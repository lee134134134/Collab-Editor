---
name: create-component
description: 按项目规范创建或拆分 React 组件，含目录归属、Props 类型、hooks、antd 交互与样式约定。新增组件或拆分大组件时使用。
---

# 创建与拆分组件

## 使用时机

新建组件、拆分过大的页面、或不确定组件该放页面私有还是全局时。

## 目标产出

- 组件落在正确目录
- Props 显式类型化
- 加载/空/错误态齐全
- `pnpm type-check` + `pnpm lint` 通过

## 步骤

1. **定归属**：
   - 只被一个页面用 → `apps/web/src/pages/<page>/components/`
   - 被两个及以上页面用 → `apps/web/src/components/`
2. **写组件**：函数组件 + `interface XxxProps`；文件 PascalCase。
   ```tsx
   interface CommentItemProps {
     content: string;
     resolved?: boolean;
     onResolve?: () => void;
   }

   export const CommentItem: React.FC<CommentItemProps> = ({ content, resolved, onResolve }) => {
     return <Card>{content}</Card>;
   };
   ```
3. **状态**：组件内 `useState`/`useMemo`；跨页用户态用 `useModel('@@initialState')`。
4. **副作用**：事件监听、定时器、Yjs provider 必须在 cleanup 中释放；React 19 StrictMode 下防重复创建。
5. **交互**：加载态 `Spin`，空态 `Empty`，破坏性操作 `Popconfirm`/`Modal.confirm`。
6. **样式**：antd token + `createStyles` 或同目录 CSS；BEM 类名。

## 拆分阈值

- 单文件接近 300~400 行时拆分。
- 无业务展示片段优先下放；复杂逻辑抽 `useXxx` hook。
- 不提前抽象（YAGNI）。

## 检查

- [ ] Props 无 `any`
- [ ] 副作用有 cleanup
- [ ] 加载/空/错误态
- [ ] 文案中文
- [ ] 类型检查 + Lint 通过
