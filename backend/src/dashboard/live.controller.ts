import { Controller, Get, Sse } from '@nestjs/common';
import { Observable, interval, from } from 'rxjs';
import { switchMap, map, startWith } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('live')
export class LiveController {
  constructor(private readonly dashboard: DashboardService) {}

  /**
   * MatchZy Events & Forwards: https://shobhit-pathak.github.io/MatchZy/events.html
   */
  @Get()
  async list() {
    return this.dashboard.getLiveMatches();
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => from(this.dashboard.getLiveMatches())),
      map((payload) => ({ data: payload })),
    );
  }
}
