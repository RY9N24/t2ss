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
    const contentTypeHeader = headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : (contentTypeHeader ?? null);
    const contentLengthHeader = headers['content-length'];
    const parsedSize = Array.isArray(contentLengthHeader)
      ? Number(contentLengthHeader[0])
      : contentLengthHeader
      ? Number(contentLengthHeader)
      : undefined;
    const sizeBytes = Number.isFinite(parsedSize ?? NaN)
      ? (parsedSize as number)
      : null;
    const stream = request.raw;
    const { filePath } = await this.storage.saveStream(stream, originalFilename);

    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, value]),
    ) as Record<string, unknown>;

    const matchzyMatchIdHeader = headers['matchzy-matchid'];
    const matchzyMatchId = Array.isArray(matchzyMatchIdHeader)
      ? (matchzyMatchIdHeader[0] as string)
      : (matchzyMatchIdHeader as string | undefined) ?? null;
    const matchzyMapHeader = headers['matchzy-mapnumber'];
    const mapNumberValue = Array.isArray(matchzyMapHeader)
      ? matchzyMapHeader[0]
      : matchzyMapHeader;
    const matchzyMapNumber = mapNumberValue !== undefined ? Number(mapNumberValue) : null;

    await this.uploads.recordUpload({
      filePath,
      originalFilename,
      metaHeaders: normalizedHeaders,
      contentType,
      sizeBytes,
      matchzyMatchId,
      matchzyMapNumber: Number.isFinite(matchzyMapNumber ?? NaN)
        ? (matchzyMapNumber as number)
        : null,
    });

    return { status: 'stored' };
  }
}
