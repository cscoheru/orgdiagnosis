/**
 * 导出工作流数据为 Markdown 文件
 */

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出里程碑计划为 MD */
export function exportPlanToMD(
  planData: { project_goal: string; phases: Array<{ phase_name: string; duration_weeks: number; goals: string; key_activities: string[]; deliverables: string[] }> },
  clientName: string,
) {
  const lines: string[] = [];
  lines.push(`# 项目计划 — ${clientName}`);
  lines.push('');
  lines.push(`## 项目总体目标`);
  lines.push('');
  lines.push(planData.project_goal);
  lines.push('');
  lines.push(`## 阶段规划`);
  lines.push('');

  for (const phase of planData.phases) {
    lines.push(`### ${phase.phase_name} (${phase.duration_weeks} 周)`);
    lines.push('');
    if (phase.goals) {
      lines.push(`**目标**: ${phase.goals}`);
      lines.push('');
    }
    if (phase.key_activities.length > 0) {
      lines.push('**关键活动**:');
      for (const a of phase.key_activities) lines.push(`- ${a}`);
      lines.push('');
    }
    if (phase.deliverables.length > 0) {
      lines.push('**交付物**:');
      for (const d of phase.deliverables) lines.push(`- ${d}`);
      lines.push('');
    }
  }

  downloadMarkdown(lines.join('\n'), `计划-${clientName}.md`);
}

/** 导出 MDS 为 MD */
export function exportMDSToMD(
  mdsData: { title: string; project_goal: string; key_message: string; phases: Array<{ phase_name: string; duration_weeks: number }>; rows: Array<{ type: string; cells: string[] }>; expected_outcomes: string[] },
) {
  const lines: string[] = [];
  lines.push(`# ${mdsData.title}`);
  lines.push('');
  lines.push(`## 项目目标`);
  lines.push('');
  lines.push(mdsData.project_goal);
  lines.push('');
  lines.push(`## 核心信息`);
  lines.push('');
  lines.push(mdsData.key_message);
  lines.push('');

  // Build table: rows = activities + deliverables, columns = phases
  if (mdsData.phases.length > 0) {
    const phaseNames = mdsData.phases.map(p => p.phase_name);
    lines.push(`| 类型 | ${phaseNames.join(' | ')} |`);
    lines.push(`| --- | ${phaseNames.map(() => '---').join(' | ')} |`);

    for (const row of mdsData.rows) {
      const label = row.type === 'activity' ? '活动' : '成果';
      const cells = mdsData.phases.map((_, i) => row.cells[i] || '');
      lines.push(`| ${label} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  if (mdsData.expected_outcomes.length > 0) {
    lines.push(`## 预期成果`);
    lines.push('');
    for (const o of mdsData.expected_outcomes) lines.push(`- ${o}`);
  }

  downloadMarkdown(lines.join('\n'), `MDS-${mdsData.title.replace(/\s+/g, '_')}.md`);
}

/** 导出详细大纲为 MD */
export function exportOutlineToMD(
  outlineData: { sections: Array<{ section_name: string; activities: Array<{ activity_name: string; slides: Array<{ slide_index: number; title: string; slide_type: string; storyline: string; arguments: string[]; evidence: string[]; supporting_materials: string[] }> }> }> },
) {
  const typeLabels: Record<string, string> = { content: '内容', methodology: '方法论', case: '案例' };

  const lines: string[] = [];
  lines.push('# 项目建议书大纲');
  lines.push('');

  for (const section of outlineData.sections) {
    lines.push(`## ${section.section_name}`);
    lines.push('');

    for (const activity of section.activities) {
      lines.push(`### ${activity.activity_name}`);
      lines.push('');

      for (const slide of activity.slides) {
        const typeLabel = typeLabels[slide.slide_type] || slide.slide_type;
        lines.push(`#### ${slide.slide_index}. ${slide.title} [${typeLabel}]`);
        lines.push('');
        if (slide.storyline) {
          lines.push(`**核心观点**: ${slide.storyline}`);
          lines.push('');
        }
        if (slide.arguments.length > 0) {
          lines.push('**论点**:');
          for (const a of slide.arguments) lines.push(`- ${a}`);
          lines.push('');
        }
        if (slide.evidence.length > 0) {
          lines.push('**论据**:');
          for (const e of slide.evidence) lines.push(`- ${e}`);
          lines.push('');
        }
        if (slide.supporting_materials.length > 0) {
          lines.push('**素材**:');
          for (const m of slide.supporting_materials) lines.push(`- ${m}`);
          lines.push('');
        }
      }
    }
  }

  downloadMarkdown(lines.join('\n'), '详细大纲.md');
}
