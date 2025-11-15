import { Aggregator } from '../aggregator';
import { buildIdempotencyKey, extractMetadata } from '../idempotency';
import { PersistenceAdapter, RawEventRecord } from '../types';

class InMemoryPersistence implements PersistenceAdapter {
  public inserted: string[] = [];
  public aggregateCalls: number = 0;
  public offsets: Map<string, number> = new Map();
  public heartbeats: Map<string, string> = new Map();

  async recordRawEvent(record: RawEventRecord): Promise<boolean> {
    if (this.inserted.includes(record.idempotencyKey)) {
      return false;
    }
    this.inserted.push(record.idempotencyKey);
    return true;
  }

  async incrementAggregate(record: RawEventRecord): Promise<void> {
    this.aggregateCalls += 1;
  }

  async updateOffset(record: RawEventRecord): Promise<void> {
    const key = `${record.metadata.serverId}:${record.metadata.matchId}:${record.metadata.mapNumber}`;
    this.offsets.set(key, record.sequence);
  }

  async updateServerHeartbeat(record: RawEventRecord): Promise<void> {
    this.heartbeats.set(record.metadata.serverId, record.metadata.eventTimestamp);
  }
}

function createPayload(sequence: number) {
  const body = {
    server_id: 'srv-1',
    match_id: 'match-1',
    map_no: 1,
    event_type: 'player_kill',
    event_ts: `2024-03-01T10:00:0${sequence}Z`,
    payload: {
      player_id: 'player-1',
      victim_id: 'player-2',
      weapon: 'ak47',
    },
  };

  const metadata = extractMetadata({ body });
  const idempotencyKey = buildIdempotencyKey(metadata);
  return {
    buffer: Buffer.from(JSON.stringify({ body })),
    metadata,
    idempotencyKey,
  };
}

describe('Aggregator idempotency', () => {
  it('skips duplicate deliveries', async () => {
    const persistence = new InMemoryPersistence();
    const aggregator = new Aggregator(persistence);
    const { buffer } = createPayload(1);

    const first = await aggregator.process('matchzy.events.raw', buffer, {}, 1);
    const second = await aggregator.process('matchzy.events.raw', buffer, {}, 2);

    expect(first).toBe('processed');
    expect(second).toBe('duplicate');
    expect(persistence.aggregateCalls).toBe(1);
    expect(persistence.offsets.get('srv-1:match-1:1')).toBe(2);
    expect(persistence.heartbeats.get('srv-1')).toBe('2024-03-01T10:00:01Z');
  });
});
