# Collab-Editor

类飞书在线协同文档编辑器：CRDT 实时协同、在线状态与协同光标、富文本、评论批注、文档库。

pnpm monorepo：React 19 + Umi max + antd 6（`apps/web`）、NestJS + Yjs（`apps/server`）、
共享契约（`packages/shared`）。

## 快速开始

```bash
pnpm install
pnpm dev:all          # 前端 http://localhost:8001，后端 REST :3000 / 协同 WS :3001
```

种子账号：`admin / admin123`、`alice / alice123`、`bob / bob123`。

## 常用命令

```bash
pnpm dev               # 仅前端
pnpm dev:server        # 仅后端
pnpm build             # 全仓构建
pnpm type-check        # 全仓类型检查
pnpm lint              # Biome
pnpm test              # 服务端单测
pnpm test:integration  # 集成测试（需后端运行）
pnpm test:e2e          # 浏览器 E2E（需 Chrome，脚本可自动拉起服务）
```

## 架构

- **协同**：Tiptap 3 + Yjs；前端经 y-websocket 连接独立原生 ws 服务（:3001），服务端中继
  awareness、按房间同步 Y.Doc 更新。
- **鉴权**：JWT 登录；协同连接使用一次性 ticket（60s，单次消费），WS 校验 Origin 白名单。
- **持久化**：Yjs 全量快照存入 SQLite；单文档串行 writer；房间无人 30s 逐出并 flush；
  启动文件锁防止多实例写库。
- **评论**：元数据走 REST，正文锚点以 CRDT Mark 写入文档；解决/删除由服务端收口，
  WS `type=100` 实时广播评论活动。

## 目录

```
apps/web       前端（文档库 / 编辑器 / 登录）
apps/server    后端（auth / docs / comments / collab）
packages/shared 前后端共享 DTO 与常量
scripts/e2e.mjs 双浏览器 E2E
```

开发规范、环境变量与已知限制见 `AGENTS.md`。
