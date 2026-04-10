"""
绩效领域模块

PerformanceModule 是绩效领域的自包含模块，继承 BaseDomainModule。
负责注册绩效分析节点、元模型 key 和 AI prompt 模板。

元模型 (10 个):
- 原有诊断: Performance_Metric, Competency, Review_Cycle
- 新增咨询: Performance_Plan, Org_Performance, Position_Performance,
           Review_Template, Rating_Model, Performance_Review, Calibration_Session

使用方式:
    from lib.domain.performance import PerformanceModule

    module = PerformanceModule()
    module.register_nodes()  # 注册 LangGraph 节点
"""

from __future__ import annotations

from typing import Callable, Dict, List

from lib.domain.base import BaseDomainModule
from lib.domain.performance.nodes import (
    analyze_performance_node,
    generate_org_performance_node,
    generate_position_performance_node,
    generate_review_template_node,
    analyze_review_patterns_node,
    calibration_analysis_node,
    generate_performance_report_node,
)
from lib.domain.performance.prompts import (
    PERFORMANCE_SYSTEM_PROMPT,
    PERFORMANCE_DIMENSION_PROMPT,
    ORG_PERFORMANCE_GENERATION_PROMPT,
    POSITION_PERFORMANCE_GENERATION_PROMPT,
    TEMPLATE_GENERATION_PROMPT,
    REVIEW_PATTERN_ANALYSIS_PROMPT,
    CALIBRATION_ANALYSIS_PROMPT,
    PERFORMANCE_REPORT_PROMPT,
)


class PerformanceModule(BaseDomainModule):
    """绩效领域模块

    管理绩效方案、组织绩效、岗位绩效、考核表单、评分模型、考核记录、校准会话
    等十大元模型，提供绩效诊断分析 + AI 生成 + 统计分析节点和配套 AI prompt。
    """

    domain_key: str = "performance"
    display_name: str = "绩效"
    meta_models: List[str] = [
        # 原有诊断模型
        "Performance_Metric",
        "Competency",
        "Review_Cycle",
        # 新增咨询模型
        "Performance_Plan",
        "Org_Performance",
        "Position_Performance",
        "Review_Template",
        "Rating_Model",
        "Performance_Review",
        "Calibration_Session",
    ]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回绩效分析节点映射

        Returns:
            {
                "analyze_performance": analyze_performance_node,
                "generate_org_performance": generate_org_performance_node,
                "generate_position_performance": generate_position_performance_node,
                "generate_review_template": generate_review_template_node,
                "analyze_review_patterns": analyze_review_patterns_node,
                "calibration_analysis": calibration_analysis_node,
                "generate_performance_report": generate_performance_report_node,
            }
        """
        return {
            "analyze_performance": analyze_performance_node,
            "generate_org_performance": generate_org_performance_node,
            "generate_position_performance": generate_position_performance_node,
            "generate_review_template": generate_review_template_node,
            "analyze_review_patterns": analyze_review_patterns_node,
            "calibration_analysis": calibration_analysis_node,
            "generate_performance_report": generate_performance_report_node,
        }

    def get_meta_model_keys(self) -> List[str]:
        """返回绩效领域管理的内核元模型 key 列表

        Returns:
            10 个元模型 key
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回绩效领域 AI prompt 模板

        Returns:
            {
                "system": 绩效分析系统提示词,
                "dimension": 绩效维度分析提示词,
                "org_generation": 部门绩效生成提示词,
                "position_generation": 岗位绩效生成提示词,
                "template_generation": 表单模板生成提示词,
                "review_analysis": 考核数据分析提示词,
                "calibration_analysis": 校准分析提示词,
                "report_generation": 报告生成提示词,
            }
        """
        return {
            "system": PERFORMANCE_SYSTEM_PROMPT,
            "dimension": PERFORMANCE_DIMENSION_PROMPT,
            "org_generation": ORG_PERFORMANCE_GENERATION_PROMPT,
            "position_generation": POSITION_PERFORMANCE_GENERATION_PROMPT,
            "template_generation": TEMPLATE_GENERATION_PROMPT,
            "review_analysis": REVIEW_PATTERN_ANALYSIS_PROMPT,
            "calibration_analysis": CALIBRATION_ANALYSIS_PROMPT,
            "report_generation": PERFORMANCE_REPORT_PROMPT,
        }
