import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddMatchFinalisationColumns1706040002000 implements MigrationInterface {
  name = 'AddMatchFinalisationColumns1706040002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('matches', [
      new TableColumn({ name: 'team1_score', type: 'integer', default: '0' }),
      new TableColumn({ name: 'team2_score', type: 'integer', default: '0' }),
      new TableColumn({ name: 'winner_team_id', type: 'uuid', isNullable: true }),
    ]);

    await queryRunner.createForeignKey(
      'matches',
      new TableForeignKey({
        columnNames: ['winner_team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.addColumns('maps', [
      new TableColumn({ name: 'team1_score', type: 'integer', default: '0' }),
      new TableColumn({ name: 'team2_score', type: 'integer', default: '0' }),
      new TableColumn({ name: 'winner_team_id', type: 'uuid', isNullable: true }),
    ]);

    await queryRunner.createForeignKey(
      'maps',
      new TableForeignKey({
        columnNames: ['winner_team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.addColumns('player_stats', [
      new TableColumn({ name: 'damage', type: 'integer', default: '0' }),
      new TableColumn({ name: 'enemy_5ks', type: 'integer', default: '0' }),
      new TableColumn({ name: 'enemy_4ks', type: 'integer', default: '0' }),
      new TableColumn({ name: 'enemy_3ks', type: 'integer', default: '0' }),
      new TableColumn({ name: 'enemy_2ks', type: 'integer', default: '0' }),
      new TableColumn({ name: 'utility_count', type: 'integer', default: '0' }),
      new TableColumn({ name: 'utility_successes', type: 'integer', default: '0' }),
      new TableColumn({ name: 'utility_enemies', type: 'integer', default: '0' }),
      new TableColumn({ name: 'flash_count', type: 'integer', default: '0' }),
      new TableColumn({ name: 'flash_successes', type: 'integer', default: '0' }),
      new TableColumn({ name: 'health_points_removed_total', type: 'integer', default: '0' }),
      new TableColumn({ name: 'health_points_dealt_total', type: 'integer', default: '0' }),
      new TableColumn({ name: 'shots_fired_total', type: 'integer', default: '0' }),
      new TableColumn({ name: 'shots_on_target_total', type: 'integer', default: '0' }),
      new TableColumn({ name: 'v1_count', type: 'integer', default: '0' }),
      new TableColumn({ name: 'v1_wins', type: 'integer', default: '0' }),
      new TableColumn({ name: 'v2_count', type: 'integer', default: '0' }),
      new TableColumn({ name: 'v2_wins', type: 'integer', default: '0' }),
      new TableColumn({ name: 'entry_count', type: 'integer', default: '0' }),
      new TableColumn({ name: 'entry_wins', type: 'integer', default: '0' }),
      new TableColumn({ name: 'equipment_value', type: 'integer', default: '0' }),
      new TableColumn({ name: 'money_saved', type: 'integer', default: '0' }),
      new TableColumn({ name: 'kill_reward', type: 'integer', default: '0' }),
      new TableColumn({ name: 'live_time', type: 'integer', default: '0' }),
      new TableColumn({ name: 'head_shot_kills', type: 'integer', default: '0' }),
      new TableColumn({ name: 'cash_earned', type: 'integer', default: '0' }),
      new TableColumn({ name: 'enemies_flashed', type: 'integer', default: '0' }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const matchesTable = await queryRunner.getTable('matches');
    const mapsTable = await queryRunner.getTable('maps');

    const matchesFk = matchesTable?.foreignKeys.find((fk) => fk.columnNames.includes('winner_team_id'));
    if (matchesFk) {
      await queryRunner.dropForeignKey('matches', matchesFk);
    }
    await queryRunner.dropColumn('matches', 'winner_team_id');
    await queryRunner.dropColumn('matches', 'team2_score');
    await queryRunner.dropColumn('matches', 'team1_score');

    const mapsFk = mapsTable?.foreignKeys.find((fk) => fk.columnNames.includes('winner_team_id'));
    if (mapsFk) {
      await queryRunner.dropForeignKey('maps', mapsFk);
    }
    await queryRunner.dropColumn('maps', 'winner_team_id');
    await queryRunner.dropColumn('maps', 'team2_score');
    await queryRunner.dropColumn('maps', 'team1_score');

    const playerColumns = [
      'damage',
      'enemy_5ks',
      'enemy_4ks',
      'enemy_3ks',
      'enemy_2ks',
      'utility_count',
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
    ];

    for (const column of playerColumns) {
      await queryRunner.dropColumn('player_stats', column);
    }
  }
}
