import { Column, Entity, Index } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';

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

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
