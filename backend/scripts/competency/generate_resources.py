"""
Competency Co-pilot — 学习资源生成脚本 (FR-1.5)

基于一级能力项的二级能力和行为描述，由 AI 推荐学习资源。
会前预计算，结果写入 result.json。

用法:
  cd backend
  python scripts/competency/generate_resources.py
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.ai_client import AIClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent.parent / "data" / "competency_output"
RESULT_PATH = DATA_DIR / "result.json"

PROMPT_SYSTEM = """你是一位资深的企业培训与发展专家，擅长为能力模型匹配学习资源。
你需要严格输出 JSON 格式。"""

PROMPT_USER_TEMPLATE = """针对能力项「{term}」，基于以下二级能力和关键行为描述，推荐 5-8 个学习资源。

【二级能力项与行为】
{behavior_summary}

【要求】
- 资源类型限于以下六种: 书籍、视频、在线课程、案例库、工具、模板
- 资源应真实存在或高度合理（优先推荐业界知名资源）
- 每个资源标注适用层级: 初级(在他人指导下工作)、中级(独立工作)、高级(赋能他人)
- 层级分布应合理，覆盖至少两个层级
- 简述推荐理由（一句话）

请严格返回 JSON 数组：
[{{"title": "资源名称", "type": "书籍", "target_level": "中级", "rationale": "推荐理由"}}]"""


def build_behavior_summary(comp: Dict) -> str:
    """将一级能力项的 L2 + behaviors 格式化为文本"""
    parts = []
    for sec in comp.get("secondary_terms", []):
        behaviors_text = "\n".join(
            f"    - [{b.get('level', '中级')}] {b['description']}"
            for b in sec.get("behaviors", [])
        )
        parts.append(f"  【{sec['term']}】\n{behaviors_text}")
    return "\n\n".join(parts)


async def generate_resources_for_term(
    client: AIClient,
    term: str,
    behavior_summary: str,
) -> List[Dict]:
    """为单个一级能力项生成学习资源"""
    user_prompt = PROMPT_USER_TEMPLATE.format(
        term=term,
        behavior_summary=behavior_summary,
    )

    result = await client.chat_json(
        PROMPT_SYSTEM,
        user_prompt,
        temperature=0.4,
        max_tokens=4096,
        timeout=60,
    )

    if isinstance(result, list):
        return result
    elif isinstance(result, dict) and "resources" in result:
        return result["resources"]
    elif isinstance(result, dict) and "data" in result:
        return result["data"]
    else:
        logger.warning(f"Unexpected format for '{term}': {type(result)}")
        return []


async def run_generate():
    client = AIClient()

    if not client.is_configured():
        print("错误: AI API 未配置。请设置 DASHSCOPE_API_KEY 环境变量。")
        sys.exit(1)

    # Load existing result
    logger.info(f"读取结果文件: {RESULT_PATH}")
    with open(RESULT_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    competencies = data['competencies']
    logger.info(f"共 {len(competencies)} 个能力项")

    total = 0
    generated = 0

    for i, comp in enumerate(competencies):
        total += 1
        term = comp['term']
        model = comp.get('model', 'unknown')

        logger.info(f"[{i+1}/{total}] {term} ({model})...")

        try:
            behavior_summary = build_behavior_summary(comp)
            resources = await generate_resources_for_term(client, term, behavior_summary)

            # Normalize resources
            normalized = []
            for r in resources:
                if not isinstance(r, dict):
                    continue
                normalized.append({
                    "title": r.get("title", ""),
                    "type": r.get("type", "书籍"),
                    "target_level": r.get("target_level", "中级"),
                    "rationale": r.get("rationale", ""),
                })

            comp["resources"] = normalized
            generated += 1
            logger.info(f"  → {len(normalized)} 个资源")

        except Exception as e:
            logger.error(f"  失败: {e}")
            comp["resources"] = []

    # Update meta
    from datetime import datetime, timezone
    data['meta']['resources_generated_at'] = datetime.now(timezone.utc).isoformat()
    data['meta']['resources_description'] = (
        "学习资源由 AI 基于二级能力和关键行为描述生成。"
        "资源类型: 书籍、视频、在线课程、案例库、工具、模板。"
        "层级: 初级(在他人指导下工作)、中级(独立工作)、高级(赋能他人)。"
    )

    # Save
    with open(RESULT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_resources = sum(len(c.get("resources", [])) for c in competencies)
    logger.info(f"\n资源生成完成: {generated}/{total} 项成功, 共 {total_resources} 个资源")
    logger.info(f"结果已保存: {RESULT_PATH}")


if __name__ == "__main__":
    asyncio.run(run_generate())
