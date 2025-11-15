import 'dotenv/config';

export interface WorkerConfig {
  natsUrl: string;
  natsSubject: string;
  durableName: string;
  databaseUrl: string;
  logLevel: string;
}

export function loadConfig(): WorkerConfig {
  return {
    natsUrl: process.env.NATS_URL ?? 'nats://nats:4222',
    natsSubject: process.env.NATS_SUBJECT_MATCHZY_EVENTS ?? 'matchzy.events.raw',
    durableName: process.env.NATS_DURABLE_NAME ?? 'matchzy-workers',
    databaseUrl: process.env.DATABASE_URL ?? 'postgres://matchzy:matchzy@postgres:5432/matchzy',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
