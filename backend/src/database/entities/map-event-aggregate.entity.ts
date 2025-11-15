import { Column, Entity, Index } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';

@Entity({ name: 'map_event_aggregates' })
@Index(['serverId', 'matchId', 'mapNo', 'eventType'], { unique: true })
export class MapEventAggregate extends TimestampedEntity {
  @Column({ name: 'server_id', type: 'text' })
  serverId!: string;

  @Column({ name: 'match_id', type: 'text' })
  matchId!: string;

  @Column({ name: 'map_no', type: 'integer' })
  mapNo!: number;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ type: 'integer', default: 0 })
  count!: number;

  @Column({ name: 'last_event_ts', type: 'timestamptz', nullable: true })
  lastEventTs?: Date | null;

  @Column({ name: 'last_idempotency_key', type: 'text', nullable: true })
  lastIdempotencyKey?: string | null;
}
