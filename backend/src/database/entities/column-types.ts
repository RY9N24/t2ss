import type { ColumnType } from 'typeorm';

const isTestEnv = process.env.NODE_ENV === 'test';

export const TIMESTAMP_COLUMN_TYPE: ColumnType = isTestEnv ? 'datetime' : 'timestamptz';
export const JSONB_COLUMN_TYPE: ColumnType = isTestEnv ? 'simple-json' : 'jsonb';
export const JSONB_DEFAULT_EXPRESSION = isTestEnv ? "'{}'" : "'{}'::jsonb";
