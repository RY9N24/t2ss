import { Pool } from 'pg';
import { PersistenceAdapter, RawEventRecord } from './types';

export class PostgresPersistence implements PersistenceAdapter {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async recordRawEvent(record: RawEventRecord): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO events_raw (subject, idempotency_key, payload, headers, matchzy_match_id)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
          record.subject,
          record.idempotencyKey,
          JSON.stringify(record.payload),
          JSON.stringify(record.headers ?? {}),
          record.metadata.matchId || null,
        ],
      );
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  async incrementAggregate(record: RawEventRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO map_event_aggregates (server_id, match_id, map_no, event_type, count, last_event_ts, last_idempotency_key)
         VALUES ($1, $2, $3, $4, 1, $5::timestamptz, $6)
         ON CONFLICT (server_id, match_id, map_no, event_type)
         DO UPDATE SET count = map_event_aggregates.count + 1,
                       last_event_ts = GREATEST(map_event_aggregates.last_event_ts, EXCLUDED.last_event_ts),
                       last_idempotency_key = EXCLUDED.last_idempotency_key`,
        [
          record.metadata.serverId,
          record.metadata.matchId,
          record.metadata.mapNumber,
          record.metadata.eventType,
          record.metadata.eventTimestamp,
          record.idempotencyKey,
        ],
      );
    } finally {
      client.release();
    }
  }

  async updateOffset(record: RawEventRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO event_offsets (server_id, match_id, map_no, last_sequence, last_event_ts)
         VALUES ($1, $2, $3, $4, $5::timestamptz)
         ON CONFLICT (server_id, match_id, map_no)
         DO UPDATE SET last_sequence = GREATEST(event_offsets.last_sequence, EXCLUDED.last_sequence),
                       last_event_ts = GREATEST(event_offsets.last_event_ts, EXCLUDED.last_event_ts)`,
        [
          record.metadata.serverId,
          record.metadata.matchId,
          record.metadata.mapNumber,
          record.sequence.toString(),
          record.metadata.eventTimestamp,
        ],
      );
    } finally {
      client.release();
    }
  }

  async updateServerHeartbeat(record: RawEventRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE servers
            SET last_seen_at = GREATEST(COALESCE(last_seen_at, '-infinity')::timestamptz, $2::timestamptz)
          WHERE endpoint = $1`,
        [record.metadata.serverId, record.metadata.eventTimestamp],
      );
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
