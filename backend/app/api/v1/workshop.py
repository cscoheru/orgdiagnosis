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
from app.models.kernel.relation import RelationCreate

router = APIRouter(prefix="/workshop", tags=["工作坊共创"])


def _to_key(obj_id: str) -> str:
    """Normalize _id (sys_objects/1) to _key (1) for ObjectService calls."""
    if obj_id.startswith("sys_objects/"):
        return obj_id.split("/", 1)[1]
    return obj_id


def _to_id(key_or_id: str) -> str:
    """Ensure value is in full _id format (sys_objects/1)."""
    if key_or_id.startswith("sys_objects/"):
        return key_or_id
    return f"sys_objects/{key_or_id}"


def _match_ws(obj: dict, session_id: str) -> bool:
    """Check if obj's workshop_id matches session_id (handles _key, _id, and raw formats)."""
    wid = obj.get("properties", {}).get("workshop_id", "")
    key = _to_key(session_id)
    return wid in (key, session_id, _to_id(key))


def _transform_relation(rel: dict) -> dict:
    """Transform ArangoDB edge doc (_from/_to) to API format (from_obj_id/to_obj_id)."""
    return {
        "_key": rel["_key"],
        "_id": rel["_id"],
        "from_obj_id": rel["_from"],
        "to_obj_id": rel["_to"],
        "relation_type": rel.get("relation_type", ""),
    }


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
                "workshop_id": obj["_key"],
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
    session = svc.get_object(_to_key(session_id))
    if not session:
        raise HTTPException(404, "会话不存在")
    # 获取所有节点 (匹配 workshop_id 的各种格式)
    all_nodes = svc.list_objects(model_key="Canvas_Node", limit=500)
    nodes = [n for n in all_nodes if _match_ws(n, session_id)]
    # 获取所有关系
    rel_svc = RelationService(db)
    all_rels = rel_svc.list_relations(limit=1000)
    node_ids = {n["_id"] for n in nodes}
    rels = [_transform_relation(r) for r in all_rels
            if r.get("relation_type") == "canvas_parent_child" and r["_from"] in node_ids]
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
        rel_svc.create_relation(RelationCreate(
            from_obj_id=data.parent_node_id,
            to_obj_id=node["_id"],
            relation_type="canvas_parent_child",
        ))
    return node


@router.patch("/sessions/{session_id}/nodes/{node_id}", summary="更新节点")
def update_node(session_id: str, node_id: str, data: NodeUpdate, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    existing = svc.get_object(_to_key(node_id))
    if not existing:
        raise HTTPException(404, "节点不存在")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    merged = {**existing["properties"], **patch}
    return svc.update_object(_to_key(node_id), ObjectUpdate(properties=merged))


@router.delete("/sessions/{session_id}/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除节点及子树")
def delete_node(session_id: str, node_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    rel_svc = RelationService(db)
    # BFS 找到所有子节点 — 使用 _id 格式比较（relations 存储的是 _id）
    node_id_full = _to_id(_to_key(node_id))
    to_visit = [node_id_full]
    visited = set()
    while to_visit:
        current = to_visit.pop()
        if current in visited:
            continue
        visited.add(current)
        all_rels = rel_svc.list_relations(limit=1000)
        for r in all_rels:
            if r.get("relation_type") == "canvas_parent_child" and r["_from"] == current:
                if r["_to"] not in visited:
                    to_visit.append(r["_to"])
    # 删除所有关系和节点（用 _key 操作 ObjectService）
    for obj_id in visited:
        obj_key = _to_key(obj_id)
        all_rels = rel_svc.list_relations(limit=1000)
        for r in all_rels:
            if r["_from"] == obj_id or r["_to"] == obj_id:
                rel_svc.delete_relation(r["_key"])
        svc.delete_object(obj_key)


# ─── AI Suggest Nodes ───


@router.post("/sessions/{session_id}/suggest", summary="AI 推断子节点")
async def suggest_nodes(session_id: str, data: SuggestRequest, db: Any = Depends(get_db)):
    from app.services.ai_client import ai_client

    if not ai_client.is_configured():
        raise HTTPException(503, "AI 服务未配置")

    system_prompt = """你是一位顶级商业咨询顾问。根据给定的行业上下文和当前节点，推荐子节点。

**规则：只生成与当前节点相同类型的子节点，恰好 3 个。**

返回 JSON 格式:
{"suggestions": [{"name": "节点名称", "type": "节点类型（与当前节点相同）", "reason": "推荐理由（一句话）"}]}"""

    existing_list = "\n".join(f"- {c}" for c in data.existing_children) if data.existing_children else "无"
    user_prompt = f"""行业背景: {data.industry_context}
当前节点: [{data.current_node_type}] {data.current_node_name}
已有子节点:
{existing_list}

请推荐恰好 3 个同类型的子节点，不要重复已有的。"""

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
    return [i for i in all_items if _match_ws(i, session_id)]


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
    existing = svc.get_object(_to_key(eval_id))
    if not existing:
        raise HTTPException(404, "评价项不存在")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    merged = {**existing["properties"], **patch}
    return svc.update_object(_to_key(eval_id), ObjectUpdate(properties=merged))


@router.delete("/sessions/{session_id}/evaluations/{eval_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除评价项")
def delete_evaluation(session_id: str, eval_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    svc.delete_object(_to_key(eval_id))


# ─── Tag Endpoints ───


@router.get("/sessions/{session_id}/tags", summary="获取标签 (按 category 分组)")
def list_tags(session_id: str, db: Any = Depends(get_db)):
    svc = ObjectService(db)
    all_cats = svc.list_objects(model_key="Tag_Category", limit=500)
    cats = [c for c in all_cats if _match_ws(c, session_id)]
    cats.sort(key=lambda c: c.get("properties", {}).get("display_order", 0))
    all_tags = svc.list_objects(model_key="Smart_Tag", limit=500)
    tags = [t for t in all_tags if _match_ws(t, session_id)]
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
    existing = svc.get_object(_to_key(tag_id))
    if not existing:
        raise HTTPException(404, "标签不存在")
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    merged = {**existing["properties"], **patch}
    return svc.update_object(_to_key(tag_id), ObjectUpdate(properties=merged))


# ─── AI Suggest Tags ───


@router.post("/sessions/{session_id}/suggest-tags", summary="AI 推荐标签")
async def suggest_tags(session_id: str, data: SuggestTagsRequest, db: Any = Depends(get_db)):
    from app.services.ai_client import ai_client

    if not ai_client.is_configured():
        raise HTTPException(503, "AI 服务未配置")

    # 获取已有标签字典
    svc = ObjectService(db)
    all_tags = svc.list_objects(model_key="Smart_Tag", limit=500)
    workshop_tags = [t for t in all_tags if _match_ws(t, session_id)]
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
    session = svc.get_object(_to_key(session_id))
    if not session:
        raise HTTPException(404, "会话不存在")

    # 获取所有节点
    all_nodes = svc.list_objects(model_key="Canvas_Node", limit=500)
    nodes = [n for n in all_nodes if _match_ws(n, session_id)]

    # 获取所有关系
    all_rels = rel_svc.list_relations(limit=1000)
    node_ids = {n["_id"] for n in nodes}
    parent_map = {}  # node_id -> parent_id
    for r in all_rels:
        if r.get("relation_type") == "canvas_parent_child" and r["_to"] in node_ids:
            parent_map[r["_to"]] = r["_from"]

    # 获取所有标签和标签关系
    all_tag_rels = rel_svc.list_relations(limit=1000)
    tag_rels_map: dict[str, list[str]] = {}  # node_id -> [tag_names]
    for r in all_tag_rels:
        if r.get("relation_type") == "canvas_node_to_tag" and r["_from"] in node_ids:
            tag_obj = svc.get_object(_to_key(r["to_obj_id"]))
            if tag_obj:
                tag_name = tag_obj["properties"].get("name", "")
                tag_rels_map.setdefault(r["_from"], []).append(tag_name)

    # 获取所有评价项
    all_evals = svc.list_objects(model_key="Evaluation_Item", limit=500)
    eval_map: dict[str, dict] = {}  # name -> {dim_x, dim_y, dim_z, dim_w}
    for e in all_evals:
        if _match_ws(e, session_id):
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
