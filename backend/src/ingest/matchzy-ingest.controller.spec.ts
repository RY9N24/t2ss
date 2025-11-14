import { UnauthorizedException } from '@nestjs/common';
import { MatchzyIngestController } from './matchzy-ingest.controller';
import { MatchzyEventsPublisher } from './services/matchzy-events.publisher';

describe('MatchzyIngestController', () => {
  const publishMock = jest.fn();
  const controller = new MatchzyIngestController({ publish: publishMock } as unknown as MatchzyEventsPublisher);

  beforeEach(() => {
    publishMock.mockReset();
    process.env.SERVER_TOKEN = 'secret';
  });

  it('publishes payload when authorization header is valid', async () => {
    await controller.ingestMatchzyEvent({ foo: 'bar' }, 'Bearer secret', { authorization: 'Bearer secret' });

    expect(publishMock).toHaveBeenCalledWith({
      body: { foo: 'bar' },
      headers: { authorization: 'Bearer secret' },
    });
  });

  it('throws when token mismatches', async () => {
    await expect(() => controller.ingestMatchzyEvent({}, 'Bearer nope', { authorization: 'Bearer nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
