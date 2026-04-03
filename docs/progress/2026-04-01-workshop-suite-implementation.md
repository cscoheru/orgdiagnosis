# ConsultingOS 智能共创套件 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a workshop co-creation suite with AI-assisted canvas, 4D matrix scoring, AI tagging, and CSV export — all backed by Kernel ObjectService.

**Architecture:** 5 new meta-models (Workshop_Session, Canvas_Node, Evaluation_Item, Tag_Category, Smart_Tag) stored in existing Kernel InMemoryDatabase. Backend API in `backend/app/api/v1/workshop.py` using ObjectService for CRUD + ai_client for AI endpoints. Frontend pages under `app/(dashboard)/workshop/cocreate/` with ReactFlow canvas, Recharts scatter chart, and tag pills.

**Tech Stack:** FastAPI + Kernel ObjectService (backend), Next.js + ReactFlow + Recharts + elkjs (frontend), DashScope/DeepSeek via ai_client.py (AI)

---

## Task 1: Meta-Model 定义 (Seed Data)

**Files:**
- Modify: `backend/scripts/seed_meta_models.py` (append 5 models to `META_MODELS` list, line ~341 before `]`)

**Step 1: Add 5 workshop meta-models to META_MODELS list**

Append these 5 definitions to the `META_MODELS` list in `seed_meta_models.py`, before the closing `]` on line 341:

```python
    # ========== 智能共创套件 Workshop Suite (5) ==========
    {
        "model_key": "Workshop_Session",
        "name": "工作坊会话",
        "fields": [
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "工作坊标题"},
            {"field_name": "industry_context", "field_type": "text", "is_required": True, "description": "行业上下文背景"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目 ID"},
        ],
        "description": "共创套件 — 工作坊会话基座",
    },
    {
        "model_key": "Canvas_Node",
        "name": "画布节点",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "节点名称"},
            {"field_name": "node_type", "field_type": "enum", "is_required": True, "enum_options": ["scene", "painpoint", "idea", "task"], "description": "节点类型"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "节点描述"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 画布思维导图节点",
    },
    {
        "model_key": "Evaluation_Item",
        "name": "评价项",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "评价项名称"},
            {"field_name": "dim_x", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 X 分数 (1-5)"},
            {"field_name": "dim_y", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 Y 分数 (1-5)"},
            {"field_name": "dim_z", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 Z 分数 (1-5)"},
            {"field_name": "dim_w", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 W 分数 (1-5)"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 四维评价项",
    },
    {
        "model_key": "Tag_Category",
        "name": "标签大类",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "大类名称 (场景维/痛点维/技能维/格式维)"},
            {"field_name": "color", "field_type": "string", "is_required": False, "default_value": "#3b82f6", "description": "显示颜色"},
            {"field_name": "display_order", "field_type": "integer", "is_required": False, "default_value": 0, "description": "排序顺序"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 标签分类",
    },
    {
        "model_key": "Smart_Tag",
        "name": "智能标签",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "标签名称"},
            {"field_name": "color", "field_type": "string", "is_required": False, "default_value": "#6b7280", "description": "标签颜色"},
            {"field_name": "category_id", "field_type": "string", "is_required": False, "description": "所属标签大类 ID"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 具体标签",
    },
```

**Step 2: Restart backend to verify meta-models seed**

Run: `cd /Users/kjonekong/Documents/org-diagnosis/backend && nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &`

Then verify: `curl -s http://localhost:8000/api/v1/kernel/meta | python3 -m json.tool | grep -E "Workshop_Session|Canvas_Node|Evaluation_Item|Tag_Category|Smart_Tag"`

Expected: All 5 model keys appear in the output.

**Step 3: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add backend/scripts/seed_meta_models.py
git commit -m "feat(workshop): add 5 meta-models for co-creation suite"
```

---

## Task 2: Workshop Backend API (CRUD + AI Suggest)

**Files:**
- Create: `backend/app/api/v1/workshop.py`
- Modify: `backend/app/api/router.py` (register workshop router)

**Step 1: Create `backend/app/api/v1/workshop.py`**

```python
"""
工作坊共创套件 API

端点:
  POST/GET   /sessions              — 创建/列表工作坊会话
  GET        /sessions/{id}         — 获取会话详情 (含所有节点)
  POST       /sessions/{id}/nodes   — 创建画布节点
  PATCH      /sessions/{id}/nodes/{node_id} — 更新节点
  DELETE     /sessions/{id}/nodes/{node_id} — 删除节点及子树
  POST       /sessions/{id}/suggest — AI 推断子节点
  GET        /sessions/{id}/tags    — 获取标签 (按 category 分组)
  POST       /sessions/{id}/tags    — 创建标签
  PATCH      /sessions/{id}/tags/{tag_id} — 更新标签
  POST       /sessions/{id}/suggest-tags — AI 推荐标签
  GET        /sessions/{id}/export  — 图遍历展平导出
  GET/POST   /sessions/{id}/evaluations — 评价项 CRUD
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Any
from pydantic import BaseModel

from app.kernel.database import get_db
from app.services.kernel.object_service import ObjectService
from app.services.kernel.relation_service import RelationService
from app.models.kernel.meta_model import (
    ObjectCreate,
    ObjectUpdate,
)

router = APIRouter(prefix="/workshop", tags=["工作坊共创"])


# ─── Request / Response Models ───


class SessionCreate(BaseModel):
    title: str
    industry_context: str
    project_id: str | None = None


class NodeCreate(BaseModel):
    name: str
    node_type: str  # scene | painpoint | idea | task
    description: str | None = None
    parent_node_id: str | None = None  # 父节点 _id，用于建立 relation


class NodeUpdate(BaseModel):
    name: str | None = None
    node_type: str | None = None
    description: str | None = None


class SuggestRequest(BaseModel):
    current_node_id: str
    current_node_name: str
    current_node_type: str
    industry_context: str
    existing_children: list[str] = []


class EvaluationCreate(BaseModel):
    name: str
    dim_x: float = 3.0
    dim_y: float = 3.0
    dim_z: float = 3.0
    dim_w: float = 3.0


class EvaluationUpdate(BaseModel):
    name: str | None = None
    dim_x: float | None = None
    dim_y: float | None = None
    dim_z: float | None = None
    dim_w: float | None = None


class TagCreate(BaseModel):
    name: str
    category_id: str | None = None
    color: str = "#6b7280"


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    category_id: str | None = None


class SuggestTagsRequest(BaseModel):
    target_text: str
    node_id: str
    existing_tags: list[dict[str, str]] = []  # [{name, category}]


# ─── Session Endpoints ───


@router.post("/sessions", status_code=status.HTTP_201_CREATED, summary="创建工作坊会话")
def create_session(data: SessionCreate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    obj = svc.create_object(ObjectCreate(
        model_key="Workshop_Session",
        properties={
            "title": data.title,
            "industry_context": data.industry_context,
            **({"project_id": data.project_id} if data.project_id else {}),
        },
    ))
    # 自动创建 4 个默认标签大类
    rel_svc = RelationService(db)
    categories = [
        {"name": "场景维", "color": "#3b82f6", "display_order": 1},
        {"name": "痛点维", "color": "#ef4444", "display_order": 2},
        {"name": "技能维", "color": "#22c55e", "display_order": 3},
        {"name": "格式维", "color": "#a855f7", "display_order": 4},
    ]
    for cat in categories:
        svc.create_object(ObjectCreate(
            model_key="Tag_Category",
            properties={
                "name": cat["name"],
                "color": cat["color"],
                "display_order": cat["display_order"],
                "workshop_id": obj["_id"],
            },
        ))
    return obj


@router.get("/sessions", summary="获取工作坊列表")
def list_sessions(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=50),
    db: Any = Depends(get_db),
):
    svc = ObjectService(db)
    sessions = svc.list_objects(model_key="Workshop_Session", limit=limit)
    if project_id:
        sessions = [s for s in sessions if s.get("properties", {}).get("project_id") == project_id]
    return sessions


@router.get("/sessions/{session_id}", summary="获取会话详情")
def get_session(session_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    session = svc.get_object(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    # 获取所有节点
    all_nodes = svc.list_objects(model_key="Canvas_Node", limit=500)
    nodes = [n for n in all_nodes if n.get("properties", {}).get("workshop_id") == session_id]
    # 获取所有关系
    rel_svc = RelationService(db)
    all_rels = rel_svc.list_relations(limit=1000)
    node_ids = {n["_id"] for n in nodes}
    rels = [r for r in all_rels if r["relation_type"] == "canvas_parent_child" and r["from_obj_id"] in node_ids]
    return {"session": session, "nodes": nodes, "relations": rels}


# ─── Canvas Node Endpoints ───


@router.post("/sessions/{session_id}/nodes", status_code=status.HTTP_201_CREATED, summary="创建画布节点")
def create_node(session_id: str, data: NodeCreate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    rel_svc = RelationService(db)
    node = svc.create_object(ObjectCreate(
        model_key="Canvas_Node",
        properties={
            "name": data.name,
            "node_type": data.node_type,
            **({"description": data.description} if data.description else {}),
            "workshop_id": session_id,
        },
    ))
    # 如果有父节点，创建关系
    if data.parent_node_id:
        rel_svc.create_relation({
            "from_obj_id": data.parent_node_id,
            "to_obj_id": node["_id"],
            "relation_type": "canvas_parent_child",
        })
    return node


@router.patch("/sessions/{session_id}/nodes/{node_id}", summary="更新节点")
def update_node(session_id: str, node_id: str, data: NodeUpdate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    props = {k: v for k, v in data.model_dump().items() if v is not None}
    return svc.update_object(node_id, ObjectUpdate(properties=props))


@router.delete("/sessions/{session_id}/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除节点及子树")
def delete_node(session_id: str, node_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    rel_svc = RelationService(db)
    # 找到所有子节点 (BFS)
    to_delete = [node_id]
    visited = set()
    while to_delete:
        current = to_delete.pop()
        if current in visited:
            continue
        visited.add(current)
        # 找子节点
        all_rels = rel_svc.list_relations(limit=1000)
        children = [r["to_obj_id"] for r in all_rels
                     if r["relation_type"] == "canvas_parent_child" and r["from_obj_id"] == current]
        to_delete.extend(children)
    # 删除所有关系和节点
    for nid in visited:
        for r in rel_svc.list_relations(limit=1000):
            if r["from_obj_id"] == nid or r["to_obj_id"] == nid:
                rel_svc.delete_relation(r["_key"])
        svc.delete_object(nid)


# ─── AI Suggest Nodes ───


@router.post("/sessions/{session_id}/suggest", summary="AI 推断子节点")
async def suggest_nodes(session_id: str, data: SuggestRequest, db: Any = Depends(get_db)):
    from app.services.ai_client import ai_client

    if not ai_client.is_configured():
        raise HTTPException(503, "AI 服务未配置")

    system_prompt = """你是一位顶级商业咨询顾问。根据给定的行业上下文和当前节点，发散出 3-5 个 MECE（相互独立完全穷尽）的子节点建议。

返回 JSON 格式:
{"suggestions": [{"name": "节点名称", "type": "scene|painpoint|idea|task", "reason": "推荐理由"}]}

节点类型说明:
- scene: 业务场景/活动
- painpoint: 痛点/问题
- idea: 想法/机会
- task: 任务/行动"""

    existing_list = "\n".join(f"- {c}" for c in data.existing_children) if data.existing_children else "无"
    user_prompt = f"""行业背景: {data.industry_context}
当前节点: [{data.current_node_type}] {data.current_node_name}
已有子节点:
{existing_list}

请推荐 3-5 个子节点。"""

    try:
        result = await ai_client.chat_json(
            system_prompt, user_prompt, temperature=0.7
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"AI 推断失败: {e}")


# ─── Evaluation Endpoints ───


@router.get("/sessions/{session_id}/evaluations", summary="获取评价项列表")
def list_evaluations(session_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    all_items = svc.list_objects(model_key="Evaluation_Item", limit=500)
    return [i for i in all_items if i.get("properties", {}).get("workshop_id") == session_id]


@router.post("/sessions/{session_id}/evaluations", status_code=status.HTTP_201_CREATED, summary="创建评价项")
def create_evaluation(session_id: str, data: EvaluationCreate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    return svc.create_object(ObjectCreate(
        model_key="Evaluation_Item",
        properties={
            "name": data.name,
            "dim_x": data.dim_x,
            "dim_y": data.dim_y,
            "dim_z": data.dim_z,
            "dim_w": data.dim_w,
            "workshop_id": session_id,
        },
    ))


@router.patch("/sessions/{session_id}/evaluations/{eval_id}", summary="更新评价项")
def update_evaluation(session_id: str, eval_id: str, data: EvaluationUpdate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    props = {k: v for k, v in data.model_dump().items() if v is not None}
    return svc.update_object(eval_id, ObjectUpdate(properties=props))


@router.delete("/sessions/{session_id}/evaluations/{eval_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除评价项")
def delete_evaluation(session_id: str, eval_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    svc.delete_object(eval_id)


# ─── Tag Endpoints ───


@router.get("/sessions/{session_id}/tags", summary="获取标签 (按 category 分组)")
def list_tags(session_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    # 获取所有标签大类
    all_cats = svc.list_objects(model_key="Tag_Category", limit=500)
    cats = [c for c in all_cats if c.get("properties", {}).get("workshop_id") == session_id]
    cats.sort(key=lambda c: c.get("properties", {}).get("display_order", 0))
    # 获取所有标签
    all_tags = svc.list_objects(model_key="Smart_Tag", limit=500)
    tags = [t for t in all_tags if t.get("properties", {}).get("workshop_id") == session_id]
    # 按大类分组
    grouped = {}
    for cat in cats:
        cat_id = cat["_id"]
        cat_tags = [t for t in tags if t.get("properties", {}).get("category_id") == cat_id]
        grouped[cat["properties"]["name"]] = {
            "category": cat,
            "tags": cat_tags,
        }
    return grouped


@router.post("/sessions/{session_id}/tags", status_code=status.HTTP_201_CREATED, summary="创建标签")
def create_tag(session_id: str, data: TagCreate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    return svc.create_object(ObjectCreate(
        model_key="Smart_Tag",
        properties={
            "name": data.name,
            "color": data.color,
            **({"category_id": data.category_id} if data.category_id else {}),
            "workshop_id": session_id,
        },
    ))


@router.patch("/sessions/{session_id}/tags/{tag_id}", summary="更新标签")
def update_tag(session_id: str, tag_id: str, data: TagUpdate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    props = {k: v for k, v in data.model_dump().items() if v is not None}
    return svc.update_object(tag_id, ObjectUpdate(properties=props))


# ─── AI Suggest Tags ───


@router.post("/sessions/{session_id}/suggest-tags", summary="AI 推荐标签")
async def suggest_tags(session_id: str, data: SuggestTagsRequest, db: Any = Depends(get_db)):
    from app.services.ai_client import ai_client

    if not ai_client.is_configured():
        raise HTTPException(503, "AI 服务未配置")

    # 获取已有标签字典
    svc = ObjectService(db)
    all_tags = svc.list_objects(model_key="Smart_Tag", limit=500)
    workshop_tags = [t for t in all_tags if t.get("properties", {}).get("workshop_id") == session_id]
    existing_tag_names = [t["properties"]["name"] for t in workshop_tags]

    existing_str = "\n".join(f"- [{t['category']}] {t['name']}" for t in data.existing_tags) if data.existing_tags else "无"
    tag_dict_str = "\n".join(f"- {n}" for n in existing_tag_names) if existing_tag_names else "暂无标签"

    system_prompt = """你是一位咨询行业知识管理专家。根据业务场景描述，推荐最合适的标签。

返回 JSON 格式:
{
  "context_tags": [{"name": "标签名", "is_new": false}],
  "pain_tags": [{"name": "标签名", "is_new": true}],
  "skill_tags": [{"name": "标签名", "is_new": false}],
  "format_tags": [{"name": "标签名", "is_new": true}]
}

标签分类说明:
- context_tags: 场景维 (业务场景、客户类型、市场环境)
- pain_tags: 痛点维 (问题、困难、挑战)
- skill_tags: 技能维 (所需能力、方法论、工具)
- format_tags: 格式维 (交付物形式、报告类型)

is_new: true 表示系统中尚无此标签，建议新增。请先检查已有标签字典。"""

    user_prompt = f"""业务场景描述:
{data.target_text}

已有标签字典:
{tag_dict_str}

当前节点已有标签:
{existing_str}

请推荐标签 (每个维度 2-4 个)。"""

    try:
        result = await ai_client.chat_json(
            system_prompt, user_prompt, temperature=0.5
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"AI 标签推荐失败: {e}")


# ─── Export Endpoint ───


@router.get("/sessions/{session_id}/export", summary="图遍历展平导出")
def export_session(session_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    rel_svc = RelationService(db)

    # 获取会话
    session = svc.get_object(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")

    # 获取所有节点
    all_nodes = svc.list_objects(model_key="Canvas_Node", limit=500)
    nodes = [n for n in all_nodes if n.get("properties", {}).get("workshop_id") == session_id]

    # 获取所有关系
    all_rels = rel_svc.list_relations(limit=1000)
    node_ids = {n["_id"] for n in nodes}
    parent_map = {}  # node_id -> parent_id
    for r in all_rels:
        if r["relation_type"] == "canvas_parent_child" and r["to_obj_id"] in node_ids:
            parent_map[r["to_obj_id"]] = r["from_obj_id"]

    # 获取所有标签
    all_tags = svc.list_objects(model_key="Smart_Tag", limit=500)
    tag_rels = [r for r in all_rels if r.get("relation_type") == "canvas_node_to_tag"]
    # Note: tag relations are stored in sys_relations, need to query there
    all_tag_rels = rel_svc.list_relations(limit=1000)
    tag_rels_map: dict[str, list[str]] = {}  # node_id -> [tag_names]
    for r in all_tag_rels:
        if r["relation_type"] == "canvas_node_to_tag" and r["from_obj_id"] in node_ids:
            tag_obj = svc.get_object(r["to_obj_id"])
            if tag_obj:
                tag_name = tag_obj["properties"].get("name", "")
                cat_id = tag_obj["properties"].get("category_id", "")
                tag_rels_map.setdefault(r["from_obj_id"], []).append(tag_name)

    # 获取所有评价项
    all_evals = svc.list_objects(model_key="Evaluation_Item", limit=500)
    eval_map = {}  # name -> {dim_x, dim_y, dim_z, dim_w}
    for e in all_evals:
        if e.get("properties", {}).get("workshop_id") == session_id:
            eval_map[e["properties"].get("name", "")] = e["properties"]

    # 构建层级路径 (L1 > L2 > L3)
    def get_path(node_id: str) -> list[str]:
        path = []
        current = node_id
        depth = 0
        while current and depth < 5:
            for n in nodes:
                if n["_id"] == current:
                    path.append(n["properties"].get("name", ""))
                    current = parent_map.get(current)
                    break
            else:
                break
            depth += 1
        return list(reversed(path))

    # 组装导出数据
    items = []
    for node in nodes:
        path = get_path(node["_id"])
        props = node["properties"]
        eval_data = eval_map.get(props.get("name", ""), {})
        tags = tag_rels_map.get(node["_id"], [])

        items.append({
            "node_id": node["_id"],
            "path": " > ".join(path) if path else props.get("name", ""),
            "node_name": props.get("name", ""),
            "node_type": props.get("node_type", ""),
            "dim_x": eval_data.get("dim_x"),
            "dim_y": eval_data.get("dim_y"),
            "dim_z": eval_data.get("dim_z"),
            "dim_w": eval_data.get("dim_w"),
            "tags": tags,
        })

    return {
        "workshop_title": session["properties"].get("title", ""),
        "industry": session["properties"].get("industry_context", ""),
        "items": items,
    }
```

**Step 2: Register workshop router in `backend/app/api/router.py`**

Add import and registration (after the workflow_router import on line 18):

```python
from app.api.v1.workshop import router as workshop_router
```

Add registration (after the workflow_router line, line 52):

```python
# 工作坊共创套件 API
api_router.include_router(workshop_router, prefix="/v1")
```

**Step 3: Verify API starts without error**

Run: `cd /Users/kjonekong/Documents/org-diagnosis/backend && python -c "from app.api.v1.workshop import router; print('OK:', len(router.routes), 'routes')"`

Expected: `OK: 14 routes`

**Step 4: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add backend/app/api/v1/workshop.py backend/app/api/router.py
git commit -m "feat(workshop): add workshop API with CRUD, AI suggest, and export endpoints"
```

---

## Task 3: Frontend API Client + Install elkjs

**Files:**
- Create: `lib/api/workshop-api.ts`
- Modify: `package.json` (add elkjs)

**Step 1: Install elkjs dependency**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npm install elkjs`

**Step 2: Create `lib/api/workshop-api.ts`**

```typescript
/**
 * Workshop API Client
 *
 * 与后端 /api/v1/workshop/* 端点交互。
 */

import { API_BASE_URL } from "@/lib/api-config";

// ──────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────

export interface WorkshopSession {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    title: string;
    industry_context: string;
    project_id?: string;
  };
}

export interface CanvasNode {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    name: string;
    node_type: "scene" | "painpoint" | "idea" | "task";
    description?: string;
    workshop_id: string;
  };
}

export interface CanvasRelation {
  _key: string;
  _id: string;
  from_obj_id: string;
  to_obj_id: string;
  relation_type: string;
}

export interface EvaluationItem {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    name: string;
    dim_x: number;
    dim_y: number;
    dim_z: number;
    dim_w: number;
    workshop_id: string;
  };
}

export interface TagCategory {
  _key: string;
  _id: string;
  properties: {
    name: string;
    color: string;
    display_order: number;
    workshop_id: string;
  };
}

export interface SmartTag {
  _key: string;
  _id: string;
  properties: {
    name: string;
    color: string;
    category_id?: string;
    workshop_id: string;
  };
}

export interface SessionDetail {
  session: WorkshopSession;
  nodes: CanvasNode[];
  relations: CanvasRelation[];
}

export interface AiSuggestion {
  name: string;
  type: string;
  reason: string;
}

export interface AiTagSuggestion {
  name: string;
  is_new: boolean;
}

export interface ExportData {
  workshop_title: string;
  industry: string;
  items: ExportItem[];
}

export interface ExportItem {
  node_id: string;
  path: string;
  node_name: string;
  node_type: string;
  dim_x?: number;
  dim_y?: number;
  dim_z?: number;
  dim_w?: number;
  tags: string[];
}

// ──────────────────────────────────────────────
// 通用请求
// ──────────────────────────────────────────────

async function workshopRequest<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/workshop${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `服务器错误 ${response.status}: ${text}` };
    }
    if (response.status === 204) return { success: true };
    const json = await response.json();
    return { success: true, data: json };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "网络错误" };
  }
}

// ──────────────────────────────────────────────
// Session API
// ──────────────────────────────────────────────

export async function createSession(title: string, industry_context: string, project_id?: string) {
  return workshopRequest<WorkshopSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title, industry_context, project_id }),
  });
}

export async function listSessions(project_id?: string) {
  const params = project_id ? `?project_id=${encodeURIComponent(project_id)}` : "";
  return workshopRequest<WorkshopSession[]>(`/sessions${params}`);
}

export async function getSession(sessionId: string) {
  return workshopRequest<SessionDetail>(`/sessions/${encodeURIComponent(sessionId)}`);
}

// ──────────────────────────────────────────────
// Node API
// ──────────────────────────────────────────────

export async function createNode(sessionId: string, name: string, nodeType: string, description?: string, parentNodeId?: string) {
  return workshopRequest<CanvasNode>(`/sessions/${encodeURIComponent(sessionId)}/nodes`, {
    method: "POST",
    body: JSON.stringify({ name, node_type: nodeType, description, parent_node_id: parentNodeId }),
  });
}

export async function updateNode(sessionId: string, nodeId: string, patch: { name?: string; node_type?: string; description?: string }) {
  return workshopRequest<CanvasNode>(`/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteNode(sessionId: string, nodeId: string) {
  return workshopRequest<void>(`/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// AI Suggest
// ──────────────────────────────────────────────

export async function suggestNodes(sessionId: string, data: {
  current_node_id: string;
  current_node_name: string;
  current_node_type: string;
  industry_context: string;
  existing_children: string[];
}) {
  return workshopRequest<{ suggestions: AiSuggestion[] }>(`/sessions/${encodeURIComponent(sessionId)}/suggest`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// Evaluation API
// ──────────────────────────────────────────────

export async function listEvaluations(sessionId: string) {
  return workshopRequest<EvaluationItem[]>(`/sessions/${encodeURIComponent(sessionId)}/evaluations`);
}

export async function createEvaluation(sessionId: string, data: { name: string; dim_x?: number; dim_y?: number; dim_z?: number; dim_w?: number }) {
  return workshopRequest<EvaluationItem>(`/sessions/${encodeURIComponent(sessionId)}/evaluations`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEvaluation(sessionId: string, evalId: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) {
  return workshopRequest<EvaluationItem>(`/sessions/${encodeURIComponent(sessionId)}/evaluations/${encodeURIComponent(evalId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteEvaluation(sessionId: string, evalId: string) {
  return workshopRequest<void>(`/sessions/${encodeURIComponent(sessionId)}/evaluations/${encodeURIComponent(evalId)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// Tag API
// ──────────────────────────────────────────────

export async function listTags(sessionId: string) {
  return workshopRequest<Record<string, { category: TagCategory; tags: SmartTag[] }>>(`/sessions/${encodeURIComponent(sessionId)}/tags`);
}

export async function createTag(sessionId: string, name: string, categoryId?: string, color?: string) {
  return workshopRequest<SmartTag>(`/sessions/${encodeURIComponent(sessionId)}/tags`, {
    method: "POST",
    body: JSON.stringify({ name, category_id: categoryId, color: color || "#6b7280" }),
  });
}

export async function updateTag(sessionId: string, tagId: string, patch: { name?: string; color?: string; category_id?: string }) {
  return workshopRequest<SmartTag>(`/sessions/${encodeURIComponent(sessionId)}/tags/${encodeURIComponent(tagId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function suggestTags(sessionId: string, data: {
  target_text: string;
  node_id: string;
  existing_tags: { name: string; category: string }[];
}) {
  return workshopRequest<{
    context_tags: AiTagSuggestion[];
    pain_tags: AiTagSuggestion[];
    skill_tags: AiTagSuggestion[];
    format_tags: AiTagSuggestion[];
  }>(`/sessions/${encodeURIComponent(sessionId)}/suggest-tags`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// Export API
// ──────────────────────────────────────────────

export async function exportSession(sessionId: string) {
  return workshopRequest<ExportData>(`/sessions/${encodeURIComponent(sessionId)}/export`);
}

// ──────────────────────────────────────────────
// Relation helpers (via kernel API)
// ──────────────────────────────────────────────

import { createRelation } from "@/lib/api/kernel-client";

export async function tagNode(nodeId: string, tagId: string) {
  return createRelation(nodeId, tagId, "canvas_node_to_tag");
}

export async function untagNode(relationKey: string) {
  const { deleteRelation } = await import("@/lib/api/kernel-client");
  return deleteRelation(relationKey);
}
```

**Step 3: Verify API client compiles**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npx tsc --noEmit lib/api/workshop-api.ts 2>&1 | head -20`

Expected: No type errors (or only pre-existing errors unrelated to this file)

**Step 4: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add lib/api/workshop-api.ts package.json package-lock.json
git commit -m "feat(workshop): add frontend API client and install elkjs"
```

---

## Task 4: Workshop Pages (List + Detail Shell)

**Files:**
- Create: `app/(dashboard)/workshop/cocreate/page.tsx`
- Create: `app/(dashboard)/workshop/cocreate/[id]/page.tsx`

**Step 1: Create workshop list page**

Create `app/(dashboard)/workshop/cocreate/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listSessions, createSession, type WorkshopSession } from "@/lib/api/workshop-api";
import { Plus, ArrowRight, Sparkles } from "lucide-react";

export default function CoCreatePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const res = await listSessions();
    if (res.success && res.data) setSessions(res.data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newIndustry.trim()) return;
    setCreating(true);
    const res = await createSession(newTitle.trim(), newIndustry.trim());
    if (res.success && res.data) {
      router.push(`/workshop/cocreate/${res.data._id}`);
    }
    setCreating(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            智能共创套件
          </h1>
          <p className="text-gray-500 mt-1">AI 辅助的结构化咨询共创工作坊</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建工作坊
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">创建工作坊</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工作坊标题</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="如：国窖终端动销共创会"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行业背景</label>
                <textarea
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="如：高端白酒销售，核心渠道为经销商和终端烟酒店..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newIndustry.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建并进入"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">还没有工作坊</p>
          <p className="text-gray-400 text-sm mt-1">点击上方按钮创建第一个智能共创工作坊</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <button
              key={s._id}
              onClick={() => router.push(`/workshop/cocreate/${s._id}`)}
              className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{s.properties.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{s.properties.industry_context}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create workshop detail page (shell with 3 tabs)**

Create `app/(dashboard)/workshop/cocreate/[id]/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  getSession,
  exportSession,
  createEvaluation,
  deleteEvaluation,
  listEvaluations,
  updateEvaluation,
  listTags,
  createTag,
  tagNode,
  suggestNodes,
  suggestTags,
  createNode,
  updateNode,
  deleteNode,
  type SessionDetail,
  type EvaluationItem,
  type AiSuggestion,
  type AiTagSuggestion,
} from "@/lib/api/workshop-api";
import { listRelations, deleteRelation, type KernelRelation } from "@/lib/api/kernel-client";
import { ArrowLeft, Download, Sparkles, Layers, BarChart3, Tags } from "lucide-react";

// Dynamic imports for SSR compatibility
const CoCreateCanvas = dynamic(() => import("@/components/workshop/CoCreateCanvas"), { ssr: false });
const EvaluationMatrix = dynamic(() => import("@/components/workshop/EvaluationMatrix"), { ssr: false });
const TaggingSidebar = dynamic(() => import("@/components/workshop/TaggingSidebar"), { ssr: false });

type Tab = "canvas" | "matrix" | "tags";

export default function WorkshopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("canvas");
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [tagData, setTagData] = useState<Record<string, { category: any; tags: any[] }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    const res = await getSession(sessionId);
    if (res.success && res.data) {
      setSession(res.data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (activeTab === "matrix") {
      listEvaluations(sessionId).then((r) => {
        if (r.success && r.data) setEvaluations(r.data);
      });
    }
    if (activeTab === "tags") {
      listTags(sessionId).then((r) => {
        if (r.success && r.data) setTagData(r.data);
      });
    }
  }, [activeTab, sessionId]);

  // ─── Canvas handlers ───
  const handleAddNode = async (name: string, nodeType: string, description?: string, parentId?: string) => {
    const res = await createNode(sessionId, name, nodeType, description, parentId);
    if (res.success) loadSession();
  };

  const handleUpdateNode = async (nodeId: string, patch: { name?: string; node_type?: string; description?: string }) => {
    await updateNode(sessionId, nodeId, patch);
    loadSession();
  };

  const handleDeleteNode = async (nodeId: string) => {
    await deleteNode(sessionId, nodeId);
    loadSession();
  };

  const handleSuggestNodes = async (data: Parameters<typeof suggestNodes>[1]) => {
    return suggestNodes(sessionId, data);
  };

  // ─── Evaluation handlers ───
  const handleAddEvaluation = async (name: string) => {
    const res = await createEvaluation(sessionId, { name });
    if (res.success && res.data) {
      setEvaluations((prev) => [...prev, res.data!]);
    }
  };

  const handleUpdateEvaluation = async (evalId: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) => {
    const res = await updateEvaluation(sessionId, evalId, patch);
    if (res.success && res.data) {
      setEvaluations((prev) => prev.map((e) => (e._id === evalId ? res.data! : e)));
    }
  };

  const handleDeleteEvaluation = async (evalId: string) => {
    await deleteEvaluation(sessionId, evalId);
    setEvaluations((prev) => prev.filter((e) => e._id !== evalId));
  };

  // ─── Tag handlers ───
  const handleSuggestTags = async (data: Parameters<typeof suggestTags>[1]) => {
    return suggestTags(sessionId, data);
  };

  const handleCreateTag = async (name: string, categoryId?: string) => {
    const res = await createTag(sessionId, name, categoryId);
    if (res.success && res.data) {
      // Reload tags
      const tr = await listTags(sessionId);
      if (tr.success && tr.data) setTagData(tr.data);
      return res.data;
    }
    return null;
  };

  const handleTagNode = async (nodeId: string, tagId: string) => {
    await tagNode(nodeId, tagId);
  };

  // ─── Export handler ───
  const handleExport = async () => {
    const res = await exportSession(sessionId);
    if (!res.success || !res.data) return;
    const { workshop_title, items } = res.data;
    // Convert to CSV
    const headers = ["路径", "节点名称", "节点类型", "维度X", "维度Y", "维度Z", "维度W", "标签"];
    const rows = items.map((item) => [
      item.path,
      item.node_name,
      item.node_type,
      item.dim_x ?? "",
      item.dim_y ?? "",
      item.dim_z ?? "",
      item.dim_w ?? "",
      item.tags.join("; "),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workshop_title}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">加载工作坊...</div>;
  if (!session) return <div className="text-center py-20 text-red-500">工作坊不存在</div>;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "canvas", label: "画布", icon: <Layers className="w-4 h-4" /> },
    { key: "matrix", label: "矩阵", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "tags", label: "标签", icon: <Tags className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/workshop/cocreate")} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{session.session.properties.title}</h1>
            <p className="text-xs text-gray-500 line-clamp-1">{session.session.properties.industry_context}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b bg-gray-50 px-6 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "canvas" && (
          <CoCreateCanvas
            session={session}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onSuggestNodes={handleSuggestNodes}
            onSelectNode={setSelectedNodeId}
          />
        )}
        {activeTab === "matrix" && (
          <EvaluationMatrix
            items={evaluations}
            onAddItem={handleAddEvaluation}
            onUpdateItem={handleUpdateEvaluation}
            onDeleteItem={handleDeleteEvaluation}
          />
        )}
        {activeTab === "tags" && (
          <TaggingSidebar
            sessionId={sessionId}
            tagData={tagData}
            nodes={session.nodes}
            selectedNodeId={selectedNodeId}
            onSuggestTags={handleSuggestTags}
            onCreateTag={handleCreateTag}
            onTagNode={handleTagNode}
            onRefreshTags={() => listTags(sessionId).then((r) => { if (r.success && r.data) setTagData(r.data); })}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify pages compile**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npx tsc --noEmit app/\(dashboard\)/workshop/cocreate/page.tsx 2>&1 | head -20`

Expected: No errors (the dynamic imports will resolve once the components exist)

**Step 4: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add app/\(dashboard\)/workshop/
git commit -m "feat(workshop): add workshop list and detail pages with 3-tab shell"
```

---

## Task 5: CoCreateCanvas Component (ReactFlow + elkjs + AI Ghost Nodes)

**Files:**
- Create: `components/workshop/CoCreateCanvas.tsx`
- Create: `components/workshop/SmartNode.tsx`

This is the largest task. The canvas uses ReactFlow with elkjs for automatic LR tree layout.

**Step 1: Create `components/workshop/SmartNode.tsx`**

Custom ReactFlow node with hover AI suggest button, inline editing, and node type colors:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Sparkles, Pencil, Trash2, Check, X } from "lucide-react";

const NODE_TYPE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  scene: { bg: "#eff6ff", border: "#3b82f6", badge: "场景" },
  painpoint: { bg: "#fef2f2", border: "#ef4444", badge: "痛点" },
  idea: { bg: "#f0fdf4", border: "#22c55e", badge: "想法" },
  task: { bg: "#fefce8", border: "#eab308", badge: "任务" },
};

export interface SmartNodeData {
  label: string;
  nodeType: string;
  description?: string;
  isGhost?: boolean;
  reason?: string;
  onAccept?: () => void;
  onUpdate?: (patch: { name?: string; description?: string }) => void;
  onDelete?: () => void;
  onSuggest?: () => void;
}

export default function SmartNode({ data, id }: NodeProps & { data: SmartNodeData }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const colors = NODE_TYPE_COLORS[data.nodeType] || NODE_TYPE_COLORS.scene;

  if (data.isGhost) {
    // Ghost node (AI suggestion, not yet confirmed)
    return (
      <div
        className="relative px-4 py-2 rounded-lg border-2 border-dashed opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
        style={{ borderColor: colors.border, background: colors.bg }}
        onClick={data.onAccept}
      >
        <Handle type="target" position={Position.Left} />
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: colors.border }}>
            {colors.badge}
          </span>
          <span className="text-sm font-medium">{data.label}</span>
        </div>
        {data.reason && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.reason}</p>
        )}
        <p className="text-xs text-blue-500 mt-1">点击采纳</p>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div
      className="relative px-4 py-2 rounded-lg border-2 shadow-sm min-w-[120px] max-w-[200px]"
      style={{ borderColor: colors.border, background: colors.bg }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: colors.border }}>
          {colors.badge}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                data.onUpdate?.({ name: editValue });
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="text-sm font-medium bg-transparent border-b border-blue-400 outline-none w-full"
          />
        ) : (
          <span className="text-sm font-medium truncate">{data.label}</span>
        )}
      </div>

      {/* Action buttons */}
      {showActions && !editing && (
        <div className="absolute -top-8 right-0 flex items-center gap-1 bg-white border rounded-lg shadow-md px-1 py-0.5">
          {data.onSuggest && (
            <button onClick={data.onSuggest} className="p-1 text-amber-500 hover:text-amber-600" title="AI 建议">
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-blue-600" title="编辑">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {data.onDelete && (
            <button onClick={data.onDelete} className="p-1 text-gray-500 hover:text-red-600" title="删除">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

**Step 2: Create `components/workshop/CoCreateCanvas.tsx`**

Full ReactFlow canvas with elkjs layout, AI ghost nodes, add root node:

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Position,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";
import SmartNode, { type SmartNodeData } from "./SmartNode";
import { type SessionDetail, type AiSuggestion } from "@/lib/api/workshop-api";
import { Plus, Loader2 } from "lucide-react";

const elk = new ELK();

const nodeTypes: NodeTypes = { smartNode: SmartNode };

interface CoCreateCanvasProps {
  session: SessionDetail;
  onAddNode: (name: string, nodeType: string, description?: string, parentId?: string) => Promise<any>;
  onUpdateNode: (nodeId: string, patch: { name?: string; node_type?: string; description?: string }) => Promise<any>;
  onDeleteNode: (nodeId: string) => Promise<any>;
  onSuggestNodes: (data: { current_node_id: string; current_node_name: string; current_node_type: string; industry_context: string; existing_children: string[] }) => Promise<{ success: boolean; data?: { suggestions: AiSuggestion[] }; error?: string }>;
  onSelectNode: (nodeId: string | null) => void;
}

function buildTree(nodes: SessionDetail["nodes"], relations: SessionDetail["relations"]) {
  // Build parent->children map
  const childMap: Record<string, string[]> = {};
  const nodeMap: Record<string, SessionDetail["nodes"][0]> = {};
  for (const n of nodes) nodeMap[n._id] = n;
  for (const r of relations) {
    if (r.relation_type === "canvas_parent_child") {
      childMap[r.from_obj_id] = childMap[r.from_obj_id] || [];
      childMap[r.from_obj_id].push(r.to_obj_id);
    }
  }
  // Find root nodes (no parent)
  const childIds = new Set<string>();
  for (const r of relations) if (r.relation_type === "canvas_parent_child") childIds.add(r.to_obj_id);
  const roots = nodes.filter((n) => !childIds.has(n._id));
  return { nodeMap, childMap, roots };
}

export default function CoCreateCanvas({
  session,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onSuggestNodes,
  onSelectNode,
}: CoCreateCanvasProps) {
  const [suggestions, setSuggestions] = useState<Map<string, AiSuggestion[]>>(new Map());
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newRootName, setNewRootName] = useState("");

  const { nodeMap, childMap, roots } = useMemo(
    () => buildTree(session.nodes, session.relations),
    [session.nodes, session.relations]
  );

  // Convert session data to ReactFlow nodes + edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const rfNodes: Node[] = [];
    const rfEdges: Edge[] = [];

    for (const node of session.nodes) {
      const props = node.properties;
      rfNodes.push({
        id: node._id,
        type: "smartNode",
        position: { x: 0, y: 0 }, // Will be set by elkjs
        data: {
          label: props.name,
          nodeType: props.node_type || "scene",
          description: props.description,
          onUpdate: (patch) => onUpdateNode(node._id, patch),
          onDelete: () => onDeleteNode(node._id),
          onSuggest: () => handleSuggest(node._id, props.name, props.node_type),
        } as SmartNodeData,
      });
    }

    for (const rel of session.relations) {
      if (rel.relation_type === "canvas_parent_child") {
        rfEdges.push({
          id: `${rel.from_obj_id}-${rel.to_obj_id}`,
          source: rel.from_obj_id,
          target: rel.to_obj_id,
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        });
      }
    }

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [session.nodes, session.relations]);

  // Add ghost nodes from suggestions
  const allNodes = useMemo(() => {
    const nodes = [...initialNodes];
    const edges = [...initialEdges];
    for (const [parentId, suggs] of suggestions) {
      const parentIdx = nodes.findIndex((n) => n.id === parentId);
      const parentY = parentIdx >= 0 ? nodes[parentIdx].position.y : 0;
      suggs.forEach((s, i) => {
        const ghostId = `ghost-${parentId}-${i}`;
        nodes.push({
          id: ghostId,
          type: "smartNode",
          position: { x: 0, y: parentY + (i - suggs.length / 2) * 60 }, // elkjs will override
          data: {
            label: s.name,
            nodeType: s.type,
            reason: s.reason,
            isGhost: true,
            onAccept: () => handleAcceptGhost(parentId, s),
          } as SmartNodeData,
        });
        edges.push({
          id: `${parentId}-${ghostId}`,
          source: parentId,
          target: ghostId,
          type: "smoothstep",
          style: { stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "5 5" },
        });
      });
    }
    return { nodes, edges };
  }, [initialNodes, initialEdges, suggestions]);

  // elkjs layout
  const layoutedNodes = useMemo(() => {
    if (allNodes.nodes.length === 0) return allNodes.nodes;
    const graph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      },
      children: allNodes.nodes.map((n) => ({
        id: n.id,
        width: 160,
        height: 50,
      })),
      edges: allNodes.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };
    try {
      const layout = elk.layoutSync(graph);
      return allNodes.nodes.map((n) => {
        const elkNode = layout.children?.find((c) => c.id === n.id);
        if (elkNode) {
          return { ...n, position: { x: elkNode.x || 0, y: elkNode.y || 0 } };
        }
        return n;
      });
    } catch {
      return allNodes.nodes;
    }
  }, [allNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allNodes.edges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(allNodes.edges);
  }, [layoutedNodes, allNodes.edges, setNodes, setEdges]);

  // Handlers
  const handleSuggest = async (nodeId: string, nodeName: string, nodeType: string) => {
    setLoadingNode(nodeId);
    const children = childMap[nodeId] || [];
    const childNames = children.map((cid) => nodeMap[cid]?.properties?.name || "").filter(Boolean);
    const res = await onSuggestNodes({
      current_node_id: nodeId,
      current_node_name: nodeName,
      current_node_type: nodeType,
      industry_context: session.session.properties.industry_context,
      existing_children: childNames,
    });
    if (res.success && res.data) {
      setSuggestions((prev) => new Map(prev).set(nodeId, res.data!.suggestions));
    }
    setLoadingNode(null);
  };

  const handleAcceptGhost = async (parentId: string, suggestion: AiSuggestion) => {
    await onAddNode(suggestion.name, suggestion.type, suggestion.reason, parentId);
    // Clear suggestions for this parent
    setSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  };

  const handleAddRoot = async () => {
    if (!newRootName.trim()) return;
    await onAddNode(newRootName.trim(), "scene");
    setNewRootName("");
    setShowAddRoot(false);
  };

  return (
    <div className="h-full relative">
      {/* Floating toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowAddRoot(!showAddRoot)}
          className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          添加根节点
        </button>
        {loadingNode && (
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            AI 思考中...
          </div>
        )}
      </div>

      {/* Add root node input */}
      {showAddRoot && (
        <div className="absolute top-14 left-3 z-10 bg-white border rounded-lg shadow-md p-3 flex items-center gap-2">
          <input
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRoot()}
            placeholder="输入根节点名称..."
            className="px-2 py-1 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={handleAddRoot} className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            添加
          </button>
          <button onClick={() => setShowAddRoot(false)} className="px-2 py-1 text-gray-500 text-sm hover:text-gray-700">
            取消
          </button>
        </div>
      )}

      {/* Empty state */}
      {session.nodes.length === 0 && !showAddRoot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg">点击左上角「添加根节点」开始构建场景树</p>
            <p className="text-sm mt-1">或从右侧节点面板拖入</p>
          </div>
        </div>
      )}

      {/* ReactFlow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        fitView
        attributionPosition="bottom-left"
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={() => "#3b82f6"} />
      </ReactFlow>
    </div>
  );
}
```

**Step 3: Verify canvas compiles**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npx tsc --noEmit components/workshop/CoCreateCanvas.tsx components/workshop/SmartNode.tsx 2>&1 | head -30`

**Step 4: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add components/workshop/CoCreateCanvas.tsx components/workshop/SmartNode.tsx
git commit -m "feat(workshop): add ReactFlow canvas with elkjs layout and AI ghost nodes"
```

---

## Task 6: EvaluationMatrix Component (Recharts ScatterChart)

**Files:**
- Create: `components/workshop/EvaluationMatrix.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, Trash2, Download } from "lucide-react";
import type { EvaluationItem } from "@/lib/api/workshop-api";

const { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } = dynamic(
  () => import("recharts"),
  { ssr: false }
) as any;

interface DimensionConfig {
  key: string;
  label: string;
}

interface EvaluationMatrixProps {
  items: EvaluationItem[];
  onAddItem: (name: string) => Promise<any>;
  onUpdateItem: (id: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
}

const DEFAULT_DIMENSIONS: DimensionConfig[] = [
  { key: "dim_x", label: "痛点极值" },
  { key: "dim_y", label: "业务价值" },
  { key: "dim_z", label: "能力鸿沟" },
  { key: "dim_w", label: "落地难度" },
];

// Debounce helper
function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  return useCallback(
    (...args: any[]) => {
      if (timer) clearTimeout(timer);
      setTimer(setTimeout(() => callback(...args), delay));
    },
    [callback, delay, timer]
  ) as T;
}

export default function EvaluationMatrix({ items, onAddItem, onUpdateItem, onDeleteItem }: EvaluationMatrixProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const debouncedUpdate = useDebounce(onUpdateItem, 500);

  const chartData = items.map((item) => ({
    id: item._id,
    name: item.properties.name,
    x: item.properties.dim_x,
    y: item.properties.dim_y,
    z: item.properties.dim_z,
    w: item.properties.dim_w,
  }));

  // Highlight items in top-right quadrant (x > 3, y > 3)
  const isHighlighted = (d: typeof chartData[0]) => d.x > 3 && d.y > 3;

  const highlightedItems = items.filter((item) => item.properties.dim_x > 3 && item.properties.dim_y > 3);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAddItem(newName.trim());
    setNewName("");
    setShowAdd(false);
  };

  const handleSliderChange = (id: string, key: string, value: number) => {
    debouncedUpdate(id, { [key]: value });
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Scoring */}
      <div className="w-[380px] border-r bg-white overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">评价项</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-3 border rounded-lg flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="评价项名称..."
              className="flex-1 px-2 py-1 border rounded text-sm outline-none"
              autoFocus
            />
            <button onClick={handleAdd} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">确定</button>
            <button onClick={() => setShowAdd(false)} className="px-2 py-1 text-gray-500 text-sm">取消</button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">暂无评价项，请添加</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item._id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{item.properties.name}</span>
                  <button onClick={() => onDeleteItem(item._id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {DEFAULT_DIMENSIONS.slice(0, 3).map((dim) => (
                  <div key={dim.key} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 w-16 shrink-0">{dim.label}</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={item.properties[dim.key as keyof typeof item.properties] as number}
                      onChange={(e) => handleSliderChange(item._id, dim.key, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 accent-blue-600"
                    />
                    <span className="text-xs text-gray-600 w-6 text-right">
                      {item.properties[dim.key as keyof typeof item.properties] as number}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {highlightedItems.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 mb-1">高优先场景 ({highlightedItems.length})</h3>
            <ul className="text-xs text-red-700 space-y-0.5">
              {highlightedItems.map((item) => (
                <li key={item._id}>{item.properties.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right Panel - Scatter Chart */}
      <div className="flex-1 p-4 bg-gray-50">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 5]}
                name={DEFAULT_DIMENSIONS[0].label}
                label={{ value: DEFAULT_DIMENSIONS[0].label, position: "bottom", offset: 0 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 5]}
                name={DEFAULT_DIMENSIONS[1].label}
                label={{ value: DEFAULT_DIMENSIONS[1].label, angle: -90, position: "insideLeft" }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 400]} name={DEFAULT_DIMENSIONS[2].label} />
              <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="5 5" />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="5 5" />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
              />
              <Scatter data={chartData} name="评价项">
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.id}
                    fill={isHighlighted(entry) ? "#ef4444" : "#3b82f6"}
                    fillOpacity={isHighlighted(entry) ? 0.9 : 0.6}
                    stroke={isHighlighted(entry) ? "#dc2626" : "#2563eb"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npx tsc --noEmit components/workshop/EvaluationMatrix.tsx 2>&1 | head -20`

**Step 3: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add components/workshop/EvaluationMatrix.tsx
git commit -m "feat(workshop): add 4D evaluation matrix with scatter chart and sliders"
```

---

## Task 7: TaggingSidebar Component (AI Tag Recommendations + Pills)

**Files:**
- Create: `components/workshop/TaggingSidebar.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus, X, Check } from "lucide-react";
import type { AiTagSuggestion } from "@/lib/api/workshop-api";

interface TaggingSidebarProps {
  sessionId: string;
  tagData: Record<string, { category: any; tags: any[] }>;
  nodes: any[];
  selectedNodeId: string | null;
  onSuggestTags: (data: { target_text: string; node_id: string; existing_tags: { name: string; category: string }[] }) => Promise<{ success: boolean; data?: any; error?: string }>;
  onCreateTag: (name: string, categoryId?: string) => Promise<any>;
  onTagNode: (nodeId: string, tagId: string) => Promise<any>;
  onRefreshTags: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  "场景维": { label: "场景维", color: "bg-blue-100 text-blue-700 border-blue-300" },
  "痛点维": { label: "痛点维", color: "bg-red-100 text-red-700 border-red-300" },
  "技能维": { label: "技能维", color: "bg-green-100 text-green-700 border-green-300" },
  "格式维": { label: "格式维", color: "bg-purple-100 text-purple-700 border-purple-300" },
};

const AI_TAG_KEYS = ["context_tags", "pain_tags", "skill_tags", "format_tags"] as const;
const AI_TAG_LABELS: Record<string, string> = {
  context_tags: "场景维",
  pain_tags: "痛点维",
  skill_tags: "技能维",
  format_tags: "格式维",
};

export default function TaggingSidebar({
  sessionId,
  tagData,
  nodes,
  selectedNodeId,
  onSuggestTags,
  onCreateTag,
  onTagNode,
  onRefreshTags,
}: TaggingSidebarProps) {
  const [aiTags, setAiTags] = useState<Record<string, AiTagSuggestion[]> | null>(null);
  const [selectedPills, setSelectedPills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n._id === selectedNodeId);

  const handleSuggest = async () => {
    if (!selectedNode) return;
    setLoading(true);
    const props = selectedNode.properties;
    // Collect existing tags for this node
    const existingTags: { name: string; category: string }[] = [];
    // Get all tags from tagData
    for (const [catName, group] of Object.entries(tagData)) {
      for (const tag of group.tags) {
        existingTags.push({ name: tag.properties.name, category: catName });
      }
    }
    const res = await onSuggestTags({
      target_text: `${props.name}${props.description ? "：" + props.description : ""}`,
      node_id: selectedNode._id,
      existing_tags: existingTags,
    });
    if (res.success && res.data) {
      setAiTags(res.data);
      setSelectedPills(new Set());
    }
    setLoading(false);
  };

  const togglePill = (tagName: string) => {
    setSelectedPills((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  const handleAdopt = async (tagName: string, categoryKey: string) => {
    setAdopting(tagName);
    // Find the category ID for this dimension
    const catName = AI_TAG_LABELS[categoryKey];
    const group = tagData[catName];
    const categoryId = group?.category?._id;
    await onCreateTag(tagName, categoryId);
    setAdopting(null);
  };

  const handleSaveTags = async () => {
    if (!selectedNode) return;
    for (const tagName of selectedPills) {
      // Find tag ID
      for (const group of Object.values(tagData)) {
        const tag = group.tags.find((t: any) => t.properties.name === tagName);
        if (tag) {
          await onTagNode(selectedNode._id, tag._id);
        }
      }
    }
    setSelectedPills(new Set());
    setAiTags(null);
    onRefreshTags();
  };

  return (
    <div className="h-full flex">
      {/* Node selector */}
      <div className="w-[200px] border-r bg-white overflow-y-auto p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">选择节点</h3>
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-400">请先在画布中创建节点</p>
        ) : (
          <div className="space-y-1">
            {nodes.map((node) => (
              <button
                key={node._id}
                onClick={() => { setSelectedPills(new Set()); setAiTags(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${
                  selectedNodeId === node._id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                {node.properties.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag panel */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {!selectedNode ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            请在左侧选择一个节点
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{selectedNode.properties.name}</h2>
                <p className="text-xs text-gray-500">标签配置</p>
              </div>
              <button
                onClick={handleSuggest}
                disabled={loading}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI 智能分析标签
              </button>
            </div>

            {/* AI suggested tags */}
            {aiTags && (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">AI 推荐标签</h3>
                {AI_TAG_KEYS.map((key) => {
                  const tags = aiTags[key] || [];
                  if (tags.length === 0) return null;
                  const catInfo = CATEGORY_LABELS[AI_TAG_LABELS[key]] || { label: key, color: "bg-gray-100 text-gray-700" };
                  return (
                    <div key={key} className="p-3 bg-white border rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-2">{AI_TAG_LABELS[key]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag.name}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-all ${
                              tag.is_new
                                ? selectedPills.has(tag.name)
                                  ? "bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-300"
                                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : selectedPills.has(tag.name)
                                  ? catInfo.color + " ring-1 ring-blue-300"
                                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                            onClick={() => togglePill(tag.name)}
                          >
                            {tag.is_new ? "NEW" : ""}
                            {tag.name}
                            {tag.is_new && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAdopt(tag.name, key); }}
                                className="ml-0.5 text-amber-600 hover:text-amber-800"
                                disabled={adopting === tag.name}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {selectedPills.size > 0 && (
                  <button
                    onClick={handleSaveTags}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    保存标签配置 ({selectedPills.size})
                  </button>
                )}
              </div>
            )}

            {/* Existing tags by category */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">已有标签库</h3>
              {Object.entries(tagData).length === 0 ? (
                <p className="text-xs text-gray-400">暂无标签，使用 AI 分析或手动创建</p>
              ) : (
                Object.entries(tagData).map(([catName, group]) => {
                  const catInfo = CATEGORY_LABELS[catName] || { label: catName, color: "bg-gray-100 text-gray-700" };
                  return (
                    <div key={catName} className="p-3 bg-white border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.category?.properties?.color }} />
                        <span className="text-xs font-medium text-gray-700">{catName}</span>
                        <span className="text-xs text-gray-400">({group.tags.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.tags.map((tag: any) => (
                          <span key={tag._id} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                            {tag.properties.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `cd /Users/kjonekong/Documents/org-diagnosis && npx tsc --noEmit components/workshop/TaggingSidebar.tsx 2>&1 | head -20`

**Step 3: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add components/workshop/TaggingSidebar.tsx
git commit -m "feat(workshop): add AI tagging sidebar with pill-based tag selection"
```

---

## Task 8: Integration Verification + Sidebar Navigation

**Files:**
- Modify: `app/(dashboard)/DashboardShell.tsx` (add workshop nav link)

**Step 1: Add workshop link to sidebar navigation**

In `DashboardShell.tsx`, find the navigation groups (search for "研讨会工具" or similar). Add a new nav item under that group:

```typescript
{
  label: "智能共创",
  href: "/workshop/cocreate",
  icon: <Sparkles className="w-4 h-4" />,
}
```

If "研讨会工具" group doesn't exist, add it or place under an appropriate group.

**Step 2: Start backend and frontend dev server**

Backend: `cd /Users/kjonekong/Documents/org-diagnosis/backend && nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &`

Frontend: Already running on localhost:3000 (or start with `npm run dev`)

**Step 3: End-to-end verification checklist**

1. Navigate to `/workshop/cocreate` — should show empty list
2. Click "新建工作坊" — modal opens, fill title + industry, submit
3. Redirected to `/workshop/cocreate/{id}` — 3 tabs visible
4. Canvas tab: click "添加根节点" → enter name → node appears
5. Hover node → click Sparkles → AI suggests ghost nodes → click to adopt
6. Matrix tab: add evaluation items → drag sliders → scatter chart updates
7. Tags tab: select node → click "AI 智能分析标签" → pills appear → select + save
8. Click "导出 CSV" → file downloads

**Step 4: Commit**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add app/\(dashboard\)/DashboardShell.tsx
git commit -m "feat(workshop): add sidebar navigation link for co-creation suite"
```

---

## Summary

| Task | Description | Files | Estimated |
|------|-------------|-------|-----------|
| 1 | Meta-Models | seed_meta_models.py | Small |
| 2 | Workshop API | workshop.py, router.py | Medium |
| 3 | Frontend API Client | workshop-api.ts, package.json | Small |
| 4 | Workshop Pages | cocreate/page.tsx, [id]/page.tsx | Medium |
| 5 | CoCreateCanvas | CoCreateCanvas.tsx, SmartNode.tsx | Large |
| 6 | EvaluationMatrix | EvaluationMatrix.tsx | Medium |
| 7 | TaggingSidebar | TaggingSidebar.tsx | Medium |
| 8 | Integration | DashboardShell.tsx, verification | Small |
