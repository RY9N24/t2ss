import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('servers')
export class ServersController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async list() {
    return this.dashboard.listServers();
  }

  @Post()
  async register(
    @Body()
    body: {
      name: string;
      endpoint: string;
      location?: string | null;
      notes?: string | null;
    },
  ) {
    return this.dashboard.registerServer(body);
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string) {
    return this.dashboard.toggleServer(id, true);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.dashboard.toggleServer(id, false);
  }

  @Post(':id/tokens')
  async createToken(@Param('id') id: string, @Body('label') label?: string | null) {
    return this.dashboard.createServerToken(id, label ?? null);
  }

  @Post(':id/tokens/:tokenId/revoke')
  async revoke(@Param('tokenId') tokenId: string) {
    return this.dashboard.revokeServerToken(tokenId);
  }
}
