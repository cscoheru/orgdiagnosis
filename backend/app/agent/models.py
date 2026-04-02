"""
AI 顾问 Agent — Pydantic 请求/响应模型

定义 Blueprint 和 Agent Session 的 API 接口模型。
数据存储复用 sys_objects (通过 ObjectService)，这里仅定义 API 层的输入输出。
"""
from pydantic import BaseModel, Field
from typing import Any


# ─── Logic Node ───


class LogicNodeCreate(BaseModel):
    """创建逻辑节点"""
    node_type: str = Field(..., min_length=1, max_length=64, description="节点类型标识")
    display_name: str = Field(..., min_length=1, max_length=128, description="展示名称")
    description: str | None = Field(default=None, max_length=1024, description="节点用途说明")
    required_data_schema: dict[str, Any] = Field(..., description="JSON Schema: 必须收集的数据字段")
    layout_template_id: str | None = Field(default=None, description="PPT 模板坑位 ID")
    dependencies: list[str] = Field(default_factory=list, description="前置依赖的 node_type 列表")
    industry_tags: list[str] = Field(default_factory=list, description="适用行业标签")
    output_schema: dict[str, Any] | None = Field(default=None, description="产出数据结构")
    display_order: int = Field(default=0, description="展示排序")


class LogicNodeUpdate(BaseModel):
    """更新逻辑节点"""
    display_name: str | None = None
    description: str | None = None
    required_data_schema: dict[str, Any] | None = None
    layout_template_id: str | None = None
    dependencies: list[str] | None = None
    industry_tags: list[str] | None = None
    output_schema: dict[str, Any] | None = None
    display_order: int | None = None


# ─── Benchmark ───


class BenchmarkCreate(BaseModel):
    """创建标杆报告模板"""
    title: str = Field(..., min_length=1, max_length=256, description="标杆报告标题")
    industry: str = Field(..., min_length=1, max_length=64, description="适用行业")
    consulting_type: str = Field(..., description="咨询类型")
    description: str | None = Field(default=None, max_length=1024, description="模板描述")
    logic_node_ids: list[str] = Field(default_factory=list, description="包含的逻辑节点 _id 列表")


class BenchmarkUpdate(BaseModel):
    """更新标杆报告模板"""
    title: str | None = None
    industry: str | None = None
    consulting_type: str | None = None
    description: str | None = None
    logic_node_ids: list[str] | None = None


# ─── Dependency Tree (API 响应) ───


class TreeNodeStatus(BaseModel):
    """依赖树中的单个节点"""
    id: str
    node_type: str
    display_name: str
    dependencies: list[str] = Field(default_factory=list)
    required_fields: list[str] = Field(default_factory=list)
    status: str = Field(default="pending", description="pending / complete / missing")


class DependencyTree(BaseModel):
    """完整的逻辑依赖树"""
    benchmark_id: str
    title: str
    consulting_type: str
    nodes: list[TreeNodeStatus] = Field(default_factory=list)
    execution_order: list[str] = Field(default_factory=list, description="拓扑排序后的节点 ID 列表")


# ─── Missing Data (API 响应) ───


class MissingField(BaseModel):
    """缺失的数据字段"""
    node_id: str
    node_type: str
    node_display_name: str
    field_key: str
    field_label: str
    field_type: str = Field(default="input", description="input/textarea/select/number/file")
    field_options: list[str] | None = Field(default=None, description="select 类型的选项")
    required: bool = Field(default=True)


# ─── Agent Session ───


class AgentSessionCreate(BaseModel):
    """创建 Agent 会话"""
    project_goal: str = Field(..., min_length=1, description="用户初始目标描述")
    benchmark_id: str = Field(..., description="标杆报告模板 ID")
    project_id: str | None = Field(default=None, description="关联的项目 ID")


class AgentSessionResume(BaseModel):
    """恢复 Agent 会话 (提交用户数据)"""
    data: dict[str, Any] = Field(..., description="用户提交的表单数据")


# ─── UI Component (Server-Driven UI 协议) ───


class UIComponent(BaseModel):
    """动态 UI 组件定义"""
    type: str = Field(..., description="input/textarea/select/multiselect/number/file")
    key: str = Field(..., description="数据字段 key")
    label: str = Field(..., description="字段标签")
    placeholder: str | None = None
    required: bool = Field(default=False)
    options: list[str] | None = Field(default=None, description="select 类型的选项")
    min: float | None = Field(default=None, description="number 最小值")
    max: float | None = Field(default=None, description="number 最大值")
    accept: list[str] | None = Field(default=None, description="file 接受的文件类型")


class InteractionResponse(BaseModel):
    """Agent 交互响应 (Server-Driven UI)"""
    message: str = Field(..., description="AI 引导话术")
    ui_components: list[UIComponent] = Field(default_factory=list, description="动态表单组件")
    context: dict[str, Any] = Field(default_factory=dict, description="上下文信息")
