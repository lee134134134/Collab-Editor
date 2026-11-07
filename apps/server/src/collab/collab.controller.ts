import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { TicketService } from './ticket.service.js';

/** REST 侧协同 ticket 签发：登录用户换取 60s 一次性 WS 握手凭据。 */
@Controller('api/collab')
export class CollabController {
  constructor(
    @Inject(TicketService) private readonly ticketService: TicketService,
  ) {}

  @Post('ticket')
  @UseGuards(JwtAuthGuard)
  ticket(@CurrentUser() user: JwtPayload): { ticket: string } {
    return { ticket: this.ticketService.issue(user.sub) };
  }
}
