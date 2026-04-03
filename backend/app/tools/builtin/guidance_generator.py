"""
引导话术生成工具 — 智能咨询引导 (Claude Code plan mode 风格)

核心设计思想（借鉴 Claude Code）：
1. 深度分析已有数据，只问真正缺失的关键信息
2. 封闭性选择题优先（cards 样式），避免开放性问答题
3. 每轮最多 3 个问题
4. 数据充分时（≥80% 节点完成）建议直接生成报告
"""
import json

from loguru import logger

from app.tools.base import BaseConsultingTool, ToolContext, ToolResult
from app.tools.registry import register_tool


# ─── 预设封闭性选项 ───

SMART_FIELD_MAP: dict[str, dict] = {
    "market_position": {
        "type": "single_choice",
        "options": ["领导者", "挑战者", "跟随者", "利基者"],
        "ui_style": "cards",
    },
    "org_type": {
        "type": "single_choice",
        "options": ["职能制", "事业部制", "矩阵制", "网络制", "混合制"],
        "ui_style": "cards",
    },
    "has_kpi_system": {
        "type": "single_choice",
        "options": ["已建立", "部分建立", "未建立"],
        "ui_style": "cards",
    },
    "org_pain_points": {
        "type": "multi_choice",
        "options": [
            "层级过多，决策链长",
            "部门墙严重，协作困难",
            "权责不清，推诿扯皮",
            "管理层能力不足",
            "组织僵化，难以适应变化",
        ],
        "allow_custom": True,
    },
    "talent_pain_points": {
        "type": "multi_choice",
        "options": [
            "关键岗位缺人",
            "人才流失率高",
            "胜任力不匹配",
            "缺乏继任计划",
            "培训体系不完善",
        ],
        "allow_custom": True,
    },
    "performance_pain_points": {
        "type": "multi_choice",
        "options": [
            "考核指标不清晰",
            "考核周期不合理",
            "结果与薪酬脱钩",
            "缺乏绩效反馈",
            "目标设定困难",
        ],
        "allow_custom": True,
    },
    "threats": {
        "type": "multi_choice",
        "options": [
            "新进入者威胁",
            "替代品/新技术颠覆",
            "行业监管收紧",
            "市场需求下滑",
            "供应链风险",
        ],
        "allow_custom": True,
    },
    "strengths": {
        "type": "multi_choice",
        "options": [
            "较强的行业经验和专业积累",
            "稳定的客户关系和市场份额",
            "良好的管理团队和企业文化",
            "技术/产品创新能力",
            "高效的运营体系",
        ],
        "allow_custom": True,
    },
    "opportunities": {
        "type": "multi_choice",
        "options": [
            "数字化转型带来效率提升",
            "行业政策利好",
            "市场需求持续增长",
            "技术创新开辟新赛道",
            "上下游整合机会",
        ],
        "allow_custom": True,
    },
    "weaknesses": {
        "type": "multi_choice",
        "options": [
            "组织架构不够灵活",
            "人才梯队存在断层",
            "缺乏系统的绩效管理",
            "创新能力不足",
            "成本控制有待加强",
        ],
        "allow_custom": True,
    },
    "strategic_priorities": {
        "type": "multi_choice",
        "options": [
            "优化组织架构和管控模式",
            "建立科学绩效管理体系",
            "加强人才梯队建设",
            "推进数字化转型",
            "提升运营效率和成本控制",
        ],
        "allow_custom": True,
    },
    "expected_outcomes": {
        "type": "multi_choice",
        "options": [
            "组织效率提升 20%+",
            "关键人才流失率降低 50%",
            "绩效管理体系全覆盖",
            "决策链缩短 30%",
            "员工满意度提升",
        ],
        "allow_custom": True,
    },
}


@register_tool
class GuidanceGeneratorTool(BaseConsultingTool):
    name = "guidance_generator"
    description = "根据缺失字段和项目上下文，生成智能咨询引导话术"
    category = "generation"

    async def execute(self, ctx: ToolContext) -> ToolResult:
        missing = ctx.extra.get("missing_fields", [])
        blueprint = ctx.blueprint
        collected = ctx.collected_data
        goal = ctx.project_goal
        interaction_count = ctx.extra.get("interaction_count", 0)

        if not missing:
            return ToolResult(success=False, error="没有缺失字段需要引导")

        # ─── 完成度检查：≥80% 节点完成且已有交互 → 建议直接生成 ───
        total_nodes = len(blueprint.get("nodes", []))
        completed_nodes = sum(
            1 for n in blueprint.get("nodes", [])
            if n.get("status") == "complete"
        )
        completion_ratio = completed_nodes / total_nodes if total_nodes > 0 else 0

        if completion_ratio >= 0.8 and interaction_count >= 1:
            return ToolResult(
                data={"action": "suggest_execute"},
                message={
                    "role": "assistant",
                    "content": (
                        f"已收集 {completed_nodes}/{total_nodes} 个分析模块的数据"
                        f"（完成度 {int(completion_ratio * 100)}%），"
                        f"信息已基本充分，可以直接生成报告。"
                    ),
                    "metadata": {
                        "ui_components": [{
                            "type": "single_choice",
                            "key": "__confirm_execute__",
                            "label": "数据已基本充分，是否直接生成报告？",
                            "options": ["直接生成", "补充更多信息"],
                            "required": True,
                            "ui_style": "cards",
                        }],
                        "context": {
                            "current_node": "数据完整性检查",
                            "progress": ctx.extra.get("progress", 0.0),
                            "benchmark_title": blueprint.get("title", ""),
                            "interaction_count": interaction_count + 1,
                        },
                    },
                },
            )

        # ─── 字段优先级排序（required → 阻塞下游多 → 执行顺序靠前）───
        prioritized = self._prioritize_missing_fields(missing, blueprint)
        selected = prioritized[:3]  # 上限 3 个问题

        # ─── 生成封闭性 UI 组件 ───
        ui_components = [
            self._generate_smart_component(f, collected, goal, blueprint)
            for f in selected
        ]

        # ─── 生成上下文感知引导话术 ───
        guidance = await self._generate_guidance_message(
            selected, collected, goal, blueprint, completion_ratio
        )

        current_node = selected[0].get("node_display_name", "") if selected else ""

        return ToolResult(
            data={
                "guidance": guidance,
                "ui_components": ui_components,
                "current_node": current_node,
                "completion_ratio": completion_ratio,
            },
            message={
                "role": "assistant",
                "content": guidance,
                "metadata": {
                    "ui_components": ui_components,
                    "context": {
                        "current_node": current_node,
                        "progress": ctx.extra.get("progress", 0.0),
                        "benchmark_title": blueprint.get("title", ""),
                        "interaction_count": interaction_count + 1,
                    },
                },
            },
        )

    def _prioritize_missing_fields(
        self, missing: list[dict], blueprint: dict
    ) -> list[dict]:
        """按 required → 阻塞下游数 → 执行顺序 排序"""
        nodes = blueprint.get("nodes", [])
        execution_order = blueprint.get("execution_order", [])

        # 统计每个 node_type 被多少下游节点依赖
        downstream_count: dict[str, int] = {}
        for node in nodes:
            nt = node.get("node_type", "")
            downstream_count.setdefault(nt, 0)
        for node in nodes:
            for dep in node.get("dependencies", []):
                downstream_count[dep] = downstream_count.get(dep, 0) + 1

        order_index = {nt: i for i, nt in enumerate(execution_order)}

        def sort_key(f: dict) -> tuple:
            nt = f.get("node_type", "")
            return (
                not f.get("required", False),
                -downstream_count.get(nt, 0),
                order_index.get(nt, 999),
            )

        return sorted(missing, key=sort_key)

    def _generate_smart_component(
        self, field: dict, collected: dict, goal: str, blueprint: dict
    ) -> dict:
        """为缺失字段生成封闭性 UI 组件"""
        field_key = field.get("field_key", "")
        field_label = field.get("field_label", "")
        node_type = field.get("node_type", "")

        # 1. 查找预设选项
        if field_key in SMART_FIELD_MAP:
            template = SMART_FIELD_MAP[field_key]
            comp: dict = {
                "type": template["type"],
                "key": f"{node_type}.{field_key}",
                "label": field_label,
                "required": field.get("required", False),
                "options": template["options"],
            }
            if template.get("ui_style"):
                comp["ui_style"] = template["ui_style"]
            if template.get("allow_custom"):
                comp["allow_custom"] = template["allow_custom"]
            return comp

        # 2. 从已有数据推导选项
        derived = self._derive_options_from_context(field_key, collected, goal)
        if derived:
            return {
                "type": "multi_choice",
                "key": f"{node_type}.{field_key}",
                "label": field_label,
                "required": field.get("required", False),
                "options": derived,
                "allow_custom": True,
            }

        # 3. Fallback: 使用原始 field_type（保持兼容）
        comp = {
            "type": field.get("field_type", "input"),
            "key": f"{node_type}.{field_key}",
            "label": field_label,
            "required": field.get("required", False),
        }
        if field.get("field_options"):
            comp["options"] = field["field_options"]
        return comp

    @staticmethod
    def _derive_options_from_context(
        field_key: str, collected: dict, goal: str
    ) -> list[str] | None:
        """从已收集数据推导选项"""
        if field_key == "revenue":
            industry = collected.get("company_overview", {}).get("industry", "")
            return ["1000万以下", "1000万-5000万", "5000万-1亿", "1亿-10亿", "10亿以上"]

        if field_key == "founding_year":
            return ["3年以内", "3-5年", "5-10年", "10-20年", "20年以上"]

        if field_key == "competitor_name":
            industry = collected.get("company_overview", {}).get("industry", "")
            return []  # 无法推导，返回 None 让 fallback 处理

        if field_key == "market_size":
            return ["100亿以下", "100-500亿", "500-1000亿", "1000亿以上"]

        if field_key == "growth_rate":
            return ["<5%（低速）", "5-15%（中速）", "15-30%（高速）", ">30%（爆发增长）"]

        if field_key == "key_positions":
            return ["CEO/总经理", "CFO/财务总监", "CHRO/人力总监", "CTO/技术总监", "COO/运营总监"]

        if field_key == "vacancy_rate":
            return ["<5%", "5-10%", "10-20%", ">20%"]

        return None

    async def _generate_guidance_message(
        self,
        selected_fields: list[dict],
        collected: dict,
        goal: str,
        blueprint: dict,
        completion_ratio: float,
    ) -> str:
        """生成上下文感知引导话术（LLM + fallback）"""
        system_prompt = (
            f"你是一位资深管理咨询顾问，正在为「{blueprint.get('title', '')}」项目收集信息。"
            f"系统已自动收集了部分数据（完成度约 {int(completion_ratio * 100)}%）。"
            f"现在还需要补充 {len(selected_fields)} 项关键信息。"
            "请用专业但亲切的语气，生成2-3句话的引导话术，简要说明为什么需要这些信息。"
            "直接输出话术文本，不要加引号或额外格式。"
        )

        # 传递实际 collected_data 值（而非 '...'）让 AI 了解已有上下文
        collected_summary: dict[str, dict] = {}
        for node_type, node_data in collected.items():
            if isinstance(node_data, dict):
                collected_summary[node_type] = {
                    k: (v[:100] + "..." if isinstance(v, str) and len(v) > 100 else v)
                    for k, v in node_data.items()
                    if v
                }

        fields_desc = "\n".join(
            f"- {f['field_label']}（{f['node_display_name']}）"
            for f in selected_fields
        )

        user_prompt = f"""项目目标：{goal}

已收集的数据：
{json.dumps(collected_summary, ensure_ascii=False, indent=2)}

需要补充的信息：
{fields_desc}

请生成引导话术。"""

        from app.services.ai_client import AIClient
        ai_client = AIClient()

        if ai_client.is_configured():
            try:
                return await ai_client.chat(
                    system_prompt, user_prompt,
                    temperature=0.7, max_tokens=512,
                )
            except Exception as e:
                logger.warning(f"AI guidance failed: {e}, using template")

        # Fallback
        node_name = selected_fields[0].get("node_display_name", "") if selected_fields else ""
        fields = "、".join(f.get("field_label", "") for f in selected_fields)
        return f"为了完善「{node_name}」分析，请补充{fields}等信息。"

    def get_cost_estimate(self) -> int:
        return 800
