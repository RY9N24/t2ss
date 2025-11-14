import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DemoUpload } from '../demo-upload.entity';

@Injectable()
export class DemoUploadService {
  constructor(
    @InjectRepository(DemoUpload)
    private readonly repository: Repository<DemoUpload>,
  ) {}

  async recordUpload(input: {
    filePath: string;
    originalFilename: string | null;
    metaHeaders: Record<string, unknown>;
  }): Promise<DemoUpload> {
    const entity = this.repository.create(input);
    return this.repository.save(entity);
  }
}
