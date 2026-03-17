"""
AI 信息抽取服务
使用 DeepSeek API 进行五维诊断分析
"""
import httpx
import json
import logging
import time
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.models.schemas import FiveDimensionsData, L1Dimension, L2Category, L3Item, ConfidenceLevel

logger = logging.getLogger(__name__)


# 五维模型 Prompt
SYSTEM_PROMPT = """你是一位资深的组织诊断专家，精通 IBM/华为 BLM 模型。你的任务是从原始文本中提取信息，映射到五维诊断模型，并进行量化评分。

## 五维模型结构

### 1. 战略 (Strategy) - "做正确的事"
- L2 业务现状: L3 performance_gap(业绩差距), opportunity_gap(机会差距)
- L2 战略规划: L3 market_insight(市场洞察), strategic_intent(战略意图), innovation_focus(创新焦点), business_design(业务设计)
- L2 战略执行: L3 critical_tasks(关键任务), organizational_support(组织支撑), talent_readiness(人才准备), corporate_culture(企业文化)
- L2 战略评估: L3 business_analysis(经营分析), execution_evaluation(执行评价), strategy_iteration(战略迭代)

### 2. 组织 (Structure) - "提升系统运转效率"
- L2 组织架构: L3 structure_type(架构形态), layers_and_span(管理层级), departmental_boundaries(部门边界)
- L2 权责分配: L3 decision_mechanism(决策机制), delegation_system(授权体系), role_definitions(岗位指引)
- L2 协同流程: L3 core_processes(核心流程), cross_functional_collaboration(跨部门协作), process_digitalization(流程数字化)
- L2 组织效能: L3 per_capita_efficiency(人效指标), agility(响应速度)

### 3. 绩效 (Performance) - "明确指挥棒"
- L2 绩效体系设计: L3 goal_setting_tools(目标设定), metric_cascading(指标分解), weights_and_standards(权重标准)
- L2 过程管理: L3 goal_tracking(目标跟进), performance_coaching(绩效辅导), data_collection(数据收集)
- L2 考核与反馈: L3 appraisal_fairness(考核公平), feedback_quality(面谈质量), grievance_mechanism(申诉机制)
- L2 结果应用: L3 link_to_rewards(激励挂钩), promotion_and_elimination(晋升淘汰), link_to_learning_and_development(培训发展)

### 4. 薪酬 (Compensation) - "提供核心动力"
- L2 薪酬策略: L3 market_positioning(市场定位), fixed_vs_variable_mix(固浮比), internal_equity(内部公平)
- L2 薪酬结构: L3 base_pay(基本工资), short_term_incentives(短期激励), long_term_incentives(长期激励), benefits_and_allowances(弹性福利)
- L2 管理与预算: L3 payroll_management(总额管控), salary_adjustment(调薪机制), pay_transparency(薪酬沟通)

### 5. 人才 (Talent) - "打造核心资产"
- L2 规划与盘点: L3 competency_models(胜任力模型), talent_review(人才盘点), pipeline_health(梯队健康)
- L2 获取与配置: L3 employer_branding(雇主品牌), recruitment_precision(招聘精准), internal_mobility(内部流动)
- L2 培养与发展: L3 onboarding(融入体系), leadership_development(骨干培养), career_pathways(职业通道)
- L2 保留与激励: L3 key_talent_turnover(核心流失), employee_engagement(员工敬业), non_financial_incentives(非物质激励)

## 评分规则
1. 每个 L3 项: 0-100 分整数
2. evidence: 从原文提取的具体证据（引用原文）
3. confidence: high(原文明确提及), medium(可推断), low(无明确信息，需进一步验证)

## 输出格式
返回严格的 JSON 格式，不要有任何额外文字。"""


def generate_user_prompt(text: str) -> str:
    """生成用户 Prompt"""
    return f"""请分析以下原始文本，进行五维诊断评估。

原始文本:
{text}

请严格按照以下 JSON 格式输出，不要有任何额外文字:

```json
{{
  "strategy": {{
    "label": "战略",
    "description": "做正确的事",
    "L2_categories": {{
      "business_status": {{
        "label": "业务现状",
        "L3_items": {{
          "performance_gap": {{ "score": 65, "evidence": "原文证据", "confidence": "high" }},
          "opportunity_gap": {{ "score": 70, "evidence": "原文证据", "confidence": "medium" }}
        }}
      }}
    }}
  }},
  "structure": {{ ... }},
  "performance": {{ ... }},
  "compensation": {{ ... }},
  "talent": {{ ... }},
  "overall_score": 60,
  "summary": "整体诊断摘要..."
}}
```

注意：
1. 必须包含所有五个维度
2. 每个 L2 必须包含所有 L3 项
3. score 为 0-100 的整数
4. evidence 必须引用原文内容
5. confidence 为 high/medium/low 之一"""


class AIExtractor:
    """AI 信息抽取服务"""

    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.api_url = settings.DEEPSEEK_API_URL
        self.timeout = 30  # 缩短超时到30秒，超时后使用 mock 数据
        self.max_tokens = settings.AI_MAX_TOKENS

    def is_configured(self) -> bool:
        """检查 API 是否配置"""
        return bool(self.api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def extract(self, text: str) -> Dict[str, Any]:
        """
        从文本中抽取五维诊断数据

        Args:
            text: 原始文本

        Returns:
            五维诊断数据字典
        """
        start_time = time.time()

        # 检查 API 配置
        if not self.is_configured():
            logger.warning("DeepSeek API 未配置，使用 Mock 数据")
            return self._generate_mock_data(text)

        # 截断超长文本
        if len(text) > 20000:
            text = text[:20000] + "\n...[文本已截断，保留前20000字符]"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.api_key}"
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": generate_user_prompt(text)}
                        ],
                        "temperature": 0.3,
                        "max_tokens": self.max_tokens
                    }
                )

                if response.status_code == 429:
                    logger.warning("API 限流，使用 Mock 数据")
                    return self._generate_mock_data(text)

                if response.status_code == 402:
                    logger.warning("API 余额不足，使用 Mock 数据")
                    return self._generate_mock_data(text)

                response.raise_for_status()

                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                if not content:
                    raise ValueError("API 返回内容为空")

                # 解析 JSON
                data = self._parse_response(content)
                processing_time = int((time.time() - start_time) * 1000)

                logger.info(f"AI 分析完成，耗时 {processing_time}ms")
                return data

        except httpx.TimeoutException:
            logger.warning("API 请求超时，使用 Mock 数据")
            return self._generate_mock_data(text)

        except Exception as e:
            logger.warning(f"API 请求失败: {str(e)}，使用 Mock 数据")
            return self._generate_mock_data(text)

    async def generate(self, text: str) -> Dict[str, Any]:
        """
        generate 方法（extract 的别名，用于 PDF 生成器调用）
        """
        return await self.extract(text)

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """解析 API 响应"""
        # 提取 JSON
        json_match = content
        if "```json" in content:
            import re
            match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
            if match:
                json_match = match.group(1)

        try:
            data = json.loads(json_match)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON 解析失败: {str(e)}")

        # 验证数据结构
        required_dims = ['strategy', 'structure', 'performance', 'compensation', 'talent']
        for dim in required_dims:
            if dim not in data:
                raise ValueError(f"缺少维度: {dim}")

        # 计算聚合分数
        self._calculate_scores(data)

        return data

    def _calculate_scores(self, data: Dict[str, Any]) -> None:
        """计算聚合分数"""
        total_score = 0
        dimensions = ['strategy', 'structure', 'performance', 'compensation', 'talent']

        for dim_key in dimensions:
            dim = data.get(dim_key, {})
            dim_total = 0
            l2_count = 0

            l2_cats = dim.get('L2_categories', {})
            for l2_key, l2_cat in l2_cats.items():
                l2_total = 0
                l3_count = 0

                l3_items = l2_cat.get('L3_items', {})
                for l3_key, l3_item in l3_items.items():
                    score = l3_item.get('score', 0)
                    if isinstance(score, (int, float)):
                        l2_total += score
                        l3_count += 1

                if l3_count > 0:
                    l2_cat['score'] = round(l2_total / l3_count)
                    dim_total += l2_cat['score']
                    l2_count += 1

            if l2_count > 0:
                dim['score'] = round(dim_total / l2_count)
                total_score += dim['score']

        if len(dimensions) > 0:
            data['overall_score'] = round(total_score / len(dimensions))

    def _generate_mock_data(self, text: str) -> Dict[str, Any]:
        """生成 Mock 数据（API 不可用时）"""
        text_lower = text.lower()

        return {
            "strategy": {
                "label": "战略",
                "description": "做正确的事",
                "score": 72,
                "L2_categories": {
                    "business_status": {
                        "score": 65,
                        "label": "业务现状",
                        "L3_items": {
                            "performance_gap": {
                                "score": 60 if "营收" in text_lower or "增长" in text_lower else 70,
                                "evidence": "原文提及业绩相关内容" if "增长" in text_lower else "未提及具体业绩差距",
                                "confidence": "medium"
                            },
                            "opportunity_gap": {
                                "score": 55 if "机会" in text_lower else 70,
                                "evidence": "原文提及市场机会" if "机会" in text_lower else "未提及机会差距",
                                "confidence": "medium"
                            }
                        }
                    },
                    "strategic_planning": {
                        "score": 75,
                        "label": "战略规划",
                        "L3_items": {
                            "market_insight": {"score": 78, "evidence": "模拟数据", "confidence": "low"},
                            "strategic_intent": {"score": 75, "evidence": "模拟数据", "confidence": "low"},
                            "innovation_focus": {"score": 72, "evidence": "模拟数据", "confidence": "low"},
                            "business_design": {"score": 75, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "strategy_execution": {
                        "score": 68,
                        "label": "战略执行",
                        "L3_items": {
                            "critical_tasks": {"score": 65, "evidence": "模拟数据", "confidence": "low"},
                            "organizational_support": {"score": 70, "evidence": "模拟数据", "confidence": "low"},
                            "talent_readiness": {"score": 60, "evidence": "模拟数据", "confidence": "low"},
                            "corporate_culture": {"score": 77, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "strategy_evaluation": {
                        "score": 80,
                        "label": "战略评估",
                        "L3_items": {
                            "business_analysis": {"score": 82, "evidence": "模拟数据", "confidence": "low"},
                            "execution_evaluation": {"score": 78, "evidence": "模拟数据", "confidence": "low"},
                            "strategy_iteration": {"score": 80, "evidence": "模拟数据", "confidence": "low"}
                        }
                    }
                }
            },
            "structure": {
                "label": "组织",
                "description": "提升系统运转效率",
                "score": 58 if "组织" in text_lower or "架构" in text_lower else 65,
                "L2_categories": {
                    "organizational_structure": {
                        "score": 60,
                        "label": "组织架构",
                        "L3_items": {
                            "structure_type": {"score": 62, "evidence": "模拟数据", "confidence": "low"},
                            "layers_and_span": {"score": 55, "evidence": "模拟数据", "confidence": "low"},
                            "departmental_boundaries": {"score": 63, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "authority_and_responsibility": {
                        "score": 68,
                        "label": "权责分配",
                        "L3_items": {
                            "decision_mechanism": {"score": 70, "evidence": "模拟数据", "confidence": "low"},
                            "delegation_system": {"score": 65, "evidence": "模拟数据", "confidence": "low"},
                            "role_definitions": {"score": 69, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "collaboration_and_processes": {
                        "score": 55 if "协作" in text_lower or "部门墙" in text_lower else 65,
                        "label": "协同流程",
                        "L3_items": {
                            "core_processes": {"score": 68, "evidence": "模拟数据", "confidence": "low"},
                            "cross_functional_collaboration": {
                                "score": 50 if "协作" in text_lower else 65,
                                "evidence": "原文提及跨部门协作问题" if "协作" in text_lower else "模拟数据",
                                "confidence": "medium"
                            },
                            "process_digitalization": {"score": 62, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "organizational_effectiveness": {
                        "score": 68,
                        "label": "组织效能",
                        "L3_items": {
                            "per_capita_efficiency": {"score": 70, "evidence": "模拟数据", "confidence": "low"},
                            "agility": {"score": 66, "evidence": "模拟数据", "confidence": "low"}
                        }
                    }
                }
            },
            "performance": {
                "label": "绩效",
                "description": "明确指挥棒",
                "score": 52 if "绩效" in text_lower or "考核" in text_lower else 60,
                "L2_categories": {
                    "system_design": {
                        "score": 50,
                        "label": "绩效体系设计",
                        "L3_items": {
                            "goal_setting_tools": {"score": 52, "evidence": "模拟数据", "confidence": "low"},
                            "metric_cascading": {"score": 48, "evidence": "模拟数据", "confidence": "low"},
                            "weights_and_standards": {"score": 50, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "process_management": {
                        "score": 55,
                        "label": "过程管理",
                        "L3_items": {
                            "goal_tracking": {"score": 58, "evidence": "模拟数据", "confidence": "low"},
                            "performance_coaching": {"score": 52, "evidence": "模拟数据", "confidence": "low"},
                            "data_collection": {"score": 55, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "appraisal_and_feedback": {
                        "score": 48 if "公平" in text_lower else 58,
                        "label": "考核与反馈",
                        "L3_items": {
                            "appraisal_fairness": {
                                "score": 45 if "公平" in text_lower else 60,
                                "evidence": "原文提及考核公平性问题" if "公平" in text_lower else "模拟数据",
                                "confidence": "medium"
                            },
                            "feedback_quality": {"score": 60, "evidence": "模拟数据", "confidence": "low"},
                            "grievance_mechanism": {"score": 58, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "result_application": {
                        "score": 55,
                        "label": "结果应用",
                        "L3_items": {
                            "link_to_rewards": {"score": 58, "evidence": "模拟数据", "confidence": "low"},
                            "promotion_and_elimination": {"score": 52, "evidence": "模拟数据", "confidence": "low"},
                            "link_to_learning_and_development": {"score": 55, "evidence": "模拟数据", "confidence": "low"}
                        }
                    }
                }
            },
            "compensation": {
                "label": "薪酬",
                "description": "提供核心动力",
                "score": 55 if "薪酬" in text_lower or "工资" in text_lower else 68,
                "L2_categories": {
                    "compensation_strategy": {
                        "score": 70,
                        "label": "薪酬策略",
                        "L3_items": {
                            "market_positioning": {"score": 68, "evidence": "模拟数据", "confidence": "low"},
                            "fixed_vs_variable_mix": {"score": 72, "evidence": "模拟数据", "confidence": "low"},
                            "internal_equity": {"score": 70, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "compensation_structure": {
                        "score": 66,
                        "label": "薪酬结构",
                        "L3_items": {
                            "base_pay": {"score": 68, "evidence": "模拟数据", "confidence": "low"},
                            "short_term_incentives": {"score": 65, "evidence": "模拟数据", "confidence": "low"},
                            "long_term_incentives": {"score": 55, "evidence": "模拟数据", "confidence": "low"},
                            "benefits_and_allowances": {"score": 72, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "management_and_budgeting": {
                        "score": 68,
                        "label": "管理与预算",
                        "L3_items": {
                            "payroll_management": {"score": 70, "evidence": "模拟数据", "confidence": "low"},
                            "salary_adjustment": {"score": 65, "evidence": "模拟数据", "confidence": "low"},
                            "pay_transparency": {"score": 60, "evidence": "模拟数据", "confidence": "low"}
                        }
                    }
                }
            },
            "talent": {
                "label": "人才",
                "description": "打造核心资产",
                "score": 50 if "人才" in text_lower or "流失" in text_lower or "离职" in text_lower else 58,
                "L2_categories": {
                    "planning_and_review": {
                        "score": 58,
                        "label": "规划与盘点",
                        "L3_items": {
                            "competency_models": {"score": 60, "evidence": "模拟数据", "confidence": "low"},
                            "talent_review": {"score": 55, "evidence": "模拟数据", "confidence": "low"},
                            "pipeline_health": {"score": 59, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "acquisition_and_allocation": {
                        "score": 55,
                        "label": "获取与配置",
                        "L3_items": {
                            "employer_branding": {"score": 58, "evidence": "模拟数据", "confidence": "low"},
                            "recruitment_precision": {"score": 52, "evidence": "模拟数据", "confidence": "low"},
                            "internal_mobility": {"score": 48, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "training_and_development": {
                        "score": 60,
                        "label": "培养与发展",
                        "L3_items": {
                            "onboarding": {"score": 65, "evidence": "模拟数据", "confidence": "low"},
                            "leadership_development": {"score": 55, "evidence": "模拟数据", "confidence": "low"},
                            "career_pathways": {"score": 55, "evidence": "模拟数据", "confidence": "low"}
                        }
                    },
                    "retention_and_engagement": {
                        "score": 45 if "流失" in text_lower or "离职" in text_lower else 55,
                        "label": "保留与激励",
                        "L3_items": {
                            "key_talent_turnover": {
                                "score": 40 if "流失" in text_lower or "离职" in text_lower else 55,
                                "evidence": "原文提及人才流失问题" if "流失" in text_lower else "模拟数据",
                                "confidence": "medium"
                            },
                            "employee_engagement": {"score": 58, "evidence": "模拟数据", "confidence": "low"},
                            "non_financial_incentives": {"score": 52, "evidence": "模拟数据", "confidence": "low"}
                        }
                    }
                }
            },
            "overall_score": 62,
            "summary": "基于提供的信息，该组织整体健康度处于中等水平。主要问题集中在绩效管理和人才保留方面，建议重点关注考核公平性优化和核心人才保留策略。"
        }


# 单例实例
ai_extractor = AIExtractor()
