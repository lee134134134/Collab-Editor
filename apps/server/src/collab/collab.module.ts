import { Module } from '@nestjs/common';
import { CollabController } from './collab.controller.js';
import { RoomManager } from './room-manager.js';
import { TicketService } from './ticket.service.js';
import { CollabWsServer } from './ws-server.js';

/**
 * 协同模块：导出 RoomManager，供 docs/comments 模块注入使用（评论 Mark 收口、文档删除逐出）。
 * RoomManager 不反向 import docs/comments（避免循环依赖）。
 */
@Module({
  controllers: [CollabController],
  providers: [TicketService, RoomManager, CollabWsServer],
  exports: [TicketService, RoomManager],
})
export class CollabModule {}
