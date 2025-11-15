import { Pool, PoolClient } from 'pg';
import { createLogger } from './logger';
import {
  FinalizerStore,
  MapResultUpdate,
  PlayerCsvRow,
  SeriesResultUpdate,
  TeamSummary,
  WinnerSummary,
} from './finalizer';

interface MatchRow {
  id: string;
  tournament_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface TeamLookup {
  team1Id: string | null;
  team2Id: string | null;
  byName: Map<string, string | null>;
}

export class PostgresFinalizerStore implements FinalizerStore {
  private readonly pool: Pool;
  private readonly logger = createLogger('info');

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async applyMapResultUpdate(update: MapResultUpdate): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const match = await this.findMatch(client, update.matchId);
      if (!match) {
        await this.insertAuditEntry(client, 'map_result_match_missing', {
          match_id: update.matchId,
          csv_path: update.csvPath,
          note: 'TODO(need-confirmation)',
        });
        await client.query('ROLLBACK');
        return;
      }

      const map = await this.findMap(client, match.id, update.mapNumber);
      if (!map) {
        await this.insertAuditEntry(client, 'map_result_map_missing', {
          match_id: update.matchId,
          map_number: update.mapNumber,
          csv_path: update.csvPath,
          note: 'TODO(need-confirmation)',
        });
        await client.query('ROLLBACK');
        return;
      }

      const teamLookup = await this.resolveTeams(client, match, update.team1, update.team2);

      await this.updateMapScore(client, map.id, update, teamLookup);
      await this.updateMatchScore(client, match.id, update.team1, update.team2);

      if (update.unknownColumns.length > 0) {
        await this.insertAuditEntry(client, 'map_result_unknown_columns', {
          match_id: update.matchId,
          csv_path: update.csvPath,
          unknown_columns: update.unknownColumns,
          note: 'TODO(need-confirmation)',
        });
      }

      for (const row of update.rows) {
        await this.upsertPlayerStats(client, match, map.id, row, teamLookup);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error: (error as Error).message, update }, 'Failed to apply map result update');
      throw error;
    } finally {
      client.release();
    }
  }

  async applySeriesResult(update: SeriesResultUpdate): Promise<void> {
    const client = await this.pool.connect();
    try {
      const match = await this.findMatch(client, update.matchId);
      if (!match) {
        await this.insertAuditEntry(client, 'series_result_match_missing', {
          match_id: update.matchId,
          note: 'TODO(need-confirmation)',
        });
        return;
      }

      const teamLookup = await this.resolveTeams(client, match, null, null);
      const winnerTeamId = this.resolveWinnerTeamId(update.winner, teamLookup);

      await client.query(
        `UPDATE matches
            SET team1_score = COALESCE($2, team1_score),
                team2_score = COALESCE($3, team2_score),
                winner_team_id = COALESCE($4::uuid, winner_team_id),
                status = CASE WHEN status = 'completed' THEN status ELSE 'completed' END,
                completed_at = COALESCE(completed_at, $5::timestamptz),
                updated_at = NOW(),
                metadata = jsonb_set(metadata, '{final_series}', $6::jsonb, true)
          WHERE id = $1`,
        [
          match.id,
          update.team1SeriesScore,
          update.team2SeriesScore,
          winnerTeamId,
          update.occurredAt ?? null,
          JSON.stringify({
            team1_series_score: update.team1SeriesScore,
            team2_series_score: update.team2SeriesScore,
            winner: update.winner,
            confirmed_via: 'matchzy_csv',
          }),
        ],
      );
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async findMatch(client: PoolClient, externalId: string): Promise<MatchRow | null> {
    const result = await client.query<MatchRow>(
      `SELECT id, tournament_id, home_team_id, away_team_id
         FROM matches
        WHERE external_id = $1
        LIMIT 1`,
      [externalId],
    );
    return result.rows[0] ?? null;
  }

  private async findMap(client: PoolClient, matchId: string, mapNumber: number): Promise<{ id: string } | null> {
    const result = await client.query<{ id: string }>(
      `SELECT id
         FROM maps
        WHERE match_id = $1
          AND (map_number = $2 OR matchzy_map_number = $2)
        LIMIT 1`,
      [matchId, mapNumber],
    );
    return result.rows[0] ?? null;
  }

  private async updateMapScore(
    client: PoolClient,
    mapId: string,
    update: MapResultUpdate,
    teamLookup: TeamLookup,
  ): Promise<void> {
    const winnerTeamId = this.resolveWinnerTeamId(update.winner, teamLookup);
    await client.query(
      `UPDATE maps
          SET team1_score = $2,
              team2_score = $3,
              winner_team_id = COALESCE($4::uuid, winner_team_id),
              status = 'completed',
              completed_at = COALESCE(completed_at, $5::timestamptz),
              updated_at = NOW(),
              metadata = jsonb_set(metadata, '{matchzy_map_result}', $6::jsonb, true)
        WHERE id = $1`,
      [
        mapId,
        update.team1.score ?? 0,
        update.team2.score ?? 0,
        winnerTeamId,
        update.occurredAt ?? null,
        JSON.stringify({
          team1: update.team1,
          team2: update.team2,
          winner: update.winner,
          csv_path: update.csvPath,
        }),
      ],
    );
  }

  private async updateMatchScore(
    client: PoolClient,
    matchId: string,
    team1: TeamSummary,
    team2: TeamSummary,
  ): Promise<void> {
    const metadata = {
      team1,
      team2,
      confirmed_via: 'matchzy_csv',
    };

    await client.query(
      `UPDATE matches
          SET team1_score = COALESCE($2, team1_score),
              team2_score = COALESCE($3, team2_score),
              updated_at = NOW(),
              metadata = jsonb_set(metadata, '{latest_map_result}', $4::jsonb, true)
        WHERE id = $1`,
      [matchId, team1.seriesScore, team2.seriesScore, JSON.stringify(metadata)],
    );
  }

  private async upsertPlayerStats(
    client: PoolClient,
    match: MatchRow,
    mapId: string,
    row: PlayerCsvRow,
    teamLookup: TeamLookup,
  ): Promise<void> {
    if (!row.steamId64) {
      await this.insertAuditEntry(client, 'player_row_missing_steam', {
        match_id: row.matchId,
        map_number: row.mapNumber,
        player_name: row.name,
        note: 'TODO(need-confirmation)',
      });
      return;
    }

    const playerId = await this.findOrCreatePlayer(client, match, row);
    const teamId = this.resolvePlayerTeamId(row, teamLookup);

    await client.query(
      `INSERT INTO player_stats (
          map_id, player_id, team_id, match_id,
          kills, deaths, assists,
          damage, enemy_5ks, enemy_4ks, enemy_3ks, enemy_2ks,
          utility_count, utility_damage, utility_successes, utility_enemies,
          flash_count, flash_successes,
          health_points_removed_total, health_points_dealt_total,
          shots_fired_total, shots_on_target_total,
          v1_count, v1_wins, v2_count, v2_wins,
          entry_count, entry_wins,
          equipment_value, money_saved, kill_reward,
          live_time, head_shot_kills, cash_earned, enemies_flashed,
          updated_at, created_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18,
          $19, $20,
          $21, $22,
          $23, $24, $25, $26,
          $27, $28,
          $29, $30, $31,
          $32, $33, $34, $35,
          NOW(), NOW()
        )
        ON CONFLICT (map_id, player_id)
        DO UPDATE SET
          team_id = EXCLUDED.team_id,
          match_id = EXCLUDED.match_id,
          kills = EXCLUDED.kills,
          deaths = EXCLUDED.deaths,
          assists = EXCLUDED.assists,
          damage = EXCLUDED.damage,
          enemy_5ks = EXCLUDED.enemy_5ks,
          enemy_4ks = EXCLUDED.enemy_4ks,
          enemy_3ks = EXCLUDED.enemy_3ks,
          enemy_2ks = EXCLUDED.enemy_2ks,
          utility_count = EXCLUDED.utility_count,
          utility_damage = EXCLUDED.utility_damage,
          utility_successes = EXCLUDED.utility_successes,
          utility_enemies = EXCLUDED.utility_enemies,
          flash_count = EXCLUDED.flash_count,
          flash_successes = EXCLUDED.flash_successes,
          health_points_removed_total = EXCLUDED.health_points_removed_total,
          health_points_dealt_total = EXCLUDED.health_points_dealt_total,
          shots_fired_total = EXCLUDED.shots_fired_total,
          shots_on_target_total = EXCLUDED.shots_on_target_total,
          v1_count = EXCLUDED.v1_count,
          v1_wins = EXCLUDED.v1_wins,
          v2_count = EXCLUDED.v2_count,
          v2_wins = EXCLUDED.v2_wins,
          entry_count = EXCLUDED.entry_count,
          entry_wins = EXCLUDED.entry_wins,
          equipment_value = EXCLUDED.equipment_value,
          money_saved = EXCLUDED.money_saved,
          kill_reward = EXCLUDED.kill_reward,
          live_time = EXCLUDED.live_time,
          head_shot_kills = EXCLUDED.head_shot_kills,
          cash_earned = EXCLUDED.cash_earned,
          enemies_flashed = EXCLUDED.enemies_flashed,
          updated_at = NOW()`,
      [
        mapId,
        playerId,
        teamId,
        match.id,
        row.kills,
        row.deaths,
        row.assists,
        row.damage,
        row.enemy5ks,
        row.enemy4ks,
        row.enemy3ks,
        row.enemy2ks,
        row.utilityCount,
        row.utilityDamage,
        row.utilitySuccesses,
        row.utilityEnemies,
        row.flashCount,
        row.flashSuccesses,
        row.healthPointsRemovedTotal,
        row.healthPointsDealtTotal,
        row.shotsFiredTotal,
        row.shotsOnTargetTotal,
        row.v1Count,
        row.v1Wins,
        row.v2Count,
        row.v2Wins,
        row.entryCount,
        row.entryWins,
        row.equipmentValue,
        row.moneySaved,
        row.killReward,
        row.liveTime,
        row.headShotKills,
        row.cashEarned,
        row.enemiesFlashed,
      ],
    );
  }

  private async findOrCreatePlayer(client: PoolClient, match: MatchRow, row: PlayerCsvRow): Promise<string> {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM players WHERE steam_id = $1 LIMIT 1`,
      [row.steamId64],
    );

    if (existing.rowCount && existing.rows[0]) {
      return existing.rows[0].id;
    }

    const insert = await client.query<{ id: string }>(
      `INSERT INTO players (nickname, steam_id, tournament_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
      [row.name || row.steamId64, row.steamId64, match.tournament_id],
    );

    return insert.rows[0].id;
  }

  private resolvePlayerTeamId(row: PlayerCsvRow, lookup: TeamLookup): string | null {
    const teamName = row.team.trim().toLowerCase();
    if (!teamName) {
      return null;
    }
    return lookup.byName.get(teamName) ?? null;
  }

  private resolveWinnerTeamId(winner: WinnerSummary, lookup: TeamLookup): string | null {
    if (winner.team === 'team1') {
      return lookup.team1Id;
    }
    if (winner.team === 'team2') {
      return lookup.team2Id;
    }
    return null;
  }

  private async resolveTeams(
    client: PoolClient,
    match: MatchRow,
    team1: TeamSummary | null,
    team2: TeamSummary | null,
  ): Promise<TeamLookup> {
    const byName = new Map<string, string | null>();
    const team1Id = await this.resolveTeamId(client, match, team1, match.home_team_id);
    const team2Id = await this.resolveTeamId(client, match, team2, match.away_team_id);

    if (team1?.name) {
      byName.set(team1.name.trim().toLowerCase(), team1Id);
    }
    if (team2?.name) {
      byName.set(team2.name.trim().toLowerCase(), team2Id);
    }

    return { team1Id, team2Id, byName };
  }

  private async resolveTeamId(
    client: PoolClient,
    match: MatchRow,
    team: TeamSummary | null,
    fallbackId: string | null,
  ): Promise<string | null> {
    const externalId = team?.externalId;
    if (externalId && match.tournament_id) {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM teams WHERE external_id = $1 AND tournament_id = $2 LIMIT 1`,
        [externalId, match.tournament_id],
      );
      if (result.rowCount && result.rows[0]) {
        return result.rows[0].id;
      }
    }

    return fallbackId;
  }

  private async insertAuditEntry(client: PoolClient, action: string, metadata: Record<string, unknown>): Promise<void> {
    await client.query(
      `INSERT INTO audit_log (category, action, metadata)
         VALUES ($1, $2, $3::jsonb)`,
      ['finalization', action, JSON.stringify(metadata)],
    );
  }
}
