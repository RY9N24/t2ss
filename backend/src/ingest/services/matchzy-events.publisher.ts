import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection } from 'nats';

@Injectable()
export class MatchzyEventsPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(MatchzyEventsPublisher.name);
  private connection?: NatsConnection;
  private readonly subject: string;

  constructor(private readonly configService: ConfigService) {
    // NATS JetStream advisories & monitoring: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
    this.subject = this.configService.get<string>('NATS_SUBJECT_MATCHZY_EVENTS', 'matchzy.events.raw');
  }

  private async getConnection(): Promise<NatsConnection> {
    if (this.connection) {
      return this.connection;
    }

    const servers = this.configService.get<string>('NATS_URL', 'nats://nats:4222');
    this.connection = await connect({ servers });
    this.logger.log(`Connected to NATS at ${servers}`);
    return this.connection;
  }

  async publish(rawPayload: unknown): Promise<void> {
    const connection = await this.getConnection();
    const data = Buffer.from(JSON.stringify(rawPayload));
    await connection.publish(this.subject, data);
    this.logger.debug(`Published event to ${this.subject}`);
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
