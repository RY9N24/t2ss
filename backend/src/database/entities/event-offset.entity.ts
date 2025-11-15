import { Column, Entity, Index } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';

@Entity({ name: 'event_offsets' })
@Index(['serverId', 'matchId', 'mapNo'], { unique: true })
export class EventOffset extends TimestampedEntity {
  @Column({ name: 'server_id', type: 'text' })
  serverId!: string;

  @Column({ name: 'match_id', type: 'text' })
  matchId!: string;

  @Column({ name: 'map_no', type: 'integer' })
  mapNo!: number;

  @Column({ name: 'last_sequence', type: 'bigint', default: 0 })
  lastSequence!: string;

  @Column({ name: 'last_event_ts', type: 'timestamptz', nullable: true })
  lastEventTs?: Date | null;
}
