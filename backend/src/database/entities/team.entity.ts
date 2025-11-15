import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Tournament } from './tournament.entity';
import { Player } from './player.entity';
import { Match } from './match.entity';
import { PlayerStats } from './player-stat.entity';

@Entity({ name: 'teams' })
@Index(['tournamentId', 'name'], { unique: true })
export class Team extends TimestampedEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'short_name', type: 'text', nullable: true })
  shortName?: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId?: string | null;

  @Column({ name: 'tournament_id', type: 'uuid', nullable: true })
  tournamentId?: string | null;

  @ManyToOne(() => Tournament, (tournament) => tournament.teams, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  tournament?: Tournament | null;

  @OneToMany(() => Player, (player) => player.team)
  players!: Player[];

  @OneToMany(() => Match, (match) => match.homeTeam)
  homeMatches!: Match[];

  @OneToMany(() => Match, (match) => match.awayTeam)
  awayMatches!: Match[];

  @OneToMany(() => PlayerStats, (stats) => stats.team)
  stats!: PlayerStats[];
}
