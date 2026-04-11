"""
层级工具 (Phase 4)

组织树遍历、目标分解链查询、周期变体查询。
"""

from __future__ import annotations

import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge

logger = logging.getLogger(__name__)


async def get_org_tree(bridge: KernelBridge, root_org_id: str) -> list[dict[str, Any]]:
    """获取组织树（从根部门向下递归）

    Args:
        bridge: KernelBridge 实例
        root_org_id: 根部门 _key

    Returns:
        嵌套的组织树列表
    """
    root = await bridge.get_object(root_org_id)
    if not root:
        return []

    root_props = root.get("properties", {})

    # 查找所有子部门 (parent_org_ref 指向当前部门)
    all_orgs = await bridge.get_objects_by_model("Org_Unit", limit=200)
    children = []
    for org in (all_orgs or []):
        parent_ref = org.get("properties", {}).get("parent_org_ref", "")
        if parent_ref in (root_org_id, f"sys_objects/{root_org_id}"):
            child_tree = await get_org_tree(bridge, org["_key"])
            children.append(child_tree[0] if child_tree else {
                "_key": org["_key"],
                "properties": org.get("properties", {}),
                "children": [],
            })

    return [{
        "_key": root["_key"],
        "properties": root_props,
        "children": children,
    }]


async def get_goal_cascade_chain(
    bridge: KernelBridge,
    goal_id: str,
    relation_type: str = "Decomposed_From",
    max_depth: int = 10,
) -> list[dict[str, Any]]:
    """获取目标分解链（从当前目标沿 DECOMPOSED_FROM 向上追溯）

    Args:
        bridge: KernelBridge 实例
        goal_id: 起始目标 _key
        relation_type: 关系类型
        max_depth: 最大遍历深度

    Returns:
        从当前到最远祖先的有序列表
    """
    return await bridge.get_ancestors(
        f"sys_objects/{goal_id}",
        relation_type,
        max_depth,
    )


async def get_period_variants(
    bridge: KernelBridge,
    org_perf_id: str,
) -> list[dict[str, Any]]:
    """获取某部门绩效的所有周期变体（年度/季度/月度）

    通过 DECOMPOSED_FROM 关系查找子绩效。
    """
    from app.services.kernel.object_service import ObjectService
    from app.kernel.database import get_db

    db = get_db()
    svc = ObjectService(db)

    # 查找所有 DECOMPOSED_FROM → 当前对象的关系
    aql = """
    FOR edge IN @@collection
    FILTER edge._from == @from_id
       AND edge.relation_type == @rel_type
    RETURN edge._to
    """
    cursor = db.aql.execute(
        aql,
        bind_vars={
            "@collection": "sys_relations",
            "from_id": f"sys_objects/{org_perf_id}",
            "rel_type": "Decomposed_From",
        },
    )
    child_ids = list(cursor)

    variants = []
    for child_id in child_ids:
        child_key = child_id.split("/")[1]
        child = svc.get_object(child_key)
        if child:
            variants.append(child)

    return variants
