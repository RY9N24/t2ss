import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { MatchzyEventsPublisher } from './services/matchzy-events.publisher';

@Controller()
export class MatchzyIngestController {
  constructor(private readonly publisher: MatchzyEventsPublisher) {}

  /**
   * MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
   */
  @Post('/ingest/matchzy')
  @HttpCode(200)
  async ingestMatchzyEvent(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization: string | undefined,
    @Headers() headers: FastifyRequest['headers'],
  ): Promise<{ status: 'accepted' }> {
    const expected = process.env.SERVER_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Server token is not configured');
    }

    const [scheme, token] = authorization ? authorization.split(' ') : [];
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer' || token !== expected) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    await this.publisher.publish({ body, headers });
    return { status: 'accepted' };
  }
}
