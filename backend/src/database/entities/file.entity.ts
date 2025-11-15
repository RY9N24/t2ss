import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TimestampedEntity } from './timestamped.entity';
import { Match } from './match.entity';
import { Map } from './map.entity';

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

  @Column({ name: 'meta_headers', type: 'jsonb', default: () => "'{}'::jsonb" })
  metaHeaders!: Record<string, unknown>;

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
