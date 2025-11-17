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

  @Column({ type: 'integer', default: 0 })
  damage!: number;

  @Column({ name: 'enemy_5ks', type: 'integer', default: 0 })
  enemy5ks!: number;

  @Column({ name: 'enemy_4ks', type: 'integer', default: 0 })
  enemy4ks!: number;

  @Column({ name: 'enemy_3ks', type: 'integer', default: 0 })
  enemy3ks!: number;

  @Column({ name: 'enemy_2ks', type: 'integer', default: 0 })
  enemy2ks!: number;

  @Column({ name: 'utility_count', type: 'integer', default: 0 })
  utilityCount!: number;

  @Column({ name: 'utility_successes', type: 'integer', default: 0 })
  utilitySuccesses!: number;

  @Column({ name: 'utility_enemies', type: 'integer', default: 0 })
  utilityEnemies!: number;

  @Column({ name: 'flash_count', type: 'integer', default: 0 })
  flashCount!: number;

  @Column({ name: 'flash_successes', type: 'integer', default: 0 })
  flashSuccesses!: number;

  @Column({ name: 'health_points_removed_total', type: 'integer', default: 0 })
  healthPointsRemovedTotal!: number;

  @Column({ name: 'health_points_dealt_total', type: 'integer', default: 0 })
  healthPointsDealtTotal!: number;

  @Column({ name: 'shots_fired_total', type: 'integer', default: 0 })
  shotsFiredTotal!: number;

  @Column({ name: 'shots_on_target_total', type: 'integer', default: 0 })
  shotsOnTargetTotal!: number;

  @Column({ name: 'v1_count', type: 'integer', default: 0 })
  v1Count!: number;

  @Column({ name: 'v1_wins', type: 'integer', default: 0 })
  v1Wins!: number;

  @Column({ name: 'v2_count', type: 'integer', default: 0 })
  v2Count!: number;

  @Column({ name: 'v2_wins', type: 'integer', default: 0 })
  v2Wins!: number;

  @Column({ name: 'entry_count', type: 'integer', default: 0 })
  entryCount!: number;

  @Column({ name: 'entry_wins', type: 'integer', default: 0 })
  entryWins!: number;

  @Column({ name: 'equipment_value', type: 'integer', default: 0 })
  equipmentValue!: number;

  @Column({ name: 'money_saved', type: 'integer', default: 0 })
  moneySaved!: number;

  @Column({ name: 'kill_reward', type: 'integer', default: 0 })
  killReward!: number;

  @Column({ name: 'live_time', type: 'integer', default: 0 })
  liveTime!: number;

  @Column({ name: 'head_shot_kills', type: 'integer', default: 0 })
  headShotKills!: number;

  @Column({ name: 'cash_earned', type: 'integer', default: 0 })
  cashEarned!: number;

  @Column({ name: 'enemies_flashed', type: 'integer', default: 0 })
  enemiesFlashed!: number;
}
