import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import multipart from '@fastify/multipart';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(multipart);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen({ port, host: '0.0.0.0' });
  Logger.log(`Ingest API listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  // TODO(need-confirmation): уточнить политику репорта ошибок при запуске
  Logger.error(error, 'Bootstrap');
  process.exitCode = 1;
});
