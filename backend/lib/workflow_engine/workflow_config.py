"""
工作流配置定义

三类咨询交付工作流的步骤配置。
新增工作流只需在此添加配置 + 对应的 StepHandler。
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class StepConfig(BaseModel):
    """单个步骤配置"""
    id: str = Field(..., description="步骤唯一标识")
    name: str = Field(..., description="步骤显示名称")
    type: str = Field(..., description="步骤处理器类型 (对应 steps/ 下的文件名)")
    depends_on: Optional[str] = Field(None, description="依赖的前置步骤 ID")
    is_manual: bool = Field(False, description="是否需要人工操作")
    context: Optional[Dict[str, Any]] = Field(None, description="步骤上下文参数")


class WorkflowConfig(BaseModel):
    """工作流配置"""
    key: str = Field(..., description="工作流类型标识")
    name: str = Field(..., description="工作流显示名称")
    description: Optional[str] = None
    steps: List[StepConfig] = Field(..., min_length=1)
    initial_step: str = Field(..., description="初始步骤 ID")


# ============================================================
# 三类工作流配置
# ============================================================

WORKFLOW_CONFIGS: Dict[str, WorkflowConfig] = {}

# W1: 需求分析与建议书
WORKFLOW_CONFIGS["proposal"] = WorkflowConfig(
    key="proposal",
    name="需求分析与建议书",
    description="从客户文本智能提取需求，生成里程碑计划和 MDS 建议书 PPT",
    steps=[
        StepConfig(id="smart_extract", name="基本信息与需求", type="ai_extract_form", is_manual=True),
        StepConfig(id="milestone_plan", name="核心需求与计划", type="ai_generate", depends_on="smart_extract", is_manual=True),
        StepConfig(id="mds_content", name="MDS 幻灯片", type="ai_generate", depends_on="milestone_plan", is_manual=True),
        StepConfig(id="impl_outline", name="详细大纲", type="ai_generate", depends_on="mds_content", is_manual=True),
        StepConfig(id="template_select", name="PPT 模板与布局", type="manual_edit", depends_on="impl_outline", is_manual=True),
        StepConfig(id="ppt_output", name="生成 PPTX", type="ppt_export", depends_on="template_select", is_manual=True),
    ],
    initial_step="smart_extract",
)

# W2: 调研诊断与报告
WORKFLOW_CONFIGS["diagnosis"] = WorkflowConfig(
    key="diagnosis",
    name="调研诊断与报告",
    description="结构化问卷收集 → 五维分析 → 诊断报告 PPT",
    steps=[
        StepConfig(id="questionnaire", name="结构化问卷", type="smart_questionnaire", is_manual=True),
        StepConfig(id="client_confirm", name="客户确认", type="manual_confirm", depends_on="questionnaire", is_manual=True),
        StepConfig(id="dashboard", name="五维仪表盘", type="ai_analyze", depends_on="client_confirm"),
        StepConfig(id="ppt_output", name="PPT输出", type="ppt_export_by_dimension", depends_on="dashboard", is_manual=True),
    ],
    initial_step="questionnaire",
)

# W3: 项目解决方案
WORKFLOW_CONFIGS["delivery"] = WorkflowConfig(
    key="delivery",
    name="项目解决方案",
    description="按阶段推进项目执行，AI 驱动任务，生成阶段总结报告",
    steps=[
        StepConfig(id="create_order", name="创建咨询订单", type="auto_transition"),
        StepConfig(id="edit_plan", name="编辑项目计划", type="manual_edit", depends_on="create_order", is_manual=True),
        StepConfig(id="phase_execute", name="阶段推进", type="continuous", depends_on="edit_plan", is_manual=True),
        StepConfig(id="phase_report", name="阶段总结报告", type="ppt_export", depends_on="phase_execute", is_manual=True,
                   context={"scope": "phase"}),
    ],
    initial_step="create_order",
)

# W4: 战略解码 (步骤由前端 StrategyStore 管理，后端仅提供 session 持久化)
WORKFLOW_CONFIGS["strategy"] = WorkflowConfig(
    key="strategy",
    name="战略解码",
    description="业绩诊断 → 市场洞察 → 目标设定 → 战略执行，前端驱动步骤流转",
    steps=[
        StepConfig(id="performance_review", name="业绩诊断", type="manual_edit", is_manual=True),
        StepConfig(id="market_insight", name="市场洞察", type="manual_edit", depends_on="performance_review", is_manual=True),
        StepConfig(id="target_setting", name="目标设定", type="manual_edit", depends_on="market_insight", is_manual=True),
        StepConfig(id="strategy_execution", name="战略执行", type="manual_edit", depends_on="target_setting", is_manual=True),
    ],
    initial_step="performance_review",
)


def get_workflow_config(workflow_type: str) -> WorkflowConfig:
    """获取工作流配置，不存在则抛出 ValueError"""
    config = WORKFLOW_CONFIGS.get(workflow_type)
    if not config:
        raise ValueError(
            f"未知工作流类型: {workflow_type}. "
            f"可选: {list(WORKFLOW_CONFIGS.keys())}"
        )
    return config
