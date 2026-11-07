---
name: create-api
description: 按项目规范新增 REST 接口或共享契约，含 shared DTO、NestJS 控制器、前端 service 与错误处理边界。新增或修改接口时使用。
---

# 新增与维护 API

## 使用时机

需要新增 REST 接口、修改出入参、或新增前后端共享类型时。

## 目标产出

- `packages/shared/src/index.ts` 中的 DTO / 常量（如需）
- `apps/server/src/<domain>/` 中的 controller + service
- `apps/web/src/services/<domain>.ts` 中的请求函数
- 调用方只写成功逻辑
- `pnpm type-check` + `pnpm lint` 通过

## 步骤

1. **定契约**：在 `packages/shared/src/index.ts` 新增/修改 DTO，命名 `XxxDTO`、`XxxRequest`。
2. **写服务端**：在对应 domain 模块加路由，统一 `/api/...`；错误用 Nest 异常。
3. **写前端 service**：使用 Umi `request`，泛型显式声明返回类型：
   ```ts
   import type { DocMeta } from '@collab/shared';
   import { request } from '@umijs/max';

   export function listDocs() {
     return request<DocMeta[]>('/api/docs', { method: 'GET' });
   }
   ```
4. **消费**：组件从 `@/services/...` 导入；错误由 `requestErrorConfig` 统一提示，业务层不重复 `try/catch` 弹错。
5. **鉴权**：token 由 `app.tsx` 拦截器注入；WS 连接先取 `POST /api/collab/ticket`。

## 检查

- [ ] 路径以 `/api` 开头，REST 语义正确
- [ ] DTO 在 shared，不在两端重复
- [ ] 返回类型显式泛型
- [ ] 错误响应 `{ message }`
- [ ] 类型检查 + Lint 通过
