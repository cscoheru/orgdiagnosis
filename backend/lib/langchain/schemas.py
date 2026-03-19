"""
LangChain Pydantic Schemas for Five-Dimensional Diagnosis

This module defines the data models for the consultation diagnostic system.
Based on IBM/Huawei BLM model with 5 L1 dimensions, 20 L2 categories, and 50+ L3 metrics.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class ConfidenceLevel(str, Enum):
    """置信度等级"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TertiaryDimension(BaseModel):
    """三级维度：最细颗粒度的评分"""
    name: str = Field(..., description="三级维度名称 (如: performance_gap)")
    display_name: str = Field(..., description="中文显示名称 (如: 业绩差距)")
    score: int = Field(..., ge=0, le=100, description="0-100的评分")
    evidence: str = Field(..., description="从原文中摘录的支撑性证据")
    analysis: str = Field(default="", description="简短的诊断意见")
    confidence: ConfidenceLevel = Field(default=ConfidenceLevel.MEDIUM, description="置信度")

    class Config:
        use_enum_values = True


class SecondaryDimension(BaseModel):
    """二级维度：汇总三级维度的结果"""
    name: str = Field(..., description="二级维度名称 (如: business_status)")
    display_name: str = Field(..., description="中文显示名称 (如: 业务现状)")
    tertiary_metrics: List[TertiaryDimension] = Field(default_factory=list)
    avg_score: float = Field(default=0.0, description="该二级维度的平均分")

    def calculate_avg_score(self) -> float:
        """计算平均分"""
        if not self.tertiary_metrics:
            return 0.0
        scores = [m.score for m in self.tertiary_metrics]
        self.avg_score = sum(scores) / len(scores)
        return self.avg_score


class PrimaryDimension(BaseModel):
    """一级维度：管理咨询的五大核心维度之一"""
    category: str = Field(..., description="维度类别 (strategy/structure/performance/compensation/talent)")
    display_name: str = Field(..., description="中文显示名称")
    secondary_metrics: List[SecondaryDimension] = Field(default_factory=list)
    summary_insight: str = Field(default="", description="综合管理建议")
    total_score: float = Field(default=0.0, description="该维度的总分")

    def calculate_total_score(self) -> float:
        """计算总分"""
        if not self.secondary_metrics:
            return 0.0
        # 先计算每个二级维度的平均分
        for secondary in self.secondary_metrics:
            secondary.calculate_avg_score()
        # 再计算所有二级维度的平均分
        scores = [s.avg_score for s in self.secondary_metrics]
        self.total_score = sum(scores) / len(scores)
        return self.total_score


class ConsultationDiagnosticReport(BaseModel):
    """最终完整的诊断报告结构"""
    task_id: str = Field(..., description="任务ID")
    report_name: str = Field(default="组织诊断报告", description="报告名称")
    client_name: Optional[str] = Field(default=None, description="客户名称")
    dimensions: List[PrimaryDimension] = Field(default_factory=list)
    overall_score: float = Field(default=0.0, description="整体健康度评分")
    created_at: Optional[str] = Field(default=None, description="创建时间")
    raw_text_summary: Optional[str] = Field(default=None, description="原始文本摘要")

    def calculate_overall_score(self) -> float:
        """计算整体健康度"""
        if not self.dimensions:
            return 0.0
        # 先计算每个一级维度的总分
        for dim in self.dimensions:
            dim.calculate_total_score()
        # 再计算所有一级维度的平均分
        scores = [d.total_score for d in self.dimensions]
        self.overall_score = sum(scores) / len(scores)
        return self.overall_score

    def to_frontend_format(self) -> Dict[str, Any]:
        """转换为前端 Recharts 所需的格式"""
        return {
            "taskId": self.task_id,
            "reportName": self.report_name,
            "clientName": self.client_name,
            "overallScore": round(self.overall_score, 1),
            "createdAt": self.created_at,
            "dimensions": {
                dim.category: {
                    "score": round(dim.total_score, 1),
                    "displayName": dim.display_name,
                    "summary": dim.summary_insight,
                    "L2_categories": {
                        sec.name: {
                            "displayName": sec.display_name,
                            "avgScore": round(sec.avg_score, 1),
                            "L3_items": {
                                item.name: {
                                    "displayName": item.display_name,
                                    "score": item.score,
                                    "evidence": item.evidence,
                                    "analysis": item.analysis,
                                    "confidence": item.confidence
                                }
                                for item in sec.tertiary_metrics
                            }
                        }
                        for sec in dim.secondary_metrics
                    }
                }
                for dim in self.dimensions
            }
        }


# 五维模型定义
FIVE_DIMENSIONS_SCHEMA = {
    "strategy": {
        "display_name": "战略",
        "L2_categories": {
            "business_status": {
                "display_name": "业务现状",
                "L3_items": {
                    "performance_gap": "业绩差距",
                    "opportunity_gap": "机会差距"
                }
            },
            "strategic_planning": {
                "display_name": "战略规划",
                "L3_items": {
                    "market_insight": "市场洞察",
                    "strategic_intent": "战略意图",
                    "innovation_focus": "创新焦点",
                    "business_design": "业务设计"
                }
            },
            "strategy_execution": {
                "display_name": "战略执行",
                "L3_items": {
                    "critical_tasks": "关键任务",
                    "organizational_support": "组织支撑",
                    "talent_readiness": "人才准备",
                    "corporate_culture": "企业文化"
                }
            },
            "strategy_evaluation": {
                "display_name": "战略评估",
                "L3_items": {
                    "business_analysis": "经营分析",
                    "execution_evaluation": "执行评价",
                    "strategy_iteration": "战略迭代"
                }
            }
        }
    },
    "structure": {
        "display_name": "组织",
        "L2_categories": {
            "organizational_structure": {
                "display_name": "组织架构",
                "L3_items": {
                    "structure_type": "架构形态",
                    "layers_and_span": "管理层级",
                    "departmental_boundaries": "部门边界"
                }
            },
            "authority_and_responsibility": {
                "display_name": "权责分配",
                "L3_items": {
                    "decision_mechanism": "决策机制",
                    "delegation_system": "授权体系",
                    "role_definitions": "岗位指引"
                }
            },
            "collaboration_and_processes": {
                "display_name": "协同流程",
                "L3_items": {
                    "core_processes": "核心流程",
                    "cross_functional_collaboration": "跨部门协作",
                    "process_digitalization": "流程数字化"
                }
            },
            "organizational_effectiveness": {
                "display_name": "组织效能",
                "L3_items": {
                    "per_capita_efficiency": "人效指标",
                    "agility": "响应速度"
                }
            }
        }
    },
    "performance": {
        "display_name": "绩效",
        "L2_categories": {
            "system_design": {
                "display_name": "体系设计",
                "L3_items": {
                    "goal_setting_tools": "目标设定",
                    "metric_cascading": "指标分解",
                    "weights_and_standards": "权重标准"
                }
            },
            "process_management": {
                "display_name": "过程管理",
                "L3_items": {
                    "goal_tracking": "目标跟进",
                    "performance_coaching": "绩效辅导",
                    "data_collection": "数据收集"
                }
            },
            "appraisal_and_feedback": {
                "display_name": "考核反馈",
                "L3_items": {
                    "appraisal_fairness": "考核公平",
                    "feedback_quality": "面谈质量",
                    "grievance_mechanism": "申诉机制"
                }
            },
            "result_application": {
                "display_name": "结果应用",
                "L3_items": {
                    "link_to_rewards": "激励挂钩",
                    "promotion_and_elimination": "晋升淘汰",
                    "link_to_learning_and_development": "培训发展"
                }
            }
        }
    },
    "compensation": {
        "display_name": "薪酬",
        "L2_categories": {
            "compensation_strategy": {
                "display_name": "薪酬策略",
                "L3_items": {
                    "market_positioning": "市场定位",
                    "fixed_vs_variable_mix": "固浮比",
                    "internal_equity": "内部公平"
                }
            },
            "compensation_structure": {
                "display_name": "薪酬结构",
                "L3_items": {
                    "base_pay": "基本工资",
                    "short_term_incentives": "短期激励",
                    "long_term_incentives": "长期激励",
                    "benefits_and_allowances": "弹性福利"
                }
            },
            "management_and_budgeting": {
                "display_name": "管理预算",
                "L3_items": {
                    "payroll_management": "总额管控",
                    "salary_adjustment": "调薪机制",
                    "pay_transparency": "薪酬沟通"
                }
            }
        }
    },
    "talent": {
        "display_name": "人才",
        "L2_categories": {
            "planning_and_review": {
                "display_name": "规划盘点",
                "L3_items": {
                    "competency_models": "胜任力模型",
                    "talent_review": "人才盘点",
                    "pipeline_health": "梯队健康"
                }
            },
            "acquisition_and_allocation": {
                "display_name": "获取配置",
                "L3_items": {
                    "employer_branding": "雇主品牌",
                    "recruitment_precision": "招聘精准",
                    "internal_mobility": "内部流动"
                }
            },
            "training_and_development": {
                "display_name": "培养发展",
                "L3_items": {
                    "onboarding": "融入体系",
                    "leadership_development": "骨干培养",
                    "career_pathways": "职业通道"
                }
            },
            "retention_and_engagement": {
                "display_name": "保留激励",
                "L3_items": {
                    "key_talent_turnover": "核心流失率",
                    "employee_engagement": "员工敬业",
                    "non_financial_incentives": "非物质激励"
                }
            }
        }
    }
}


def create_empty_report(task_id: str) -> ConsultationDiagnosticReport:
    """创建空的诊断报告模板"""
    dimensions = []

    for category, category_data in FIVE_DIMENSIONS_SCHEMA.items():
        secondary_metrics = []

        for sec_name, sec_data in category_data["L2_categories"].items():
            tertiary_metrics = []

            for item_name, item_display_name in sec_data["L3_items"].items():
                tertiary_metrics.append(TertiaryDimension(
                    name=item_name,
                    display_name=item_display_name,
                    score=0,
                    evidence="",
                    analysis="",
                    confidence=ConfidenceLevel.MEDIUM
                ))

            secondary_metrics.append(SecondaryDimension(
                name=sec_name,
                display_name=sec_data["display_name"],
                tertiary_metrics=tertiary_metrics
            ))

        dimensions.append(PrimaryDimension(
            category=category,
            display_name=category_data["display_name"],
            secondary_metrics=secondary_metrics
        ))

    return ConsultationDiagnosticReport(
        task_id=task_id,
        dimensions=dimensions
    )
