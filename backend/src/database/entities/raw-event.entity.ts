import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { JSONB_COLUMN_TYPE, JSONB_DEFAULT_EXPRESSION } from './column-types';

@Entity({ name: 'events_raw' })
export class RawEvent extends TimestampedEntity {
  @Column({ name: 'subject', type: 'text' })
  subject!: string;

  @Column({ name: 'idempotency_key', type: 'text', unique: true })
  @Index({ unique: true })
  idempotencyKey!: string;

  @Column({ name: 'payload', type: JSONB_COLUMN_TYPE })
  payload!: Record<string, unknown>;

  @Column({ name: 'headers', type: JSONB_COLUMN_TYPE, default: () => JSONB_DEFAULT_EXPRESSION })
  headers!: Record<string, unknown>;

  @Column({ name: 'matchzy_match_id', type: 'text', nullable: true })
  matchzyMatchId?: string | null;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId?: string | null;

  @ManyToOne(() => Match, (match) => match.rawEvents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  match?: Match | null;
}
