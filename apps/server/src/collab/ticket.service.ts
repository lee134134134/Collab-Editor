import { Injectable } from '@nestjs/common';
import { newTicket } from '../utils/ids.js';

const DEFAULT_TTL_MS = 60_000;
const CLEANUP_INTERVAL_MS = 10_000;

interface TicketEntry {
  userId: number;
  expiresAt: number;
}

/**
 * 协同 WS 一次性 ticket 签发/消费：
 * - issue(userId) → 64 位 hex 随机串，60s TTL；
 * - consume(ticket) → 命中且未过期则返回 userId 并立即删除（一次性用后即删）；
 * - 定期清扫过期条目，防止 Map 无限增长。
 */
@Injectable()
export class TicketService {
  private readonly tickets = new Map<string, TicketEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;
  // TTL 暴露为公开字段：单测可覆盖为极短值以验证过期逻辑；
  // 构造函数无参数，避免 Nest 把 number 误当依赖注入（emitDecoratorMetadata 会 emit [Number]）。
  ttlMs = DEFAULT_TTL_MS;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // 让定时器不阻塞进程退出
    this.cleanupTimer.unref?.();
  }

  issue(userId: number): string {
    const ticket = newTicket();
    this.tickets.set(ticket, { userId, expiresAt: Date.now() + this.ttlMs });
    return ticket;
  }

  /** 消费 ticket：返回 userId；无效/过期返回 null。一次性，用后即删。 */
  consume(ticket: string): number | null {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    if (entry.expiresAt < Date.now()) return null;
    return entry.userId;
  }

  /** 清扫过期条目。 */
  cleanup(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt < now) this.tickets.delete(ticket);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
