"""
Competency Co-pilot — 会前预计算脚本 (v2.0)

核心逻辑：
  1. FR-1.2: 验证种子列表 + 发现新能力项 → 统一备选池 (20-25 项)
  2. FR-1.3: 遍历备选池，生成 3-5 个二级能力项
  3. FR-1.4: 遍历二级项，生成 3-6 个关键行为 (含层级标签)

用法:
  cd backend
  python scripts/competency/precompute.py
  python scripts/competency/precompute.py --seeds path/to/seeds.json --materials path/to/materials.json
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

# 确保能导入 backend 包
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.ai_client import AIClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent.parent / "data" / "competency_output"


# ── Prompt 模板 ──────────────────────────────────────────────

PROMPT_L1_SYSTEM = """你是一位资深的人力资源咨询专家，擅长从大量文本中构建能力模型。
你需要严格遵循指令，输出格式为 JSON。"""

PROMPT_L1_USER_TEMPLATE = """我将提供一份"种子能力项列表"和多份"源材料"。你的任务是：

第一步 - 验证种子列表：
逐一检查种子列表中的每个能力项，在源材料中寻找支撑证据。
为每个种子项打一个"证据强度分"（0到1之间），反映其在材料中被提及的频率和重要性。

第二步 - 发现新能力项：
扫描所有源材料，找出不在种子列表中但被高频提及或具有重要性的能力相关概念。
为新发现项打分（0到1），并记录来源。

第三步 - 合并排序：
将种子项和新发现项合并，按分数从高到低排序，返回 Top 20-25。

【关键约束】
- 种子列表中的所有词条必须全部出现在最终结果中
- 每个词条的 origin 字段必须正确标记："seed" 或 "discovered"
- sources 字段列出支撑该词条的源材料名称
- 种子项的分数不应低于 0.5（既然它们已被列入种子列表，说明有一定重要性）
- 新发现项只有在材料中有充分证据时才应纳入

【种子能力项列表】
{seeds}

【源材料】
{materials}

请严格返回 JSON 数组，不要添加任何其他文字：
[{{"term": "能力项名称", "score": 0.95, "origin": "seed", "sources": ["源材料A", "源材料B"]}}]"""

PROMPT_L2_SYSTEM = """你是一位资深的人力资源咨询专家。你需要严格输出 JSON 格式。"""

PROMPT_L2_USER_TEMPLATE = """针对一级能力项「{term}」，基于以下背景信息，生成 3-5 个二级能力子项。
每个子项应该是对该一级能力的具体分解维度，名称简洁（2-6个字）。

背景信息：
{context}

请严格返回 JSON 数组：
[{{"term": "子项名称"}}]"""

PROMPT_BEHAVIOR_SYSTEM = """你是一位资深的人力资源咨询专家。你需要严格输出 JSON 格式。"""

PROMPT_BEHAVIOR_USER_TEMPLATE = """针对二级能力项「{term}」（属于一级能力「{parent_term}」），生成 3-6 个关键行为描述。

要求：
- 每个行为描述应具体、可观察、可衡量
- 用"能..."开头，描述具体的行为表现
- 为每个行为标注建议层级：初级（执行者）、中级（管理者）、高级（领导者）
- 层级分布应合理：至少包含2个不同层级

背景信息：
{context}

请严格返回 JSON 数组：
[{{"description": "能将公司级目标翻译为团队可执行的任务", "level": "中级"}}]"""


# ── 工具函数 ──────────────────────────────────────────────

def load_json(path: Path) -> Any:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def format_materials(materials: List[Dict]) -> str:
    """将源材料格式化为文本"""
    parts = []
    for m in materials:
        parts.append(f"【{m['source']}】\n{m['content']}")
    return "\n\n".join(parts)


def add_ids(pool: List[Dict]) -> None:
    """为所有条目添加 ID"""
    for i, comp in enumerate(pool):
        comp["id"] = f"comp_{i+1:03d}"
        for j, sec in enumerate(comp.get("secondary_terms", [])):
            sec["id"] = f"sec_{i+1:03d}_{j+1:02d}"
            for k, beh in enumerate(sec.get("behaviors", [])):
                beh["id"] = f"beh_{i+1:03d}_{j+1:02d}_{k+1:02d}"


# ── 核心处理函数 ──────────────────────────────────────────────

async def step_1_verify_and_discover(
    client: AIClient,
    materials: List[Dict],
    seeds: List[str],
) -> List[Dict]:
    """
    FR-1.2: 验证种子列表 + 发现新能力项 → 统一备选池
    """
    logger.info(f"FR-1.2: 开始验证 {len(seeds)} 个种子项并发现新能力项...")

    seeds_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(seeds))
    materials_text = format_materials(materials)

    user_prompt = PROMPT_L1_USER_TEMPLATE.format(
        seeds=seeds_text,
        materials=materials_text,
    )

    result = await client.chat_json(
        PROMPT_L1_SYSTEM,
        user_prompt,
        temperature=0.2,
        max_tokens=8192,
        timeout=180,
    )

    # 解析结果
    if isinstance(result, list):
        pool = result
    elif isinstance(result, dict) and "competencies" in result:
        pool = result["competencies"]
    elif isinstance(result, dict) and "data" in result:
        pool = result["data"]
    else:
        raise ValueError(f"FR-1.2: 意外的返回格式: {type(result)}")

    # 验证所有种子项都在结果中
    result_terms = {item["term"] for item in pool}
    missing = [s for s in seeds if s not in result_terms]
    if missing:
        logger.warning(f"FR-1.2: 以下种子项未出现在 AI 结果中，将自动补充: {missing}")
        for s in missing:
            pool.append({
                "term": s,
                "score": 0.5,
                "origin": "seed",
                "sources": ["种子列表（补充）"],
            })

    # 确保每个条目都有正确的 origin 标记
    seed_set = set(seeds)
    for item in pool:
        if item["term"] in seed_set:
            item["origin"] = "seed"
        elif "origin" not in item:
            item["origin"] = "discovered"

    # 按分数排序
    pool.sort(key=lambda x: x.get("score", 0), reverse=True)

    # 截取 Top 25
    pool = pool[:25]

    seed_count = sum(1 for item in pool if item["origin"] == "seed")
    discovered_count = sum(1 for item in pool if item["origin"] == "discovered")
    logger.info(f"FR-1.2: 完成! 共 {len(pool)} 项 (种子: {seed_count}, 新发现: {discovered_count})")

    return pool


async def step_2_expand_l2(
    client: AIClient,
    term: str,
    materials: List[Dict],
) -> List[Dict]:
    """
    FR-1.3: 为一级能力项生成 3-5 个二级能力子项
    """
    context = format_materials(materials)

    user_prompt = PROMPT_L2_USER_TEMPLATE.format(
        term=term,
        context=context[:3000],  # 限制长度避免超 token
    )

    result = await client.chat_json(
        PROMPT_L2_SYSTEM,
        user_prompt,
        temperature=0.3,
        max_tokens=2048,
        timeout=60,
    )

    if isinstance(result, list):
        return result
    elif isinstance(result, dict) and "terms" in result:
        return result["terms"]
    else:
        logger.warning(f"FR-1.3: 意外格式 for '{term}': {type(result)}")
        return []


async def step_3_expand_behaviors(
    client: AIClient,
    term: str,
    parent_term: str,
    materials: List[Dict],
) -> List[Dict]:
    """
    FR-1.4: 为二级能力项生成 3-6 个关键行为 (含层级)
    """
    context = format_materials(materials)

    user_prompt = PROMPT_BEHAVIOR_USER_TEMPLATE.format(
        term=term,
        parent_term=parent_term,
        context=context[:2000],  # 限制长度
    )

    result = await client.chat_json(
        PROMPT_BEHAVIOR_SYSTEM,
        user_prompt,
        temperature=0.3,
        max_tokens=2048,
        timeout=60,
    )

    if isinstance(result, list):
        return result
    elif isinstance(result, dict) and "behaviors" in result:
        return result["behaviors"]
    else:
        logger.warning(f"FR-1.4: 意外格式 for '{term}': {type(result)}")
        return []


# ── 主流程 ──────────────────────────────────────────────

async def run_precompute(
    seeds_path: Path,
    materials_path: Path,
    output_path: Path,
):
    client = AIClient()

    if not client.is_configured():
        print("错误: AI API 未配置。请设置 DASHSCOPE_API_KEY 环境变量。")
        sys.exit(1)

    # 加载输入
    logger.info("加载输入数据...")
    seeds_data = load_json(seeds_path)
    materials = load_json(materials_path)
    models = seeds_data["models"]
    all_seeds = seeds_data["all_seeds"]

    logger.info(f"模型数: {len(models)}, 种子总计: {len(all_seeds)} 项, 源材料: {len(materials)} 份")

    # 按模型顺序处理
    all_competencies = []
    model_meta = {}

    for model_id in sorted(models.keys(), key=lambda k: models[k].get("order", 0)):
        model_def = models[model_id]
        model_label = model_def["label"]
        model_seeds = model_def["seeds"]

        logger.info(f"\n{'='*60}")
        logger.info(f"模型: {model_label} ({model_id}) — {len(model_seeds)} 个种子项")
        logger.info(f"{'='*60}")
        model_meta[model_id] = {"label": model_label, "order": model_def["order"]}

        # FR-1.2: 验证该模型的种子 + 发现新项
        pool = await step_1_verify_and_discover(client, materials, model_seeds)

        # 标记 model 字段
        for comp in pool:
            comp["model"] = model_id

        # FR-1.3: 展开二级能力项
        logger.info("FR-1.3: 开始展开二级能力项...")
        for i, comp in enumerate(pool):
            logger.info(f"  [{i+1}/{len(pool)}] {comp['term']}...")
            try:
                secondary = await step_2_expand_l2(client, comp["term"], materials)
                comp["secondary_terms"] = [{"term": s["term"]} for s in secondary if isinstance(s, dict) and "term" in s]
                logger.info(f"    → {len(comp['secondary_terms'])} 个二级项")
            except Exception as e:
                logger.error(f"    失败: {e}")
                comp["secondary_terms"] = []

        # FR-1.4: 展开关键行为
        logger.info("FR-1.4: 开始展开关键行为...")
        total_l2 = sum(len(c["secondary_terms"]) for c in pool)
        processed = 0
        for comp in pool:
            for sec in comp["secondary_terms"]:
                processed += 1
                logger.info(f"  [{processed}/{total_l2}] {comp['term']} > {sec['term']}...")
                try:
                    behaviors = await step_3_expand_behaviors(client, sec["term"], comp["term"], materials)
                    sec["behaviors"] = [
                        {
                            "description": b.get("description", ""),
                            "level": b.get("level", "中级"),
                        }
                        for b in behaviors
                        if isinstance(b, dict)
                    ]
                    logger.info(f"    → {len(sec['behaviors'])} 个行为")
                except Exception as e:
                    logger.error(f"    失败: {e}")
                    sec["behaviors"] = []

        all_competencies.extend(pool)

    # 添加 ID
    add_ids(all_competencies)

    # 构建输出
    output = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_count": len(materials),
            "seed_count": len(all_seeds),
            "models": model_meta,
        },
        "competencies": all_competencies,
    }

    # 保存
    save_json(output_path, output)
    logger.info(f"\n结果已保存到: {output_path}")

    # 统计
    total_behaviors = sum(
        len(sec.get("behaviors", []))
        for comp in all_competencies
        for sec in comp.get("secondary_terms", [])
    )
    total_l2 = sum(len(comp.get("secondary_terms", [])) for comp in all_competencies)
    logger.info(f"统计: {len(all_competencies)} 一级, {total_l2} 二级, {total_behaviors} 行为")


def main():
    parser = argparse.ArgumentParser(description="Competency Co-pilot 预计算脚本")
    parser.add_argument(
        "--seeds",
        type=Path,
        default=SCRIPT_DIR / "seeds.json",
        help="种子列表 JSON 文件路径",
    )
    parser.add_argument(
        "--materials",
        type=Path,
        default=SCRIPT_DIR / "source_materials.json",
        help="源材料 JSON 文件路径",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DATA_DIR / "result.json",
        help="输出文件路径",
    )
    args = parser.parse_args()

    asyncio.run(run_precompute(args.seeds, args.materials, args.output))


if __name__ == "__main__":
    main()
