"""
组织领域 LangGraph 节点

实现组织结构分析的异步节点函数。
节点通过 KernelBridge 读取/写入内核数据，通过 AIClient 调用 AI 分析。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object

from .prompts import ORGANIZATION_SYSTEM_PROMPT, ORGANIZATION_DIMENSION_PROMPT

logger = logging.getLogger(__name__)

# 内核桥接实例
_bridge = KernelBridge()


def _safe_format(obj_list: list[dict[str, Any]]) -> str:
    """安全地将对象列表格式化为 AI 可读的文本"""
    if not obj_list:
        return "（暂无数据）"
    lines = []
    for obj in obj_list:
        props = obj.get("properties", {})
        key = obj.get("_key", "unknown")
        lines.append(f"- [{key}] {json.dumps(props, ensure_ascii=False, default=str)}")
    return "\n".join(lines)


async def _analyze_with_ai(context_text: str) -> str:
    """调用 AI 进行组织结构分析

    同步/异步桥接模式: 检测当前是否已有运行中的事件循环，
    确保在异步和同步上下文中都能正确调用。

    Args:
        context_text: 组织数据的文本化描述

    Returns:
        AI 分析结果文本
    """
    try:
        import app.services.ai_client as ai_mod
        ai = ai_mod.ai_client
    except (ImportError, AttributeError):
        logger.warning("AI 客户端未配置，返回模拟分析结果")
        return _mock_analysis_result()

    if not ai.is_configured():
        logger.warning("AI API Key 未配置，返回模拟分析结果")
        return _mock_analysis_result()

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    user_prompt = ORGANIZATION_DIMENSION_PROMPT.format(
        org_units=context_text,
        job_roles=context_text,
        process_flows=context_text,
    )

    if loop is not None and loop.is_running():
        # 已有事件循环，直接 await 异步调用
        return await ai.chat(
            system_prompt=ORGANIZATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=4096,
        )
    else:
        # 无事件循环，创建新循环执行
        return await ai.chat(
            system_prompt=ORGANIZATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=4096,
        )


def _mock_analysis_result() -> str:
    """AI 未配置时的模拟分析结果

    提供一组合理的默认输出，用于开发调试。
    """
    return """## 组织结构诊断报告 (模拟数据)

### 1. 组织架构分析
🟡 **层级深度**: 当前组织层级需要进一步数据支撑分析
🟢 **管理跨度**: 建议每个管理者直接汇报 5-8 人
🟡 **职责划分**: 需要更多组织单元数据来评估职责覆盖

### 2. 岗位体系分析
🟢 **职族分布**: 职族体系已建立 (管理M/专业P/操作O/营销S)
🟡 **关键岗位**: 需要补充关键岗位识别数据
🟢 **职级体系**: 薪酬带宽与岗位级别匹配度待评估

### 3. 流程效率分析
🟢 **流程健康度**: 基本流程框架已建立
🟡 **跨部门协同**: 需要更多流程数据来评估协同效率

### 4. 综合建议
- **短期**: 完善组织数据采集，建立组织健康度基线
- **中期**: 基于数据驱动进行组织架构优化

> 注意: 此为模拟输出，请配置 AI API Key 以获取真实分析结果。
"""


async def analyze_structure_node(state: dict[str, Any]) -> dict[str, Any]:
    """组织结构分析节点

    执行流程:
    1. 从内核查询 Org_Unit、Job_Role、Process_Flow 数据
    2. 将数据格式化为 AI 可读的上下文文本
    3. 调用 AI 进行组织结构分析
    4. 将分析结果写入内核
    5. 更新工作流状态并返回

    Args:
        state: LangGraph 工作流状态

    Returns:
        更新后的状态字典 (包含 analysis 和 results)
    """
    domain_key = "structure"

    try:
        # ── 1. 从内核查询组织相关数据 ──
        logger.info("[组织分析] 开始查询内核数据...")

        org_units = await _bridge.get_objects_by_model("Org_Unit", limit=200)
        job_roles = await _bridge.get_objects_by_model("Job_Role", limit=500)
        process_flows = await _bridge.get_objects_by_model("Process_Flow", limit=200)

        logger.info(
            "[组织分析] 查询完成: Org_Unit=%d, Job_Role=%d, Process_Flow=%d",
            len(org_units),
            len(job_roles),
            len(process_flows),
        )

        # ── 2. 格式化上下文 ──
        context_parts = []

        org_units_text = _safe_format(org_units)
        context_parts.append(f"### 组织单元\n{org_units_text}")

        job_roles_text = _safe_format(job_roles)
        context_parts.append(f"### 岗位角色\n{job_roles_text}")

        process_flows_text = _safe_format(process_flows)
        context_parts.append(f"### 业务流程\n{process_flows_text}")

        context_text = "\n\n".join(context_parts)

        # ── 3. 调用 AI 分析 ──
        logger.info("[组织分析] 调用 AI 进行分析...")
        analysis_result = await _analyze_with_ai(context_text)
        logger.info("[组织分析] AI 分析完成, 结果长度=%d", len(analysis_result))

        # ── 4. 将分析结果写入内核 (作为分析报告对象) ──
        try:
            report_obj = await _bridge.create_object(
                "Analysis_Report",
                {
                    "title": "组织结构诊断报告",
                    "domain": domain_key,
                    "content": analysis_result,
                    "source_models": ["Org_Unit", "Job_Role", "Process_Flow"],
                    "data_summary": {
                        "org_unit_count": len(org_units),
                        "job_role_count": len(job_roles),
                        "process_flow_count": len(process_flows),
                    },
                },
            )
            state = track_kernel_object(state, report_obj.get("_id", ""))
            logger.info("[组织分析] 分析报告已写入内核: %s", report_obj.get("_key"))
        except Exception as e:
            # 内核写入失败不影响分析结果返回
            logger.warning("[组织分析] 写入内核失败: %s", e)

        # ── 5. 更新工作流状态 ──
        result = {
            "domain": domain_key,
            "analysis": analysis_result,
            "data_summary": {
                "org_unit_count": len(org_units),
                "job_role_count": len(job_roles),
                "process_flow_count": len(process_flows),
            },
            "status": "completed",
        }

        state = set_domain_result(state, domain_key, result)
        state["status"] = state.get("status", "running")
        state["progress"] = state.get("progress", 0.0) + 0.2
        state["updated_at"] = __import__("datetime").datetime.now().isoformat()

        logger.info("[组织分析] 节点执行完成")
        return state

    except Exception as e:
        logger.error("[组织分析] 节点执行失败: %s", e, exc_info=True)
        # 返回错误状态，不中断工作流
        error_result = {
            "domain": domain_key,
            "error": str(e),
            "status": "failed",
        }
        state = set_domain_result(state, domain_key, error_result)
        state["error"] = str(e)
        state["updated_at"] = __import__("datetime").datetime.now().isoformat()
        return state
