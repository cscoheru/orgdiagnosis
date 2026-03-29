"""
Competency Co-pilot — 人工权重调整脚本 (v1.0)

在预计算结果上应用综合权重，调整排序。
不调用 AI，纯本地计算，秒级完成。

用法:
  cd backend
  python scripts/competency/adjust_weights.py

原理:
  综合分 = AI 证据强度 (score) × 人工权重 (weight)
  人工权重由 weight_config 定义，基于以下维度:
    - 公司与部门需求
    - 培训中心意见
    - 咨询顾问综合评估
"""

import json
import logging
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent.parent / "data" / "competency_output"
RESULT_PATH = DATA_DIR / "result.json"

# ── 权重配置 ──────────────────────────────────────────────
# 1.0 = 不调整, AI 原始分数
# <1.0 = 降权 (不适合该模型或该层级)
#
# 权重说明:
#   - "交付管理"的职责: IT 项目开发、技术实施交付、系统运维
#   - "项目/业务管理"的职责: 项目管理、业务分析、团队管理

WEIGHT_CONFIG: dict[str, float] = {
    # ── 跨模型降权项（适用于两个模型）──
    # 业务洞察是业务管理职责，不属于交付技术能力
    "业务洞察与引领能力": 0.5,
    # 翻译官是角色描述，但对应 Team Topology 的 Facilitation 交互模式
    "翻译官能力": 0.75,
    # 系统化思维：OS 全局视角 + Team Topology 理解基础，但过于抽象
    "系统化思维": 0.85,
    # 数据分析不是交付核心职责(交付的是数据平台，不是做分析)
    "数据分析与价值挖掘": 0.7,
    # 需求引领与业务需求转化重叠
    "需求引领能力": 0.75,
    # 全局观太抽象，具体性不足
    "全局观": 0.7,
    # 沟通协调过于通用
    "沟通协调与影响能力": 0.75,
    # 方案设计呈现偏向展示层，非核心
    "方案设计与呈现能力": 0.75,
    # 业务流程架构能力偏向架构师
    "业务流程架构能力": 0.7,
    # 供应商管理属于采购，非核心交付
    "供应商管理能力": 0.7,
    # 快速学习偏向个人素质
    "快速学习与适应能力": 0.7,
    # 坚韧性是素质
    "韧性/抗压性": 0.7,
    # 项目团队管理在交付侧不是重点
    "项目与团队管理能力": 0.7,
    # 结构化思维：OS 审查 + 团队设计都需要，但属底层思维
    "结构化思维与问题解构能力": 0.85,
    # 同理心是素质
    "同理心与信任建立": 0.7,
    # 技术方案整合偏向技术侧
    "技术方案整合能力": 0.75,

    # ── 业务管理额外降权项 ──
    # 业务管理不需要全栈技术知识
    "全栈技术知识": 0.5,
    # 结构化问题解决能力（BM 侧的表述）
    "结构化问题解决能力": 0.85,
    # 方案设计与呈现偏向展示
    "方案设计与呈现能力": 0.75,
    # 战略解码偏向高层
    "战略解码能力": 0.8,
    # 风险预判偏向专业岗位
    "风险预判与管控能力": 0.8,
    # 前瞻性/洞见太抽象
    "前瞻性/洞见能力": 0.75,
    # 业务流程架构师太具体
    "业务流程架构师能力": 0.75,
    # 价值发现者能力不太准确
    "价值发现者能力": 0.75,
    # 跨界资源整合偏向高层
    "跨界资源整合能力": 0.8,
    # 翻译官角色描述（子项中可能出现）
    "业务翻译": 0.6,
}

# ── 种子提升 ──────────────────────────────────────────────
# 将 AI 发现项提升为种子项（不降权，origin 改为 seed）
# 基于: 《Operating System Concepts》+ 《Team Topology》
SEED_PROMOTIONS: dict[str, str] = {
    # AI 时代代码审查能力（进程/存储/I/O/安全）是交付质量守门人
    "AI技术理解与应用": "delivery_management",
}

# ── 模型归属修正 ──
# 部分 AI 生成项可能被错误分配到模型，这里修正归属
MODEL_OVERRIDE: dict[str, str] = {
    # 这些项在 AI 结果中可能出现在错误的模型下
    # "错误归属的能力项": "正确的模型"
}


def adjust_weights(result_path: Path) -> dict:
    """应用权重调整"""
    logger.info(f"读取结果文件: {result_path}")
    with open(result_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    competencies = data['competencies']
    logger.info(f"共 {len(competencies)} 个能力项")

    # 统计
    adjusted = 0
    promoted = 0
    reversed_count = 0
    for comp in competencies:
        term = comp['term']
        current_score = comp['score']

        # 如果已有旧权重，先反转还原原始 AI 分数
        old_weight = comp.get('weight')
        if old_weight is not None and old_weight != 1.0:
            comp['score'] = round(current_score / old_weight, 3)
            reversed_count += 1

        original_score = comp['score']

        # 应用种子提升
        if term in SEED_PROMOTIONS:
            comp['origin'] = 'seed'
            target_model = SEED_PROMOTIONS[term]
            if comp.get('model') != target_model:
                logger.info(f"  种子提升: {term} → origin=seed, model={target_model}")
                comp['model'] = target_model
            else:
                logger.info(f"  种子提升: {term} → origin=seed")
            comp['weight'] = 1.0
            promoted += 1
            continue

        weight = WEIGHT_CONFIG.get(term, 1.0)

        # 应用模型归属修正
        if term in MODEL_OVERRIDE:
            comp['model'] = MODEL_OVERRIDE[term]
            logger.info(f"  模型修正: {term} → {MODEL_OVERRIDE[term]}")

        if weight != 1.0:
            comp['score'] = round(original_score * weight, 3)
            comp['weight'] = weight
            adjusted += 1
            logger.info(f"  {comp['model']:20s} | {term:20s} | {original_score:.2f} × {weight} = {comp['score']:.3f}")
        else:
            comp['weight'] = 1.0

    logger.info(f"\n权重调整完成: {adjusted} 项被调整, {promoted} 项提升为种子")

    # 去重: 同一模型下同名的能力项，保留数据更丰富的
    seen: dict[str, dict] = {}
    deduped = []
    removed = 0
    for comp in competencies:
        key = f"{comp.get('model', '')}:{comp['term']}"
        if key in seen:
            existing = seen[key]
            existing_sec = len(existing.get('secondary_terms', []))
            comp_sec = len(comp.get('secondary_terms', []))
            if comp_sec > existing_sec:
                deduped.remove(existing)
                deduped.append(comp)
                seen[key] = comp
                logger.info(f"  去重: 保留更丰富版本 {comp['term']} ({comp_sec} vs {existing_sec} 二级项)")
            else:
                logger.info(f"  去重: 移除重复项 {comp['term']} ({comp_sec} vs {existing_sec} 二级项)")
            removed += 1
        else:
            seen[key] = comp
            deduped.append(comp)
    if removed > 0:
        data['competencies'] = deduped
        logger.info(f"去重完成: 移除 {removed} 个重复项, 剩余 {len(deduped)} 项")

    # 重新排序
    for comp in data['competencies']:
        model = comp.get('model', 'delivery_management')
        model_comps = [c for c in data['competencies'] if c.get('model') == model]
        model_comps.sort(key=lambda x: x['score'], reverse=True)
        for rank, c in enumerate(model_comps):
            c['rank'] = rank + 1

    # 更新 meta
    data['meta']['weight_adjusted_at'] = datetime.now(timezone.utc).isoformat()
    data['meta']['weight_description'] = (
        "综合权重 = AI证据强度 × 人工权重。"
        "人工权重基于公司与部门需求、培训中心意见、咨询顾问综合评估。"
    )

    # 保存
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"结果已保存: {result_path}")

    return data


def print_summary(data: dict) -> None:
    """打印调整后的摘要"""
    print("\n" + "=" * 70)
    print("调整后排序 (按模型分组)")
    print("=" * 70)

    for model_id in ['delivery_management', 'business_management']:
        label = '交付管理' if model_id == 'delivery_management' else '项目/业务管理'
        print(f"\n{label} (Top 10):")
        model_comps = sorted(
            [c for c in data['competencies'] if c.get('model') == model_id],  # noqa
            key=lambda x: x['score'], reverse=True
        )
        for i, c in enumerate(model_comps[:10]):
            origin = '种子' if c.get('origin') == 'seed' else '发现'
            weight = c.get('weight', 1.0)
            weight_str = f"w={weight}" if weight != 1.0 else ""
            print(f"  {i+1:2}. [{origin}] {c['term']:16s}  分数={c['score']:.3f}  {weight_str}")


def main():
    result_path = RESULT_PATH
    if not result_path.exists():
        print(f"错误: 找不到结果文件 {result_path}")
        print("请先运行预计算脚本: python scripts/competency/precompute.py")
        sys.exit(1)

    data = adjust_weights(result_path)
    print_summary(data)


if __name__ == "__main__":
    main()
