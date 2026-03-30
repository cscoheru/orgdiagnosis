"""
从 result.json 导出 3 份带编码的 Markdown 文件:
  1. docs/能力模型定义清单L1.md
  2. docs/能力模型定义清单L1-L2.md
  3. docs/能力对应学习资源清单.md
"""

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent.parent  # project root
DATA_PATH = BASE / "backend/data/competency_output/result.json"
DOCS_PATH = BASE / "docs"
DOCS_PATH.mkdir(exist_ok=True)

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

PREFIX_LABEL = {
    "delivery_management": "交付管理",
    "business_management": "项目/业务管理",
}
ORIGIN_LABEL = {"seed": "种子", "discovered": "发现"}

# Group by model
models = {}
for c in data["competencies"]:
    m = c.get("model", "delivery_management")
    models.setdefault(m, []).append(c)

# Sort each model: seeds first (by score desc), then discovered
for m in models:
    seeds = sorted([c for c in models[m] if c["origin"] == "seed"], key=lambda c: c["score"], reverse=True)
    disc = sorted([c for c in models[m] if c["origin"] != "seed"], key=lambda c: c["score"], reverse=True)
    models[m] = seeds + disc


def escape_md(text: str) -> str:
    """Escape pipe characters for markdown tables."""
    return text.replace("|", "\\|")


# ═══════════════════════════════════════════════════════════════════
# File 1: L1 only
# ═══════════════════════════════════════════════════════════════════
lines1 = []
lines1.append("# 能力模型定义清单 — 一级能力项\n")
lines1.append(f"> 生成时间: {data.get('meta', {}).get('generated_at', 'N/A')}")
lines1.append(f"> 一级能力项总数: {len(data['competencies'])}\n")

for model_key in ["delivery_management", "business_management"]:
    comps = models.get(model_key, [])
    label = PREFIX_LABEL[model_key]
    lines1.append(f"## {label} ({len(comps)} 项)\n")
    lines1.append("| 编码 | 能力项 | 定义 | 证据强度 | 来源 |")
    lines1.append("|------|--------|------|----------|------|")
    for c in comps:
        code = c.get("code", "")
        term = escape_md(c.get("term", ""))
        desc = escape_md(c.get("description", "")) if c.get("description") else ""
        score = f"{c['score'] * 100:.0f}%"
        origin = ORIGIN_LABEL.get(c["origin"], c["origin"])
        lines1.append(f"| {code} | {term} | {desc} | {score} | {origin} |")
    lines1.append("")

out1 = DOCS_PATH / "能力模型定义清单L1.md"
out1.write_text("\n".join(lines1), encoding="utf-8")
print(f"[1/3] {out1} ({len(comps)} L1 items)")


# ═══════════════════════════════════════════════════════════════════
# File 2: L1 + L2
# ═══════════════════════════════════════════════════════════════════
lines2 = []
lines2.append("# 能力模型定义清单 — 一级 & 二级能力项\n")
lines2.append(f"> 生成时间: {data.get('meta', {}).get('generated_at', 'N/A')}\n")

total_l2 = 0
for model_key in ["delivery_management", "business_management"]:
    comps = models.get(model_key, [])
    label = PREFIX_LABEL[model_key]
    lines2.append(f"## {label}\n")

    for c in comps:
        code = c.get("code", "")
        term = escape_md(c.get("term", ""))
        desc = escape_md(c.get("description", "")) if c.get("description") else ""
        origin = ORIGIN_LABEL.get(c["origin"], c["origin"])

        lines2.append(f"### {code} {term}")
        if desc:
            lines2.append(f"> {desc}")
        lines2.append(f"> 证据强度: {c['score'] * 100:.0f}% · 来源: {origin}\n")

        secs = c.get("secondary_terms", [])
        if secs:
            lines2.append("| 编码 | 二级能力项 | 定义 | 行为数 |")
            lines2.append("|------|-----------|------|--------|")
            for sec in secs:
                sec_code = sec.get("code", "")
                sec_term = escape_md(sec.get("term", ""))
                sec_desc = escape_md(sec.get("description", "")) if sec.get("description") else ""
                beh_count = len(sec.get("behaviors", []))
                lines2.append(f"| {sec_code} | {sec_term} | {sec_desc} | {beh_count} |")
            total_l2 += len(secs)
        lines2.append("")

out2 = DOCS_PATH / "能力模型定义清单L1-L2.md"
out2.write_text("\n".join(lines2), encoding="utf-8")
print(f"[2/3] {out2} ({len(data['competencies'])} L1 + {total_l2} L2 items)")


# ═══════════════════════════════════════════════════════════════════
# File 3: Resources
# ═══════════════════════════════════════════════════════════════════
lines3 = []
lines3.append("# 能力对应学习资源清单\n")
lines3.append(f"> 生成时间: {data.get('meta', {}).get('generated_at', 'N/A')}\n")

total_res = 0
for model_key in ["delivery_management", "business_management"]:
    comps = models.get(model_key, [])
    label = PREFIX_LABEL[model_key]
    lines3.append(f"## {label}\n")

    for c in comps:
        code = c.get("code", "")
        term = escape_md(c.get("term", ""))
        resources = c.get("resources", [])
        if not resources:
            continue

        lines3.append(f"### {code} {term}\n")
        lines3.append("| 编码 | 资源名称 | 类型 | 层级 | 推荐理由 |")
        lines3.append("|------|----------|------|------|----------|")
        for res in resources:
            res_code = res.get("code", "")
            res_title = escape_md(res.get("title", ""))
            res_type = res.get("type", "")
            res_level = res.get("target_level", "")
            res_rationale = escape_md(res.get("rationale", "")) if res.get("rationale") else ""
            lines3.append(f"| {res_code} | {res_title} | {res_type} | {res_level} | {res_rationale} |")
            total_res += 1
        lines3.append("")

out3 = DOCS_PATH / "能力对应学习资源清单.md"
out3.write_text("\n".join(lines3), encoding="utf-8")
print(f"[3/3] {out3} ({total_res} resources)")

print("\nDone!")
