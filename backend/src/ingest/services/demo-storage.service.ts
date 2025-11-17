import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

@Injectable()
export class DemoStorageService {
  private readonly logger = new Logger(DemoStorageService.name);
  private readonly storagePath: string;

  constructor(config: ConfigService) {
    this.storagePath = config.get<string>('DEMO_STORAGE_PATH', join(process.cwd(), 'storage/demos'));
  }

  async saveStream(
    stream: Readable,
    originalName?: string | null,
  ): Promise<{ filePath: string; originalFilename: string | null }> {
    await fs.mkdir(this.storagePath, { recursive: true });
    const safeName = originalName ? originalName.replace(/[^A-Za-z0-9_.-]/g, '_') : undefined;
    const fileName = `${Date.now()}-${randomUUID()}.zip`;
    const targetName = safeName ? `${safeName}-${fileName}` : fileName;
    const fullPath = join(this.storagePath, targetName);

    const writeStream = createWriteStream(fullPath);
    await pipeline(stream, writeStream);
    this.logger.debug(`Stored demo at ${fullPath}`);

    return { filePath: fullPath, originalFilename: originalName ?? null };
  }
}
