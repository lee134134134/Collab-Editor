import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { RoomManager } from './collab/room-manager.js';
import { loadConfig } from './config.js';
import { acquireFileLock } from './file-lock.js';

/**
 * 启动入口：
 * 1. 文件锁（data/collab.lock）防多实例——内存房间多实例会静默丢更新（单实例硬约束）；
 * 2. Nest REST（:3000）→ AppModule（含全局 DbService 建库/种子、CollabWsServer 起 :3001）；
 * 3. 优雅停机：SIGINT/SIGTERM 先全量 flush 所有房间再关连接/关库/释放锁。
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();

  // 先建 data 目录，再独占创建文件锁
  const dataDir = path.dirname(config.dbPath);
  fs.mkdirSync(dataDir, { recursive: true });
  const lock = acquireFileLock(path.join(dataDir, 'collab.lock'));

  const app = await NestFactory.create(AppModule);
  await app.listen(config.port);
  console.log(`[server] REST 已监听 http://localhost:${config.port}`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] 收到 ${signal}，开始优雅停机…`);
    try {
      const roomManager = app.get(RoomManager);
      // 全量 flush：SIGINT/SIGTERM 时所有房间最终落库再退出（oracle 硬约束）
      await roomManager.flushAll();
      // 触发 CollabWsServer 断连 + DbService 关库 + RoomManager 资源释放
      await app.close();
    } catch (err) {
      console.error('[server] 停机异常', err);
    } finally {
      lock.release();
      process.exit(0);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap().catch((err) => {
  console.error('[server] 启动失败', err);
  process.exit(1);
});
