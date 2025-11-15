import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository, DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  AuditLogEntry,
  GameServer,
  Map,
  MapEventAggregate,
  Match,
  Player,
  PlayerStats,
  RawEvent,
  ServerToken,
  StoredFile,
  Team,
  Tournament,
} from '../database/entities';

const execFileAsync = promisify(execFile);

interface LiveMatchView {
  id: string;
  externalId: string | null;
  title: string | null;
  tournament: string | null;
  status: string;
  startedAt: Date | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  aggregateScore: { team1: number; team2: number };
  mapSummaries: Array<{
    id: string;
    name: string;
    mapNumber: number;
    status: string | null;
    team1Score: number;
    team2Score: number;
    startedAt: Date | null;
  }>;
  eventCounts: Record<string, number>;
}

interface HistoryFilters {
  tournamentId?: string;
  teamId?: string;
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
  search?: string;
}

interface HistoryRow {
  id: string;
  startedAt: Date | null;
  completedAt: Date | null;
  title: string | null;
  tournament: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  team1Score: number;
  team2Score: number;
  winnerTeamId: string | null;
}

interface MatchDetail extends HistoryRow {
  maps: Array<{
    id: string;
    mapNumber: number;
    name: string;
    status: string | null;
    team1Score: number;
    team2Score: number;
    winnerTeamId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
  players: Array<{
    id: string;
    name: string | null;
    teamId: string | null;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
  }>;
  timeline: Array<{
    id: string;
    occurredAt: Date;
    subject: string;
    payload: Record<string, unknown>;
  }>;
  demoFiles: Array<{
    id: string;
    originalFilename: string | null;
    storedPath: string;
    uploadedAt: Date;
  }>;
}

interface DiskStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Match) private readonly matchesRepo: Repository<Match>,
    @InjectRepository(Tournament) private readonly tournamentsRepo: Repository<Tournament>,
    @InjectRepository(Team) private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Map) private readonly mapsRepo: Repository<Map>,
    @InjectRepository(PlayerStats) private readonly statsRepo: Repository<PlayerStats>,
    @InjectRepository(Player) private readonly playersRepo: Repository<Player>,
    @InjectRepository(MapEventAggregate)
    private readonly aggregatesRepo: Repository<MapEventAggregate>,
    @InjectRepository(RawEvent) private readonly rawEventsRepo: Repository<RawEvent>,
    @InjectRepository(StoredFile) private readonly filesRepo: Repository<StoredFile>,
    @InjectRepository(GameServer) private readonly serversRepo: Repository<GameServer>,
    @InjectRepository(ServerToken) private readonly tokensRepo: Repository<ServerToken>,
    @InjectRepository(AuditLogEntry) private readonly auditRepo: Repository<AuditLogEntry>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async getLiveMatches(): Promise<LiveMatchView[]> {
    const liveMatches = await this.matchesRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.tournament', 'tournament')
      .leftJoinAndSelect('match.homeTeam', 'homeTeam')
      .leftJoinAndSelect('match.awayTeam', 'awayTeam')
      .leftJoinAndSelect('match.maps', 'maps')
      .where('match.completed_at IS NULL')
      .andWhere(
        '(match.started_at IS NOT NULL OR match.status IN (:...statuses))',
        { statuses: ['live', 'running', 'in_progress'] },
      )
      .orderBy('COALESCE(match.started_at, match.updated_at)', 'DESC')
      .addOrderBy('maps.map_number', 'ASC')
      .getMany();

    const ids = liveMatches.map((match) => match.id);
    const aggregateRows = ids.length
      ? await this.aggregatesRepo
          .createQueryBuilder('agg')
          .where('agg.match_id = ANY(:ids)', { ids })
          .getMany()
      : [];

    const eventCounts: Record<string, Record<string, number>> = {};
    for (const agg of aggregateRows) {
      if (!eventCounts[agg.matchId]) {
        eventCounts[agg.matchId] = {};
      }
      eventCounts[agg.matchId][agg.eventType] = agg.count;
    }

    return liveMatches.map((match) => ({
      id: match.id,
      externalId: match.externalId ?? null,
      title: match.title ?? null,
      tournament: match.tournament?.name ?? null,
      status: match.status,
      startedAt: match.startedAt ?? null,
      homeTeam: match.homeTeam ?? null,
      awayTeam: match.awayTeam ?? null,
      aggregateScore: {
        team1: match.maps.reduce((acc, map) => acc + map.team1Score, 0),
        team2: match.maps.reduce((acc, map) => acc + map.team2Score, 0),
      },
      mapSummaries: match.maps
        .slice()
        .sort((a, b) => a.mapNumber - b.mapNumber)
        .map((map) => ({
          id: map.id,
          name: map.name,
          mapNumber: map.mapNumber,
          status: map.status ?? null,
          team1Score: map.team1Score,
          team2Score: map.team2Score,
          startedAt: map.startedAt ?? null,
        })),
      eventCounts: eventCounts[match.id] ?? {},
    }));
  }

  async getHistory(filters: HistoryFilters): Promise<{ total: number; results: HistoryRow[] }> {
    const qb = this.matchesRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.tournament', 'tournament')
      .leftJoinAndSelect('match.homeTeam', 'homeTeam')
      .leftJoinAndSelect('match.awayTeam', 'awayTeam')
      .where('match.completed_at IS NOT NULL');

    if (filters.tournamentId) {
      qb.andWhere('match.tournament_id = :tournamentId', { tournamentId: filters.tournamentId });
    }
    if (filters.teamId) {
      qb.andWhere('(match.home_team_id = :teamId OR match.away_team_id = :teamId)', { teamId: filters.teamId });
    }
    if (filters.from) {
      qb.andWhere('match.completed_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('match.completed_at <= :to', { to: filters.to });
    }
    if (filters.search) {
      qb.andWhere(
        '(match.title ILIKE :search OR homeTeam.name ILIKE :search OR awayTeam.name ILIKE :search OR tournament.name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    qb.orderBy('match.completed_at', 'DESC');

    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = filters.offset ?? 0;

    const [results, total] = await qb.take(limit).skip(offset).getManyAndCount();

    return {
      total,
      results: results.map((match) => ({
        id: match.id,
        startedAt: match.startedAt ?? null,
        completedAt: match.completedAt ?? null,
        title: match.title ?? null,
        tournament: match.tournament?.name ?? null,
        homeTeam: match.homeTeam ?? null,
        awayTeam: match.awayTeam ?? null,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        winnerTeamId: match.winnerTeamId ?? null,
      })),
    };
  }

  async exportHistoryCsv(filters: HistoryFilters): Promise<string> {
    const { results } = await this.getHistory(filters);
    const header = 'Match Title,Tournament,Home Team,Away Team,Winner,Score,Completed At\n';
    const lines = results.map((row) => {
      const winner = row.winnerTeamId
        ? row.homeTeam?.id === row.winnerTeamId
          ? row.homeTeam?.name
          : row.awayTeam?.name
        : '';
      const score = `${row.team1Score}-${row.team2Score}`;
      const completed = row.completedAt ? row.completedAt.toISOString() : '';
      return [row.title ?? '', row.tournament ?? '', row.homeTeam?.name ?? '', row.awayTeam?.name ?? '', winner ?? '', score, completed]
        .map((value) => `"${(value ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    return header + lines.join('\n');
  }

  async getMatchDetail(id: string): Promise<MatchDetail> {
    const match = await this.matchesRepo.findOne({
      where: { id },
      relations: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
        maps: true,
      },
    });

    if (!match) {
      throw new BadRequestException('Match not found');
    }

    const stats = await this.statsRepo.find({
      where: { matchId: id },
      relations: { player: true },
    });

    const timeline = await this.rawEventsRepo.find({
      where: { matchId: id },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    const files = await this.filesRepo.find({
      where: { matchId: id },
      order: { createdAt: 'ASC' },
    });

    return {
      id: match.id,
      startedAt: match.startedAt ?? null,
      completedAt: match.completedAt ?? null,
      title: match.title ?? null,
      tournament: match.tournament?.name ?? null,
      homeTeam: match.homeTeam ?? null,
      awayTeam: match.awayTeam ?? null,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      winnerTeamId: match.winnerTeamId ?? null,
      maps: match.maps
        .slice()
        .sort((a, b) => a.mapNumber - b.mapNumber)
        .map((map) => ({
          id: map.id,
          mapNumber: map.mapNumber,
          name: map.name,
          status: map.status ?? null,
          team1Score: map.team1Score,
          team2Score: map.team2Score,
          winnerTeamId: map.winnerTeamId ?? null,
          startedAt: map.startedAt ?? null,
          completedAt: map.completedAt ?? null,
        })),
      players: stats.map((stat) => ({
        id: stat.playerId,
        name: stat.player?.nickname ?? null,
        teamId: stat.teamId ?? null,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        damage: stat.damage,
      })),
      timeline: timeline.map((event) => ({
        id: event.id,
        occurredAt: event.createdAt,
        subject: event.subject,
        payload: event.payload,
      })),
      demoFiles: files.map((file) => ({
        id: file.id,
        originalFilename: file.originalFilename ?? null,
        storedPath: file.storagePath,
        uploadedAt: file.createdAt,
      })),
    };
  }

  async registerServer(payload: { name: string; endpoint: string; location?: string | null; notes?: string | null }): Promise<GameServer> {
    const existing = await this.serversRepo.findOne({ where: { endpoint: payload.endpoint } });
    if (existing) {
      throw new BadRequestException('Server with this endpoint already exists');
    }
    const server = this.serversRepo.create({
      name: payload.name,
      endpoint: payload.endpoint,
      location: payload.location ?? null,
      notes: payload.notes ?? null,
      isActive: true,
    });
    return this.serversRepo.save(server);
  }

  async toggleServer(serverId: string, active: boolean): Promise<GameServer> {
    const server = await this.serversRepo.findOne({ where: { id: serverId } });
    if (!server) {
      throw new BadRequestException('Server not found');
    }
    server.isActive = active;
    return this.serversRepo.save(server);
  }

  async listServers(): Promise<Array<GameServer & { tokens: ServerToken[] }>> {
    return this.serversRepo.find({ relations: { tokens: true }, order: { createdAt: 'DESC' } });
  }

  async createServerToken(serverId: string, label?: string | null): Promise<{ plaintext: string; token: ServerToken }> {
    const server = await this.serversRepo.findOne({ where: { id: serverId } });
    if (!server) {
      throw new BadRequestException('Server not found');
    }
    const plaintext = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const token = this.tokensRepo.create({ serverId, tokenHash, label: label ?? null });
    await this.tokensRepo.save(token);
    return { plaintext, token };
  }

  async revokeServerToken(tokenId: string): Promise<ServerToken> {
    const token = await this.tokensRepo.findOne({ where: { id: tokenId } });
    if (!token) {
      throw new BadRequestException('Token not found');
    }
    token.revokedAt = new Date();
    return this.tokensRepo.save(token);
  }

  async getDiskStats(): Promise<DiskStats> {
    const storagePath = this.config.get<string>('DEMO_STORAGE_PATH', join(process.cwd(), 'storage/demos'));
    try {
      await fs.access(storagePath);
    } catch {
      await fs.mkdir(storagePath, { recursive: true });
    }

    const { stdout } = await execFileAsync('df', ['-Pk', storagePath]);
    const [, ...rows] = stdout.trim().split('\n');
    if (!rows.length) {
      throw new Error('Unable to determine disk usage');
    }
    const parts = rows[0].trim().split(/\s+/);
    const total = Number(parts[1]) * 1024;
    const used = Number(parts[2]) * 1024;
    const available = Number(parts[3]) * 1024;
    const usagePercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
    return { totalBytes: total, usedBytes: used, availableBytes: available, usagePercent };
  }

  async getJetStreamSummary(): Promise<Record<string, unknown>> {
    const jszUrl = this.config.get<string>('JSZ_MONITOR_URL', 'http://nats:8222/jsz?state=summary');
    const response = await firstValueFrom(this.http.get(jszUrl));
    return response.data;
  }

  async getDatabaseSize(): Promise<{ sizeBytes: number }> {
    const result = await this.dataSource.query('SELECT pg_database_size(current_database()) as size');
    return { sizeBytes: Number(result?.[0]?.size ?? 0) };
  }

  async truncateTournamentData(confirm: string): Promise<{ truncated: boolean }> {
    if (confirm !== 'DELETE') {
      throw new BadRequestException('Confirmation token mismatch');
    }
    const sqlPath = join(process.cwd(), 'scripts', 'truncate_tournament_data.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    await this.dataSource.query(sql);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'admin',
        action: 'truncate_tournament_data',
        metadata: { performed_at: new Date().toISOString() },
      }),
    );
    return { truncated: true };
  }

  async dropDatabase(confirm: string, finalConfirm: string): Promise<{ dropped: boolean }> {
    if (confirm !== 'DELETE' || finalConfirm !== 'DROP DATABASE') {
      throw new BadRequestException('Confirmation tokens mismatch');
    }
    if (this.config.get('ALLOW_DB_DROP') !== 'true') {
      throw new ForbiddenException('Database drop is disabled by configuration');
    }

    const databaseName = this.config.get<string>('POSTGRES_DB') ?? this.config.get<string>('DATABASE_URL') ?? 'matchzy';
    this.logger.warn(`Requesting database drop for ${databaseName}`);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'admin',
        action: 'drop_database',
        metadata: { requested_at: new Date().toISOString(), database: databaseName },
      }),
    );
    await this.dataSource.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database()`);
    await this.dataSource.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
    return { dropped: true };
  }
}
