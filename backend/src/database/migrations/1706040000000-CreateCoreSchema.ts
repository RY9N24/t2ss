import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCoreSchema1706040000000 implements MigrationInterface {
  name = 'CreateCoreSchema1706040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'tournaments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'slug',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'external_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_tournaments_slug',
            columnNames: ['slug'],
          },
          {
            name: 'UQ_tournaments_external_id',
            columnNames: ['external_id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'servers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'endpoint',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'location',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_servers_endpoint',
            columnNames: ['endpoint'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'short_name',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'logo_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'external_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tournament_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['tournament_id'],
            referencedTableName: 'tournaments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'teams',
      new TableIndex({
        name: 'IDX_teams_tournament_name',
        columnNames: ['tournament_id', 'name'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'players',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'nickname',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'first_name',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_name',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'steam_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'country',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'team_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'tournament_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_players_steam_id',
            columnNames: ['steam_id'],
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new TableForeignKey({
            columnNames: ['tournament_id'],
            referencedTableName: 'tournaments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'matches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'tournament_id',
            type: 'uuid',
          },
          {
            name: 'server_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'external_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            default: "'scheduled'",
          },
          {
            name: 'best_of',
            type: 'smallint',
            default: 1,
          },
          {
            name: 'scheduled_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'home_team_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'away_team_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['tournament_id'],
            referencedTableName: 'tournaments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['server_id'],
            referencedTableName: 'servers',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new TableForeignKey({
            columnNames: ['home_team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new TableForeignKey({
            columnNames: ['away_team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'matches',
      new TableIndex({
        name: 'IDX_matches_tournament_external',
        columnNames: ['tournament_id', 'external_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'matches',
      new TableIndex({
        name: 'IDX_matches_server',
        columnNames: ['server_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'maps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'match_id',
            type: 'uuid',
          },
          {
            name: 'map_number',
            type: 'integer',
          },
          {
            name: 'name',
            type: 'text',
          },
          {
            name: 'status',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'matchzy_map_number',
            type: 'smallint',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['match_id'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'maps',
      new TableIndex({
        name: 'IDX_maps_match_number',
        columnNames: ['match_id', 'map_number'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'storage_path',
            type: 'text',
          },
          {
            name: 'original_filename',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'size_bytes',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'content_type',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'meta_headers',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'match_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'map_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['match_id'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['map_id'],
            referencedTableName: 'maps',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'files',
      new TableIndex({
        name: 'IDX_files_match',
        columnNames: ['match_id'],
      }),
    );
    await queryRunner.createIndex(
      'files',
      new TableIndex({
        name: 'IDX_files_map',
        columnNames: ['map_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'player_stats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'map_id',
            type: 'uuid',
          },
          {
            name: 'player_id',
            type: 'uuid',
          },
          {
            name: 'team_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'match_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'rounds',
            type: 'integer',
            default: 0,
          },
          {
            name: 'kills',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deaths',
            type: 'integer',
            default: 0,
          },
          {
            name: 'assists',
            type: 'integer',
            default: 0,
          },
          {
            name: 'kast',
            type: 'numeric(5,2)',
            default: '0',
          },
          {
            name: 'adr',
            type: 'numeric(6,2)',
            default: '0',
          },
          {
            name: 'rating',
            type: 'numeric(4,2)',
            default: '0',
          },
          {
            name: 'headshot_percentage',
            type: 'numeric(5,2)',
            default: '0',
          },
          {
            name: 'opening_kills',
            type: 'integer',
            default: 0,
          },
          {
            name: 'opening_deaths',
            type: 'integer',
            default: 0,
          },
          {
            name: 'clutches_won',
            type: 'integer',
            default: 0,
          },
          {
            name: 'clutches_played',
            type: 'integer',
            default: 0,
          },
          {
            name: 'multi_kill_rounds',
            type: 'integer',
            default: 0,
          },
          {
            name: 'utility_damage',
            type: 'integer',
            default: 0,
          },
          {
            name: 'flash_assists',
            type: 'integer',
            default: 0,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['map_id'],
            referencedTableName: 'maps',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['player_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new TableForeignKey({
            columnNames: ['match_id'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'player_stats',
      new TableIndex({
        name: 'IDX_player_stats_map_player',
        columnNames: ['map_id', 'player_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'player_stats',
      new TableIndex({
        name: 'IDX_player_stats_match',
        columnNames: ['match_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'events_raw',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'subject',
            type: 'text',
          },
          {
            name: 'idempotency_key',
            type: 'text',
          },
          {
            name: 'payload',
            type: 'jsonb',
          },
          {
            name: 'headers',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'matchzy_match_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'match_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_events_raw_idempotency_key',
            columnNames: ['idempotency_key'],
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['match_id'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'events_raw',
      new TableIndex({
        name: 'IDX_events_raw_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'audit_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'category',
            type: 'text',
          },
          {
            name: 'action',
            type: 'text',
          },
          {
            name: 'entity_type',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
        ],
      }),
    );
    await queryRunner.createIndex(
      'audit_log',
      new TableIndex({
        name: 'IDX_audit_log_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'bot_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'chat_id',
            type: 'bigint',
          },
          {
            name: 'tournament_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'language_code',
            type: 'varchar(10)',
            default: "'en'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['tournament_id'],
            referencedTableName: 'tournaments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
    await queryRunner.createIndex(
      'bot_subscriptions',
      new TableIndex({
        name: 'IDX_bot_subscriptions_chat_tournament',
        columnNames: ['chat_id', 'tournament_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('bot_subscriptions', 'IDX_bot_subscriptions_chat_tournament');
    await queryRunner.dropTable('bot_subscriptions');

    await queryRunner.dropIndex('audit_log', 'IDX_audit_log_created_at');
    await queryRunner.dropTable('audit_log');

    await queryRunner.dropIndex('events_raw', 'IDX_events_raw_created_at');
    await queryRunner.dropTable('events_raw');

    await queryRunner.dropIndex('player_stats', 'IDX_player_stats_match');
    await queryRunner.dropIndex('player_stats', 'IDX_player_stats_map_player');
    await queryRunner.dropTable('player_stats');

    await queryRunner.dropIndex('files', 'IDX_files_map');
    await queryRunner.dropIndex('files', 'IDX_files_match');
    await queryRunner.dropTable('files');

    await queryRunner.dropIndex('maps', 'IDX_maps_match_number');
    await queryRunner.dropTable('maps');

    await queryRunner.dropIndex('matches', 'IDX_matches_server');
    await queryRunner.dropIndex('matches', 'IDX_matches_tournament_external');
    await queryRunner.dropTable('matches');

    await queryRunner.dropTable('players');

    await queryRunner.dropIndex('teams', 'IDX_teams_tournament_name');
    await queryRunner.dropTable('teams');

    await queryRunner.dropTable('servers');

    await queryRunner.dropTable('tournaments');
  }
}
