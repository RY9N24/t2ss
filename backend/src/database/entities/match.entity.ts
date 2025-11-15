import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Tournament } from './tournament.entity';
import { GameServer } from './server.entity';
import { Team } from './team.entity';
import { Map } from './map.entity';
import { StoredFile } from './file.entity';
import { PlayerStats } from './player-stat.entity';
import { RawEvent } from './raw-event.entity';

@Entity({ name: 'matches' })
@Index(['tournamentId', 'externalId'], { unique: true })
export class Match extends TimestampedEntity {
  @Column({ name: 'tournament_id', type: 'uuid' })
  tournamentId!: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.matches, {
    onDelete: 'CASCADE',
  })
  tournament!: Tournament;

  @Column({ name: 'server_id', type: 'uuid', nullable: true })
  serverId?: string | null;

  @ManyToOne(() => GameServer, (server) => server.matches, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  server?: GameServer | null;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId?: string | null;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', default: 'scheduled' })
  status!: string;

  @Column({ name: 'best_of', type: 'smallint', default: 1 })
  bestOf!: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'home_team_id', type: 'uuid', nullable: true })
  homeTeamId?: string | null;

  @ManyToOne(() => Team, (team) => team.homeMatches, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  homeTeam?: Team | null;

  @Column({ name: 'away_team_id', type: 'uuid', nullable: true })
  awayTeamId?: string | null;

  @ManyToOne(() => Team, (team) => team.awayMatches, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  awayTeam?: Team | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @OneToMany(() => Map, (map) => map.match)
  maps!: Map[];

  @OneToMany(() => StoredFile, (file) => file.match)
  files!: StoredFile[];

  @OneToMany(() => PlayerStats, (stats) => stats.match)
  aggregatedStats!: PlayerStats[];

  @OneToMany(() => RawEvent, (event) => event.match)
  rawEvents!: RawEvent[];
}
