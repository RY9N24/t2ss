import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CsvFinalizer, FinalizerStore, MapResultUpdate, SeriesResultUpdate, parseMatchzyCsv } from '../finalizer';
import { WorkerConfig } from '../config';
import { RawEventRecord } from '../types';

class InMemoryStore implements FinalizerStore {
  public mapUpdates: MapResultUpdate[] = [];
  public seriesUpdates: SeriesResultUpdate[] = [];
  public closed = false;

  async applyMapResultUpdate(update: MapResultUpdate): Promise<void> {
    this.mapUpdates.push(update);
  }

  async applySeriesResult(update: SeriesResultUpdate): Promise<void> {
    this.seriesUpdates.push(update);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function createConfig(statsPath: string): WorkerConfig {
  return {
    natsUrl: 'nats://example:4222',
    natsSubject: 'matchzy.events.raw',
    durableName: 'test-durable',
    databaseUrl: 'postgres://user:pass@localhost:5432/db',
    logLevel: 'silent',
    matchzyStatsPath: statsPath,
  };
}

describe('parseMatchzyCsv', () => {
  it('parses numeric fields and captures unknown columns', () => {
    const csv = [
      'MatchId,MapNumber,SteamId64,Team,Name,Kills,Deaths,Assists,Damage,Enemy5Ks,UnknownColumn',
      '12,1,76561198000000000,Team Alpha,PlayerOne,20,10,5,2500,1,extra',
    ].join('\n');

    const parsed = parseMatchzyCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    const row = parsed.rows[0];
    expect(row.matchId).toBe('12');
    expect(row.mapNumber).toBe(1);
    expect(row.steamId64).toBe('76561198000000000');
    expect(row.team).toBe('Team Alpha');
    expect(row.kills).toBe(20);
    expect(row.damage).toBe(2500);
    expect(parsed.unknownColumns).toEqual(['unknowncolumn']);
  });
});

describe('CsvFinalizer', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matchzy-finalizer-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads CSV data and forwards map_result updates to the store', async () => {
    const csvPath = path.join(tmpDir, 'match_data_map1_42.csv');
    const csvContent = [
      'MatchId,MapNumber,SteamId64,Team,Name,Kills,Deaths,Assists,Damage,Enemy5Ks,Enemy4Ks,Enemy3Ks,Enemy2Ks,Utility_Count,Utility_Damage,Utility_Successes,Utility_Enemies,Flash_Count,Flash_Successes,Health_Points_Removed_Total,Health_Points_Dealt_Total,Shots_Fired_Total,Shots_On_Target_Total,V1_Count,V1_Wins,V2_Count,V2_Wins,Entry_Count,Entry_Wins,Equipment_Value,Money_Saved,Kill_Reward,Live_Time,Head_Shot_Kills,Cash_Earned,Enemies_Flashed',
      '42,1,76561198000000000,Team Alpha,PlayerOne,25,14,7,2800,0,1,3,6,2,180,3,4,9,3,1100,900,300,150,2,1,0,0,5,2,5000,1200,800,120,8,4000,6',
    ].join('\n');
    await fs.writeFile(csvPath, csvContent, 'utf8');

    const store = new InMemoryStore();
    const finalizer = new CsvFinalizer(
      createConfig(tmpDir),
      store,
    );

    const record: RawEventRecord = {
      subject: 'matchzy.events.raw',
      headers: {},
      idempotencyKey: 'abc',
      sequence: 1,
      metadata: {
        serverId: 'srv',
        matchId: '42',
        mapNumber: 1,
        eventType: 'map_result',
        eventTimestamp: '2024-03-10T12:00:00Z',
        payloadSubset: {},
      },
      payload: {
        body: {
          event: 'map_result',
          matchid: 42,
          map_number: 1,
          team1: { name: 'Team Alpha', score: 16, series_score: 1, id: 'alpha' },
          team2: { name: 'Team Beta', score: 9, series_score: 0, id: 'beta' },
          winner: { team: 'team1' },
        },
      },
    };

    await finalizer.handle(record);
    await finalizer.close();

    expect(store.mapUpdates).toHaveLength(1);
    const update = store.mapUpdates[0];
    expect(update.matchId).toBe('42');
    expect(update.mapNumber).toBe(1);
    expect(update.rows).toHaveLength(1);
    expect(update.rows[0].kills).toBe(25);
    expect(update.team1.name).toBe('Team Alpha');
    expect(store.seriesUpdates).toHaveLength(0);
    expect(store.closed).toBe(true);
  });

  it('forwards series_end updates', async () => {
    const store = new InMemoryStore();
    const finalizer = new CsvFinalizer(createConfig(tmpDir), store);

    const record: RawEventRecord = {
      subject: 'matchzy.events.raw',
      headers: {},
      idempotencyKey: 'series',
      sequence: 2,
      metadata: {
        serverId: 'srv',
        matchId: '42',
        mapNumber: 1,
        eventType: 'series_end',
        eventTimestamp: '2024-03-10T12:05:00Z',
        payloadSubset: {},
      },
      payload: {
        body: {
          event: 'series_end',
          matchid: 42,
          team1_series_score: 2,
          team2_series_score: 1,
          winner: { team: 'team1' },
        },
      },
    };

    await finalizer.handle(record);
    await finalizer.close();

    expect(store.seriesUpdates).toHaveLength(1);
    expect(store.seriesUpdates[0].team1SeriesScore).toBe(2);
  });
});
