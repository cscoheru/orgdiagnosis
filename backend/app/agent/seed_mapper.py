"""
Seed Mapper — 将项目工作流数据 (W1/W2) 映射为 Agent collected_data 格式

使得 AI 顾问可以继承已有数据，避免重复询问。
"""
from __future__ import annotations

from typing import Any


def map_w1_to_collected_data(
    extract_data: dict[str, Any],
    plan_data: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """
    将 W1 需求分析数据映射为 Agent collected_data 格式。

    Args:
        extract_data: W1 Step 1 的 EnhancedSmartExtractData
        plan_data: W1 Step 2 的 EnhancedMilestonePlanData (可选)

    Returns:
        collected_data 格式的 dict, key 为 node_type
    """
    collected: dict[str, dict[str, Any]] = {}

    # ─── company_overview ───
    collected["company_overview"] = {
        "company_name": extract_data.get("client_name", ""),
        "industry": extract_data.get("industry", ""),
        "employee_count": _parse_employee_count(extract_data.get("company_scale", "")),
        "core_business": extract_data.get("company_info", ""),
    }

    # ─── industry_analysis ───
    collected["industry_analysis"] = {
        "industry_trend": extract_data.get("industry_background", ""),
    }

    # ─── SWOT (部分 — weaknesses 来自痛点, strengths/opportunities/threats 需要用户补充) ───
    pain_points = extract_data.get("core_pain_points", [])
    if isinstance(pain_points, list):
        weaknesses = "; ".join(
            p.get("description", "") if isinstance(p, dict) else str(p)
            for p in pain_points if p
        )
    else:
        weaknesses = str(pain_points) if pain_points else ""

    collected["SWOT"] = {"weaknesses": weaknesses}

    # ─── strategic_recommendations ───
    goals = extract_data.get("expected_goals", [])
    criteria = extract_data.get("success_criteria", [])
    collected["strategic_recommendations"] = {
        "strategic_priorities": "; ".join(goals) if isinstance(goals, list) else str(goals),
        "expected_outcomes": "; ".join(criteria) if isinstance(criteria, list) else str(criteria),
    }

    # ─── implementation_roadmap ───
    if plan_data:
        phases = plan_data.get("phases", [])
        if isinstance(phases, list):
            phases_text = "; ".join(
                f"{p.get('phase_name', '')}: {p.get('goals', '')}"
                for p in phases if p.get("phase_name")
            )
            total_weeks = plan_data.get("total_duration_weeks", 0)
        else:
            phases_text = str(phases)
            total_weeks = 0

        collected["implementation_roadmap"] = {
            "phases": phases_text,
            "timeline": f"共{total_weeks}周",
        }

    return collected


def map_w2_to_collected_data(diagnosis_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """
    将 W2 调研诊断数据 (FiveDimensionsData) 映射为 Agent collected_data 格式。

    Args:
        diagnosis_data: W2 Step 3 的 FiveDimensionsData

    Returns:
        需要合并到已有 collected_data 中的增量数据
    """
    collected: dict[str, dict[str, Any]] = {}

    for dim_key in ("strategy", "structure", "performance", "compensation", "talent"):
        dim = diagnosis_data.get(dim_key, {})
        if not isinstance(dim, dict):
            continue

        score = dim.get("score", 0)
        evidence_parts: list[str] = []

        # 从 L2/L3 层级提取 evidence
        l2_categories = dim.get("L2_categories", {})
        if isinstance(l2_categories, dict):
            for _l2_key, l2 in l2_categories.items():
                if not isinstance(l2, dict):
                    continue
                l3_items = l2.get("L3_items", {})
                if isinstance(l3_items, dict):
                    for _l3_key, l3 in l3_items.items():
                        if isinstance(l3, dict) and l3.get("evidence"):
                            evidence_parts.append(l3["evidence"])

        evidence_text = "; ".join(evidence_parts[:10])  # 限制长度

        if dim_key == "structure":
            collected.setdefault("organizational_structure", {})
            collected["organizational_structure"]["org_pain_points"] = evidence_text
            collected["organizational_structure"]["structure_score"] = score

        elif dim_key == "performance":
            collected.setdefault("performance_diagnosis", {})
            collected["performance_diagnosis"]["performance_pain_points"] = evidence_text
            collected["performance_diagnosis"]["has_kpi_system"] = (
                "已建立" if score >= 60 else "部分建立" if score >= 30 else "未建立"
            )
            collected["performance_diagnosis"]["performance_score"] = score

        elif dim_key == "talent":
            collected.setdefault("talent_assessment", {})
            collected["talent_assessment"]["talent_pain_points"] = evidence_text
            collected["talent_assessment"]["talent_score"] = score

        elif dim_key == "strategy":
            collected.setdefault("strategic_recommendations", {})
            collected["strategic_recommendations"]["strategic_context"] = evidence_text
            collected["strategic_recommendations"]["strategy_score"] = score

        elif dim_key == "compensation":
            # 薪酬维度合并到 performance_diagnosis
            collected.setdefault("performance_diagnosis", {})
            existing = collected["performance_diagnosis"].get("performance_pain_points", "")
            if evidence_text:
                collected["performance_diagnosis"]["performance_pain_points"] = (
                    f"{existing}; {evidence_text}" if existing else evidence_text
                )

    # 整体摘要
    overall_score = diagnosis_data.get("overall_score", 0)
    summary = diagnosis_data.get("summary", "")
    if summary:
        collected.setdefault("SWOT", {})
        existing_swot = collected["SWOT"].get("strengths", "")
        collected["SWOT"]["strengths"] = (
            f"{existing_swot}; {summary}" if existing_swot else summary
        )

    return collected


def merge_collected_data(
    base: dict[str, dict[str, Any]],
    *overrides: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """
    合并多份 collected_data,后者覆盖前者的同名字段。

    Args:
        base: 基础 collected_data
        *overrides: 增量数据 (W1, W2 等)

    Returns:
        合并后的 collected_data
    """
    result = dict(base)
    for override in overrides:
        for node_type, node_data in override.items():
            if node_type not in result:
                result[node_type] = dict(node_data)
            else:
                result[node_type] = {**result[node_type], **node_data}
    return result


def _parse_employee_count(scale: str) -> str:
    """将公司规模文本转为大致人数"""
    if not scale:
        return ""
    scale = scale.strip().lower()
    mapping = {
        "小型": "50人以下",
        "中型": "50-200人",
        "大型": "200-1000人",
        "超大型": "1000人以上",
    }
    for key, value in mapping.items():
        if key in scale:
            return value
    return scale


def map_w3_to_collected_data(
    phases: list[dict[str, Any]] | None = None,
    team_members: list[dict[str, Any]] | None = None,
    report_data: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """
    将 W3 项目交付数据映射为 Agent collected_data 格式。

    Args:
        phases: W3 阶段列表 (PhaseData[])
        team_members: 团队成员列表 (TeamMemberInfo[])
        report_data: 阶段报告数据 (PhaseReportData)

    Returns:
        需要合并到已有 collected_data 中的增量数据
    """
    collected: dict[str, dict[str, Any]] = {}
    phases = phases or []
    team_members = team_members or []
    report_data = report_data or {}

    if not phases and not team_members and not report_data:
        return collected

    # ─── implementation_roadmap (阶段 + 时间线) ───
    if phases:
        phases_text = "; ".join(
            f"{p.get('phase_name', '')}: {p.get('goals', '')}"
            for p in phases if p.get("phase_name")
        )
        total_weeks = sum(p.get("duration_weeks", 0) or 0 for p in phases)
        completed_count = sum(1 for p in phases if p.get("status") == "completed")
        completed_phases = [p for p in phases if p.get("status") == "completed"]

        collected["implementation_roadmap"] = {
            "phases": phases_text,
            "timeline": f"共{len(phases)}个阶段，预计{total_weeks}周，已完成{completed_count}个阶段",
        }

        # ─── strategic_recommendations (目标 + 交付物) ───
        all_goals = [p.get("goals", "") for p in phases if p.get("goals")]
        all_deliverables: list[str] = []
        for p in completed_phases:
            deliverables = p.get("deliverables", [])
            if isinstance(deliverables, list):
                all_deliverables.extend(deliverables)

        collected["strategic_recommendations"] = {
            "strategic_priorities": "; ".join(g for g in all_goals if g),
            "expected_outcomes": "; ".join(all_deliverables[:10]) if all_deliverables else "",
        }

    # ─── organizational_structure + talent_assessment (团队信息) ───
    if team_members:
        role_counts: dict[str, int] = {}
        for m in team_members:
            role = m.get("role", "member")
            role_counts[role] = role_counts.get(role, 0) + 1

        external_count = sum(1 for m in team_members if m.get("is_external"))

        # 启发式推断组织类型
        lead_count = role_counts.get("lead", 0) + role_counts.get("项目负责人", 0)
        member_count = sum(v for k, v in role_counts.items() if k not in ("lead", "项目负责人"))
        if lead_count > 1:
            org_type_hint = "矩阵制"
        elif member_count > 5:
            org_type_hint = "事业部制"
        else:
            org_type_hint = "职能制"

        collected.setdefault("organizational_structure", {})
        collected["organizational_structure"].update({
            "org_type": org_type_hint,
            "team_composition": f"共{len(team_members)}人（外部{external_count}人）",
        })

        collected.setdefault("talent_assessment", {})
        specializations = [m.get("specialization", "") for m in team_members if m.get("specialization")]
        collected["talent_assessment"].update({
            "key_positions": str(len(team_members)),
            "team_specializations": "; ".join(specializations[:8]) if specializations else "",
        })

    # ─── SWOT (报告数据增强) ───
    if report_data:
        storyline = report_data.get("storyline", "")
        evidence = report_data.get("evidence", [])
        arguments = report_data.get("arguments", [])

        if storyline:
            collected.setdefault("SWOT", {})
            existing = collected["SWOT"].get("strengths", "")
            collected["SWOT"]["strengths"] = f"{existing}; {storyline}" if existing else storyline

        if evidence and isinstance(evidence, list):
            collected.setdefault("SWOT", {})
            existing = collected["SWOT"].get("opportunities", "")
            collected["SWOT"]["opportunities"] = (
                f"{existing}; {'; '.join(evidence[:5])}" if existing else "; ".join(evidence[:5])
            )

        if arguments and isinstance(arguments, list):
            collected.setdefault("strategic_recommendations", {})
            existing = collected["strategic_recommendations"].get("strategic_priorities", "")
            collected["strategic_recommendations"]["strategic_priorities"] = (
                f"{existing}; {'; '.join(arguments[:5])}" if existing else "; ".join(arguments[:5])
            )

    return collected
