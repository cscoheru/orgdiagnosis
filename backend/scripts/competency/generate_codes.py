"""
为 L1/L2/L3/资源 生成统一编码并写入 result.json。

编码规则:
  L1: DM-01, DM-02, ... / BM-01, BM-02, ...
  L2: DM-01-01, DM-01-02, ... / BM-01-01, ...
  L3: DM-01-01-01, DM-01-01-02, ... / BM-01-01-01, ...
  资源: DMR-01-01, DMR-01-02, ... / BMR-01-01, ...

排序: 每个模型内按 score 降序（种子优先）。
"""

import json
from pathlib import Path

result_path = Path("backend/data/competency_output/result.json")

with open(result_path, "r", encoding="utf-8") as f:
    data = json.load(f)

PREFIX = {
    "delivery_management": "DM",
    "business_management": "BM",
}

total_comps = 0
total_l2 = 0
total_l3 = 0
total_res = 0

for model_key, prefix in PREFIX.items():
    comps = [c for c in data["competencies"] if c["model"] == model_key]
    # Seeds first (by score desc), then discovered (by score desc)
    seeds = sorted(
        [c for c in comps if c["origin"] == "seed"],
        key=lambda c: c["score"],
        reverse=True,
    )
    discovered = sorted(
        [c for c in comps if c["origin"] != "seed"],
        key=lambda c: c["score"],
        reverse=True,
    )
    ordered = seeds + discovered

    for l1_num, comp in enumerate(ordered, 1):
        l1_code = f"{prefix}-{l1_num:02d}"
        comp["code"] = l1_code
        total_comps += 1

        # L2
        for l2_num, sec in enumerate(comp.get("secondary_terms", []), 1):
            l2_code = f"{prefix}-{l1_num:02d}-{l2_num:02d}"
            sec["code"] = l2_code
            total_l2 += 1

            # L3 (behaviors)
            for l3_num, beh in enumerate(sec.get("behaviors", []), 1):
                l3_code = f"{prefix}-{l1_num:02d}-{l2_num:02d}-{l3_num:02d}"
                beh["code"] = l3_code
                total_l3 += 1

        # Resources
        res_prefix = f"{prefix}R"
        for res_num, res in enumerate(comp.get("resources", []), 1):
            res_code = f"{res_prefix}-{l1_num:02d}-{res_num:02d}"
            res["code"] = res_code
            total_res += 1

print(f"编码生成完成:")
print(f"  L1: {total_comps} 项")
print(f"  L2: {total_l2} 项")
print(f"  L3: {total_l3} 项")
print(f"  资源: {total_res} 项")

with open(result_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n已写入 {result_path}")
