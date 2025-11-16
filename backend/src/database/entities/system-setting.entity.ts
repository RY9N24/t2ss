import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { JSONB_COLUMN_TYPE, JSONB_DEFAULT_EXPRESSION, TIMESTAMP_COLUMN_TYPE } from './column-types';

@Entity({ name: 'system_settings' })
export class SystemSetting {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ name: 'value', type: JSONB_COLUMN_TYPE, default: () => JSONB_DEFAULT_EXPRESSION })
  value!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
