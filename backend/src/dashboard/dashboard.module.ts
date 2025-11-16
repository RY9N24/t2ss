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
  SystemSetting,
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
import { EmergencyGcService } from './emergency-gc.service';

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
      SystemSetting,
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
  providers: [DashboardService, EmergencyGcService],
  exports: [DashboardService],
})
export class DashboardModule {}
