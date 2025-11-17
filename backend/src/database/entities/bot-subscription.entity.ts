import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Tournament } from './tournament.entity';

@Entity({ name: 'bot_subscriptions' })
@Index(['chatId', 'tournamentId'], { unique: true })
export class BotSubscription extends TimestampedEntity {
  @Column({ name: 'chat_id', type: 'bigint' })
  chatId!: string;

  @Column({ name: 'tournament_id', type: 'uuid', nullable: true })
  tournamentId?: string | null;

  @ManyToOne(() => Tournament, (tournament) => tournament.subscriptions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  tournament?: Tournament | null;

  @Column({ name: 'language_code', type: 'varchar', length: 10, default: 'en' })
  languageCode!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
