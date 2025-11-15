import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFile } from '../../database/entities/file.entity';

@Injectable()
export class DemoUploadService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly repository: Repository<StoredFile>,
  ) {}

  async recordUpload(input: {
    filePath: string;
    originalFilename: string | null;
    metaHeaders: Record<string, unknown>;
    contentType?: string | null;
    sizeBytes?: number | null;
  }): Promise<StoredFile> {
    const entity = this.repository.create({
      storagePath: input.filePath,
      originalFilename: input.originalFilename,
      metaHeaders: input.metaHeaders,
      contentType: input.contentType ?? null,
      sizeBytes:
        typeof input.sizeBytes === 'number' ? input.sizeBytes.toString() : null,
    });
    return this.repository.save(entity);
  }
}
