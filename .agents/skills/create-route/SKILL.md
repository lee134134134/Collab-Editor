---
name: create-route
description: 按项目规范新增 Umi 页面与路由，含 routes.ts 注册、菜单文案、登录守卫与动态参数。新增页面或调整路由时使用。
---

# 新增页面与路由

## 使用时机

新增页面、调整菜单、或增加动态路由（如 `/docs/:id`）时。

## 目标产出

- `apps/web/config/routes.ts` 中注册路由
- 页面组件在 `apps/web/src/pages/<name>/`
- 需要菜单时补 `name`、`icon`、`src/locales/zh-CN/menu.ts`
- `pnpm type-check` 通过

## 步骤

1. **建页面**：`apps/web/src/pages/<name>/index.tsx`，默认导出 React 组件。
2. **注册路由**：
   ```ts
   {
     path: '/docs',
     name: 'docs',
     icon: 'fileText',
     component: './docs',
   }
   ```
   - 动态页：`path: '/docs/:id'`，`hideInMenu: true`
   - 登录页：`layout: false`
3. **菜单文案**：需要出现在侧边栏时，在 `src/locales/zh-CN/menu.ts` 增加 `menu.<name>`。
4. **守卫**：受保护页面无需额外配置，`app.tsx` 的 `layout.onPageChange` 会拦截未登录。
5. **默认首页**：调整 `/` 的 `redirect`。

## 检查

- [ ] 路由 path 与组件路径一致
- [ ] 需要菜单时 name/icon/locale 齐全
- [ ] 动态参数用 `useParams` 读取
- [ ] 受保护页面确认登录守卫
- [ ] 类型检查通过
