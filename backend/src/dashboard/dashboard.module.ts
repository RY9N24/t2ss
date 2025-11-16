import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLogEntry,
  GameServer,
  Map,
  MapEventAggregate,
  Match,
  Player,
  PlayerStats,
  RawEvent,
  ServerToken,
  StoredFile,
  Team,
  Tournament,
} from '../database/entities';
import { DashboardService } from './dashboard.service';
import { LiveController } from './live.controller';
import { MatchesController } from './matches.controller';
import { ServersController } from './servers.controller';
import { SystemController } from './system.controller';
import { AdminController } from './admin.controller';
import { DemosController } from './demos.controller';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([
      AuditLogEntry,
      GameServer,
      Map,
      MapEventAggregate,
      Match,
      Player,
      PlayerStats,
      RawEvent,
      ServerToken,
      StoredFile,
      Team,
      Tournament,
    ]),
  ],
  controllers: [
    LiveController,
    MatchesController,
    ServersController,
    SystemController,
    AdminController,
    DemosController,
  ],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
