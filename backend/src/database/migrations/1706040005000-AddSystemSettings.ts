import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemSettings1706040005000 implements MigrationInterface {
  name = 'AddSystemSettings1706040005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const isSqlite = driver === 'sqlite' || driver === 'better-sqlite3';
    const jsonType = isSqlite ? 'text' : 'jsonb';
    const jsonDefault = isSqlite ? "'{}'" : "'{}'::jsonb";
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY,
        "value" ${jsonType} NOT NULL DEFAULT ${jsonDefault},
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "system_settings"');
  }
}
