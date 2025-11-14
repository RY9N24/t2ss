import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'demo_uploads' })
export class DemoUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'file_path' })
  filePath!: string;

  @Column({ name: 'original_filename', nullable: true })
  originalFilename?: string | null;

  @Column({ type: 'simple-json', name: 'meta_headers' })
  metaHeaders!: Record<string, unknown>;
}
