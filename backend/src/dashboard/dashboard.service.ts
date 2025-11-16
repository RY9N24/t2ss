import { Injectable, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository, DataSource, In, EntityManager } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { randomBytes, createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  AuditLogEntry,
  BotSubscription,
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
import { EmergencyGcService, DiskStats, EmergencyGcSettings, EmergencyGcRunResult } from './emergency-gc.service';
import {
  DataTransferService,
  TournamentSnapshot,
  SnapshotTable,
  SNAPSHOT_TABLE_ORDER,
  SNAPSHOT_TABLES,
  SnapshotValue,
} from './data-transfer.service';
import { BackupService } from './backup.service';

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

interface DemoFilters {
  tournamentId?: string;
  status?: string;
  pinned?: boolean;
  inUse?: boolean;
  from?: Date;
  to?: Date;
  minSize?: number;
  maxSize?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

interface DemoListItem {
  id: string;
  originalFilename: string | null;
  uploadedAt: Date;
  status: string;
  sizeBytes: number | null;
  isPinned: boolean;
  isInUse: boolean;
  effectiveInUse: boolean;
  matchzyMatchId: string | null;
  matchzyMapNumber: number | null;
  downloadable: boolean;
  canDelete: boolean;
  match?: {
    id: string;
    title: string | null;
    status: string;
    completedAt: Date | null;
    tournament?: { id: string; name: string | null } | null;
  } | null;
  map?: { id: string; name: string; mapNumber: number | null; matchzyMapNumber: number | null } | null;
}

interface ImportTableSummary {
  total: number;
  inserts: number;
  updates: number;
}

type ImportSummary = Record<SnapshotTable, ImportTableSummary>;

type ExportFormat = 'csv' | 'xlsx' | 'sqlite';

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
    @InjectRepository(BotSubscription)
    private readonly subscriptionsRepo: Repository<BotSubscription>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly emergencyGc: EmergencyGcService,
    private readonly dataTransfer: DataTransferService,
    private readonly backups: BackupService,
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

  async listTournaments(): Promise<Array<{ id: string; name: string | null; slug: string }>> {
    const tournaments = await this.tournamentsRepo.find({
      select: { id: true, name: true, slug: true },
      order: { createdAt: 'DESC' },
    });
    return tournaments.map((tournament) => ({
      id: tournament.id,
      name: tournament.name ?? null,
      slug: tournament.slug,
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
    return this.emergencyGc.getDiskStats();
  }

  async getEmergencyGcSettings(): Promise<EmergencyGcSettings> {
    return this.emergencyGc.getSettings();
  }

  async updateEmergencyGcSettings(
    patch: Partial<Pick<EmergencyGcSettings, 'enabled' | 'graceMinutes' | 'notifyPanel' | 'notifyBot'>>,
  ): Promise<EmergencyGcSettings> {
    return this.emergencyGc.updateSettings(patch);
  }

  async triggerEmergencyGc(force = false): Promise<EmergencyGcRunResult> {
    return this.emergencyGc.triggerManualRun(force);
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

  async getDemoFilterOptions(): Promise<{ statuses: string[]; tournaments: Array<{ id: string; name: string | null }> }> {
    const tournaments = await this.tournamentsRepo.find({ select: { id: true, name: true }, order: { name: 'ASC' } });
    return {
      statuses: ['stored', 'reuploading', 'missing', 'deleted'],
      tournaments: tournaments.map((tournament) => ({ id: tournament.id, name: tournament.name ?? null })),
    };
  }

  async listDemoFiles(filters: DemoFilters): Promise<{ total: number; results: DemoListItem[] }> {
    const driverType = (this.dataSource?.options?.type ?? '').toString();
    if (driverType === 'sqlite' || driverType === 'better-sqlite3') {
      return this.listDemoFilesInMemory(filters);
    }
    const qb = this.filesRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.match', 'match')
      .leftJoinAndSelect('match.tournament', 'tournament')
      .leftJoinAndSelect('file.map', 'map')
      .orderBy('file.created_at', 'DESC');

    if (filters.tournamentId) {
      qb.andWhere('match.tournament_id = :tournamentId', { tournamentId: filters.tournamentId });
    }
    if (filters.status) {
      qb.andWhere('file.status = :status', { status: filters.status });
    }
    if (filters.pinned !== undefined) {
      qb.andWhere('file.is_pinned = :pinned', { pinned: filters.pinned });
    }
    if (filters.inUse !== undefined) {
      qb.andWhere('file.is_in_use = :inUse', { inUse: filters.inUse });
    }
    if (filters.from) {
      qb.andWhere('file.created_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('file.created_at <= :to', { to: filters.to });
    }
    if (filters.minSize !== undefined) {
      qb.andWhere('file.size_bytes::bigint >= :minSize', { minSize: filters.minSize });
    }
    if (filters.maxSize !== undefined) {
      qb.andWhere('file.size_bytes::bigint <= :maxSize', { maxSize: filters.maxSize });
    }
    if (filters.search) {
      qb.andWhere(
        '(file.original_filename ILIKE :search OR file.matchzy_match_id ILIKE :search OR match.title ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    qb.take(limit);
    qb.skip(offset);

    const [rows, total] = await qb.getManyAndCount();
    const results: DemoListItem[] = rows.map((file) => {
      const match = file.match ?? null;
      const map = file.map ?? null;
      const sizeBytes = file.sizeBytes ? Number(file.sizeBytes) : null;
      const effectiveInUse = file.isInUse || (match ? !match.completedAt : false);
      const downloadable = file.status === 'stored' && !file.deletedAt;
      return {
        id: file.id,
        originalFilename: file.originalFilename ?? null,
        uploadedAt: file.createdAt,
        status: file.status,
        sizeBytes,
        isPinned: file.isPinned,
        isInUse: file.isInUse,
        effectiveInUse,
        matchzyMatchId: file.matchzyMatchId ?? null,
        matchzyMapNumber: file.matchzyMapNumber ?? null,
        downloadable,
        canDelete: downloadable && !file.isPinned && !effectiveInUse,
        match: match
          ? {
              id: match.id,
              title: match.title ?? null,
              status: match.status,
              completedAt: match.completedAt ?? null,
              tournament: match.tournament
                ? { id: match.tournament.id, name: match.tournament.name ?? null }
                : null,
            }
          : null,
        map: map
          ? {
              id: map.id,
              name: map.name,
              mapNumber: map.mapNumber ?? null,
              matchzyMapNumber: map.matchzyMapNumber ?? null,
            }
          : null,
      };
    });

    return { total, results };
  }

  private async listDemoFilesInMemory(filters: DemoFilters): Promise<{ total: number; results: DemoListItem[] }> {
    const rows = await this.filesRepo.find({
      relations: { match: { tournament: true }, map: true },
      order: { createdAt: 'DESC' },
    });
    const matchesFilter = (file: StoredFile) => {
      if (filters.tournamentId && file.match?.tournament?.id !== filters.tournamentId) {
        return false;
      }
      if (filters.status && file.status !== filters.status) {
        return false;
      }
      if (filters.pinned !== undefined && file.isPinned !== filters.pinned) {
        return false;
      }
      const effectiveInUse = file.isInUse || (file.match ? !file.match.completedAt : false);
      if (filters.inUse !== undefined && effectiveInUse !== filters.inUse) {
        return false;
      }
      if (filters.from && file.createdAt < filters.from) {
        return false;
      }
      if (filters.to && file.createdAt > filters.to) {
        return false;
      }
      const sizeBytes = file.sizeBytes ? Number(file.sizeBytes) : undefined;
      if (filters.minSize !== undefined && (sizeBytes ?? 0) < filters.minSize) {
        return false;
      }
      if (filters.maxSize !== undefined && (sizeBytes ?? 0) > filters.maxSize) {
        return false;
      }
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const haystack = [file.originalFilename, file.matchzyMatchId, file.match?.title].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    };
    const filtered = rows.filter(matchesFilter);
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    const paged = filtered.slice(offset, offset + limit);
    const results = paged.map((file) => {
      const match = file.match ?? null;
      const map = file.map ?? null;
      const sizeBytes = file.sizeBytes ? Number(file.sizeBytes) : null;
      const effectiveInUse = file.isInUse || (match ? !match.completedAt : false);
      const downloadable = file.status === 'stored' && !file.deletedAt;
      return {
        id: file.id,
        originalFilename: file.originalFilename ?? null,
        uploadedAt: file.createdAt,
        status: file.status,
        sizeBytes,
        isPinned: file.isPinned,
        isInUse: file.isInUse,
        effectiveInUse,
        matchzyMatchId: file.matchzyMatchId ?? null,
        matchzyMapNumber: file.matchzyMapNumber ?? null,
        downloadable,
        canDelete: downloadable && !file.isPinned && !effectiveInUse,
        match: match
          ? {
              id: match.id,
              title: match.title ?? null,
              status: match.status,
              completedAt: match.completedAt ?? null,
              tournament: match.tournament
                ? { id: match.tournament.id, name: match.tournament.name ?? null }
                : null,
            }
          : null,
        map: map
          ? { id: map.id, name: map.name, mapNumber: map.mapNumber ?? null, matchzyMapNumber: map.matchzyMapNumber ?? null }
          : null,
      };
    });
    return { total: filtered.length, results };
  }

  async getDemoDownloadStream(fileId: string): Promise<{ stream: NodeJS.ReadableStream; filename: string; contentType: string | null }> {
    const file = await this.filesRepo.findOne({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('Demo not found');
    }
    if (file.status !== 'stored' || file.deletedAt) {
      throw new BadRequestException('Demo is not available for download');
    }
    try {
      await fs.access(file.storagePath);
    } catch {
      file.status = 'missing';
      await this.filesRepo.save(file);
      throw new NotFoundException('Stored file is missing on disk');
    }
    const filename = file.originalFilename ?? `demo-${file.id}.zip`;
    return { stream: createReadStream(file.storagePath), filename, contentType: file.contentType ?? 'application/octet-stream' };
  }

  async deleteDemoFiles(ids: string[]): Promise<{ deleted: string[]; skipped: Array<{ id: string; reason: string }> }> {
    if (!ids.length) {
      throw new BadRequestException('No demo identifiers provided');
    }
    const files = await this.filesRepo.find({
      where: { id: In(ids) },
      relations: { match: true },
      order: { createdAt: 'DESC' },
    });
    const deleted: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const foundIds = new Set(files.map((file) => file.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        skipped.push({ id, reason: 'not_found' });
      }
    }

    for (const file of files) {
      const effectiveInUse = file.isInUse || (file.match ? !file.match.completedAt : false);
      if (file.isPinned) {
        skipped.push({ id: file.id, reason: 'pinned' });
        continue;
      }
      if (effectiveInUse) {
        skipped.push({ id: file.id, reason: 'in_use' });
        continue;
      }
      if (file.status !== 'stored') {
        skipped.push({ id: file.id, reason: `status_${file.status}` });
        continue;
      }
      try {
        await fs.unlink(file.storagePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      file.status = 'deleted';
      file.deletedAt = new Date();
      file.isInUse = false;
      await this.filesRepo.save(file);
      deleted.push(file.id);
      await this.auditRepo.save(
        this.auditRepo.create({
          category: 'demos',
          action: 'delete',
          entityType: 'file',
          entityId: file.id,
          metadata: { storage_path: file.storagePath },
        }),
      );
    }

    return { deleted, skipped };
  }

  async requestDemoReupload(fileId: string): Promise<{ queued: boolean }> {
    const file = await this.filesRepo.findOne({
      where: { id: fileId },
      relations: { match: { server: true }, map: true },
    });
    if (!file) {
      throw new NotFoundException('Demo not found');
    }
    const match = file.match;
    if (!match || !match.server || !match.server.endpoint) {
      throw new BadRequestException('Demo is not linked to a server agent');
    }
    const ingestUrl = this.config.get<string>('DEMO_REUPLOAD_INGEST_URL');
    if (!ingestUrl) {
      throw new BadRequestException('DEMO_REUPLOAD_INGEST_URL is not configured');
    }
    const matchIdentifier = file.matchzyMatchId ?? match.externalId;
    if (!matchIdentifier) {
      throw new BadRequestException('Demo is missing MatchZy match metadata');
    }
    const mapNumber =
      file.matchzyMapNumber ?? file.map?.matchzyMapNumber ?? file.map?.mapNumber ?? null;
    const agentPath = this.config.get<string>('DEMO_REUPLOAD_AGENT_PATH', '/agent/reupload');
    const targetUrl = this.resolveAgentUrl(match.server.endpoint, agentPath);
    const payload = {
      match_id: matchIdentifier,
      map_number: mapNumber,
      ingest_url: ingestUrl,
      meta_headers: file.metaHeaders,
    };
    const headers: Record<string, string> = {};
    const apiKey = this.config.get<string>('DEMO_REUPLOAD_API_KEY');
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    try {
      await firstValueFrom(this.http.post(targetUrl, payload, { headers }));
    } catch (error) {
      this.logger.error({ error: (error as Error).message, targetUrl }, 'Reupload agent request failed');
      throw new BadRequestException('Failed to contact server agent for reupload');
    }
    file.status = 'reuploading';
    file.isInUse = true;
    await this.filesRepo.save(file);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'demos',
        action: 'reupload',
        entityType: 'file',
        entityId: file.id,
        metadata: { target_url: targetUrl, match_id: matchIdentifier, map_number: mapNumber },
      }),
    );
    return { queued: true };
  }

  async updateDemoFlags(
    fileId: string,
    patch: { isPinned?: boolean; isInUse?: boolean },
  ): Promise<{ id: string; isPinned: boolean; isInUse: boolean }> {
    const file = await this.filesRepo.findOne({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('Demo not found');
    }
    if (typeof patch.isPinned === 'boolean') {
      file.isPinned = patch.isPinned;
    }
    if (typeof patch.isInUse === 'boolean') {
      file.isInUse = patch.isInUse;
    }
    await this.filesRepo.save(file);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'demos',
        action: 'update_flags',
        entityType: 'file',
        entityId: file.id,
        metadata: { isPinned: file.isPinned, isInUse: file.isInUse },
      }),
    );
    return { id: file.id, isPinned: file.isPinned, isInUse: file.isInUse };
  }

  async exportTournamentSnapshot(
    tournamentId: string,
    format: ExportFormat,
  ): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
    const snapshot = await this.buildTournamentSnapshot(tournamentId);
    const tournamentRow = snapshot.tournaments[0];
    const slug = (tournamentRow?.slug as string | undefined) ?? tournamentId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename: string;
    let mimeType: string;
    let buffer: Buffer;
    if (format === 'csv') {
      filename = `${slug}-${timestamp}.csv.zip`;
      mimeType = 'application/zip';
      buffer = await this.dataTransfer.toCsvArchive(snapshot);
    } else if (format === 'xlsx') {
      filename = `${slug}-${timestamp}.xlsx`;
      mimeType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      buffer = Buffer.from(await this.dataTransfer.toXlsx(snapshot));
    } else {
      filename = `${slug}-${timestamp}.sqlite`;
      mimeType = 'application/octet-stream';
      buffer = await this.dataTransfer.toSqlite(snapshot);
    }
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'exports',
        action: 'tournament_snapshot',
        entityType: 'tournament',
        entityId: tournamentId,
        metadata: {
          format,
          tables: SNAPSHOT_TABLE_ORDER.reduce<Record<string, number>>(
            (acc, table) => {
              acc[table] = snapshot[table].length;
              return acc;
            },
            {},
          ),
        },
      }),
    );
    return { filename, mimeType, buffer };
  }

  async importTournamentFromCsv(
    buffer: Buffer,
    apply: boolean,
  ): Promise<{ dryRun: boolean; applied: boolean; tables: ImportSummary }> {
    const snapshot = await this.dataTransfer.fromCsvArchive(buffer);
    return this.applySnapshot(snapshot, apply, 'csv');
  }

  async importTournamentFromSqlite(
    buffer: Buffer,
    apply: boolean,
  ): Promise<{ dryRun: boolean; applied: boolean; tables: ImportSummary }> {
    const snapshot = await this.dataTransfer.fromSqlite(buffer);
    return this.applySnapshot(snapshot, apply, 'sqlite');
  }

  async createDatabaseBackup(): Promise<{ filename: string; buffer: Buffer }> {
    const archive = await this.backups.createArchive();
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'backup',
        action: 'pg_dump',
        metadata: { filename: archive.filename, sizeBytes: archive.buffer.length },
      }),
    );
    return archive;
  }

  async restoreDatabaseBackup(
    buffer: Buffer,
    apply: boolean,
  ): Promise<
    | { dryRun: true; items: string[] }
    | { dryRun: false; restored: boolean; output: string }
  > {
    if (!apply) {
      const dryRun = await this.backups.dryRunRestore(buffer);
      await this.auditRepo.save(
        this.auditRepo.create({
          category: 'backup',
          action: 'pg_restore_dry_run',
          metadata: { entries: dryRun.items.length },
        }),
      );
      return dryRun;
    }
    const result = await this.backups.restore(buffer);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'backup',
        action: 'pg_restore_apply',
        metadata: { output: result.output },
      }),
    );
    return { dryRun: false, restored: true, output: result.output };
  }

  private async buildTournamentSnapshot(tournamentId: string): Promise<TournamentSnapshot> {
    const tournament = await this.tournamentsRepo.findOne({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    const teams = await this.teamsRepo.find({ where: { tournamentId } });
    const players = await this.playersRepo.find({ where: { tournamentId } });
    const matches = await this.matchesRepo.find({ where: { tournamentId } });
    const matchIds = matches.map((match) => match.id);
    const maps = matchIds.length
      ? await this.mapsRepo.find({ where: { matchId: In(matchIds) } })
      : [];
    const mapIds = maps.map((map) => map.id);
    const stats = mapIds.length
      ? await this.statsRepo.find({ where: { mapId: In(mapIds) } })
      : [];
    const fileWhere: Array<Partial<StoredFile>> = [];
    if (matchIds.length) {
      fileWhere.push({ matchId: In(matchIds) as any });
    }
    if (mapIds.length) {
      fileWhere.push({ mapId: In(mapIds) as any });
    }
    const files = fileWhere.length
      ? await this.filesRepo.find({ where: fileWhere as any })
      : [];
    const events = matchIds.length
      ? await this.rawEventsRepo.find({ where: { matchId: In(matchIds) } })
      : [];
    const subscriptions = await this.subscriptionsRepo.find({ where: { tournamentId } });
    return {
      tournaments: [this.mapEntityToSnapshotRow('tournaments', tournament)],
      teams: teams.map((team) => this.mapEntityToSnapshotRow('teams', team)),
      players: players.map((player) => this.mapEntityToSnapshotRow('players', player)),
      matches: matches.map((match) => this.mapEntityToSnapshotRow('matches', match)),
      maps: maps.map((map) => this.mapEntityToSnapshotRow('maps', map)),
      player_stats: stats.map((stat) => this.mapEntityToSnapshotRow('player_stats', stat)),
      files: files.map((file) => this.mapEntityToSnapshotRow('files', file)),
      events_raw: events.map((event) => this.mapEntityToSnapshotRow('events_raw', event)),
      bot_subscriptions: subscriptions.map((sub) =>
        this.mapEntityToSnapshotRow('bot_subscriptions', sub),
      ),
    };
  }

  private async applySnapshot(
    snapshot: TournamentSnapshot,
    apply: boolean,
    source: 'csv' | 'sqlite',
  ): Promise<{ dryRun: boolean; applied: boolean; tables: ImportSummary }> {
    const summary = await this.computeImportSummaries(snapshot);
    const tournamentId = snapshot.tournaments[0]?.id as string | undefined;
    if (!apply) {
      return { dryRun: true, applied: false, tables: summary };
    }
    await this.persistSnapshot(snapshot);
    await this.auditRepo.save(
      this.auditRepo.create({
        category: 'imports',
        action: 'tournament_snapshot',
        entityType: 'tournament',
        entityId: tournamentId ?? null,
        metadata: { source, summary },
      }),
    );
    return { dryRun: false, applied: true, tables: summary };
  }

  private async computeImportSummaries(snapshot: TournamentSnapshot): Promise<ImportSummary> {
    const summary = {} as ImportSummary;
    for (const table of SNAPSHOT_TABLE_ORDER) {
      const rows = snapshot[table];
      if (!rows.length) {
        summary[table] = { total: 0, inserts: 0, updates: 0 };
        continue;
      }
      const ids = rows
        .map((row) => (row.id as string | undefined) ?? null)
        .filter((value): value is string => Boolean(value));
      let inserts = rows.length;
      if (ids.length) {
        const repo = this.getRepositoryForTable(table);
        const existing = await repo.find({
          where: { id: In(ids) } as any,
          select: { id: true } as any,
        });
        const existingIds = new Set(existing.map((entity) => (entity as { id: string }).id));
        inserts = rows.filter((row) => !existingIds.has(row.id as string)).length;
      }
      summary[table] = { total: rows.length, inserts, updates: rows.length - inserts };
    }
    return summary;
  }

  private async persistSnapshot(snapshot: TournamentSnapshot): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      for (const table of SNAPSHOT_TABLE_ORDER) {
        const rows = snapshot[table];
        if (!rows.length) {
          continue;
        }
        const repo = this.getRepositoryForTable(table, runner.manager);
        const hydrated = rows.map((row) => this.hydrateRowForPersistence(table, row));
        await repo.upsert(hydrated, ['id']);
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private mapEntityToSnapshotRow(
    table: SnapshotTable,
    entity: unknown,
  ): Record<string, SnapshotValue> {
    const columns = SNAPSHOT_TABLES[table];
    const row: Record<string, SnapshotValue> = {};
    for (const column of columns) {
      const value = (entity as Record<string, SnapshotValue>)[column.key];
      if (value === undefined || value === null) {
        row[column.key] = null;
        continue;
      }
      if (value instanceof Date) {
        row[column.key] = value.toISOString();
        continue;
      }
      row[column.key] = value;
    }
    return row;
  }

  private hydrateRowForPersistence(
    table: SnapshotTable,
    row: Record<string, SnapshotValue>,
  ): Record<string, unknown> {
    const columns = SNAPSHOT_TABLES[table];
    const hydrated: Record<string, unknown> = {};
    for (const column of columns) {
      const value = row[column.key];
      if (value === null || value === undefined || value === '') {
        hydrated[column.key] = null;
        continue;
      }
      switch (column.type) {
        case 'datetime':
          hydrated[column.key] = typeof value === 'string' ? new Date(value) : value;
          break;
        case 'number':
          hydrated[column.key] = typeof value === 'number' ? value : Number(value);
          break;
        case 'boolean':
          hydrated[column.key] = value === true || value === 'true' || value === 1;
          break;
        case 'json':
          hydrated[column.key] =
            typeof value === 'string'
              ? (() => {
                  try {
                    return JSON.parse(value);
                  } catch {
                    return null;
                  }
                })()
              : value;
          break;
        default:
          hydrated[column.key] = value;
      }
    }
    return hydrated;
  }

  private getRepositoryForTable(
    table: SnapshotTable,
    manager: EntityManager = this.dataSource.manager,
  ): Repository<any> {
    switch (table) {
      case 'tournaments':
        return manager.getRepository(Tournament);
      case 'teams':
        return manager.getRepository(Team);
      case 'players':
        return manager.getRepository(Player);
      case 'matches':
        return manager.getRepository(Match);
      case 'maps':
        return manager.getRepository(Map);
      case 'player_stats':
        return manager.getRepository(PlayerStats);
      case 'files':
        return manager.getRepository(StoredFile);
      case 'events_raw':
        return manager.getRepository(RawEvent);
      case 'bot_subscriptions':
        return manager.getRepository(BotSubscription);
      default:
        throw new Error(`Unsupported table ${table}`);
    }
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

  private resolveAgentUrl(endpoint: string, path: string): string {
    try {
      return new URL(path, endpoint).toString();
    } catch {
      const base = endpoint.startsWith('http') ? endpoint : `http://${endpoint}`;
      const normalisedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const normalisedPath = path.startsWith('/') ? path : `/${path}`;
      return `${normalisedBase}${normalisedPath}`;
    }
  }
}
