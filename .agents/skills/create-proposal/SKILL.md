---
name: create-proposal
description: 为需求创建 OpenSpec 提案（proposal + tasks + specs），判定有无设计稿/接口/交付形态并串联分析与验收技能。开始任何非琐碎需求、需要先收敛需求再动手时使用。
---

# 创建提案（SDD）

## 使用时机

接到一个**非琐碎**需求（新增页面、新增功能、改造既有能力、跨模块变更）时，
**先写提案再写代码**。琐碎改动（改文案、调样式、修单个 typo）可跳过本技能直接改。

## 为什么

- 避免 AI 直接在代码上「盲改」，导致范围蔓延与返工
- 把「现在是怎样 → 期望变成怎样」写清楚，验收有据可依
- 变更可追溯：谁、何时、为什么改了什么

## 目标产出

```
openspec/changes/<change-id>/
├── proposal.md    # 为什么改、改什么、范围与非目标
├── tasks.md       # 可执行、可验证的任务清单
├── design.md      # 可选: 存在架构权衡/高风险时才写
└── specs/         # 本次变更对能力的增量描述
```

## 前置

- 读 `.agents/rules/README.md`，确定本需求涉及哪几条规范
- 已初始化 `openspec/`（`config.yaml` 中 `context` 已含项目技术栈与约定）

## 工作流程（6 步）

### 步骤 1：明确需求类型与条件

先向用户或需求来源确认三件事，**它们决定后续所有步骤**：

| 条件 | 取值 | 影响 |
|------|------|------|
| **有无设计稿** | `.pen` / Figma / 无 | 有 → 先跑 `design-analysis` 产出 UI 分析清单；实现后跑 `ui-verification` 验收 |
| **有无接口** | 已就绪 / 未就绪 / 无 | 已就绪 → `create-api` 对接；未就绪 → 占位接口 + mock；无 → 不做数据层 |
| **交付形态** | 新页面 / 新组件 / 改造 / 纯逻辑 | 决定目录归属与 tasks 模板 |

> 信息不全时**先问再写**，不要假设。用一句话问清「有设计稿吗？接口好了吗？」

### 步骤 2：有设计稿 → 先做设计稿分析（推荐）

执行 `.agents/skills/design-analysis`，产出 **UI 分析清单**文档。
后续 `tasks.md` 必须写明：

```
- [ ] 按 UI 分析清单 `<清单路径>` 还原布局与样式
- [ ] 实现后执行 `.agents/skills/ui-verification` 与设计稿比对，修复 P0 问题
```

### 步骤 3：创建变更目录

```bash
openspec new change <change-id>
```

`change-id` 用短横线小写英文，动词开头表达意图：
`add-log-page`、`refactor-auth-guard`、`fix-calendar-drag`

目录生成在 `openspec/changes/<change-id>/`。

### 步骤 4：写 proposal.md

```markdown
# <变更标题>

## 背景与现状
当前是怎样（引用具体文件/行为，不要空泛）。

## 期望
变更后应该怎样（可验证的描述）。

## 范围
- 本次会改：...
- 涉及文件：`src/...`、`src/...`

## 非目标（Non-goals）
- 本次**不**做：...（防止范围蔓延）

## 依据
- 设计稿：`<路径或链接>` / 无
- 接口：`GET /api/xxx`（已就绪）/ 未就绪
- 相关规范：`.agents/rules/0X-*.md`
```

**要求**：中文；引用真实文件路径；写清「现状 → 期望」；必须有「非目标」。

### 步骤 5：写 tasks.md

把变更拆成**可执行、可验证**的任务：

```markdown
# 任务清单

## 阶段一：数据层
- [ ] `src/api/log.ts` 新建，定义 `LogItem` / `LogListResponse`，实现 `getLogList`（见 .agents/skills/create-api）

## 阶段二：页面
- [ ] `src/views/LogView.vue` 新建（见 .agents/skills/create-component）
- [ ] `src/router/index.ts` 注册路由，`meta: { title: '日志' }`（见 .agents/skills/create-route）
- [ ] `src/layouts/MainLayout.vue` 同步侧边栏菜单项，`index="/log"`

## 阶段三：验收
- [ ] `pnpm type-check` 通过
- [ ] `pnpm lint` 与 `pnpm format:check` 通过
- [ ] `pnpm build` 通过
- [ ] 执行 `.agents/skills/ui-verification`，P0 问题清零
```

**要求**：

- 每个 task **≤ 2 小时**、单一可验证结果
- 必须写明**具体文件路径**
- 涉及新页面/接口/store/组件的 task，注明需读取的 `.agents/skills/` 技能
- **末尾必须有质量门禁 task**（`type-check` / `lint` / `format:check` / `build`）
- 有设计稿时必须有 `ui-verification` task

### 步骤 6：写 specs/ 并校验

```bash
openspec validate <change-id>
```

- specs 描述**可验证行为**（Given/When/Then），不写实现细节
- 只写本次**新增或修改**的能力
- **仅当**存在架构权衡、跨模块影响或高风险改动时才写 `design.md`，需记录被否决的备选方案与理由

## 校验与交接

```bash
openspec validate <change-id>    # 必须通过
openspec list                    # 确认变更在列
```

提案通过后，向用户**展示 proposal 与 tasks 摘要**，确认后再进入实施。

## 实施与归档

| 阶段 | 动作 |
|------|------|
| 实施 | 按 `tasks.md` 逐项勾选；每项读对应 Rule 定边界 + Skill 拿步骤 |
| 验收 | `pnpm type-check` / `lint` / `format:check` / `build`；有 UI 则 `ui-verification` |
| 归档 | `openspec archive <change-id>` → 移入 `openspec/changes/archive/`，spec 增量合入 `openspec/specs/` |

## 检查清单

- [ ] 已确认：有无设计稿 / 有无接口 / 交付形态
- [ ] `change-id` 短横线小写、动词开头
- [ ] proposal 有「现状 → 期望」「范围」「非目标」「涉及文件」
- [ ] tasks 每项 ≤2h、有文件路径、有门禁项
- [ ] 有设计稿 → 已跑 `design-analysis` 且 tasks 引用了清单
- [ ] 有设计稿 → tasks 含 `ui-verification` 验收项
- [ ] `openspec validate` 通过

## 常见错误

| 错误 | 后果 |
|------|------|
| 跳过提案直接改代码 | 范围蔓延、返工、无法追溯 |
| tasks 写成「实现登录功能」这种粒度 | 无法验证、无法勾选 |
| 不写非目标 | 需求越做越大 |
| tasks 缺门禁项 | 改完不知道算不算通过 |
| 有设计稿却不写 `ui-verification` | 还原度无验收标准 |
| 手工挪 `changes/archive/` | 破坏 OpenSpec 的 spec 合并逻辑，必须用 `openspec archive` |

## 相关技能

- 设计稿分析 → `.agents/skills/design-analysis`
- 实施阶段：`create-route` / `create-api` / `create-component`
- 质量门禁 → `.agents/rules/11-测试规范.md`
