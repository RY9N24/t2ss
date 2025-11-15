import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('system')
export class SystemController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('disk')
  async disk() {
    return this.dashboard.getDiskStats();
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
}
