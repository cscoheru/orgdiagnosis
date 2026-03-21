# DeepConsult Copilot - 项目总结报告

> 生成日期: 2026-03-21
> 项目版本: v1.0.0

---

## 1. 项目概述

### 1.1 项目名称
**DeepConsult Copilot** - AI 驱动的组织诊断与咨询报告生成系统

### 1.2 项目目标
基于客户需求信息，自动生成专业的项目建议书（PPTX 格式），支持：
- 多层次内容扩展（模块 → 页面标题 → 幻灯片内容）
- 智能版式适配（根据内容自动推荐 Layout）
- 母版与 Layout 分离管理
- 实时预览与导出

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| **前端** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **状态管理** | React Hooks, Context API |
| **可视化编辑** | React Flow (XYFlow) |
| **后端** | FastAPI, Python 3.11 |
| **AI 引擎** | LangChain, LangGraph, DeepSeek API |
| **数据库** | Supabase (PostgreSQL) |
| **向量存储** | ChromaDB |
| **文件存储** | 本地文件系统 |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户界面层                                 │
├─────────────────────────────────────────────────────────────────────┤
│  /report          │  /workspace      │  /preview      │  /layouts   │
│  需求录入          │  内容编辑         │  模板选择       │  Layout管理  │
└─────────┬─────────┴────────┬────────┴────────┬───────┴──────┬──────┘
          │                  │                  │              │
          ▼                  ▼                  ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API 网关层                                 │
│                    Next.js API Routes / FastAPI                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   报告生成引擎   │ │   Layout 服务    │ │   模板服务       │
│  (LangGraph)    │ │  (推荐+渲染)     │ │  (解析+存储)     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Supabase      │ │   ChromaDB      │ │   本地存储       │
│   (项目数据)     │ │   (知识库)       │ │   (PPTX模板)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 核心工作流

```
需求录入 → 模块生成 → 页面标题生成 → 内容生成 → 预览 → 导出
   │          │            │            │        │       │
   │          │            │            │        │       └─→ PPTX 文件
   │          │            │            │        └─→ 模板选择 + Layout 适配
   │          │            │            └─→ 每页：标题 + 核心观点 + 论点
   │          │            └─→ 每模块 2-4 页标题
   │          └─→ 5-8 个核心模块
   └─→ 客户信息、行业、痛点、目标
```

---

## 3. 功能模块

### 3.1 前端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| **报告生成** | `/report` | 4 步需求录入表单 |
| **内容编辑** | `/report/workspace` | 卡片式内容编辑 |
| **预览导出** | `/report/preview` | 模板选择、Layout 适配、导出 |
| **Layout 管理** | `/layouts` | Layout 库浏览与管理 |
| **Layout 编辑器** | `/layouts/[id]/edit` | 可视化 Layout 编辑 |
| **模板管理** | `/templates` | PPTX 母版上传与管理 |
| **项目管理** | `/projects` | 项目列表与状态 |

### 3.2 后端模块

| 模块 | 路径 | 功能描述 |
|------|------|----------|
| **报告生成 API** | `/api/report/*` | 任务管理、大纲生成、内容生成 |
| **Layout API** | `/api/layout/*` | Layout 推荐、列表、分析 |
| **模板 API** | `/api/template/*` | 模板上传、解析、存储 |
| **知识库 API** | `/api/knowledge/*` | 文档上传、向量化、检索 |

### 3.3 AI 工作流

```python
# 多层次扩展工作流
class ReportWorkflow:
    def run(self, requirement):
        # Step 1: 生成核心模块
        modules = self.generate_modules(requirement)

        # Step 2: 生成页面标题 (并行)
        page_titles = await asyncio.gather(*[
            self.generate_page_titles(module)
            for module in modules
        ])

        # Step 3: 生成幻灯片内容 (并行)
        slides = await asyncio.gather(*[
            self.generate_slide_content(page)
            for page in page_titles
        ])

        return slides
```

---

## 4. 数据模型

### 4.1 核心数据结构

```typescript
// 项目
interface Project {
  id: string;
  name: string;
  status: 'draft' | 'generating' | 'completed';
  created_at: string;
}

// 需求
interface ClientRequirement {
  client_name: string;
  industry: string;
  industry_background: string;
  company_intro: string;
  core_pain_points: string[];
  project_goals: string[];
  phase_planning: PhasePlanning[];
}

// 幻灯片
interface SlideDraft {
  slide_id: string;
  title: string;
  key_message: string;
  bullets: string[];
  layout: string;
  visual_strategy: string;
}

// Layout 定义
interface LayoutDefinition {
  id: string;
  name: string;
  category: LayoutCategory;
  description: string;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  slots: LayoutSlot[];
}
```

### 4.2 数据库表结构

| 表名 | 用途 |
|------|------|
| `projects` | 项目元数据 |
| `project_requirements` | 需求信息 |
| `project_outlines` | 大纲版本 |
| `project_slides` | 幻灯片内容 |
| `project_exports` | 导出记录 |

---

## 5. Layout 系统

### 5.1 Layout 分类

| 分类 | 说明 | 示例 |
|------|------|------|
| `MATRIX` | 矩阵结构 | SWOT、BCG、优先级矩阵 |
| `PROCESS` | 流程图 | 横向流程、纵向流程 |
| `PYRAMID` | 金字塔 | 层级结构、组织架构 |
| `COMPARISON` | 对比图 | 前后对比、方案对比 |
| `TIMELINE` | 时间线 | 里程碑、甘特图 |
| `RADAR` | 雷达图 | 多维评估 |
| `ORG_CHART` | 组织架构 | 部门结构、汇报关系 |
| `CUSTOM` | 自定义 | 用户创建 |

### 5.2 Layout 推荐

```typescript
// 根据内容自动推荐 Layout
function recommendLayout(slide: SlideDraft): LayoutDefinition {
  const bulletCount = slide.bullets?.length || 0;

  if (bulletCount === 4) return 'swot-matrix';      // SWOT 矩阵
  if (bulletCount === 3) return 'process-3-step';   // 三步流程
  if (bulletCount === 2) return 'comparison-h';     // 对比图
  if (bulletCount >= 5) return 'pyramid-5-level';   // 金字塔

  return 'parallel-4-cards';  // 默认
}
```

---

## 6. 部署架构

### 6.1 生产环境

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Vercel       │     │    Render       │     │    Supabase     │
│   (前端托管)     │────▶│   (后端 API)    │────▶│   (数据库)       │
│  www.xxx.com    │     │  api.xxx.com    │     │  supabase.co    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 6.2 环境变量

```bash
# 前端 (.env.local)
NEXT_PUBLIC_API_URL=https://api.xxx.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# 后端 (.env)
DEEPSEEK_API_KEY=sk-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 7. 开发进度

### 7.1 已完成功能

| 功能 | 状态 | 完成日期 |
|------|------|----------|
| 基础设施搭建 | ✅ | 2026-03-15 |
| 需求录入表单 | ✅ | 2026-03-16 |
| AI 报告生成 | ✅ | 2026-03-17 |
| 多层扩展工作流 | ✅ | 2026-03-18 |
| 卡片式内容编辑 | ✅ | 2026-03-19 |
| Layout 智能推荐 | ✅ | 2026-03-20 |
| Layout 可视化编辑器 | ✅ | 2026-03-21 |
| 模板管理系统 | ✅ | 2026-03-21 |
| Preview 页面 | ✅ | 2026-03-21 |
| PPTX 导出 | ✅ | 2026-03-21 |

### 7.2 待完成功能

| 功能 | 优先级 | 预计日期 |
|------|--------|----------|
| 幻灯片模型图系统 | P1 | TBD |
| 幻灯片实时预览 | P1 | TBD |
| 用户认证系统 | P2 | TBD |
| 团队协作功能 | P3 | TBD |

---

## 8. 关键文件

### 8.1 前端

| 文件 | 用途 |
|------|------|
| `app/(dashboard)/report/page.tsx` | 报告生成主页 |
| `app/(dashboard)/report/workspace/page.tsx` | 内容编辑 |
| `app/(dashboard)/report/preview/page.tsx` | 预览与导出 |
| `app/(dashboard)/layouts/page.tsx` | Layout 库 |
| `app/(dashboard)/layouts/[id]/edit/page.tsx` | Layout 编辑器 |
| `components/requirement-form.tsx` | 需求表单 |
| `lib/report-api.ts` | 报告 API 客户端 |
| `lib/layout-api.ts` | Layout API 客户端 |

### 8.2 后端

| 文件 | 用途 |
|------|------|
| `backend/app/main.py` | FastAPI 入口 |
| `backend/api/report.py` | 报告 API |
| `backend/api/layout.py` | Layout API |
| `backend/lib/report_workflow/workflow.py` | 报告生成工作流 |
| `backend/lib/layout/layout_analyzer.py` | Layout 分析器 |

---

## 9. 测试

### 9.1 E2E 测试

```bash
# 运行 E2E 测试
npx playwright test

# 测试覆盖率
- 需求录入流程
- 报告生成流程
- Layout 选择
- PPTX 导出
```

### 9.2 API 测试

```bash
# 健康检查
curl https://api.xxx.com/health

# 测试报告生成
curl -X POST https://api.xxx.com/api/report/start \
  -H "Content-Type: application/json" \
  -d '{"requirement": {...}}'
```

---

## 10. 维护指南

### 10.1 日常运维

```bash
# 查看后端日志
render logs --service=org-diagnosis-api

# 查看前端部署
vercel logs org-diagnosis.vercel.app

# 数据库备份
supabase db dump -f backup.sql
```

### 10.2 常见问题

| 问题 | 解决方案 |
|------|----------|
| 报告生成超时 | 检查 DeepSeek API 状态 |
| Layout 不显示 | 清除浏览器缓存 |
| 导出失败 | 检查 python-pptx 版本 |

---

## 11. 联系方式

- **项目负责人**: Claude Code AI
- **技术支持**: GitHub Issues
- **文档更新**: 2026-03-21

---

*本报告由 Claude Code 自动生成*
