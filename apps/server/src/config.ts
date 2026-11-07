import * as path from 'node:path';

/**
 * 应用配置：全部从环境变量读取，未设置时回退到 dev 默认值。
 * 单点收口，避免各模块散落 process.env 读取逻辑。
 */
export interface AppConfig {
  /** REST HTTP 端口（默认 3000） */
  port: number;
  /** 协同 WebSocket 端口（默认 3001，独立于 REST，绕开 Nest WsAdapter 与 y-websocket 路径规则冲突） */
  wsPort: number;
  /** JWT HS256 签名密钥（dev 默认值，生产必须覆盖） */
  jwtSecret: string;
  /** SQLite 数据库文件路径 */
  dbPath: string;
  /** 协同 WS 允许的 Origin 白名单 */
  collabAllowedOrigins: string[];
  /** 种子管理员用户名 */
  adminUsername: string;
  /** 种子管理员密码 */
  adminPassword: string;
}

/** Nest 依赖注入 token，用于注入 AppConfig 实例。 */
export const CONFIG = Symbol('CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  const wsPort = Number(env.WS_PORT ?? 3001);
  return {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    wsPort: Number.isFinite(wsPort) && wsPort > 0 ? wsPort : 3001,
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    // dbPath 相对当前工作目录（pnpm --filter 会把 cwd 设为 apps/server），落在 gitignore 的 data/ 下
    dbPath: path.resolve(env.DB_PATH ?? 'data/collab.db'),
    collabAllowedOrigins: (
      env.COLLAB_ALLOWED_ORIGINS ??
      'http://localhost:8001,http://127.0.0.1:8001'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    adminUsername: env.ADMIN_USERNAME ?? 'admin',
    adminPassword: env.ADMIN_PASSWORD ?? 'admin123',
  };
}
