import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchzyIngestController } from './matchzy-ingest.controller';
import { DemoIngestController } from './matchzy-demo.controller';
import { StoredFile } from '../database/entities/file.entity';
import { DemoStorageService } from './services/demo-storage.service';
import { DemoUploadService } from './services/demo-upload.service';
import { MatchzyEventsPublisher } from './services/matchzy-events.publisher';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFile])],
  controllers: [MatchzyIngestController, DemoIngestController],
  providers: [DemoStorageService, DemoUploadService, MatchzyEventsPublisher],
  exports: [MatchzyEventsPublisher],
})
export class IngestModule {}
