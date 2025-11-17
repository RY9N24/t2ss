import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { Team } from './team.entity';
import { Player } from './player.entity';
import { BotSubscription } from './bot-subscription.entity';

@Entity({ name: 'tournaments' })
export class Tournament extends TimestampedEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
  slug!: string;

  @Column({ name: 'external_id', type: 'text', nullable: true, unique: true })
  externalId?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @OneToMany(() => Match, (match) => match.tournament)
  matches!: Match[];

  @OneToMany(() => Team, (team) => team.tournament)
  teams!: Team[];

  @OneToMany(() => Player, (player) => player.tournament)
  players!: Player[];

  @OneToMany(() => BotSubscription, (subscription) => subscription.tournament)
  subscriptions!: BotSubscription[];
}
