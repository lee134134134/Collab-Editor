import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CollabModule } from './collab/collab.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { CoreModule } from './core.module.js';
import { DocsModule } from './docs/docs.module.js';

/**
 * 根模块：CoreModule（CONFIG + DbService）为 @Global 基础设施；
 * CollabModule 导出 RoomManager 供 docs/comments 注入，依赖方向单向无环。
 */
@Module({
  imports: [CoreModule, AuthModule, DocsModule, CommentsModule, CollabModule],
})
export class AppModule {}
