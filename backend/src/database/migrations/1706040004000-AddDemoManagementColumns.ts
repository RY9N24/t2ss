import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDemoManagementColumns1706040004000 implements MigrationInterface {
  name = 'AddDemoManagementColumns1706040004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('files', [
      new TableColumn({ name: 'status', type: 'text', isNullable: false, default: "'stored'" }),
      new TableColumn({ name: 'is_pinned', type: 'boolean', isNullable: false, default: 'false' }),
      new TableColumn({ name: 'is_in_use', type: 'boolean', isNullable: false, default: 'false' }),
      new TableColumn({ name: 'deleted_at', type: 'timestamptz', isNullable: true }),
      new TableColumn({ name: 'matchzy_match_id', type: 'text', isNullable: true }),
      new TableColumn({ name: 'matchzy_map_number', type: 'smallint', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('files', [
      'matchzy_map_number',
      'matchzy_match_id',
      'deleted_at',
      'is_in_use',
      'is_pinned',
      'status',
    ]);
  }
}
