import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAggregationState1706040001000 implements MigrationInterface {
  name = 'CreateAggregationState1706040001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'map_event_aggregates',
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
            name: 'server_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'match_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'map_no',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'count',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'last_event_ts',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'last_idempotency_key',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'map_event_aggregates',
      new TableIndex({
        name: 'UQ_map_event_aggregates_identity',
        columnNames: ['server_id', 'match_id', 'map_no', 'event_type'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'event_offsets',
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
            name: 'server_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'match_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'map_no',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'last_sequence',
            type: 'bigint',
            isNullable: false,
            default: 0,
          },
          {
            name: 'last_event_ts',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'event_offsets',
      new TableIndex({
        name: 'UQ_event_offsets_identity',
        columnNames: ['server_id', 'match_id', 'map_no'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('event_offsets', 'UQ_event_offsets_identity');
    await queryRunner.dropTable('event_offsets');

    await queryRunner.dropIndex('map_event_aggregates', 'UQ_map_event_aggregates_identity');
    await queryRunner.dropTable('map_event_aggregates');
  }
}
