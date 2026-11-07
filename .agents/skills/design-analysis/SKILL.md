---
name: design-analysis
description: 分析设计稿并产出 UI 分析清单，供开发还原与验收对照。按从上到下、从左到右、从外到里的顺序，记录文字/图片/布局/层级四类重点。需要读设计稿、做 UI 需求分析、或为 ui-verification 准备对照物时使用。
---

# 设计稿分析

## 使用时机

需要分析设计稿（`.pen` / Figma）并产出 **UI 分析清单**时。可在写提案前、写提案中、或单独执行。

## 核心原则（必守）

必须按 **「从上到下 → 从左到右 → 从外到里」** 的顺序阅读与记录，并逐条准确记录四类重点：
**文字 / 图片 / 布局 / 层级**。

> 不按顺序是遗漏与还原错误的**主要来源**——跳着看必然漏项。

详见 `rules/analysis-order.md`（CRITICAL）。

## 目标产出

一份 **UI 分析清单**文档，作为：
- 开发还原的唯一依据
- `ui-verification` 验收的对照物
- `create-proposal` 中 tasks 的引用对象

输出模板见 `rules/output-analysis-checklist.md`。

## 工作流程（4 步）

| 步骤 | 内容 | 详见 |
|------|------|------|
| 1 | **建立布局 Map** — 整体尺寸、区域划分、区域间距 | `rules/workflow-layout-map.md` |
| 2 | **区域与元素提取** — 每区从外到里，四类重点记全 | `rules/workflow-element-extraction.md` |
| 3 | **样式规范汇总** — 颜色、字体、圆角、间距、阴影 | `rules/workflow-style-summary.md` |
| 4 | **输出 UI 分析清单** — 按模板成文 + 自检 | `rules/workflow-output-checklist.md` |

## 工具

| 稿源 | 工具 | 说明 |
|------|------|------|
| `.pen` 文件 | **Pencil MCP**（`snapshot_layout` / `get_screenshot` / `batch_get`） | **首选**，层级与细节最完整 |
| Figma 链接 | **Figma MCP** | 可先把 Figma 粘贴进 Pencil，95%+ 样式可还原 |
| 无设计稿、仅文字描述 | 跳过本技能 | 在 proposal 中用文字描述布局 |

本项目已接入 **Pencil MCP** 与 **chrome-devtools MCP**（后者用于 `ui-verification`）。

## 四类重点（每区都要记全）

| 类别 | 记什么 | 常见遗漏 |
|------|--------|----------|
| **文字** | 内容原文、字号、字重、颜色、行高、对齐 | 首屏大字号文案、辅助说明小字 |
| **图片** | 资源、尺寸、圆角、占位方式 | 图标尺寸、空态图 |
| **布局** | 位置 x/y、宽高、排列方向、gap/padding | 容器宽度、间距、是否铺满 |
| **层级** | 嵌套关系、遮罩/浮层、z 序 | 弹层归属、侧边栏与内容区关系 |

## 检查清单

- [ ] 已按「从上到下 → 从左到右 → 从外到里」完整走一遍
- [ ] 每个区域的四类重点都已记录
- [ ] 样式汇总表已产出（颜色/字体/圆角/间距/阴影）
- [ ] 已按 `rules/output-analysis-checklist.md` 模板成文
- [ ] 已完成 `rules/workflow-output-checklist.md` 自检
- [ ] 清单路径已回填进 `create-proposal` 的 `tasks.md`

## 与其它技能的关系

```
create-proposal ──(有稿)──> design-analysis ──> [create-route/api/component 实现]
                                                      │
                                                      └──> ui-verification（对照本清单 + 设计稿）
                                                            │
                                                            └── 反思不足 ──> 反哺 design-analysis
```

- **前置**：`.agents/skills/create-proposal`（决定是否需要分析）
- **后续**：按清单人工核对或使用浏览器工具比对实现页
- **实施**：`.agents/skills/create-route` / `create-component` / `create-api`
