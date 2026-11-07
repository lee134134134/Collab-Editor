import { Global, Module } from '@nestjs/common';
import { CONFIG, loadConfig } from './config.js';
import { DbService } from './db/database.js';

/**
 * 全局基础设施模块：提供 CONFIG 与 DbService，供所有业务模块免 import 注入。
 * 依赖方向：这里是最底层，不 import 任何业务模块。
 */
@Global()
@Module({
  providers: [{ provide: CONFIG, useValue: loadConfig() }, DbService],
  exports: [CONFIG, DbService],
})
export class CoreModule {}
