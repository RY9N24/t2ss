import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DemoStorageService } from './services/demo-storage.service';
import { DemoUploadService } from './services/demo-upload.service';

@Controller()
export class DemoIngestController {
  constructor(
    private readonly storage: DemoStorageService,
    private readonly uploads: DemoUploadService,
  ) {}

  /**
   * MatchZy GOTV & Demos: https://shobhit-pathak.github.io/MatchZy/gotv/
   */
  @Post('/ingest/demo')
  @HttpCode(202)
  async ingestDemo(
    @Req() request: FastifyRequest,
    @Headers() headers: FastifyRequest['headers'],
  ): Promise<{ status: 'stored' }> {
    const originalFilenameHeader = headers['matchzy-filename'];
    const originalFilename = Array.isArray(originalFilenameHeader)
      ? originalFilenameHeader[0]
      : (originalFilenameHeader ?? null);
    const stream = request.raw;
    const { filePath } = await this.storage.saveStream(stream, originalFilename);

    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, value]),
    ) as Record<string, unknown>;

    await this.uploads.recordUpload({
      filePath,
      originalFilename,
      metaHeaders: normalizedHeaders,
    });

    return { status: 'stored' };
  }
}
