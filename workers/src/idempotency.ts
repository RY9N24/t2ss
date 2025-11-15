import crypto from 'crypto';
import { AggregationMetadata, MatchzyEventEnvelope } from './types';

function normaliseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normaliseValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normaliseValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value ?? null;
}

function extractField<T>(source: Record<string, unknown>, key: string, fallback: T): T {
  const value = source[key];
  return (typeof value === typeof fallback || value !== undefined ? (value as T) : fallback) ?? fallback;
}

export function extractMetadata(envelope: MatchzyEventEnvelope): AggregationMetadata {
  const body = envelope.body ?? {};

  const serverId = String(body['server_id'] ?? 'unknown');
  const matchId = String(body['match_id'] ?? 'unknown');
  const mapNumberRaw = body['map_no'] ?? body['map_number'] ?? 0;
  const mapNumber = typeof mapNumberRaw === 'number' ? mapNumberRaw : Number(mapNumberRaw) || 0;
  const eventType = String(body['event_type'] ?? 'unknown');
  const eventTimestamp = String(body['event_ts'] ?? body['timestamp'] ?? new Date().toISOString());

  const payloadSubset = normaliseValue(
    body['payload_subset'] ??
      body['payload'] ??
      {
        player_id: extractField(body, 'player_id', 'unknown'),
        team_id: extractField(body, 'team_id', 'unknown'),
        round: extractField(body, 'round', null),
        side: extractField(body, 'side', null),
      },
  );

  return {
    serverId,
    matchId,
    mapNumber,
    eventType,
    eventTimestamp,
    payloadSubset,
  };
}

export function buildIdempotencyKey(metadata: AggregationMetadata): string {
  const hash = crypto.createHash('sha256');
  hash.update(
    [
      metadata.serverId,
      metadata.matchId,
      metadata.mapNumber,
      metadata.eventType,
      metadata.eventTimestamp,
      JSON.stringify(normaliseValue(metadata.payloadSubset)),
    ].join('|'),
    'utf8',
  );
  return hash.digest('hex');
}
