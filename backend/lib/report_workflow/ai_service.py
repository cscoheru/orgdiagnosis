"""
Report AI Service

使用已配置的 LLM API (DashScope/通义千问) 生成报告模块、页面标题和幻灯片内容。
"""

import httpx
import json
import logging
import os
from typing import Dict, Any, List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class ReportAIService:
    """报告AI生成服务 - 使用 DashScope (通义千问) API"""

    def __init__(self):
        # 优先使用 DashScope/Anthropic 配置
        self.api_key = os.getenv("DASHSCOPE_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or os.getenv("DEEPSEEK_API_KEY", "")
        self.api_url = os.getenv("ANTHROPIC_BASE_URL") or "https://api.deepseek.com/v1/chat/completions"
        self.timeout = 90  # 90秒超时
        self.max_tokens = 4096

        # Debug logging
        logger.info(f"ReportAIService initialized:")
        logger.info(f"  API URL: {self.api_url}")
        logger.info(f"  API Key: {self.api_key[:10]}..." if self.api_key else "  API Key: NOT SET")

    def is_configured(self) -> bool:
        """检查API是否配置"""
        return bool(self.api_key) and self.api_key != "your-api-key"

    async def _call_api(self, system_prompt: str, user_prompt: str) -> str:
        """调用LLM API (DashScope/DeepSeek兼容格式)"""
        if not self.is_configured():
            raise ValueError("LLM API 未配置")

        # 判断使用哪个模型
        if "dashscope" in self.api_url.lower():
            model = "qwen-plus"  # 通义千问
        else:
            model = "deepseek-chat"  # DeepSeek

        # Configure proxy - bypass for API calls to avoid URL rewriting issues
        # trust_env=False prevents httpx from using system proxy settings
        async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
            response = await client.post(
                self.api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": self.max_tokens
                }
            )

            if response.status_code == 429:
                raise Exception("API 限流")
            if response.status_code == 402:
                raise Exception("API 余额不足")

            response.raise_for_status()

            result = response.json()
            logger.debug(f"API Response: {result}")

            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            if not content:
                logger.error(f"Empty content from API. Response: {result}")
                raise ValueError("API 返回内容为空")

            logger.debug(f"API content length: {len(content)}")
            return content

    def _extract_json(self, content: str) -> Dict[str, Any]:
        """从响应中提取JSON"""
        import re

        # 尝试提取 ```json ... ``` 块
        json_match = content
        if "```json" in content:
            match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
            if match:
                json_match = match.group(1)
        elif "```" in content:
            match = re.search(r'```\s*([\s\S]*?)\s*```', content)
            if match:
                json_match = match.group(1)

        # 尝试找到JSON对象
        if not json_match.strip().startswith('{') and not json_match.strip().startswith('['):
            match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', content)
            if match:
                json_match = match.group(1)

        try:
            return json.loads(json_match)
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}\n内容: {json_match[:500]}")
            raise ValueError(f"JSON解析失败: {str(e)}")

    # ============================================================
    # Step 1: Generate Modules
    # ============================================================

    async def generate_modules(
        self,
        client_name: str,
        industry: str,
        pain_points: List[str],
        goals: List[str],
        five_d_diagnosis: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        生成报告核心模块

        Args:
            client_name: 客户名称
            industry: 行业
            pain_points: 核心痛点列表
            goals: 项目目标列表
            five_d_diagnosis: 五维诊断结果（可选）

        Returns:
            模块列表
        """
        system_prompt = """你是一位资深的咨询顾问，擅长设计项目建议书结构。
根据客户的需求和痛点，设计一份专业的咨询项目建议书模块结构。

输出要求：
1. 生成5-8个核心模块
2. 每个模块需包含：module_id, module_name, module_title, description, estimated_pages, priority
3. 模块应覆盖：需求理解、方法框架、诊断分析、解决方案、实施计划、报价等
4. 根据客户痛点智能添加相关诊断模块

返回严格的JSON格式：
```json
{
  "modules": [
    {
      "module_id": "module_1",
      "module_name": "需求理解",
      "module_title": "项目需求的理解",
      "description": "分析客户背景、核心痛点和项目目标",
      "estimated_pages": 5,
      "priority": 1
    }
  ]
}
```"""

        diagnosis_info = ""
        if five_d_diagnosis:
            dims = []
            for dim_key in ['strategy', 'structure', 'performance', 'compensation', 'talent']:
                dim_data = five_d_diagnosis.get(dim_key, {})
                score = dim_data.get('score', 0)
                if score < 70:  # 低于70分的维度需要重点关注
                    dims.append(f"{dim_data.get('label', dim_key)}({score}分)")
            if dims:
                diagnosis_info = f"\n\n五维诊断显示以下维度需要重点关注：{', '.join(dims)}"

        user_prompt = f"""请为以下客户设计项目建议书模块结构：

客户名称：{client_name}
行业：{industry}

核心痛点：
{chr(10).join(f'- {p}' for p in pain_points if p)}

项目目标：
{chr(10).join(f'- {g}' for g in goals if g)}
{diagnosis_info}

请生成5-8个核心模块，返回JSON格式。"""

        try:
            content = await self._call_api(system_prompt, user_prompt)
            data = self._extract_json(content)
            modules = data.get("modules", [])

            # 确保每个模块有必需字段
            for i, module in enumerate(modules):
                module.setdefault("module_id", f"module_{i+1}")
                module.setdefault("diagnosis_dimension", None)
                module.setdefault("estimated_pages", 3)
                module.setdefault("priority", i+1)

            logger.info(f"AI生成了 {len(modules)} 个模块")
            return modules

        except Exception as e:
            logger.warning(f"AI生成模块失败: {e}，使用fallback")
            return self._generate_modules_fallback(pain_points, five_d_diagnosis)

    def _generate_modules_fallback(
        self,
        pain_points: List[str],
        five_d_diagnosis: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """模块生成fallback（无API时使用）"""
        modules = [
            {
                "module_id": "module_1",
                "module_name": "需求理解",
                "module_title": "项目需求的理解",
                "diagnosis_dimension": None,
                "description": "分析客户背景、核心痛点和项目目标",
                "estimated_pages": 5,
                "priority": 1
            },
            {
                "module_id": "module_2",
                "module_name": "方法框架",
                "module_title": "项目方法与整体框架",
                "diagnosis_dimension": None,
                "description": "介绍咨询方法论和MDS五维诊断模型",
                "estimated_pages": 4,
                "priority": 2
            }
        ]

        # 根据痛点添加诊断模块
        dimension_map = {
            "战略": "strategy", "组织": "structure", "绩效": "performance",
            "薪酬": "compensation", "人才": "talent",
        }
        pain_points_text = " ".join(pain_points)
        for keyword, dimension in dimension_map.items():
            if keyword in pain_points_text or (five_d_diagnosis and five_d_diagnosis.get(dimension, {}).get('score', 100) < 70):
                modules.append({
                    "module_id": f"module_{len(modules) + 1}",
                    "module_name": f"{keyword}诊断",
                    "module_title": f"{keyword}维度诊断与建议",
                    "diagnosis_dimension": dimension,
                    "description": f"针对{keyword}维度的深入诊断和改进建议",
                    "estimated_pages": 3,
                    "priority": 3
                })

        modules.extend([
            {
                "module_id": f"module_{len(modules) + 1}",
                "module_name": "实施步骤",
                "module_title": "项目实施步骤",
                "diagnosis_dimension": None,
                "description": "详细的项目实施计划和时间安排",
                "estimated_pages": 4,
                "priority": 4
            },
            {
                "module_id": f"module_{len(modules) + 1}",
                "module_name": "计划报价",
                "module_title": "项目计划、团队与报价",
                "diagnosis_dimension": None,
                "description": "项目团队配置、时间计划和费用报价",
                "estimated_pages": 3,
                "priority": 5
            }
        ])

        return modules

    # ============================================================
    # Step 2: Generate Page Titles
    # ============================================================

    async def generate_page_titles(
        self,
        module: Dict[str, Any],
        client_name: str,
        industry: str,
        pain_points: List[str],
        five_d_diagnosis: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        为单个模块生成页面标题

        Args:
            module: 模块信息
            client_name: 客户名称
            industry: 行业
            pain_points: 核心痛点
            five_d_diagnosis: 五维诊断结果

        Returns:
            页面标题列表
        """
        system_prompt = """你是一位资深的咨询顾问，擅长设计PPT页面结构。
根据模块主题，设计2-4个页面的标题和核心内容方向。

输出要求：
1. 每个页面需包含：page_id, page_title, key_direction, suggested_layout
2. suggested_layout可选：bullet_points, two_columns, data_chart, process_flow, swot_matrix
3. 页面标题要具体、有洞察力
4. key_direction描述该页面要传达的核心观点

返回严格的JSON格式：
```json
{
  "pages": [
    {
      "page_id": "module_1_page_1",
      "page_title": "行业发展趋势分析",
      "key_direction": "分析行业面临的挑战与机遇",
      "suggested_layout": "bullet_points"
    }
  ]
}
```"""

        diagnosis_context = ""
        if five_d_diagnosis and module.get("diagnosis_dimension"):
            dim_data = five_d_diagnosis.get(module["diagnosis_dimension"], {})
            diagnosis_context = f"\n\n该模块对应五维诊断维度得分：{dim_data.get('score', 'N/A')}分"
            # 添加主要问题
            l2_cats = dim_data.get("L2_categories", {})
            low_score_items = []
            for l2_key, l2_cat in l2_cats.items():
                if l2_cat.get("score", 100) < 65:
                    low_score_items.append(f"{l2_cat.get('label', l2_key)}({l2_cat.get('score')}分)")
            if low_score_items:
                diagnosis_context += f"\n需要重点关注的子维度：{', '.join(low_score_items)}"

        user_prompt = f"""请为以下模块设计页面结构：

模块名称：{module.get('module_name', '')}
模块标题：{module.get('module_title', '')}
模块描述：{module.get('description', '')}

客户名称：{client_name}
行业：{industry}
核心痛点：{', '.join(pain_points[:3]) if pain_points else '无'}
{diagnosis_context}

请生成2-4个页面，返回JSON格式。注意page_id格式为：{module.get('module_id', 'module_1')}_page_N"""

        try:
            content = await self._call_api(system_prompt, user_prompt)
            data = self._extract_json(content)
            pages = data.get("pages", [])

            # 确保每个页面有必需字段
            module_id = module.get("module_id", "module_1")
            for i, page in enumerate(pages):
                page.setdefault("page_id", f"{module_id}_page_{i+1}")
                page.setdefault("module_id", module_id)
                page.setdefault("suggested_layout", "bullet_points")
                page.setdefault("estimated_elements", 4)

            logger.info(f"AI为模块 {module.get('module_name')} 生成了 {len(pages)} 个页面")
            return pages

        except Exception as e:
            logger.warning(f"AI生成页面标题失败: {e}，使用fallback")
            return self._generate_page_titles_fallback(module, client_name, industry, pain_points)

    def _generate_page_titles_fallback(
        self,
        module: Dict[str, Any],
        client_name: str,
        industry: str,
        pain_points: List[str]
    ) -> List[Dict[str, Any]]:
        """页面标题生成fallback"""
        module_id = module.get("module_id", "module_1")
        module_name = module.get("module_name", "")

        pages = []

        if module_name == "需求理解":
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": "行业背景分析", "key_direction": f"分析{industry}行业的发展趋势和挑战", "suggested_layout": "bullet_points", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_2", "module_id": module_id, "page_title": f"{client_name}现状分析", "key_direction": "通过诊断访谈识别客户当前的核心问题", "suggested_layout": "bullet_points", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_3", "module_id": module_id, "page_title": "核心痛点分析", "key_direction": "系统梳理客户最迫切需要解决的问题", "suggested_layout": "bullet_points", "estimated_elements": len(pain_points) or 3},
                {"page_id": f"{module_id}_page_4", "module_id": module_id, "page_title": "项目目标设定", "key_direction": "设定清晰可衡量的项目目标", "suggested_layout": "bullet_points", "estimated_elements": 3},
            ]
        elif module_name == "方法框架":
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": "咨询方法论", "key_direction": "介绍系统性诊断方法和实施路径", "suggested_layout": "bullet_points", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_2", "module_id": module_id, "page_title": "MDS五维诊断模型", "key_direction": "从五个维度全面诊断组织效能", "suggested_layout": "bullet_points", "estimated_elements": 5},
                {"page_id": f"{module_id}_page_3", "module_id": module_id, "page_title": "解决方案框架", "key_direction": "基于诊断结果设计针对性解决方案", "suggested_layout": "bullet_points", "estimated_elements": 3},
            ]
        elif "诊断" in module_name:
            dim_name = module_name.replace("诊断", "")
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": f"{dim_name}现状", "key_direction": f"分析{dim_name}维度的当前状态", "suggested_layout": "bullet_points", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_2", "module_id": module_id, "page_title": f"{dim_name}问题", "key_direction": f"识别{dim_name}维度存在的核心问题", "suggested_layout": "bullet_points", "estimated_elements": 3},
                {"page_id": f"{module_id}_page_3", "module_id": module_id, "page_title": f"{dim_name}改进建议", "key_direction": f"提出{dim_name}维度的改进方案", "suggested_layout": "bullet_points", "estimated_elements": 4},
            ]
        elif module_name == "实施步骤":
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": "项目实施计划", "key_direction": "展示项目各阶段的时间安排", "suggested_layout": "process_flow", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_2", "module_id": module_id, "page_title": "关键里程碑", "key_direction": "定义项目关键节点和交付物", "suggested_layout": "bullet_points", "estimated_elements": 5},
            ]
        elif module_name == "计划报价":
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": "项目团队", "key_direction": "介绍项目团队成员和职责", "suggested_layout": "bullet_points", "estimated_elements": 4},
                {"page_id": f"{module_id}_page_2", "module_id": module_id, "page_title": "项目报价", "key_direction": "提供详细的项目费用明细", "suggested_layout": "data_chart", "estimated_elements": 5},
            ]
        else:
            # 通用页面
            pages = [
                {"page_id": f"{module_id}_page_1", "module_id": module_id, "page_title": module.get("module_title", "内容页"), "key_direction": module.get("description", ""), "suggested_layout": "bullet_points", "estimated_elements": 4},
            ]

        return pages

    # ============================================================
    # Step 3: Generate Slide Content
    # ============================================================

    async def generate_slide_content(
        self,
        page_title: str,
        key_direction: str,
        client_name: str,
        industry: str,
        pain_points: List[str],
        knowledge_context: str = ""
    ) -> Dict[str, Any]:
        """
        生成单个幻灯片的内容

        Args:
            page_title: 页面标题
            key_direction: 核心方向
            client_name: 客户名称
            industry: 行业
            pain_points: 核心痛点
            knowledge_context: 知识库检索上下文

        Returns:
            幻灯片内容（title, key_message, bullets）
        """
        system_prompt = """你是一位资深的咨询顾问，擅长撰写PPT内容。
根据页面主题和方向，生成专业的幻灯片内容。

输出要求：
1. title: 页面标题（可优化原标题使其更有洞察力）
2. key_message: 核心观点（一句话概括，作为Action Title）
3. bullets: 3-5个支撑论点（每个15-30字，具体、有洞察力）

返回严格的JSON格式：
```json
{
  "title": "页面标题",
  "key_message": "核心观点，一句话概括",
  "bullets": [
    "论点1：具体内容",
    "论点2：具体内容",
    "论点3：具体内容"
  ]
}
```"""

        context = ""
        if knowledge_context:
            context = f"\n\n参考知识库内容：\n{knowledge_context[:1000]}"

        user_prompt = f"""请为以下页面生成内容：

页面标题：{page_title}
核心方向：{key_direction}

客户：{client_name}
行业：{industry}
核心痛点：{', '.join(pain_points[:2]) if pain_points else '无'}
{context}

请生成专业、有洞察力的幻灯片内容，返回JSON格式。"""

        try:
            content = await self._call_api(system_prompt, user_prompt)
            data = self._extract_json(content)

            # 确保必需字段
            result = {
                "title": data.get("title", page_title),
                "key_message": data.get("key_message", key_direction),
                "bullets": data.get("bullets", [f"要点{i+1}" for i in range(3)])
            }

            return result

        except Exception as e:
            logger.warning(f"AI生成幻灯片内容失败: {e}，使用fallback")
            return {
                "title": page_title,
                "key_message": key_direction,
                "bullets": [
                    f"要点1：{key_direction}的第一个关键发现",
                    f"要点2：{key_direction}的第二个关键发现",
                    f"要点3：{key_direction}的第三个关键发现",
                ]
            }


# 单例实例
report_ai_service = ReportAIService()
