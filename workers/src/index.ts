import { loadConfig } from './config';
import { createLogger } from './logger';
import { PostgresPersistence } from './db';
import { Aggregator } from './aggregator';
import { NatsWorker } from './nats-consumer';
import { CsvFinalizer } from './finalizer';
import { PostgresFinalizerStore } from './finalizer-store';

async function bootstrap() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const persistence = new PostgresPersistence(config.databaseUrl);
  const finalizerStore = new PostgresFinalizerStore(config.databaseUrl);
  const finalizer = new CsvFinalizer(config, finalizerStore);
  const aggregator = new Aggregator(persistence, finalizer);
  const worker = new NatsWorker(aggregator, config);

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await worker.stop();
    await persistence.close();
    await finalizer.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await worker.stop();
    await persistence.close();
    await finalizer.close();
    process.exit(0);
  });

  await worker.start();
}

bootstrap().catch((error) => {
  const logger = createLogger('error');
  logger.error({ error: (error as Error).message }, 'Worker failed to start');
  process.exit(1);
});
