import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { WorkerConfig } from './config';
import { RawEventRecord } from './types';
import { createLogger } from './logger';

export interface Finalizer {
  handle(record: RawEventRecord): Promise<void>;
  close(): Promise<void>;
}

export interface FinalizerStore {
  applyMapResultUpdate(update: MapResultUpdate): Promise<void>;
  applySeriesResult(update: SeriesResultUpdate): Promise<void>;
  close(): Promise<void>;
}

export interface TeamSummary {
  key: 'team1' | 'team2';
  name?: string;
  score?: number | null;
  seriesScore?: number | null;
  externalId?: string;
  side?: string | null;
}

export interface WinnerSummary {
  team?: 'team1' | 'team2' | null;
  side?: string | null;
}

export interface PlayerCsvRow {
  matchId: string;
  mapNumber: number;
  steamId64: string;
  team: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  enemy5ks: number;
  enemy4ks: number;
  enemy3ks: number;
  enemy2ks: number;
  utilityCount: number;
  utilityDamage: number;
  utilitySuccesses: number;
  utilityEnemies: number;
  flashCount: number;
  flashSuccesses: number;
  healthPointsRemovedTotal: number;
  healthPointsDealtTotal: number;
  shotsFiredTotal: number;
  shotsOnTargetTotal: number;
  v1Count: number;
  v1Wins: number;
  v2Count: number;
  v2Wins: number;
  entryCount: number;
  entryWins: number;
  equipmentValue: number;
  moneySaved: number;
  killReward: number;
  liveTime: number;
  headShotKills: number;
  cashEarned: number;
  enemiesFlashed: number;
}

export interface MapResultUpdate {
  matchId: string;
  mapNumber: number;
  csvPath: string;
  rows: PlayerCsvRow[];
  unknownColumns: string[];
  team1: TeamSummary;
  team2: TeamSummary;
  winner: WinnerSummary;
  occurredAt?: string;
}

export interface SeriesResultUpdate {
  matchId: string;
  team1SeriesScore: number | null;
  team2SeriesScore: number | null;
  winner: WinnerSummary;
  occurredAt?: string;
}

const KNOWN_COLUMNS = new Set([
  'matchid',
  'mapnumber',
  'steamid64',
  'team',
  'name',
  'kills',
  'deaths',
  'damage',
  'assists',
  'enemy5ks',
  'enemy4ks',
  'enemy3ks',
  'enemy2ks',
  'utility_count',
  'utility_damage',
  'utility_successes',
  'utility_enemies',
  'flash_count',
  'flash_successes',
  'health_points_removed_total',
  'health_points_dealt_total',
  'shots_fired_total',
  'shots_on_target_total',
  'v1_count',
  'v1_wins',
  'v2_count',
  'v2_wins',
  'entry_count',
  'entry_wins',
  'equipment_value',
  'money_saved',
  'kill_reward',
  'live_time',
  'head_shot_kills',
  'cash_earned',
  'enemies_flashed',
]);

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normaliseColumn(column: string): string {
  return column.trim().toLowerCase();
}

export interface ParsedCsvResult {
  rows: PlayerCsvRow[];
  unknownColumns: string[];
}

export function parseMatchzyCsv(csvContent: string): ParsedCsvResult {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: PlayerCsvRow[] = [];
  const unknownColumns = new Set<string>();

  for (const record of records) {
    const normalisedEntries = Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
      const normalisedKey = normaliseColumn(key);
      acc[normalisedKey] = value;
      if (!KNOWN_COLUMNS.has(normalisedKey)) {
        unknownColumns.add(normalisedKey);
      }
      return acc;
    }, {});

    const matchId = normalisedEntries['matchid'] ?? '';
    const mapNumber = toNumber(normalisedEntries['mapnumber']);

    const row: PlayerCsvRow = {
      matchId,
      mapNumber,
      steamId64: normalisedEntries['steamid64'] ?? '',
      team: normalisedEntries['team'] ?? '',
      name: normalisedEntries['name'] ?? '',
      kills: toNumber(normalisedEntries['kills']),
      deaths: toNumber(normalisedEntries['deaths']),
      assists: toNumber(normalisedEntries['assists']),
      damage: toNumber(normalisedEntries['damage']),
      enemy5ks: toNumber(normalisedEntries['enemy5ks']),
      enemy4ks: toNumber(normalisedEntries['enemy4ks']),
      enemy3ks: toNumber(normalisedEntries['enemy3ks']),
      enemy2ks: toNumber(normalisedEntries['enemy2ks']),
      utilityCount: toNumber(normalisedEntries['utility_count']),
      utilityDamage: toNumber(normalisedEntries['utility_damage']),
      utilitySuccesses: toNumber(normalisedEntries['utility_successes']),
      utilityEnemies: toNumber(normalisedEntries['utility_enemies']),
      flashCount: toNumber(normalisedEntries['flash_count']),
      flashSuccesses: toNumber(normalisedEntries['flash_successes']),
      healthPointsRemovedTotal: toNumber(normalisedEntries['health_points_removed_total']),
      healthPointsDealtTotal: toNumber(normalisedEntries['health_points_dealt_total']),
      shotsFiredTotal: toNumber(normalisedEntries['shots_fired_total']),
      shotsOnTargetTotal: toNumber(normalisedEntries['shots_on_target_total']),
      v1Count: toNumber(normalisedEntries['v1_count']),
      v1Wins: toNumber(normalisedEntries['v1_wins']),
      v2Count: toNumber(normalisedEntries['v2_count']),
      v2Wins: toNumber(normalisedEntries['v2_wins']),
      entryCount: toNumber(normalisedEntries['entry_count']),
      entryWins: toNumber(normalisedEntries['entry_wins']),
      equipmentValue: toNumber(normalisedEntries['equipment_value']),
      moneySaved: toNumber(normalisedEntries['money_saved']),
      killReward: toNumber(normalisedEntries['kill_reward']),
      liveTime: toNumber(normalisedEntries['live_time']),
      headShotKills: toNumber(normalisedEntries['head_shot_kills']),
      cashEarned: toNumber(normalisedEntries['cash_earned']),
      enemiesFlashed: toNumber(normalisedEntries['enemies_flashed']),
    };

    rows.push(row);
  }

  return { rows, unknownColumns: Array.from(unknownColumns.values()).sort() };
}

function extractTeamSummary(team: unknown, key: 'team1' | 'team2'): TeamSummary {
  const candidate = (team ?? {}) as Record<string, unknown>;
  const name = typeof candidate['name'] === 'string' ? candidate['name'] : undefined;
  const score = toNumber(candidate['score']);
  const seriesScore = toNumber(candidate['series_score']);
  const externalId =
    typeof candidate['id'] === 'string' && candidate['id'].length > 0 ? candidate['id'] : undefined;
  const side = typeof candidate['side'] === 'string' ? candidate['side'] : null;

  return {
    key,
    name,
    score: Number.isFinite(score) ? score : null,
    seriesScore: Number.isFinite(seriesScore) ? seriesScore : null,
    externalId,
    side,
  };
}

function extractWinnerSummary(winner: unknown): WinnerSummary {
  const data = (winner ?? {}) as Record<string, unknown>;
  const teamRaw = data['team'];
  const team = teamRaw === 'team1' || teamRaw === 'team2' ? (teamRaw as 'team1' | 'team2') : null;
  const side = typeof data['side'] === 'string' ? data['side'] : null;
  return { team, side };
}

function ensureStringId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function extractMatchId(body: Record<string, unknown>): string | null {
  const matchIdCandidates = [
    body['matchid'],
    body['match_id'],
    body['matchId'],
    body['match'],
  ];

  for (const candidate of matchIdCandidates) {
    const normalised = ensureStringId(candidate);
    if (normalised) {
      return normalised;
    }
  }

  return null;
}

function extractMapNumber(body: Record<string, unknown>, fallback: number): number {
  const value = body['map_number'] ?? body['map_no'] ?? body['mapNumber'];
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export class CsvFinalizer implements Finalizer {
  private readonly logger = createLogger('info');

  constructor(
    private readonly config: WorkerConfig,
    private readonly store: FinalizerStore,
  ) {}

  async handle(record: RawEventRecord): Promise<void> {
    const body = (record.payload?.body ?? record.payload ?? {}) as Record<string, unknown>;
    const eventName = String(body['event'] ?? body['event_type'] ?? '').trim();
    if (!eventName) {
      return;
    }

    if (eventName === 'map_result') {
      await this.handleMapResult(record, body);
      return;
    }

    if (eventName === 'series_end') {
      await this.handleSeriesEnd(record, body);
    }
  }

  private async handleMapResult(record: RawEventRecord, body: Record<string, unknown>): Promise<void> {
    const matchId = extractMatchId(body);
    if (!matchId) {
      this.logger.warn({ body }, 'map_result missing match identifier');
      return;
    }

    const mapNumber = extractMapNumber(body, record.metadata.mapNumber ?? 0);
    const statsDir = this.config.matchzyStatsPath ?? 'csgo/MatchZy_Stats';
    const csvPath = path.resolve(statsDir, `match_data_map${mapNumber}_${matchId}.csv`);

    let csvContent: string;
    try {
      csvContent = await fs.readFile(csvPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn({ csvPath }, 'matchzy stats CSV not found');
        return;
      }
      throw error;
    }

    const parsed = parseMatchzyCsv(csvContent);
    const filteredRows = parsed.rows.filter((row) => row.mapNumber === mapNumber);

    if (filteredRows.length === 0) {
      this.logger.warn({ csvPath, mapNumber }, 'matchzy stats CSV contains no rows for map');
    }

    if (parsed.unknownColumns.length > 0) {
      this.logger.warn(
        { csvPath, unknownColumns: parsed.unknownColumns, note: 'TODO(need-confirmation)' },
        'Encountered columns not yet mapped from MatchZy CSV',
      );
    }

    const team1 = extractTeamSummary(body['team1'], 'team1');
    const team2 = extractTeamSummary(body['team2'], 'team2');
    const winner = extractWinnerSummary(body['winner']);

    const update: MapResultUpdate = {
      matchId,
      mapNumber,
      csvPath,
      rows: filteredRows,
      unknownColumns: parsed.unknownColumns,
      team1,
      team2,
      winner,
      occurredAt: record.metadata.eventTimestamp,
    };

    await this.store.applyMapResultUpdate(update);
  }

  private async handleSeriesEnd(record: RawEventRecord, body: Record<string, unknown>): Promise<void> {
    const matchId = extractMatchId(body);
    if (!matchId) {
      this.logger.warn({ body }, 'series_end missing match identifier');
      return;
    }

    const team1SeriesScore = ensureNumberOrNull(body['team1_series_score']);
    const team2SeriesScore = ensureNumberOrNull(body['team2_series_score']);
    const winner = extractWinnerSummary(body['winner']);

    const update: SeriesResultUpdate = {
      matchId,
      team1SeriesScore,
      team2SeriesScore,
      winner,
      occurredAt: record.metadata.eventTimestamp,
    };

    await this.store.applySeriesResult(update);
  }

  async close(): Promise<void> {
    await this.store.close();
  }
}

function ensureNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
