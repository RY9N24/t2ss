import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service';

interface DemoQuery {
  tournamentId?: string;
  status?: string;
  pinned?: boolean;
  inUse?: boolean;
  from?: Date;
  to?: Date;
  minSize?: number;
  maxSize?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

@Controller('demos')
export class DemosController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async list(@Query() query: Record<string, string | string[]>) {
    const filters = this.parseFilters(query);
    return this.dashboard.listDemoFiles(filters);
  }

  @Get('options')
  async options() {
    return this.dashboard.getDemoFilterOptions();
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res({ passthrough: false }) reply: FastifyReply) {
    const download = await this.dashboard.getDemoDownloadStream(id);
    reply.header('Content-Type', download.contentType ?? 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${download.filename}"`);
    return reply.send(download.stream);
  }

  @Post('delete')
  @HttpCode(200)
  async bulkDelete(@Body('ids') ids: string[] | undefined) {
    return this.dashboard.deleteDemoFiles(Array.isArray(ids) ? ids : []);
  }

  @Post(':id/reupload')
  async reupload(@Param('id') id: string) {
    return this.dashboard.requestDemoReupload(id);
  }

  @Patch(':id/flags')
  async updateFlags(@Param('id') id: string, @Body() body: { isPinned?: boolean; isInUse?: boolean }) {
    return this.dashboard.updateDemoFlags(id, body ?? {});
  }

  private parseFilters(query: Record<string, string | string[]>): DemoQuery {
    const normalize = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
    const filters: DemoQuery = {};
    const tournamentId = normalize(query['tournamentId']);
    if (tournamentId) {
      filters.tournamentId = tournamentId;
    }
    const status = normalize(query['status']);
    if (status) {
      filters.status = status;
    }
    const pinned = normalize(query['pinned']);
    if (pinned === 'true') filters.pinned = true;
    if (pinned === 'false') filters.pinned = false;
    const inUse = normalize(query['inUse']);
    if (inUse === 'true') filters.inUse = true;
    if (inUse === 'false') filters.inUse = false;
    const from = normalize(query['from']);
    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) filters.from = parsed;
    }
    const to = normalize(query['to']);
    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) filters.to = parsed;
    }
    const minSize = normalize(query['minSize']);
    if (minSize) {
      const parsed = Number(minSize);
      if (Number.isFinite(parsed)) filters.minSize = parsed * 1024 * 1024;
    }
    const maxSize = normalize(query['maxSize']);
    if (maxSize) {
      const parsed = Number(maxSize);
      if (Number.isFinite(parsed)) filters.maxSize = parsed * 1024 * 1024;
    }
    const search = normalize(query['search']);
    if (search) filters.search = search;
    const limit = normalize(query['limit']);
    if (limit) {
      const parsed = Number(limit);
      if (Number.isFinite(parsed)) filters.limit = parsed;
    }
    const offset = normalize(query['offset']);
    if (offset) {
      const parsed = Number(offset);
      if (Number.isFinite(parsed)) filters.offset = parsed;
    }
    return filters;
  }
}
