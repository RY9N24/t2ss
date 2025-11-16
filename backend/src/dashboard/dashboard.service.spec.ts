import { of } from 'rxjs';
import { DashboardService } from './dashboard.service';
import type {
  Match,
  Map,
  MapEventAggregate,
  PlayerStats,
  RawEvent,
  StoredFile,
  GameServer,
  ServerToken,
} from '../database/entities';
import type { Repository, DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { HttpService } from '@nestjs/axios';
import type { EmergencyGcService } from './emergency-gc.service';

jest.mock('node:fs', () => ({
  promises: {
    readFile: jest.fn(async () => 'SELECT 1;'),
    access: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
  },
  createReadStream: jest.fn(() => ({ on: jest.fn(), pipe: jest.fn() })),
}));

function createQueryBuilder<T>(options: {
  getMany?: () => Promise<T[]>;
  getManyAndCount?: () => Promise<[T[], number]>;
}) {
  const builder: any = {
    leftJoinAndSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    addOrderBy: jest.fn(() => builder),
    take: jest.fn(() => builder),
    skip: jest.fn(() => builder),
    getMany: jest.fn(options.getMany ?? (async () => [])),
    getManyAndCount: jest.fn(options.getManyAndCount ?? (async () => [[], 0] as [T[], number])),
  };
  return builder;
}

describe('DashboardService (unit)', () => {
  let service: DashboardService;
  let matchesRepo: jest.Mocked<Repository<Match>>;
  let aggregatesRepo: jest.Mocked<Repository<MapEventAggregate>>;
  let statsRepo: jest.Mocked<Repository<PlayerStats>>;
  let rawRepo: jest.Mocked<Repository<RawEvent>>;
  let filesRepo: jest.Mocked<Repository<StoredFile>>;
  let serversRepo: jest.Mocked<Repository<GameServer>>;
  let tokensRepo: jest.Mocked<Repository<ServerToken>>;
  let auditRepo: jest.Mocked<Repository<any>>;
  let dataSource: jest.Mocked<DataSource>;
  let config: jest.Mocked<ConfigService>;
  let http: jest.Mocked<HttpService>;
  let emergencyGc: jest.Mocked<EmergencyGcService>;
  const now = new Date('2024-01-02T12:00:00Z');

  const liveMatch: Partial<Match> & { id: string; maps: Partial<Map>[] } = {
    id: 'live-1',
    title: 'Semi-final',
    status: 'live',
    tournament: { name: 'LAN Finals' } as any,
    homeTeam: { id: 'team-a', name: 'Team Alpha' } as any,
    awayTeam: { id: 'team-b', name: 'Team Bravo' } as any,
    maps: [
      { id: 'map-1', mapNumber: 0, name: 'de_inferno', status: 'live', team1Score: 5, team2Score: 3, startedAt: new Date() } as any,
    ],
  };

  const completedMatch: Partial<Match> & { id: string; maps: Partial<Map>[] } = {
    id: 'match-1',
    title: 'Grand Final',
    status: 'completed',
    tournament: { name: 'LAN Finals' } as any,
    homeTeam: { id: 'team-a', name: 'Team Alpha' } as any,
    awayTeam: { id: 'team-b', name: 'Team Bravo' } as any,
    team1Score: 16,
    team2Score: 12,
    winnerTeamId: 'team-a',
    startedAt: new Date('2024-01-02T11:00:00Z'),
    completedAt: new Date('2024-01-02T12:00:00Z'),
    maps: [
      {
        id: 'map-final',
        mapNumber: 0,
        name: 'de_mirage',
        status: 'completed',
        team1Score: 16,
        team2Score: 12,
        winnerTeamId: 'team-a',
      } as any,
    ],
  };

  beforeEach(() => {
    matchesRepo = {
      createQueryBuilder: jest.fn()
    } as unknown as jest.Mocked<Repository<Match>>;
    aggregatesRepo = { createQueryBuilder: jest.fn(() => ({ where: jest.fn(() => ({ getMany: jest.fn(async () => [{ matchId: liveMatch.id, eventType: 'player_kill', count: 7 } as any ]) })) })) } as unknown as jest.Mocked<Repository<MapEventAggregate>>;
    statsRepo = { find: jest.fn(async () => [{ matchId: completedMatch.id, playerId: 'player-1', player: { nickname: 'Ace' }, teamId: 'team-a', kills: 20, deaths: 10, assists: 5, damage: 2500 } as any]) } as unknown as jest.Mocked<Repository<PlayerStats>>;
    rawRepo = { find: jest.fn(async () => [{ id: 'event-1', createdAt: new Date('2024-01-02T11:05:00Z'), subject: 'round_end', payload: { winner: 'team-a' } } as any]) } as unknown as jest.Mocked<Repository<RawEvent>>;
    const matchFiles = [
      {
        id: 'file-1',
        originalFilename: 'demo.zip',
        storagePath: '/tmp/demo.zip',
        createdAt: new Date('2024-01-02T12:05:00Z'),
      } as StoredFile,
    ];
    const deleteTargets = [
      {
        id: 'file-delete',
        storagePath: '/tmp/demo-delete.zip',
        status: 'stored',
        isPinned: false,
        isInUse: false,
        match: { completedAt: now, id: completedMatch.id } as any,
      } as StoredFile,
      {
        id: 'file-pinned',
        storagePath: '/tmp/demo-pinned.zip',
        status: 'stored',
        isPinned: true,
        isInUse: false,
        match: { completedAt: now, id: completedMatch.id } as any,
      } as StoredFile,
    ];
    const fileListRow = {
      id: 'file-list-1',
      originalFilename: 'demo-list.zip',
      createdAt: now,
      status: 'stored',
      sizeBytes: '2048',
      isPinned: false,
      isInUse: false,
      matchzyMatchId: 'ext-123',
      matchzyMapNumber: 0,
      deletedAt: null,
      match: {
        id: completedMatch.id,
        status: 'completed',
        completedAt: now,
        title: 'Grand Final',
        tournament: { id: 'tour-1', name: 'LAN Finals' },
      } as any,
      map: { id: 'map-final', name: 'de_mirage', mapNumber: 0, matchzyMapNumber: 0 } as any,
    } as StoredFile;
    filesRepo = {
      find: jest.fn(async (options?: any) => {
        if (options?.where?.matchId) {
          return matchFiles;
        }
        if (options?.where && Object.prototype.hasOwnProperty.call(options.where, 'id')) {
          return deleteTargets;
        }
        return [];
      }),
      findOne: jest.fn(async ({ where: { id } }) => {
        if (id === 'file-reupload') {
          return {
            id,
            storagePath: '/tmp/demo-reupload.zip',
            status: 'stored',
            isPinned: false,
            isInUse: false,
            matchzyMatchId: 'ext-123',
            matchzyMapNumber: 0,
            metaHeaders: {},
            match: {
              id: completedMatch.id,
              externalId: 'ext-123',
              server: { endpoint: 'http://agent.local' },
            } as any,
            map: { id: 'map-final', matchzyMapNumber: 0, mapNumber: 0 } as any,
          } as StoredFile;
        }
        return null;
      }),
      createQueryBuilder: jest
        .fn()
        .mockImplementation(() => createQueryBuilder<StoredFile>({ getManyAndCount: async () => [[fileListRow], 1] })),
      save: jest.fn(async (file) => file as StoredFile),
    } as unknown as jest.Mocked<Repository<StoredFile>>;
    serversRepo = {
      find: jest.fn(async () => [{ id: 'server-1', name: 'Server One', endpoint: 'srv-1', isActive: true, tokens: [] } as any]),
      findOne: jest.fn(async ({ where: { id, endpoint } }) => {
        if (id === 'server-1' || endpoint === 'srv-1') {
          return { id: 'server-1', name: 'Server One', endpoint: 'srv-1', isActive: true } as any;
        }
        return null;
      }),
      save: jest.fn(async (server) => server as any),
      create: jest.fn((payload) => payload as any),
    } as unknown as jest.Mocked<Repository<GameServer>>;
    tokensRepo = {
      create: jest.fn((payload) => payload as any),
      save: jest.fn(async (token) => ({ ...token, id: token.id ?? 'token-1' } as any)),
      findOne: jest.fn(async ({ where: { id } }) => ({ id, serverId: 'server-1' } as any)),
    } as unknown as jest.Mocked<Repository<ServerToken>>;
    auditRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async () => ({} as any)),
    } as unknown as jest.Mocked<Repository<any>>;
    dataSource = {
      query: jest.fn(async (sql) => {
        if (typeof sql === 'string' && sql.includes('pg_database_size')) {
          return [{ size: 1024 }];
        }
        return [];
      }),
    } as unknown as jest.Mocked<DataSource>;
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'ALLOW_DB_DROP') return 'true';
        if (key === 'JSZ_MONITOR_URL') return 'http://nats:8222/jsz?state=summary';
        if (key === 'DEMO_REUPLOAD_INGEST_URL') return 'http://api.local/ingest/demo';
        if (key === 'DEMO_REUPLOAD_AGENT_PATH') return '/agent/reupload';
        if (key === 'DEMO_REUPLOAD_API_KEY') return 'secret';
        return fallback;
      }),
    } as unknown as jest.Mocked<ConfigService>;
    http = {
      get: jest.fn(() => of({ data: { streams: [{ name: 'MATCHZY.EVENTS', state: { messages: 42 } }] } })),
      post: jest.fn(() => of({ data: {} })),
    } as unknown as jest.Mocked<HttpService>;

    const sharedBuilder = createQueryBuilder<Match>({
      getMany: async () => [liveMatch as Match],
      getManyAndCount: async () => [[completedMatch as Match], 1],
    });
    matchesRepo.createQueryBuilder = jest.fn(() => sharedBuilder) as any;
    matchesRepo.findOne = jest.fn(async ({ where: { id } }) => {
      if (id === completedMatch.id) {
        return completedMatch as Match;
      }
      return null;
    }) as any;

    emergencyGc = {
      getDiskStats: jest.fn(async () => ({ totalBytes: 1000, usedBytes: 500, availableBytes: 500, usagePercent: 50 })),
      getSettings: jest.fn(async () => ({ enabled: false, graceMinutes: 30, notifyPanel: true, notifyBot: false, lastRun: null })),
      updateSettings: jest.fn(async () => ({ enabled: true, graceMinutes: 20, notifyPanel: true, notifyBot: false, lastRun: null })),
      triggerManualRun: jest.fn(async () => ({ ran: false, deleted: [], finalUsagePercent: 50, reason: 'disabled', trigger: 'manual' })),
    } as unknown as jest.Mocked<EmergencyGcService>;

    service = new DashboardService(
      matchesRepo,
      {} as any,
      {} as any,
      {} as any,
      statsRepo,
      {} as any,
      aggregatesRepo,
      rawRepo,
      filesRepo,
      serversRepo,
      tokensRepo,
      auditRepo,
      dataSource,
      config,
      http,
      emergencyGc,
    );
  });

  it('maps live matches with event counters', async () => {
    const live = await service.getLiveMatches();
    expect(live).toHaveLength(1);
    expect(live[0].eventCounts['player_kill']).toBe(7);
    expect(matchesRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('returns history rows and CSV export', async () => {
    const history = await service.getHistory({ limit: 10 });
    expect(history.total).toBe(1);
    expect(history.results[0].team1Score).toBe(16);
    const csv = await service.exportHistoryCsv({});
    expect(csv).toContain('Grand Final');
    expect(csv).toContain('16-12');
  });

  it('builds match detail snapshot', async () => {
    const detail = await service.getMatchDetail(completedMatch.id);
    expect(detail.players[0].kills).toBe(20);
    expect(detail.demoFiles[0].originalFilename).toBe('demo.zip');
  });

  it('manages server tokens with audit logging', async () => {
    const server = await service.registerServer({ name: 'Srv', endpoint: 'srv-new' });
    expect(server.endpoint).toBe('srv-new');
    const { plaintext, token } = await service.createServerToken('server-1', 'primary');
    expect(typeof plaintext).toBe('string');
    expect(token.revokedAt).toBeUndefined();
    await service.revokeServerToken(token.id ?? 'token-1');
    expect(tokensRepo.save).toHaveBeenCalled();
    await service.truncateTournamentData('DELETE');
    expect(auditRepo.save).toHaveBeenCalled();
  });

  it('lists demos with derived flags and filters', async () => {
    const list = await service.listDemoFiles({ status: 'stored' });
    expect(list.total).toBe(1);
    expect(list.results[0].canDelete).toBe(true);
    expect(list.results[0].sizeBytes).toBe(2048);
  });

  it('deletes demos while skipping pinned ones', async () => {
    const result = await service.deleteDemoFiles(['file-delete', 'file-pinned', 'missing']);
    expect(result.deleted).toEqual(['file-delete']);
    expect(result.skipped.find((row) => row.id === 'file-pinned')?.reason).toBe('pinned');
    expect(result.skipped.find((row) => row.id === 'missing')?.reason).toBe('not_found');
  });

  it('requests demo reupload through agent', async () => {
    await service.requestDemoReupload('file-reupload');
    expect(http.post).toHaveBeenCalled();
    expect(filesRepo.save).toHaveBeenCalled();
  });

  it('proxies emergency GC settings and manual triggers', async () => {
    await service.getDiskStats();
    expect(emergencyGc.getDiskStats).toHaveBeenCalled();
    await service.getEmergencyGcSettings();
    expect(emergencyGc.getSettings).toHaveBeenCalled();
    await service.updateEmergencyGcSettings({ enabled: true });
    expect(emergencyGc.updateSettings).toHaveBeenCalledWith({ enabled: true });
    await service.triggerEmergencyGc(true);
    expect(emergencyGc.triggerManualRun).toHaveBeenCalledWith(true);
  });
});
