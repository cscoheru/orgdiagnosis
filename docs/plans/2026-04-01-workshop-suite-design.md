# ConsultingOS 智能共创套件 — 设计文档

> 创建日期: 2026-04-01
> 状态: Approved

## 1. 概述

为 ConsultingOS 新增"智能共创套件"，作为独立工作坊页面 (`/workshop/cocreate`)，支持：
1. **生成式画布** — AI 辅助的思维导图/场景树
2. **四维矩阵打分** — 可视化散点图 + 滑动条评分
3. **AI 标签字典** — 多维标签推荐 + 人机协作定稿
4. **数据导出** — 图遍历展平 + CSV 导出

### 1.1 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 产品定位 | 独立页面 `/workshop/cocreate` | 不干扰交付流程，独立迭代 |
| AI Provider | 复用现有 ai_client.py (DashScope/DeepSeek) | 零额外配置 |
| 数据存储 | Kernel ObjectService (sys_objects + sys_relations) | 统一架构，原生图遍历 |
| AI 工作流 | 不用 LangGraph，直接 API handler 调用 ai_client | 只有 2 步（组装 prompt → 调 AI），无需状态机 |

### 1.2 路由结构

```
app/(dashboard)/workshop/
  cocreate/
    page.tsx              — 工作坊主页（创建/进入）
    [id]/
      page.tsx              — 工作坊详情（画布 + 矩阵 + 标签三个 tab）
```

---

## 2. 阶段一：Meta-Model 定义

在现有 `seed_meta_models.py` 中追加 5 个元模型。

### 2.1 模型定义

| model_key | 字段 | 说明 |
|-----------|------|------|
| `Workshop_Session` | title (text), industry_context (text), project_id (string) | 会话上下文基座 |
| `Canvas_Node` | name (text), node_type (enum: scene/painpoint/idea/task), description (text), workshop_id (string) | 画布节点 |
| `Evaluation_Item` | name (text), dim_x (float), dim_y (float), dim_z (float), dim_w (float), workshop_id (string) | 通用四维评价 |
| `Tag_Category` | name (text), color (text), display_order (int), workshop_id (string) | 标签大类 |
| `Smart_Tag` | name (text), color (text), category_id (string), workshop_id (string) | 具体标签 |

### 2.2 数据关系

- Canvas_Node 之间通过 `sys_relations` (edge type: `canvas_parent_child`) 建立父子树结构
- Evaluation_Item 通过 `workshop_id` 关联到 Workshop_Session
- Canvas_Node 可通过 `canvas_node_to_tag` 关系关联 Smart_Tag
- Tag_Category 与 Smart_Tag 通过 Smart_Tag.category_id 关联

---

## 3. 阶段二：生成式画布

### 3.1 后端 API

新建 `backend/app/api/v1/workshop.py`，挂载到 `router.py`：

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/workshop/sessions` | 创建工作坊会话 |
| GET | `/api/v1/workshop/sessions/{id}` | 获取会话 + 所有节点/关系 |
| POST | `/api/v1/workshop/sessions/{id}/nodes` | 创建画布节点 |
| PATCH | `/api/v1/workshop/sessions/{id}/nodes/{node_id}` | 更新节点内容 |
| DELETE | `/api/v1/workshop/sessions/{id}/nodes/{node_id}` | 删除节点及子树 |
| POST | `/api/v1/workshop/sessions/{id}/suggest` | AI 推断子节点 |

### 3.2 AI 推断接口 (`/suggest`)

**请求体：**
```json
{
  "current_node_id": "node-5",
  "current_node_name": "终端动销",
  "current_node_type": "scene",
  "industry_context": "高端白酒销售",
  "existing_children": ["宴席线索挖掘"]
}
```

**处理逻辑：**
1. 从 kernel 查询 current_node 的所有子节点（通过 relations）
2. 组装 prompt：行业上下文 + 当前节点 + 已有子节点列表
3. 调用 `ai_client.chat()` 生成 3-5 个 MECE 子节点建议
4. 解析 JSON 返回

**响应体：**
```json
{
  "suggestions": [
    {"name": "宴席线索挖掘与报备", "type": "scene", "reason": "..."},
    {"name": "宴席报备流程优化", "type": "task", "reason": "..."},
    {"name": "宴席成功率分析", "type": "idea", "reason": "..."}
  ]
}
```

### 3.3 前端组件

**页面布局 (`/workshop/cocreate/[id]/page.tsx`)：**
- 顶部栏：工作坊标题 + 行业上下文展示
- 三个 Tab：画布 | 矩阵 | 标签
- 画布 Tab：ReactFlow 画布

**画布交互：**
1. 安装 `elkjs`，实现自左向右 (LR) 树状自动布局
2. 自定义 `SmartNode`：hover 时右侧出现 "AI 建议" 按钮
3. 点击后调 `/suggest` → 显示 Ghost Nodes（虚线框半透明）
4. 点击 Ghost Node → 创建真实 canvas_node + relation → 虚线变实线
5. 双击节点 → 内联编辑名称/描述

**依赖安装：** `npm install elkjs`

---

## 4. 阶段三：四维矩阵打分

### 4.1 组件设计

**文件：** `components/workshop/EvaluationMatrix.tsx`

**Props 接口：**
```typescript
interface DimensionConfig {
  key: string;          // 对应 dim_x/y/z/w
  label: string;        // 如 "痛点极值"
  }
interface EvaluationMatrixProps {
  items: EvaluationItem[];           // 评价项列表
  dimensions: [DimensionConfig];    // 4 个维度配置（X/Y/Z/气泡大小）
  onItemUpdate?: (id: string, patch: Partial<EvaluationItem>) => void;
  onHighlightExport?: (items: EvaluationItem[]) => void;
}
```

**布局：左右分栏**
- 左侧 (40%)：评价项列表，每项 4 个 Slider（1-5 分）
- 右侧 (60%)：Recharts `ScatterChart`
  - X/Y 轴映射 dim_x/dim_y
  - 气泡大小映射 dim_z（预留 dim_w）
  - 两条居中参考线分四个象限
  - 右上角（高X高Y）散点红色高亮
- 底部："导出高亮场景" 按钮

### 4.2 数据流

Slider 变更 → debounce 500ms → PATCH `/api/v1/kernel/objects/{id}` → 父组件 state 更新 → Recharts 重绘

---

## 5. 阶段四：AI 标签字典

### 5.1 后端 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/workshop/sessions/{id}/tags` | 获取所有标签（按 category 分组） |
| POST | `/api/v1/workshop/sessions/{id}/tags` | 创建标签 |
| PATCH | `/api/v1/workshop/sessions/{id}/tags/{tag_id}` | 更新标签 |
| POST | `/api/v1/workshop/sessions/{id}/suggest-tags` | AI 推荐标签 |

### 5.2 AI 推荐接口 (`/suggest-tags`)

**请求体：**
```json
{
  "target_text": "宴席线索挖掘与报备：通过商会资源...",
  "node_id": "node-5",
  "existing_tags": [
    {"name": "商务宴席", "category": "context"},
    {"name": "线索难寻", "category": "pain"}
  ]
}
```

**响应体：**
```json
{
  "context_tags": [{"name": "商务宴席", "is_new": false}],
  "pain_tags": [{"name": "线索难寻", "is_new": false}, {"name": "窜货风险", "is_new": true}],
  "skill_tags": [{"name": "客情维护", "is_new": false}, {"name": "系统录入规范", "is_new": true}],
  "format_tags": [{"name": "报告输出", "is_new": true}]
}
```

### 5.3 前端组件

**文件：** `components/workshop/TaggingSidebar.tsx`

**交互流程：**
1. 用户在画布/列表中选中一个"业务场景节点"
2. 右侧滑出"标签配置面板"
3. 点击 "AI 智能分析标签" → 调用 `/suggest-tags`
4. 展示分类标签胶囊：
   - `is_new: false` → 蓝色常规 Pill（已入库标签）
   - `is_new: true` → 紫色/金色 Pill + "[+] 采纳" 按钮
5. 用户点击 Pill 切换选中状态
6. "保存配置" → 通过 Kernel API 创建 canvas_node 到 smart_tag 的 relation

---

## 6. 阶段五：数据导出

### 6.1 后端 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/workshop/sessions/{id}/export` | 图遍历展平导出 |

**处理逻辑：**
1. 从 workshop_session 出发，遍历所有关联的 canvas_node（通过 relations）
2. 对每个节点，查询 HAS_TAG 关联的 smart_tag
3. 组装扁平化列表

**响应体：**
```json
{
  "workshop_title": "国窖终端动销工作坊",
  "industry": "高端白酒",
  "items": [
    {
      "node_id": "node-5",
      "node_name": "宴席线索挖掘与报备",
      "node_type": "scene",
      "dim_x": 4.5,
      "dim_y": 5.0,
      "dim_z": 3.0,
      "dim_w": 2.0,
      "tags": {
        "context": ["商务宴席"],
        "pain": ["线索难寻"],
        "skill": ["客情维护"],
        "format": []
      }
    }
  ]
}
```

### 6.2 前端

- 画布/矩阵页面顶部提供 "📥 导出共创成果 (CSV)" 按钮
- 调用 export API → 转换 JSON → 触发 CSV 下载
- 文件名格式：`{workshop_title}_{date}.csv`

---

## 7. 文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `app/(dashboard)/workshop/cocreate/page.tsx` | 工作坊主页（创建/列表） |
| `app/(dashboard)/workshop/cocreate/[id]/page.tsx` | 工作坊详情（三 tab） |
| `components/workshop/EvaluationMatrix.tsx` | 四维矩阵组件 |
| `components/workshop/TaggingSidebar.tsx` | 标签配置侧边栏 |
| `components/workshop/CoCreateCanvas.tsx` | 生成式画布组件 |
| `components/workshop/SmartNode.tsx` | 画布自定义节点 |
| `backend/app/api/v1/workshop.py` | 工作坊 API |
| `lib/api/workshop-api.ts` | 前端 API client |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/scripts/seed_meta_models.py` | 追加 5 个元模型 |
| `backend/app/api/router.py` | 注册 workshop router |
| `package.json` | 添加 elkjs 依赖 |

---

## 8. 实施顺序

| # | 阶段 | 依赖 | 预估 |
|---|------|------|------|
| 1 | Meta-Model 定义 | 无 | 小 |
| 2 | Workshop API (CRUD) | 阶段 1 | 中 |
| 3 | 生成式画布 (前端) | 阶段 2 API | 大 |
| 4 | AI 推断接口 | 阶段 2 API | 中 |
| 5 | 四维矩阵 (前端) | 阶段 1 元模型 | 中 |
| 6 | 标签字典 (前后端) | 阶段 2 API | 中 |
| 7 | 数据导出 (前后端) | 阶段 2-6 | 中 |
| 8 | 集成测试 | 全部 | 小 |
