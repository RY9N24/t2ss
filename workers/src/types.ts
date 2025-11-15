export interface MatchzyEventEnvelope {
  body: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export interface AggregationMetadata {
  serverId: string;
  matchId: string;
  mapNumber: number;
  eventType: string;
  eventTimestamp: string;
  payloadSubset: unknown;
}

export interface RawEventRecord {
  subject: string;
  payload: MatchzyEventEnvelope;
  headers: Record<string, unknown>;
  idempotencyKey: string;
  metadata: AggregationMetadata;
  sequence: number;
}

export interface PersistenceAdapter {
  recordRawEvent(record: RawEventRecord): Promise<boolean>;
  incrementAggregate(record: RawEventRecord): Promise<void>;
  updateOffset(record: RawEventRecord): Promise<void>;
}
