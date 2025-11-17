import { connect, consumerOpts, createInbox, JetStreamSubscription } from 'nats';
import { Aggregator } from './aggregator';
import { WorkerConfig } from './config';
import { createLogger } from './logger';

export class NatsWorker {
  private subscription?: JetStreamSubscription;

  constructor(private readonly aggregator: Aggregator, private readonly config: WorkerConfig) {}

  async start(): Promise<void> {
    const logger = createLogger(this.config.logLevel);
    const connection = await connect({ servers: this.config.natsUrl });
    const js = connection.jetstream();

    const opts = consumerOpts();
    // JetStream consumer options per official monitoring & advisories guide:
    // https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
    opts.durable(this.config.durableName);
    opts.manualAck();
    opts.ackExplicit();
    opts.deliverTo(createInbox());

    this.subscription = await js.subscribe(this.config.natsSubject, opts);
    logger.info({ subject: this.config.natsSubject, durable: this.config.durableName }, 'Subscribed to JetStream');

    (async () => {
      for await (const message of this.subscription!) {
        const info = message.info;
        const headers: Record<string, unknown> = {};
        if (message.headers) {
          for (const [key, value] of message.headers.entries()) {
            headers[key] = value;
          }
        }

        try {
          const result = await this.aggregator.process(
            info.subject,
            message.data,
            headers,
            info.streamSequence,
          );
          message.ack();
          logger.debug({ seq: info.streamSequence, result }, 'Processed event');
        } catch (error) {
          logger.error(
            { error: (error as Error).message, seq: info.streamSequence },
            'Failed to process event; NATS will redeliver',
          );
          message.term();
        }
      }

      await connection.drain();
    })().catch((error) => {
      logger.error({ error: (error as Error).message }, 'Worker loop crashed');
    });
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.drain();
      this.subscription = undefined;
    }
  }
}
