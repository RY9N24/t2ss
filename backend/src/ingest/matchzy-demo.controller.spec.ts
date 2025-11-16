import { Readable } from 'node:stream';
import type { FastifyRequest } from 'fastify';
import { DemoIngestController } from './matchzy-demo.controller';
import { DemoStorageService } from './services/demo-storage.service';
import { DemoUploadService } from './services/demo-upload.service';

describe('DemoIngestController', () => {
  const storageMock = {
    saveStream: jest.fn(async () => ({ filePath: '/tmp/demos/demo.zip', originalFilename: 'demo.zip' })),
  };
  const uploadsMock = {
    recordUpload: jest.fn(async () => ({})),
  };

  const controller = new DemoIngestController(
    storageMock as unknown as DemoStorageService,
    uploadsMock as unknown as DemoUploadService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores demo stream and headers', async () => {
    const streamPayload = Buffer.from('PK\u0003\u0004', 'binary');
    const request = {
      raw: Readable.from([streamPayload]),
    } as unknown as FastifyRequest;

    const headers = {
      'matchzy-filename': 'demo.zip',
      'matchzy-matchid': 'abc',
      'matchzy-mapnumber': '1',
    } as Record<string, string>;

    const response = await controller.ingestDemo(request, headers);

    expect(storageMock.saveStream).toHaveBeenCalledWith(expect.any(Readable), 'demo.zip');
    expect(uploadsMock.recordUpload).toHaveBeenCalledWith({
      filePath: '/tmp/demos/demo.zip',
      originalFilename: 'demo.zip',
      metaHeaders: headers,
      contentType: null,
      sizeBytes: null,
      matchzyMatchId: 'abc',
      matchzyMapNumber: 1,
    });
    expect(response).toEqual({ status: 'stored' });
  });
});
