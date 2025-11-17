import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Team } from './team.entity';
import { Tournament } from './tournament.entity';
import { PlayerStats } from './player-stat.entity';

@Entity({ name: 'players' })
export class Player extends TimestampedEntity {
  @Column({ type: 'text' })
  nickname!: string;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string | null;

  @Column({ name: 'steam_id', type: 'text', nullable: true })
  @Index({ unique: true })
  steamId?: string | null;

  @Column({ type: 'text', nullable: true })
  country?: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string | null;

  @Column({ name: 'tournament_id', type: 'uuid', nullable: true })
  tournamentId?: string | null;

  @ManyToOne(() => Team, (team) => team.players, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  team?: Team | null;

  @ManyToOne(() => Tournament, (tournament) => tournament.players, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  tournament?: Tournament | null;

  @OneToMany(() => PlayerStats, (stats) => stats.player)
  stats!: PlayerStats[];
}
