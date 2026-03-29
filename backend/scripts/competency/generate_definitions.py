"""
为 L1 和 L2 能力项生成一句话定义。

L1 种子项: 使用专家预设定义
L1 发现项: AI 根据二级能力和行为描述生成
L2 全部项: AI 根据关键行为描述生成
"""

import asyncio
import json
import sys
import os
import re
from pathlib import Path
from collections import defaultdict

import httpx
from dotenv import load_dotenv

# ── 路径与环境 ──
backend_dir = Path(__file__).resolve().parents[2]
load_dotenv(backend_dir / ".env")

API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
API_URL = os.getenv("AI_API_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions")
MODEL = os.getenv("AI_MODEL", "qwen-plus")

# ── 种子能力定义（来自专家预设） ──

SEED_DEFINITIONS = {
    # 交付管理
    "技术架构能力": "以前瞻性的系统化思维，规划与设计稳定、可扩展的技术系统蓝图的能力",
    "全栈实现能力": "运用广博而深入的工程技术，将技术蓝图高质量地转化为可靠软件产品的能力",
    "工程化交付实施": "通过建立标准化、自动化的流程与工具，保障系统开发过程高效、规范、可控的能力",
    "系统稳定性保障": "通过系统化的问题解决和主动的风险规避，确保线上系统长期稳定运行的能力",
    "业务需求转化": "准确理解业务诉求，并将其精准地转化为清晰、可执行的技术任务与规范的能力",
    "技术创新驱动": "主动探索并应用前沿技术，为现有业务场景赋能并创造新价值的能力",
    "技术团队管理": "识别、发展并激励技术人才，打造高绩效、高凝聚力技术团队的能力",
    "跨方技术协同": "在多技术栈、多利益方的复杂环境中，推动技术层面的共识与顺畅协作的能力",
    "AI技术理解与应用": "了解AI Agent开发的概念与方法，能利用主流AI辅助开发手段进行开发、测试和维护，理解AI技术的应用边界、能力和风险",
    # 项目/业务管理
    "业务领域精通": "深刻理解业务领域的运作模式、流程脉络、痛点及战略方向的专业能力",
    "业务持续性保障": "通过快速的问题解决和系统优化，保障并提升现有业务流程的稳定性与运行效率的能力",
    "整合项目交付": "运用专业知识和工具，对项目从启动到收尾的全过程进行整合性管理，以确保目标达成的能力",
    "解决方案设计": "将模糊的业务问题，解构并设计为清晰、合理、可落地的数字化解决方案的能力",
    "数据驱动决策": "利用数据分析洞察业务本质、评估项目成效，并以此驱动业务与项目决策的能力",
    "需求与价值实现": "挖掘、引导并管理与战略对齐的业务需求，并推动其端到端落地以实现可衡量商业价值的能力",
    "团队管理与赋能": "凝聚、激励并发展跨职能项目团队，营造积极协作的氛围，以激发团队最大潜能的能力",
    "协同与影响": "在复杂的组织环境中，与所有内外部干系人建立信任，推动协同，并通过有效影响来获取支持、解决冲突的能力",
}


async def call_ai(prompt: str) -> str:
    """调用 DashScope API"""
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def parse_json_response(text: str) -> dict:
    """从 AI 响应中提取 JSON"""
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


async def generate_l1_definitions(competencies: list) -> dict:
    """为缺少定义的 L1 发现项生成一句话定义"""
    need_definition = [c for c in competencies if not c.get("description")]

    if not need_definition:
        print("所有 L1 项已有定义，跳过")
        return {}

    print(f"\n{'='*60}")
    print(f"需要生成 L1 定义: {len(need_definition)} 项")
    print(f"{'='*60}")

    definitions = {}
    batch_size = 10

    for i in range(0, len(need_definition), batch_size):
        batch = need_definition[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(need_definition) + batch_size - 1) // batch_size
        print(f"\n批次 {batch_num}/{total_batches} ({len(batch)} 项)...")

        items_text = ""
        for c in batch:
            l2_names = [s["term"] for s in c.get("secondary_terms", [])]
            items_text += f"\n- {c['term']}（{c['model']}）\n  二级能力: {', '.join(l2_names)}"
            sample_behaviors = []
            for s in c.get("secondary_terms", [])[:3]:
                if s["behaviors"]:
                    sample_behaviors.append(s["behaviors"][0]["description"][:80])
            items_text += f"\n  行为示例: {'; '.join(sample_behaviors[:2])}"

        prompt = f"""你是一位企业能力建模专家。请为以下能力项各写一句话定义（15-30字），格式为"XX的能力"。

参考种子能力定义风格：
- 技术架构能力: 以前瞻性的系统化思维，规划与设计稳定、可扩展的技术系统蓝图的能力
- 业务需求转化: 准确理解业务诉求，并将其精准地转化为清晰、可执行的技术任务与规范的能力

请为以下能力项生成定义：{items_text}

要求：
1. 每个定义一句话，以"的能力"结尾
2. 抓住核心特征，不要泛泛而谈
3. 体现该能力在实际工作中的具体表现
4. 严格按 JSON 格式输出，key 为能力项名称，value 为定义
5. 不要输出其他内容

输出格式：
{{"能力项名称": "定义", ...}}"""

        try:
            result = await call_ai(prompt)
            parsed = parse_json_response(result)
            definitions.update(parsed)
            print(f"  生成 {len(parsed)} 个定义")
            await asyncio.sleep(1)
        except Exception as e:
            print(f"  错误: {e}")
            continue

    return definitions


async def generate_l2_definitions(competencies: list) -> dict:
    """为所有 L2 项生成一句话定义"""
    all_l2 = []
    for c in competencies:
        for s in c.get("secondary_terms", []):
            if not s.get("description"):
                all_l2.append({
                    "key": f"{c['term']}|{s['term']}",
                    "l1": c["term"],
                    "l2": s["term"],
                    "behaviors": [b["description"] for b in s.get("behaviors", [])],
                })

    if not all_l2:
        print("所有 L2 项已有定义，跳过")
        return {}

    print(f"\n{'='*60}")
    print(f"需要生成 L2 定义: {len(all_l2)} 项")
    print(f"{'='*60}")

    definitions = {}
    by_l1 = defaultdict(list)
    for item in all_l2:
        by_l1[item["l1"]].append(item)

    for l1_name, items in by_l1.items():
        print(f"\n处理 L1: {l1_name} ({len(items)} 个 L2)...")

        items_text = ""
        for item in items:
            items_text += f"\n- {item['l2']}"
            for b in item["behaviors"][:2]:
                items_text += f"\n  行为: {b[:100]}"

        prompt = f"""你是一位企业能力建模专家。请为以下二级能力项各写一句话定义（10-20字）。

父级能力: {l1_name}

二级能力项及关键行为：{items_text}

要求：
1. 每个定义一句话，简洁精炼
2. 与父级能力区分，体现该子能力的独特性
3. 基于关键行为描述提炼核心特征
4. 严格按 JSON 格式输出
5. 不要输出其他内容

输出格式：
{{"二级能力项名称": "定义", ...}}"""

        try:
            result = await call_ai(prompt)
            parsed = parse_json_response(result)
            for item in items:
                if item["l2"] in parsed:
                    definitions[item["key"]] = parsed[item["l2"]]
            print(f"  生成 {len(parsed)} 个定义")
            await asyncio.sleep(1)
        except Exception as e:
            print(f"  错误: {e}")
            continue

    return definitions


async def main():
    if not API_KEY:
        print("错误: DASHSCOPE_API_KEY 未配置")
        sys.exit(1)

    print(f"AI 模型: {MODEL}")
    print(f"API URL: {API_URL[:50]}...")

    result_path = Path("backend/data/competency_output/result.json")

    with open(result_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    competencies = data["competencies"]

    # Step 1: 应用种子定义
    print("=" * 60)
    print("Step 1: 应用种子能力定义")
    print("=" * 60)
    seed_count = 0
    for comp in competencies:
        if comp["origin"] == "seed" and comp["term"] in SEED_DEFINITIONS:
            comp["description"] = SEED_DEFINITIONS[comp["term"]]
            seed_count += 1
    print(f"已应用 {seed_count} 个种子定义")

    # Step 2: 生成 L1 发现项定义
    l1_defs = await generate_l1_definitions(competencies)
    for comp in competencies:
        if not comp.get("description") and comp["term"] in l1_defs:
            comp["description"] = l1_defs[comp["term"]]

    # Step 3: 生成 L2 定义
    l2_defs = await generate_l2_definitions(competencies)
    for comp in competencies:
        for sec in comp.get("secondary_terms", []):
            key = f"{comp['term']}|{sec['term']}"
            if key in l2_defs:
                sec["description"] = l2_defs[key]

    # Step 4: 统计并保存
    l1_with_desc = sum(1 for c in competencies if c.get("description"))
    l2_with_desc = sum(
        1 for c in competencies
        for s in c.get("secondary_terms", [])
        if s.get("description")
    )
    total_l2 = sum(len(c.get("secondary_terms", [])) for c in competencies)

    print(f"\n{'='*60}")
    print(f"统计: L1 定义 {l1_with_desc}/{len(competencies)}, L2 定义 {l2_with_desc}/{total_l2}")
    print(f"{'='*60}")

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n已保存到 {result_path}")


if __name__ == "__main__":
    asyncio.run(main())
