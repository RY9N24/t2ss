import { Body, Controller, Get, Patch, Post, Param, Query, Res, Req, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Controller('system')
export class SystemController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('disk')
  async disk() {
    return this.dashboard.getDiskStats();
  }

  @Get('tournaments')
  async tournaments() {
    return this.dashboard.listTournaments();
  }

  /**
   * NATS JetStream Monitoring: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring/monitoring_jetstream
   */
  @Get('jsz')
  async jetStream() {
    return this.dashboard.getJetStreamSummary();
  }

  @Get('database')
  async database() {
    return this.dashboard.getDatabaseSize();
  }

  @Get('tournaments/:id/export/:format')
  async exportTournament(
    @Param('id') id: string,
    @Param('format') format: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const allowed: Array<'csv' | 'xlsx' | 'sqlite'> = ['csv', 'xlsx', 'sqlite'];
    if (!allowed.includes(format as any)) {
      throw new BadRequestException('Unsupported export format');
    }
    const file = await this.dashboard.exportTournamentSnapshot(id, format as any);
    reply.header('Content-Type', file.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
    return reply.send(file.buffer);
  }

  @Post('tournaments/import/csv')
  async importCsv(@Req() request: FastifyRequest, @Query('apply') apply?: string) {
    const upload = await this.readUpload(request);
    return this.dashboard.importTournamentFromCsv(upload, apply === 'true');
  }

  @Post('tournaments/import/sqlite')
  async importSqlite(@Req() request: FastifyRequest, @Query('apply') apply?: string) {
    const upload = await this.readUpload(request);
    return this.dashboard.importTournamentFromSqlite(upload, apply === 'true');
  }

  @Get('emergency-gc')
  async emergencyGcSettings() {
    return this.dashboard.getEmergencyGcSettings();
  }

  @Patch('emergency-gc')
  async updateEmergencyGc(@Body() body: { enabled?: boolean; graceMinutes?: number; notifyPanel?: boolean; notifyBot?: boolean }) {
    return this.dashboard.updateEmergencyGcSettings(body ?? {});
  }

  @Post('emergency-gc/run')
  async runEmergencyGc(@Body('force') force?: boolean) {
    return this.dashboard.triggerEmergencyGc(Boolean(force));
  }

  @Post('backup/export')
  async backup(@Res({ passthrough: false }) reply: FastifyReply) {
    const archive = await this.dashboard.createDatabaseBackup();
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${archive.filename}"`);
    return reply.send(archive.buffer);
  }

  @Post('backup/restore')
  async restore(@Req() request: FastifyRequest, @Query('apply') apply?: string) {
    const upload = await this.readUpload(request);
    return this.dashboard.restoreDatabaseBackup(upload, apply === 'true');
  }

  private async readUpload(request: FastifyRequest): Promise<Buffer> {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
