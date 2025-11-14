import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestModule } from './ingest/ingest.module';
import { DemoUpload } from './ingest/demo-upload.entity';

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
            entities: [DemoUpload],
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
          entities: [DemoUpload],
          synchronize: true,
        };
      },
    }),
    IngestModule,
  ],
})
export class AppModule {}
