import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { Map } from './map.entity';
import { JSONB_COLUMN_TYPE, JSONB_DEFAULT_EXPRESSION, TIMESTAMP_COLUMN_TYPE } from './column-types';

@Entity({ name: 'files' })
@Index(['matchId'])
@Index(['mapId'])
export class StoredFile extends TimestampedEntity {
  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename?: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType?: string | null;

  @Column({ name: 'meta_headers', type: JSONB_COLUMN_TYPE, default: () => JSONB_DEFAULT_EXPRESSION })
  metaHeaders!: Record<string, unknown>;

  @Column({ name: 'status', type: 'text', default: () => "'stored'" })
  status!: string;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ name: 'is_in_use', type: 'boolean', default: false })
  isInUse!: boolean;

  @Column({ name: 'deleted_at', type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'matchzy_match_id', type: 'text', nullable: true })
  matchzyMatchId?: string | null;

  @Column({ name: 'matchzy_map_number', type: 'smallint', nullable: true })
  matchzyMapNumber?: number | null;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId?: string | null;

  @ManyToOne(() => Match, (match) => match.files, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  match?: Match | null;

  @Column({ name: 'map_id', type: 'uuid', nullable: true })
  mapId?: string | null;

  @ManyToOne(() => Map, (map) => map.files, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  map?: Map | null;
}
