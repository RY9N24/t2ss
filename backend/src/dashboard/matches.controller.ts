import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('live')
  async live() {
    return this.dashboard.getLiveMatches();
  }

  @Get('history')
  async history(
    @Query('tournamentId') tournamentId?: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.dashboard.getHistory({
      tournamentId: tournamentId || undefined,
      teamId: teamId || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      search: search || undefined,
    });
  }

  @Get('history/export')
  async historyExport(@Res() res: Response, @Query() query: Record<string, string>) {
    const csv = await this.dashboard.exportHistoryCsv({
      tournamentId: query['tournamentId'] || undefined,
      teamId: query['teamId'] || undefined,
      from: query['from'] ? new Date(query['from']) : undefined,
      to: query['to'] ? new Date(query['to']) : undefined,
      search: query['search'] || undefined,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="match-history.csv"');
    res.send(csv);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.dashboard.getMatchDetail(id);
  }
}
