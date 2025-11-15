import { MatchzyEventEnvelope, PersistenceAdapter, RawEventRecord } from './types';
import { buildIdempotencyKey, extractMetadata } from './idempotency';

export class Aggregator {
  constructor(private readonly persistence: PersistenceAdapter) {}

  /**
   * MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
   */
  async process(
    subject: string,
    payloadBuffer: Uint8Array,
    headers: Record<string, unknown>,
    sequence: number,
  ): Promise<'processed' | 'duplicate'> {
    const envelope = this.parseEnvelope(payloadBuffer);
    const metadata = extractMetadata(envelope);
    const idempotencyKey = buildIdempotencyKey(metadata);

    const record: RawEventRecord = {
      subject,
      payload: envelope,
      headers,
      metadata,
      idempotencyKey,
      sequence,
    };

    const inserted = await this.persistence.recordRawEvent(record);
    if (!inserted) {
      await this.persistence.updateOffset(record);
      return 'duplicate';
    }

    await this.persistence.incrementAggregate(record);
    await this.persistence.updateOffset(record);
    return 'processed';
  }

  private parseEnvelope(buffer: Uint8Array): MatchzyEventEnvelope {
    try {
      const text = Buffer.from(buffer).toString('utf8');
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && 'body' in parsed) {
        return parsed as MatchzyEventEnvelope;
      }

      return { body: parsed as Record<string, unknown> };
    } catch (error) {
      return {
        body: {
          parse_error: (error as Error).message,
        },
      };
    }
  }
}
