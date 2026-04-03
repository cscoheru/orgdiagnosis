"""
巩固 Prompt 模板 — 借鉴 Claude Code consolidationPrompt.ts 的四阶段结构
"""


def build_consolidation_prompt(
    existing_knowledge: str,
    session_summaries: list[str],
) -> str:
    """构建巩固 prompt"""
    return f"""# 知识巩固

你是咨询知识管理助手。回顾近期的咨询会话，将重要知识整合到知识库中。

## Phase 1 — 定向
已有知识：
{existing_knowledge}

## Phase 2 — 收集
从以下近期会话摘要中提取值得保存的知识：
{chr(10).join(f"- {s}" for s in session_summaries)}

## Phase 3 — 整合
将新知识合并到现有知识中（不创建重复）。重点关注：
- 客户行业特征和方法论洞察
- 有效的/无效的分析方法
- 项目中的关键决策和原因

## Phase 4 — 修剪
标记过时或重复的知识条目。
"""
