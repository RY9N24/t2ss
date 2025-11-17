import { Body, Controller, Post } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly dashboard: DashboardService) {}

  @Post('truncate')
  async truncate(@Body('confirm') confirm: string) {
    return this.dashboard.truncateTournamentData(confirm);
  }

  @Post('drop-database')
  async dropDatabase(@Body('confirm') confirm: string, @Body('finalConfirm') finalConfirm: string) {
    return this.dashboard.dropDatabase(confirm, finalConfirm);
  }
}
