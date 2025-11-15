import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { IngestModule } from './ingest/ingest.module';
import { StoredFile } from './database/entities/file.entity';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isTest = config.get('NODE_ENV') === 'test';
        if (isTest) {
          return {
            type: 'sqlite',
            database: ':memory:',
            entities: [StoredFile],
            synchronize: true,
          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('POSTGRES_HOST', 'postgres'),
          port: Number(config.get<number>('POSTGRES_PORT', 5432)),
          username: config.get<string>('POSTGRES_USER', 'matchzy'),
          password: config.get<string>('POSTGRES_PASSWORD', 'matchzy'),
          database: config.get<string>('POSTGRES_DB', 'matchzy'),
          autoLoadEntities: true,
          entities: [join(__dirname, '**/*.entity.{ts,js}')],
          migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
          synchronize: false,
          migrationsRun: true,
        };
      },
    }),
    IngestModule,
    DashboardModule,
  ],
})
export class AppModule {}
