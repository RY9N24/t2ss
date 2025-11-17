import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { StoredFile } from './file.entity';
import { PlayerStats } from './player-stat.entity';
import { Team } from './team.entity';
import { JSONB_COLUMN_TYPE, JSONB_DEFAULT_EXPRESSION, TIMESTAMP_COLUMN_TYPE } from './column-types';

@Entity({ name: 'maps' })
@Index(['matchId', 'mapNumber'], { unique: true })
export class Map extends TimestampedEntity {
  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @ManyToOne(() => Match, (match) => match.maps, {
    onDelete: 'CASCADE',
  })
  match!: Match;

  @Column({ name: 'map_number', type: 'integer' })
  mapNumber!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  status?: string | null;

  @Column({ name: 'started_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'matchzy_map_number', type: 'smallint', nullable: true })
  matchzyMapNumber?: number | null;

  @Column({ name: 'team1_score', type: 'integer', default: 0 })
  team1Score!: number;

  @Column({ name: 'team2_score', type: 'integer', default: 0 })
  team2Score!: number;

  @Column({ name: 'winner_team_id', type: 'uuid', nullable: true })
  winnerTeamId?: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  winnerTeam?: Team | null;

  @Column({ type: JSONB_COLUMN_TYPE, default: () => JSONB_DEFAULT_EXPRESSION })
  metadata!: Record<string, unknown>;

  @OneToMany(() => StoredFile, (file) => file.map)
  files!: StoredFile[];

  @OneToMany(() => PlayerStats, (stats) => stats.map)
  stats!: PlayerStats[];
}
