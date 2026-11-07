# Collab Editor（Claude 协作文档）

类飞书协同文档编辑器，pnpm monorepo。完整说明见 `AGENTS.md`；如有冲突以实际代码为准。

## 技术栈

- 前端 `apps/web`（@collab/web）：React 19 + @umijs/max + antd 6 + antd-style；
  编辑器 Tiptap 3.32（collaboration + collaboration-caret + @tiptap/y-tiptap）+ Yjs/y-websocket。
- 后端 `apps/server`（@collab/server）：NestJS 11、ws 8、better-sqlite3、jsonwebtoken、bcryptjs。
- 共享契约 `packages/shared`（@collab/shared）：DTO、`CollabStatus`、`PresenceUser`、`CommentThread`。
- 工具：TypeScript strict、Biome、Vitest 3、husky + lint-staged + commitlint。

## 命令

```bash
pnpm dev               # 前端 :8001（/api 代理 :3000）
pnpm dev:server        # 后端 REST :3000 + 协同 WS :3001
pnpm dev:all           # 前后端并行
pnpm type-check        # 全仓类型检查
pnpm lint              # Biome
pnpm test              # 服务端单测
pnpm test:integration  # 集成测试（需后端运行）
pnpm test:e2e          # 浏览器 E2E（需 Chrome）
```

门禁：`pnpm type-check` + `pnpm lint`；协同/REST 改动补 `pnpm test` 与
`pnpm test:integration`。

## 关键约定

- 端口：REST 3000、协同 WS 3001、web dev 8001。`.npmrc` 的 `node-linker=hoisted` 不可删。
- 鉴权：JWT（7d）+ 协同一次性 ticket（`POST /api/collab/ticket`，60s，单次消费）；
  WS close `4401` 表示票据失效；WS 校验 Origin 白名单。
- 持久化：Yjs 全量快照入 SQLite，单文档串行 writer；房间无人 30s 逐出并 flush；
  `data/collab.lock` 防多实例。
- 评论：元数据走 REST（列表/创建 `/api/docs/:docId/comments`，更新/删除
  `PATCH|DELETE /api/comments/:id`）；正文锚点以 CRDT Mark 写入 Y.Doc，服务端收口；
  WS `type=100` 下发评论活动。
- 共享类型只放 `packages/shared`，不要两端复制。
- 前端别名 `@/` → `apps/web/src`，请求经 `src/services/`。
- 种子账号：admin/admin123、alice/alice123、bob/bob123。

## 已知限制

- 无权限体系/图片上传/版本历史/导出。
- 4401 重连重建 Y.Doc 与编辑器实例，撤销历史丢失（内容由服务端快照恢复）。
- 删除 `apps/web/src/.umi` 后需先 `pnpm --filter @collab/web exec max setup`。
- 本机 git 若 iconv 报错，使用 `git -c core.precomposeunicode=false ...`。
