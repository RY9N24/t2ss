import 'dotenv/config';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

const migrations = [join(__dirname, 'migrations/*.{ts,js}')];
const entities = [join(__dirname, '..', '**/*.entity.{ts,js}')];

const url = process.env.DATABASE_URL;

const options: DataSourceOptions = url
  ? {
      type: 'postgres',
      url,
      entities,
      migrations,
      migrationsRun: false,
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'postgres',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'matchzy',
      password: process.env.POSTGRES_PASSWORD ?? 'matchzy',
      database: process.env.POSTGRES_DB ?? 'matchzy',
      entities,
      migrations,
      migrationsRun: false,
      synchronize: false,
    };

const dataSource = new DataSource(options);

export default dataSource;
