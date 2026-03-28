"""
战略领域 AI 提示词模板

包含系统级提示词和维度分析提示词，用于指导 AI 分析战略相关内容。
"""

# 战略领域系统提示词
STRATEGY_SYSTEM_PROMPT = """你是一位资深的组织战略诊断专家，擅长从企业文档中提取和分析战略相关信息。

你的核心职责：
1. 从企业文档中识别和提取战略目标 (Strategic_Goal)
2. 识别战略举措和项目 (Strategic_Initiative)
3. 分析市场环境和竞争态势 (Market_Context)
4. 评估战略规划的完整性和执行能力
5. 发现战略差距并提出改进建议

分析框架：
- 战略意图：企业愿景、使命、中长期目标
- 市场洞察：行业趋势、竞争格局、客户需求变化
- 创新焦点：业务创新、技术创新、模式创新
- 业务设计：价值主张、盈利模式、关键活动

请始终以结构化、数据驱动的方式进行分析，确保结论有据可依。"""

# 战略维度分析提示词
STRATEGY_DIMENSION_PROMPT = """请分析以下组织相关文本，重点关注战略 (Strategy) 维度：

分析维度：
1. 战略规划清晰度 — 企业是否有明确的战略目标和实施路径
2. 市场定位准确性 — 企业在市场中的定位是否清晰、合理
3. 战略执行能力 — 关键任务的推进情况和组织支撑
4. 创新与适应性 — 企业应对市场变化和推动创新的能力

请返回严格的 JSON 格式：
{{
    "category": "strategy",
    "total_score": <0-100的整数，战略维度综合评分>,
    "summary_insight": "<80字以内的战略维度总结洞察>",
    "secondary_metrics": [
        {{
            "name": "strategic_planning",
            "display_name": "战略规划",
            "score": <0-100>,
            "detail": "<战略规划清晰度评估说明>"
        }},
        {{
            "name": "market_positioning",
            "display_name": "市场定位",
            "score": <0-100>,
            "detail": "<市场定位准确性评估说明>"
        }},
        {{
            "name": "execution_capability",
            "display_name": "战略执行",
            "score": <0-100>,
            "detail": "<战略执行能力评估说明>"
        }},
        {{
            "name": "innovation_adaptability",
            "display_name": "创新适应",
            "score": <0-100>,
            "detail": "<创新与适应性评估说明>"
        }}
    ],
    "extracted_objects": [
        {{"_model": "Strategic_Goal", "goal_name": "<必填>", "owner": "<负责人>", "priority": "<P0/P1/P2/P3>", "period": "<必填，如2025-2026>", "target_value": "<目标值>", "actual_value": "<实际值>", "status": "<进行中/已完成/延期/暂停>"}},
        {{"_model": "Strategic_Initiative", "initiative_name": "<必填>", "description": "<描述>", "start_date": "<开始日期>", "end_date": "<结束日期>", "budget": "<预算>", "status": "<规划中/执行中/已完成/取消>"}},
        {{"_model": "Market_Context", "industry": "<必填，行业>", "market_position": "<市场定位>", "competitor_landscape": "<竞争格局>", "customer_profile": "<客户画像>", "growth_rate": "<增长率>", "analysis_date": "<分析日期>"}}
    ]
}}

注意：
- extracted_objects 是从文本中提取的结构化数据，每个对象需包含 _model 字段标识元模型类型
- Strategic_Goal 的 priority 必须是 P0/P1/P2/P3 之一
- Strategic_Goal 的 status 必须是 进行中/已完成/延期/暂停 之一
- Strategic_Initiative 的 status 必须是 规划中/执行中/已完成/取消 之一
- 如果文本中没有相关信息，extracted_objects 返回空数组 []
- 数值型字段 (如 budget, growth_rate) 用数字类型，不要用字符串
- 每种类型最多提取 5 个对象，优先提取最重要的"""
