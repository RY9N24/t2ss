import { Column, Entity, Index } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { JSONB_COLUMN_TYPE, JSONB_DEFAULT_EXPRESSION } from './column-types';

@Entity({ name: 'audit_log' })
@Index(['createdAt'])
export class AuditLogEntry extends TimestampedEntity {
  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ name: 'entity_type', type: 'text', nullable: true })
  entityType?: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  @Column({ type: JSONB_COLUMN_TYPE, default: () => JSONB_DEFAULT_EXPRESSION })
  metadata!: Record<string, unknown>;
}
