import { Injectable, BadRequestException } from '@nestjs/common';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import initSqlJs, { SqlJsStatic, SqlValue } from 'sql.js';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';

export type SnapshotTable =
  | 'tournaments'
  | 'teams'
  | 'players'
  | 'matches'
  | 'maps'
  | 'player_stats'
  | 'files'
  | 'events_raw'
  | 'bot_subscriptions';

export type SnapshotValue = string | number | boolean | null | Record<string, unknown>;

export interface SnapshotColumn {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'datetime';
}

export type SnapshotRows = Array<Record<string, SnapshotValue>>;

export interface TournamentSnapshot {
  tournaments: SnapshotRows;
  teams: SnapshotRows;
  players: SnapshotRows;
  matches: SnapshotRows;
  maps: SnapshotRows;
  player_stats: SnapshotRows;
  files: SnapshotRows;
  events_raw: SnapshotRows;
  bot_subscriptions: SnapshotRows;
}

export const SNAPSHOT_TABLE_ORDER: SnapshotTable[] = [
  'tournaments',
  'teams',
  'players',
  'matches',
  'maps',
  'player_stats',
  'files',
  'events_raw',
  'bot_subscriptions',
];

export const SNAPSHOT_TABLES: Record<SnapshotTable, SnapshotColumn[]> = {
  tournaments: [
    { key: 'id', type: 'string' },
    { key: 'name', type: 'string' },
    { key: 'slug', type: 'string' },
    { key: 'externalId', type: 'string' },
    { key: 'description', type: 'string' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  teams: [
    { key: 'id', type: 'string' },
    { key: 'name', type: 'string' },
    { key: 'shortName', type: 'string' },
    { key: 'logoUrl', type: 'string' },
    { key: 'externalId', type: 'string' },
    { key: 'tournamentId', type: 'string' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  players: [
    { key: 'id', type: 'string' },
    { key: 'nickname', type: 'string' },
    { key: 'firstName', type: 'string' },
    { key: 'lastName', type: 'string' },
    { key: 'steamId', type: 'string' },
    { key: 'country', type: 'string' },
    { key: 'teamId', type: 'string' },
    { key: 'tournamentId', type: 'string' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  matches: [
    { key: 'id', type: 'string' },
    { key: 'tournamentId', type: 'string' },
    { key: 'serverId', type: 'string' },
    { key: 'externalId', type: 'string' },
    { key: 'title', type: 'string' },
    { key: 'status', type: 'string' },
    { key: 'bestOf', type: 'number' },
    { key: 'scheduledAt', type: 'datetime' },
    { key: 'startedAt', type: 'datetime' },
    { key: 'completedAt', type: 'datetime' },
    { key: 'homeTeamId', type: 'string' },
    { key: 'awayTeamId', type: 'string' },
    { key: 'team1Score', type: 'number' },
    { key: 'team2Score', type: 'number' },
    { key: 'winnerTeamId', type: 'string' },
    { key: 'metadata', type: 'json' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  maps: [
    { key: 'id', type: 'string' },
    { key: 'matchId', type: 'string' },
    { key: 'mapNumber', type: 'number' },
    { key: 'name', type: 'string' },
    { key: 'status', type: 'string' },
    { key: 'startedAt', type: 'datetime' },
    { key: 'completedAt', type: 'datetime' },
    { key: 'matchzyMapNumber', type: 'number' },
    { key: 'team1Score', type: 'number' },
    { key: 'team2Score', type: 'number' },
    { key: 'winnerTeamId', type: 'string' },
    { key: 'metadata', type: 'json' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  player_stats: [
    { key: 'id', type: 'string' },
    { key: 'mapId', type: 'string' },
    { key: 'playerId', type: 'string' },
    { key: 'teamId', type: 'string' },
    { key: 'matchId', type: 'string' },
    { key: 'rounds', type: 'number' },
    { key: 'kills', type: 'number' },
    { key: 'deaths', type: 'number' },
    { key: 'assists', type: 'number' },
    { key: 'kast', type: 'string' },
    { key: 'adr', type: 'string' },
    { key: 'rating', type: 'string' },
    { key: 'headshotPercentage', type: 'string' },
    { key: 'openingKills', type: 'number' },
    { key: 'openingDeaths', type: 'number' },
    { key: 'clutchesWon', type: 'number' },
    { key: 'clutchesPlayed', type: 'number' },
    { key: 'multiKillRounds', type: 'number' },
    { key: 'utilityDamage', type: 'number' },
    { key: 'flashAssists', type: 'number' },
    { key: 'damage', type: 'number' },
    { key: 'enemy5ks', type: 'number' },
    { key: 'enemy4ks', type: 'number' },
    { key: 'enemy3ks', type: 'number' },
    { key: 'enemy2ks', type: 'number' },
    { key: 'utilityCount', type: 'number' },
    { key: 'utilitySuccesses', type: 'number' },
    { key: 'utilityEnemies', type: 'number' },
    { key: 'flashCount', type: 'number' },
    { key: 'flashSuccesses', type: 'number' },
    { key: 'healthPointsRemovedTotal', type: 'number' },
    { key: 'healthPointsDealtTotal', type: 'number' },
    { key: 'shotsFiredTotal', type: 'number' },
    { key: 'shotsOnTargetTotal', type: 'number' },
    { key: 'v1Count', type: 'number' },
    { key: 'v1Wins', type: 'number' },
    { key: 'v2Count', type: 'number' },
    { key: 'v2Wins', type: 'number' },
    { key: 'entryCount', type: 'number' },
    { key: 'entryWins', type: 'number' },
    { key: 'equipmentValue', type: 'number' },
    { key: 'moneySaved', type: 'number' },
    { key: 'killReward', type: 'number' },
    { key: 'liveTime', type: 'number' },
    { key: 'headShotKills', type: 'number' },
    { key: 'cashEarned', type: 'number' },
    { key: 'enemiesFlashed', type: 'number' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  files: [
    { key: 'id', type: 'string' },
    { key: 'storagePath', type: 'string' },
    { key: 'originalFilename', type: 'string' },
    { key: 'sizeBytes', type: 'string' },
    { key: 'contentType', type: 'string' },
    { key: 'metaHeaders', type: 'json' },
    { key: 'status', type: 'string' },
    { key: 'isPinned', type: 'boolean' },
    { key: 'isInUse', type: 'boolean' },
    { key: 'deletedAt', type: 'datetime' },
    { key: 'matchzyMatchId', type: 'string' },
    { key: 'matchzyMapNumber', type: 'number' },
    { key: 'matchId', type: 'string' },
    { key: 'mapId', type: 'string' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  events_raw: [
    { key: 'id', type: 'string' },
    { key: 'subject', type: 'string' },
    { key: 'idempotencyKey', type: 'string' },
    { key: 'payload', type: 'json' },
    { key: 'headers', type: 'json' },
    { key: 'matchzyMatchId', type: 'string' },
    { key: 'matchId', type: 'string' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
  bot_subscriptions: [
    { key: 'id', type: 'string' },
    { key: 'chatId', type: 'string' },
    { key: 'tournamentId', type: 'string' },
    { key: 'languageCode', type: 'string' },
    { key: 'isActive', type: 'boolean' },
    { key: 'createdAt', type: 'datetime' },
    { key: 'updatedAt', type: 'datetime' },
  ],
};

function createEmptySnapshot(): TournamentSnapshot {
  return SNAPSHOT_TABLE_ORDER.reduce((acc, table) => {
    acc[table] = [];
    return acc;
  }, {} as TournamentSnapshot);
}

let sqlJsInstance: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = initSqlJs({
      locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
    });
  }
  return sqlJsInstance;
}

@Injectable()
export class DataTransferService {
  /**
   * MatchZy (README, CSV/SQLite/MySQL): https://github.com/shobhit-pathak/MatchZy
   * Снимки турниров экспортируются в подтверждённые форматы CSV и SQLite для офлайн сверок.
   */
  async toCsvArchive(snapshot: TournamentSnapshot): Promise<Buffer> {
    const zip = new JSZip();
    for (const table of SNAPSHOT_TABLE_ORDER) {
      const rows = snapshot[table];
      const csvRows = rows.map((row) => this.prepareRowForText(table, row));
      const csv = stringify(csvRows, {
        header: true,
        columns: SNAPSHOT_TABLES[table].map((column) => ({ key: column.key, header: column.key })),
      });
      zip.file(`csv/${table}.csv`, csv);
    }
    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          format: 'csv',
          exportedAt: new Date().toISOString(),
          tables: SNAPSHOT_TABLE_ORDER,
        },
        null,
        2,
      ),
    );
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  async toXlsx(snapshot: TournamentSnapshot): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MatchZy Panel';
    workbook.created = new Date();

    for (const table of SNAPSHOT_TABLE_ORDER) {
      const worksheet = workbook.addWorksheet(table);
      worksheet.columns = SNAPSHOT_TABLES[table].map((column) => ({ header: column.key, key: column.key }));
      const rows = snapshot[table].map((row) => this.prepareRowForText(table, row));
      worksheet.addRows(rows);
    }

    const data = (await workbook.xlsx.writeBuffer()) as ArrayBuffer | Buffer;
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  async toSqlite(snapshot: TournamentSnapshot): Promise<Buffer> {
    const SQL = await getSqlJs();
    const db = new SQL.Database();

    for (const table of SNAPSHOT_TABLE_ORDER) {
      const columns = SNAPSHOT_TABLES[table];
      const columnSql = columns
        .map((column) => `${column.key} ${this.sqliteColumnType(column.type)}`)
        .join(', ');
      db.run(`CREATE TABLE IF NOT EXISTS ${table} (${columnSql})`);
      if (!snapshot[table].length) {
        continue;
      }
      const placeholders = columns.map(() => '?').join(', ');
      const statement = db.prepare(`INSERT INTO ${table} (${columns.map((column) => column.key).join(', ')}) VALUES (${placeholders})`);
      for (const row of snapshot[table]) {
        const valuesToBind = columns.map((column) =>
          this.serializeValueForSqlite(row[column.key], column.type),
        );
        statement.run(valuesToBind as SqlValue[]);
      }
      statement.free();
    }

    const binary = db.export();
    return Buffer.from(binary);
  }

  async fromCsvArchive(buffer: Buffer): Promise<TournamentSnapshot> {
    const zip = await JSZip.loadAsync(buffer);
    const snapshot = createEmptySnapshot();
    for (const table of SNAPSHOT_TABLE_ORDER) {
      const file = zip.file(`csv/${table}.csv`) ?? zip.file(`${table}.csv`);
      if (!file) {
        continue;
      }
      const content = await file.async('string');
      const parsed = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
      snapshot[table] = parsed.map((row) => this.parseRow(table, row));
    }
    if (!snapshot.tournaments.length) {
      throw new BadRequestException('Snapshot is missing tournament data');
    }
    return snapshot;
  }

  async fromSqlite(buffer: Buffer): Promise<TournamentSnapshot> {
    const SQL = await getSqlJs();
    const db = new SQL.Database(buffer);
    const snapshot = createEmptySnapshot();
    for (const table of SNAPSHOT_TABLE_ORDER) {
      const query = db.exec(`SELECT * FROM ${table}`);
      if (!query.length) {
        continue;
      }
      const columns = SNAPSHOT_TABLES[table];
      const values = query[0].values;
      const headers = query[0].columns;
      snapshot[table] = values.map((rowValues: unknown[]) => {
        const row: Record<string, SnapshotValue> = {};
        for (const column of columns) {
          const index = headers.indexOf(column.key);
          const rawValue = index >= 0 ? rowValues[index] : null;
          row[column.key] = this.normalizeParsedValue(rawValue, column.type);
        }
        return row;
      });
    }
    if (!snapshot.tournaments.length) {
      throw new BadRequestException('Snapshot is missing tournament data');
    }
    return snapshot;
  }

  private prepareRowForText(table: SnapshotTable, row: Record<string, SnapshotValue>): Record<string, SnapshotValue> {
    const columns = SNAPSHOT_TABLES[table];
    const prepared: Record<string, SnapshotValue> = {};
    for (const column of columns) {
      prepared[column.key] = this.serializeValueForText(row[column.key], column.type);
    }
    return prepared;
  }

  private serializeValueForText(value: SnapshotValue, type: SnapshotColumn['type']): SnapshotValue {
    if (value === null || value === undefined) {
      return '';
    }
    if (type === 'json') {
      return JSON.stringify(value ?? null);
    }
    if (type === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (type === 'number') {
      return typeof value === 'number' ? value : Number(value ?? 0);
    }
    return value;
  }

  private serializeValueForSqlite(value: SnapshotValue, type: SnapshotColumn['type']): SqlValue {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (type === 'boolean') {
      return value ? 1 : 0;
    }
    if (type === 'json') {
      return JSON.stringify(value ?? null);
    }
    if (type === 'number') {
      return typeof value === 'number' ? value : Number(value);
    }
    return value as string;
  }

  private parseRow(table: SnapshotTable, row: Record<string, string>): Record<string, SnapshotValue> {
    const columns = SNAPSHOT_TABLES[table];
    const parsed: Record<string, SnapshotValue> = {};
    for (const column of columns) {
      parsed[column.key] = this.normalizeParsedValue(row[column.key], column.type);
    }
    return parsed;
  }

  private normalizeParsedValue(value: unknown, type: SnapshotColumn['type']): SnapshotValue {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (type === 'json') {
      try {
        return typeof value === 'string'
          ? (JSON.parse(value) as SnapshotValue)
          : (value as SnapshotValue);
      } catch {
        return null;
      }
    }
    if (type === 'boolean') {
      if (typeof value === 'boolean') {
        return value;
      }
      const normalized = String(value).toLowerCase();
      return normalized === 'true' || normalized === '1';
    }
    if (type === 'number') {
      if (typeof value === 'number') {
        return value;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (type === 'datetime') {
      return typeof value === 'string' ? value : new Date(value as string).toISOString();
    }
    return typeof value === 'string' ? value : String(value);
  }

  private sqliteColumnType(type: SnapshotColumn['type']): string {
    switch (type) {
      case 'number':
        return 'REAL';
      case 'boolean':
        return 'INTEGER';
      default:
        return 'TEXT';
    }
  }
}
