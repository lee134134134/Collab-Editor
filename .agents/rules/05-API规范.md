---
alwaysApply: false
description: REST/WS 接口位置、Umi request 用法、shared 契约与错误处理边界。新增或修改接口时读取。
---

# API 规范

## 前端请求（NON-NEGOTIABLE）

- 所有 HTTP 请求函数放 `apps/web/src/services/`，按业务域分文件：
  - `docs.ts`、`comments.ts`、`self/auth.ts`
- 使用 Umi `request`，泛型显式声明返回类型；禁止在组件里裸调 `fetch` / `axios`。
- 请求函数统一返回 `Promise<T>`；调用方可传 `{ skipErrorHandler: true }` 关闭自动提示。
- 登录 token 由 `app.tsx` 的 `requestInterceptors` 注入 `Authorization: Bearer <token>`，业务层不要手工拼头。

## 后端接口（NON-NEGOTIABLE）

- REST 路径统一 `/api/...`，控制器放在对应 domain 模块。
- 错误体统一 `{ message: string }`；鉴权失败 401。
- 评论更新/删除固定 `PATCH|DELETE /api/comments/:id`，不要在前端拼文档路径。
- 协同 WS 独立 `:3001`，连接前先 `POST /api/collab/ticket` 换 60s 一次性 ticket；
  鉴权失败 close code `4401`，前端换 ticket 重建。
- WS 自定义消息 `type=100` 用于评论活动广播；协议常量放 `packages/shared`。

## 共享契约（NON-NEGOTIABLE）

- DTO、枚举、WS 常量一律放 `packages/shared/src/index.ts`：
  `UserDTO`、`DocMeta`、`CommentDTO`、`CollabStatus`、`PresenceUser`、`CommentThread`、
  `WS_MSG_COMMENT_ACTIVITY`。
- 前端通过 `import type { ... } from '@collab/shared'` 消费；不要在 `services` 内重复定义。
- 修改契约必须同步后端序列化/反序列化与前端消费方，并跑 `pnpm type-check`。

## 错误处理

- 前端错误由 `requestErrorConfig` 统一处理：401 清 token 跳登录，其余弹 `message`。
- 业务组件只处理成功逻辑；仅需要降级/静默时 `catch`，且不要再弹错误提示。
- 服务端异常用 Nest 标准异常（`UnauthorizedException`、`NotFoundException` 等），不要返回裸字符串。
