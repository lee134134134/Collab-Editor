# `.agents/` — 本项目 AI Coding 规范源

本目录存放 AI 编码工具共用的规范与技能。根目录 `AGENTS.md` 是项目总览与命令的唯一主文档；
本目录的 `rules/` 提供按主题拆分的约束，`skills/` 提供可复用的操作步骤。

> 注意：部分工具目录（`.claude/`、`.cursor/` 等）下有自己的 `commands/` 与 `skills/`，
> 本项目不强制软链；以各工具实际加载结果为准。

## 目录

```
.agents/
├── README.md
├── rules/                 # 规范层（11 条）
│   ├── README.md          # 索引
│   ├── 01-项目概述.md
│   ├── 02-编码规范.md
│   ├── 03-项目结构.md
│   ├── 04-组件规范.md
│   ├── 05-API规范.md
│   ├── 06-路由规范.md
│   ├── 07-状态管理.md
│   ├── 08-通用约束.md
│   ├── 09-样式规范.md
│   ├── 10-文档规范.md
│   └── 11-测试规范.md
└── skills/
    ├── create-proposal/   # OpenSpec 提案
    ├── design-analysis/   # 设计稿 → UI 分析清单
    ├── create-api/        # 新增 REST/WS 接口与 shared 契约
    ├── create-component/  # 新增/拆分 React 组件
    └── create-route/      # 新增 Umi 页面与路由
```

## 使用方式

1. 先读根目录 `AGENTS.md` 了解项目、命令与已知限制。
2. 写代码前按主题读 `.agents/rules/0X`。
3. 需要分步操作时读对应 `skills/<name>/SKILL.md`。
4. 改动后按 `rules/11-测试规范.md` 跑门禁。

## 维护约定

- 规范变更只改 `.agents/rules/`，并同步 `rules/README.md` 索引。
- 命令、目录、端口、环境变量变更同步 `AGENTS.md`、`CLAUDE.md`、`README.md`。
- `references/` 是旧项目工作流 submodule，与本产品无强耦合，禁止在其中写本项目文件。
