"""
关系 (边) 与图谱查询的 Pydantic 模型
"""
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Any
from enum import Enum


class DirectionEnum(str, Enum):
    """遍历方向"""

    OUTBOUND = "OUTBOUND"  # 从起点向外 (from → to)
    INBOUND = "INBOUND"    # 向内指向起点 (from ← to)
    ANY = "ANY"            # 双向


class RelationType(str, Enum):
    """关系类型枚举"""

    REPORTS_TO = "Reports_To"         # 汇报关系
    REQUIRES_SKILL = "Requires_Skill"  # 技能需求
    MANAGES = "Manages"                # 管理关系
    BELONGS_TO = "Belongs_To"          # 归属关系
    DEPENDS_ON = "Depends_On"          # 依赖关系
    ALIGNED_TO = "Aligned_To"          # 战略对齐
    EVALUATED_BY = "Evaluated_By"      # 被评估
    COMPENSATED_BY = "Compensated_By"  # 薪酬归属
    SUCCESSOR_OF = "Successor_Of"      # 继任
    PARTICIPATES_IN = "Participates_In"  # 参与
    BENCHMARKED_AGAINST = "Benchmarked_Against"  # 对标
    CUSTOM = "Custom"                  # 自定义

    # Performance Management Relations
    CASCADES_TO = "Cascades_To"                # 部门绩效→岗位绩效分解
    USES_TEMPLATE = "Uses_Template"              # 考核记录→表单模板
    APPLIES_RATING = "Applies_Rating"            # 表单模板→评分模型
    BELONGS_TO_PLAN = "Belongs_To_Plan"          # 模板/记录→绩效方案
    CALIBRATED_IN = "Calibrated_In"              # 考核记录→校准会话
    GOAL_ALIGNED = "Goal_Aligned"                # 部门绩效→战略目标对齐
    ASSESSES_COMPETENCY = "Assesses_Competency"  # 岗位绩效→胜任力评估

    # Hierarchy & Goal Cascade Relations (Phase 1)
    PARENT_ORG = "Parent_Org"                  # 组织层级 (上级部门→下级部门)
    DECOMPOSED_FROM = "Decomposed_From"        # 目标分解链 (下级绩效→上级绩效)
    LINKED_KPI = "Linked_KPI"                  # 战略举措→关联KPI


class RelationCreate(BaseModel):
    """创建关系 (边)"""

    from_obj_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="起点对象 _id (格式: sys_objects/xxx)",
    )
    to_obj_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="终点对象 _id (格式: sys_objects/xxx)",
    )
    relation_type: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="关系类型 (如 Reports_To, Requires_Skill)",
    )
    properties: dict[str, Any] | None = Field(
        default=None, description="关系附加属性"
    )

    @field_validator("from_obj_id", "to_obj_id")
    @classmethod
    def validate_obj_id(cls, v: str) -> str:
        if not v.startswith("sys_objects/"):
            raise ValueError("必须以 'sys_objects/' 开头")
        return v


class RelationUpdate(BaseModel):
    """更新关系"""

    relation_type: str | None = Field(default=None, min_length=1, max_length=64)
    properties: dict[str, Any] | None = None


class RelationResponse(BaseModel):
    """关系响应"""

    model_config = ConfigDict(from_attributes=True)

    _key: str
    _id: str
    _from: str
    _to: str
    _rev: str
    relation_type: str
    properties: dict[str, Any] | None = None


class GraphNode(BaseModel):
    """图谱节点 (树状结构)"""

    vertex: dict[str, Any]
    edge: dict[str, Any] | None = None
    children: list["GraphNode"] = []

    class Config:
        arbitrary_types_allowed = True


class GraphQuery(BaseModel):
    """图谱查询参数"""

    start_obj_id: str = Field(..., description="起点对象 _id")
    direction: DirectionEnum = Field(
        default=DirectionEnum.OUTBOUND, description="遍历方向"
    )
    depth: int = Field(default=1, ge=1, le=10, description="穿透层数 (1-10)")


class GraphResponse(BaseModel):
    """图谱响应 (树状结构)"""

    root: dict[str, Any]
    relations: list[dict[str, Any]]
    tree: GraphNode
    total_vertices: int
    total_edges: int
