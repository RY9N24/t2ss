import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddServerTokensAndStatus1706040003000 implements MigrationInterface {
  name = 'AddServerTokensAndStatus1706040003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'servers',
      new TableColumn({
        name: 'last_seen_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'server_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
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
            name: 'server_id',
            type: 'uuid',
          },
          {
            name: 'token_hash',
            type: 'text',
          },
          {
            name: 'label',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_used_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'revoked_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_server_tokens_server_token',
            columnNames: ['server_id', 'token_hash'],
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'server_tokens',
      new TableForeignKey({
        columnNames: ['server_id'],
        referencedTableName: 'servers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('server_tokens');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.includes('server_id'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('server_tokens', foreignKey);
    }
    await queryRunner.dropTable('server_tokens');
    await queryRunner.dropColumn('servers', 'last_seen_at');
  }
}
