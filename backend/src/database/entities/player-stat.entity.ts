import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Map } from './map.entity';
import { Player } from './player.entity';
import { Team } from './team.entity';
import { Match } from './match.entity';

@Entity({ name: 'player_stats' })
@Index(['mapId', 'playerId'], { unique: true })
export class PlayerStats extends TimestampedEntity {
  @Column({ name: 'map_id', type: 'uuid' })
  mapId!: string;

  @ManyToOne(() => Map, (map) => map.stats, {
    onDelete: 'CASCADE',
  })
  map!: Map;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @ManyToOne(() => Player, (player) => player.stats, {
    onDelete: 'CASCADE',
  })
  player!: Player;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string | null;

  @ManyToOne(() => Team, (team) => team.stats, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  team?: Team | null;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId?: string | null;

  @ManyToOne(() => Match, (match) => match.aggregatedStats, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  match?: Match | null;

  @Column({ type: 'integer', default: 0 })
  rounds!: number;

  @Column({ type: 'integer', default: 0 })
  kills!: number;

  @Column({ type: 'integer', default: 0 })
  deaths!: number;

  @Column({ type: 'integer', default: 0 })
  assists!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  kast!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  adr!: string;

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 0 })
  rating!: string;

  @Column({ name: 'headshot_percentage', type: 'numeric', precision: 5, scale: 2, default: 0 })
  headshotPercentage!: string;

  @Column({ name: 'opening_kills', type: 'integer', default: 0 })
  openingKills!: number;

  @Column({ name: 'opening_deaths', type: 'integer', default: 0 })
  openingDeaths!: number;

  @Column({ name: 'clutches_won', type: 'integer', default: 0 })
  clutchesWon!: number;

  @Column({ name: 'clutches_played', type: 'integer', default: 0 })
  clutchesPlayed!: number;

  @Column({ name: 'multi_kill_rounds', type: 'integer', default: 0 })
  multiKillRounds!: number;

  @Column({ name: 'utility_damage', type: 'integer', default: 0 })
  utilityDamage!: number;

  @Column({ name: 'flash_assists', type: 'integer', default: 0 })
  flashAssists!: number;
}
