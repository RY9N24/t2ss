import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from './column-types';

export abstract class TimestampedEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
