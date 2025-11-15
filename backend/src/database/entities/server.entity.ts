import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';

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

  @OneToMany(() => Match, (match) => match.server)
  matches!: Match[];
}
