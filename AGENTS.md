# Collab-Editor — 类飞书协同文档编辑器

pnpm monorepo：React 19 + antd 6 + Umi max 前端，NestJS + Yjs 后端，交付 CRDT 实时协同编辑、
在线状态/协同光标、评论批注与文档库。

## 1. 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖（`.npmrc` 必须保留 `node-linker=hoisted`，Umi 间接依赖需要扁平布局） |
| `pnpm dev` | 前端 dev，http://localhost:8001（`/api` 代理到 :3000） |
| `pnpm dev:server` | 后端 NestJS（REST :3000 + 协同 WS :3001） |
| `pnpm dev:all` | 前后端并行启动 |
| `pnpm build` | 全仓构建（web `max build` + server `tsc`） |
| `pnpm type-check` | 全仓类型检查（web 会先 `max setup`） |
| `pnpm lint` | Biome 检查（全仓，含 apps/server） |
| `pnpm test` | 服务端 Vitest 单测（collab / file-lock） |
| `pnpm test:integration` | 集成测试（需后端已启动；覆盖鉴权/文档/评论/协同协议） |
| `pnpm test:e2e` | 浏览器 E2E 冒烟（需本机 Chrome；服务未启动时脚本自动拉起） |

**改动最小门禁**：`pnpm type-check` + `pnpm lint`；涉及协同/REST 时补 `pnpm test` 与
`pnpm test:integration`。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19、@umijs/max、antd 6、antd-style、@ant-design/pro-components |
| 编辑器 | Tiptap 3.32（@tiptap/react + StarterKit + collaboration + collaboration-caret + @tiptap/y-tiptap） |
| CRDT / 实时 | Yjs 13 + y-websocket（原生 ws 客户端）、awareness、lib0 |
| 后端 | NestJS 11、ws 8、jsonwebtoken、bcryptjs、better-sqlite3 13 |
| 语言/工具 | TypeScript 7（strict）、Biome 2、Vitest 3、pnpm workspaces、husky + lint-staged + commitlint |

## 3. 目录结构

```
apps/
├── web/                        # @collab/web — Umi max 应用
│   ├── config/                 # 路由(routes.ts)、代理(proxy.ts)、Umi 配置
│   ├── mock/                   # 仅脚手架遗留，MOCK=none 时全部禁用
│   └── src/
│       ├── pages/docs/         # 文档库 index.tsx + 编辑器 editor.tsx
│       │   └── components/     # useCollabDoc / PresenceBar / CommentPanel / EditorToolbar / commentMark
│       ├── pages/user/login/   # 登录（真实 /api/auth/login）
│       ├── services/           # docs.ts / comments.ts / self/auth.ts（request 封装）
│       ├── components/         # 布局组件（OfflineBanner / RightContent 等）
│       └── app.tsx             # globalState、登录态与请求拦截器
└── server/                     # @collab/server — NestJS REST + 原生 ws
    ├── src/
    │   ├── auth/               # JWT 登录、守卫、@CurrentUser
    │   ├── docs/               # 文档元数据 CRUD
    │   ├── comments/           # 评论 CRUD（thread + replies）
    │   ├── collab/             # ticket、ws-server、room-manager、persistence-queue、protocol
    │   ├── db/database.ts      # SQLite schema + 种子用户
    │   ├── file-lock.ts        # 单实例启动锁
    │   └── config.ts           # 环境变量单点收口
    ├── test/                   # collab.test.ts / file-lock.test.ts / integration.mjs
    └── data/                   # collab.db + collab.lock（gitignore）
packages/shared/                # @collab/shared — 前后端 DTO / 常量 / 类型契约
scripts/e2e.mjs                 # Playwright-core 双浏览器 E2E
references/                     # 旧项目 Agent 工作流框架（git submodule，与本产品无强耦合）
```

## 4. 架构与运行参数

- **端口**：REST `:3000`（NestJS），协同 WS `:3001`（原生 ws，独立端口绕开 Nest WsAdapter
  与 y-websocket 路径规则冲突），web dev `:8001`。
- **鉴权**：登录签发 7d JWT；协同 WS 需一次性 ticket（`POST /api/collab/ticket`，60s TTL，
  单次消费），失败以 close code `4401` 拒绝；WS 校验 `Origin` 白名单。
- **持久化**：Yjs 全量快照写入 SQLite；单文档串行 writer（persistence-queue）；房间引用计数，
  无人 30s 后逐出并将剩余状态 flush；服务启动时获取 `data/collab.lock` 文件锁防多实例。
- **评论**：REST 存元数据，正文锚点以 CRDT Mark 写入 Y.Doc；resolve/delete 由服务端收口并
  维护 Mark 状态；WS 自定义消息 `type=100` 下发评论活动。
- **awareness**：服务端仅中继，不发布自身状态；前端 PresenceBar 过滤无 `user.name` 状态。

### 环境变量

| 变量 | 默认值 | 作用 |
|---|---|---|
| `PORT` / `WS_PORT` | 3000 / 3001 | REST / 协同 WS 端口 |
| `JWT_SECRET` | dev 默认值 | 生产必须覆盖 |
| `DB_PATH` | `data/collab.db`（相对 apps/server） | SQLite 路径 |
| `COLLAB_ALLOWED_ORIGINS` | `http://localhost:8001,http://127.0.0.1:8001` | WS Origin 白名单 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin / admin123 | 种子管理员 |
| `UMI_APP_COLLAB_WS_URL` | `ws://localhost:3001` | 前端 WS 地址 |

种子账号：`admin/admin123`、`alice/alice123`、`bob/bob123`。

## 5. 开发规范

- TypeScript strict（含 noUnusedLocals / noUnusedParameters）；禁止 `any` / `@ts-ignore` 压制错误。
- 前后端共享契约一律放 `packages/shared`（DTO、`CollabStatus`、`PresenceUser`、
  `CommentThread`、`WS_MSG_COMMENT_ACTIVITY`），不要在两端复制类型。
- 前端别名 `@/` → `apps/web/src`；请求走 `src/services/`（Umi request），不在组件里裸调 fetch。
- 服务端 REST 控制器统一 `api/...` 路径；评论更新/删除为 `PATCH|DELETE /api/comments/:id`。
- 组件样式 scoped/CSS 文件（`pages/docs/components/editor.css`），BEM 命名。
- 提交前 husky 会跑 lint-staged；commit message 遵循 Conventional Commits（commitlint）。

## 6. 已知限制 / 注意事项

- 首期无权限体系、图片上传、版本历史 UI、导出。
- ticket 过期（4401）重连会重建 Y.Doc 与编辑器实例：本地撤销历史丢失；断线期间的未同步修改可能丢失（以服务端快照恢复）。
- 评论面板依赖 WS `type=100` 活动帧，刚创建时存在瞬时竞态（随后自愈）。
- 删除 `apps/web/src/.umi` 后直接 `pnpm dev` 会报 `Can't resolve .../.umi/exports`，先执行
  `pnpm --filter @collab/web exec max setup`。
- E2E 使用两个独立 browser context 隔离 localStorage；脚本会自动拉起未启动的前后端。
- 本机 git 若遇 iconv 报错，使用 `git -c core.precomposeunicode=false ...`。

## 7. 速查表

| 想做什么 | 看哪里 |
|---|---|
| 改协同协议 / 房间 / 快照 | `apps/server/src/collab/ws-server.ts`、`room-manager.ts`、`persistence-queue.ts` |
| 改评论服务端收口 | `apps/server/src/collab/room-manager.ts` + `comments.service.ts` |
| 改前端协同生命周期 | `apps/web/src/pages/docs/components/useCollabDoc.ts` |
| 改编辑器扩展 / 工具栏 | `apps/web/src/pages/docs/editor.tsx`、`EditorToolbar.tsx` |
| 改评论 UI | `apps/web/src/pages/docs/components/CommentPanel.tsx`、`commentMark.ts` |
| 改在线头像 | `PresenceBar.tsx` |
| 改鉴权 / ticket | `apps/server/src/auth/`、`collab/ticket.service.ts` |
| 改 DTO 契约 | `packages/shared/src/index.ts` |
| 改端口 / 代理 | `apps/server/src/config.ts`、`apps/web/config/proxy.ts`、`apps/web/package.json` dev 脚本 |
