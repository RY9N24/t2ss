import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { ServerToken } from './server-token.entity';
import { TIMESTAMP_COLUMN_TYPE } from './column-types';

@Entity({ name: 'servers' })
export class GameServer extends TimestampedEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
  endpoint!: string;

  @Column({ type: 'text', nullable: true })
  location?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_seen_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastSeenAt?: Date | null;

  @OneToMany(() => Match, (match) => match.server)
  matches!: Match[];

  @OneToMany(() => ServerToken, (token) => token.server)
  tokens!: ServerToken[];
}
