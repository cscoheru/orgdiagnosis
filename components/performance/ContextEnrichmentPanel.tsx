'use client';

/**
 * Phase 2: 战略上下文富化面板
 *
 * 4 个上下文分区卡片：客户概况 / 业务复盘 / 市场洞察 / 战略方向
 * 每个分区支持文本粘贴 + 从战略解码导入
 * 已填充的分区显示绿色勾号 + 内容摘要
 */

import { useState } from 'react';
import { enrichPlanContext, bridgeStrategyData } from '@/lib/api/performance-api';
import { createObject, getObjectsByModel } from '@/lib/api/kernel-client';
import type { PerformancePlan } from '@/types/performance';
import { FileText, Upload, CheckCircle, Circle, ArrowDownToLine, Save, X } from 'lucide-react';

interface Props {
  plan: PerformancePlan;
  onUpdated: () => Promise<void>;
}

interface ContextSection {
  key: string;
  label: string;
  placeholder: string;
  color: string;
}

const CONTEXT_SECTIONS: ContextSection[] = [
  {
    key: 'client_profile',
    label: '客户概况',
    placeholder: '请输入客户基本信息：企业规模、主营业务、发展阶段、组织架构概览...',
    color: 'bg-blue-50 border-blue-200 focus-within:ring-blue-300',
  },
  {
    key: 'business_review',
    label: '业务复盘',
    placeholder: '请输入上期业绩复盘：营收完成情况、核心指标达成率、关键成功/失败因素...',
    color: 'bg-green-50 border-green-200 focus-within:ring-green-300',
  },
  {
    key: 'market_insights',
    label: '市场洞察',
    placeholder: '请输入市场洞察：行业趋势、竞争格局变化、客户需求演变、SWOT 分析...',
    color: 'bg-amber-50 border-amber-200 focus-within:ring-amber-300',
  },
  {
    key: 'strategic_direction',
    label: '战略方向',
    placeholder: '请输入战略方向：年度战略重点、战略举措、BSC 战略地图、行动计划...',
    color: 'bg-purple-50 border-purple-200 focus-within:ring-purple-300',
  },
];

export default function ContextEnrichmentPanel({ plan, onUpdated }: Props) {
  const ctx = (plan.properties.business_context as Record<string, string>) || {};
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (section: ContextSection) => {
    setEditingKey(section.key);
    setEditContent(ctx[section.key] || '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditContent('');
    setError(null);
  };

  const saveSection = async (sectionKey: string) => {
    if (!editContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await enrichPlanContext(plan._key, sectionKey, editContent.trim());
      if (res.success) {
        setEditingKey(null);
        setEditContent('');
        await onUpdated();
      } else {
        setError(res.error || '保存失败');
      }
    } finally { setSaving(false); }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const projectId = plan.properties.project_id;
      const lsKey = `strategy_data_${projectId}`;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(lsKey) : null;

      if (raw) {
        // 从 localStorage 读取战略解码数据并映射到 4 个上下文分区
        const data = JSON.parse(raw);
        const mappings: Record<string, string> = {};

        // step1 → business_review
        if (data.step1) {
          const parts: string[] = [];
          if (data.step1.goals) parts.push(`去年目标:\n${data.step1.goals}`);
          if (data.step1.actuals) parts.push(`实际完成:\n${data.step1.actuals}`);
          if (data.step1.summary) parts.push(`复盘总结:\n${data.step1.summary}`);
          if (data.step1.rootCause) parts.push(`核心短板:\n${data.step1.rootCause}`);
          if (data.step1.dimensions?.length > 0) {
            const dimLines = data.step1.dimensions
              .filter((d: any) => d.isHighlighted)
              .map((d: any) => `- ${d.name} (${d.score}%): ${d.reason}`);
            if (dimLines.length) parts.push(`3力3平台归因:\n${dimLines.join('\n')}`);
          }
          if (parts.length) mappings['business_review'] = parts.join('\n\n');
        }

        // step2 → market_insights + strategic_direction
        if (data.step2) {
          const parts: string[] = [];
          if (data.step2.swot) {
            parts.push(`SWOT分析:\n- 优势: ${data.step2.swot.strengths?.join('、')}\n- 劣势: ${data.step2.weaknesses?.join('、')}\n- 机会: ${data.step2.swot.opportunities?.join('、')}\n- 威胁: ${data.step2.threats?.join('、')}`);
          }
          if (data.step2.ksfDimensions?.length) {
            parts.push(`关键成功要素(KSF):\n${data.step2.ksfDimensions.map((k: any) => `- ${k.name}: ${k.reasoning}`).join('\n')}`);
          }
          if (data.step2.benchmarkScores?.length) {
            parts.push(`竞争力对标:\n${data.step2.benchmarkScores.map((b: any) => `- ${b.dimensionName}: 我方${b.myScore} vs 竞对${b.competitorScore}`).join('\n')}`);
          }
          if (data.step2.towsStrategies) {
            const towLines: string[] = [];
            if (data.step2.towsStrategies.so?.length) towLines.push(`SO增长: ${data.step2.towsStrategies.so.join('；')}`);
            if (data.step2.towsStrategies.wo?.length) towLines.push(`WO转型: ${data.step2.towsStrategies.wo.join('；')}`);
            if (data.step2.towsStrategies.st?.length) towLines.push(`ST多元化: ${data.step2.towsStrategies.st.join('；')}`);
            if (data.step2.towsStrategies.wt?.length) towLines.push(`WT防御: ${data.step2.towsStrategies.wt.join('；')}`);
            if (towLines.length) parts.push(`TOWS交叉策略:\n${towLines.join('\n')}`);
          }
          if (data.step2.strategicDirection) parts.push(`战略方向: ${data.step2.strategicDirection}`);
          if (data.step2.productCustomerMatrix) {
            const m = data.step2.productCustomerMatrix;
            const ansoffLines: string[] = [];
            if (m.marketPenetration?.length) ansoffLines.push(`市场渗透: ${m.marketPenetration.join('、')}`);
            if (m.productDevelopment?.length) ansoffLines.push(`产品开发: ${m.productDevelopment.join('、')}`);
            if (m.marketDevelopment?.length) ansoffLines.push(`市场开发: ${m.marketDevelopment.join('、')}`);
            if (m.diversification?.length) ansoffLines.push(`多元化: ${m.diversification.join('、')}`);
            if (ansoffLines.length) parts.push(`安索夫矩阵:\n${ansoffLines.join('\n')}`);
          }
          if (parts.length) mappings['market_insights'] = parts.join('\n\n');
        }

        // step3 → targets (附加到 strategic_direction)
        if (data.step3) {
          const parts: string[] = [];
          if (data.step3.calculatedTargets) {
            const { base, standard, challenge } = data.step3.calculatedTargets;
            parts.push(`年度目标:\n- 保底: ${base.toLocaleString()}万\n- 达标: ${standard.toLocaleString()}万\n- 挑战: ${challenge.toLocaleString()}万`);
            if (data.step3.confidenceIndex) parts.push(`信心指数: ${data.step3.confidenceIndex}%`);
          }
          if (data.step3.targets?.length) {
            parts.push(`目标明细:\n${data.step3.targets.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')}`);
          }
          if (parts.length) {
            const existing = mappings['strategic_direction'] || '';
            mappings['strategic_direction'] = existing ? `${existing}\n\n${parts.join('\n')}` : parts.join('\n');
          }
        }

        // step4 → strategic_direction (行动计划)
        if (data.step4) {
          const parts: string[] = [];
          if (data.step4.actionPlanTable?.length) {
            parts.push('3力3平台行动计划表:');
            data.step4.actionPlanTable.forEach((row: any) => {
              parts.push(`- ${row.customerGroup}/${row.product}: 营收${row.revenueTarget}, 销售:${row.salesForce}, 产品:${row.productForce}, 交付:${row.deliveryForce}`);
            });
          }
          if (data.step4.strategyMap && typeof data.step4.strategyMap === 'object') {
            const sm = data.step4.strategyMap as any;
            if (sm.theme) parts.push(`战略主题: ${sm.theme} — ${sm.themeDescription || ''}`);
          }
          if (parts.length) {
            const existing = mappings['strategic_direction'] || '';
            mappings['strategic_direction'] = existing ? `${existing}\n\n${parts.join('\n')}` : parts.join('\n');
          }
        }

        if (Object.keys(mappings).length === 0) {
          setError('战略解码数据为空，请先完成战略解码流程');
          return;
        }

        // 逐个保存到后端
        const sectionKeys = ['business_review', 'market_insights', 'strategic_direction'];
        for (const sk of sectionKeys) {
          if (mappings[sk]) {
            await enrichPlanContext(plan._key, sk, mappings[sk]);
          }
        }

        // 保存 actionPlanTable JSON 到 business_context.action_plans
        if (data.step4?.actionPlanTable?.length) {
          await enrichPlanContext(plan._key, 'action_plans', JSON.stringify(data.step4.actionPlanTable));
        }

        // 创建 Strategic_Goal 对象（避免重复导入）
        const existingGoals = await getObjectsByModel('Strategic_Goal', 100);
        const existingNames = new Set(
          (Array.isArray(existingGoals.data) ? existingGoals.data : [])
            .map((g: any) => g.properties?.goal_name)
        );

        const goalPromises: Promise<any>[] = [];

        // 从三档目标创建战略目标
        if (data.step3?.calculatedTargets) {
          const { base, standard, challenge } = data.step3.calculatedTargets;
          const growth = standard - base;

          const goalDefs = [
            { name: `总营收目标（达标）`, value: `${standard.toLocaleString()}万`, priority: 'P0', type: 'revenue_target' },
            { name: `保底营收目标`, value: `${base.toLocaleString()}万`, priority: 'P1', type: 'revenue_target' },
            { name: `挑战营收目标`, value: `${challenge.toLocaleString()}万`, priority: 'P1', type: 'revenue_target' },
          ];
          if (growth > 0) {
            goalDefs.push({ name: `增量营收（新客户/新产品）`, value: `${growth.toLocaleString()}万`, priority: 'P1', type: 'revenue_target' });
          }

          for (const gd of goalDefs) {
            if (!existingNames.has(gd.name)) {
              goalPromises.push(
                createObject('Strategic_Goal', {
                  goal_name: gd.name,
                  target_value: gd.value,
                  priority: gd.priority,
                  goal_type: gd.type,
                  period: '年度',
                  period_type: 'annual',
                  status: '进行中',
                  progress: 0,
                  project_id: plan.properties.project_id,
                  plan_ref: plan._key,
                })
              );
            }
          }
        }

        // 从行动计划表创建每行战略目标
        if (data.step4?.actionPlanTable?.length) {
          for (const row of data.step4.actionPlanTable) {
            const goalName = `${row.customerGroup} - ${row.product} 营收目标`;
            if (!existingNames.has(goalName)) {
              goalPromises.push(
                createObject('Strategic_Goal', {
                  goal_name: goalName,
                  target_value: `${row.revenueTarget}万`,
                  priority: 'P2',
                  goal_type: 'revenue_target',
                  period: '年度',
                  period_type: 'annual',
                  status: '进行中',
                  progress: 0,
                  description: `销售力: ${row.salesForce}; 产品力: ${row.productForce}; 交付力: ${row.deliveryForce}; 人力: ${row.hr}; 财务: ${row.financeAssets}; 数字化: ${row.digitalProcess}`,
                  project_id: plan.properties.project_id,
                  plan_ref: plan._key,
                })
              );
            }
          }
        }

        // 并发创建所有目标
        if (goalPromises.length > 0) {
          await Promise.allSettled(goalPromises);
        }

        await onUpdated();
      } else {
        // localStorage 无数据，尝试后端 API（兼容旧数据）
        const res = await bridgeStrategyData(plan._key, plan.properties.project_id);
        if (res.success && res.data && (res.data as Record<string, unknown>).success !== false) {
          await onUpdated();
        } else {
          const payload = res.data as Record<string, string> | undefined;
          const msg = payload?.message || res.error || '导入失败';
          setError(msg);
        }
      }
    } catch (e: any) {
      setError(e.message || '导入失败');
    } finally { setImporting(false); }
  };

  const filledCount = CONTEXT_SECTIONS.filter(s => ctx[s.key]).length;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">战略上下文</span>
          <span className="text-xs text-gray-400">{filledCount}/{CONTEXT_SECTIONS.length} 已填充</span>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          <ArrowDownToLine size={12} />
          {importing ? '导入中...' : '从战略解码导入'}
        </button>
      </div>

      {error && <p className="px-5 py-2 text-xs text-red-600 bg-red-50">{error}</p>}

      {/* Context Sections Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {CONTEXT_SECTIONS.map((section) => {
          const filled = !!ctx[section.key];
          const editing = editingKey === section.key;

          return (
            <div key={section.key} className={`rounded-lg border p-3 ${section.color} transition-all ${editing ? 'ring-2' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {filled ? (
                    <CheckCircle size={13} className="text-green-500" />
                  ) : (
                    <Circle size={13} className="text-gray-300" />
                  )}
                  <span className="text-xs font-semibold text-gray-700">{section.label}</span>
                </div>
                {!editing && (
                  <button
                    onClick={() => startEdit(section)}
                    className="text-[10px] text-indigo-500 hover:text-indigo-700"
                  >
                    {filled ? '编辑' : '填写'}
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder={section.placeholder}
                    className="w-full h-24 text-xs bg-white border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-gray-400"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X size={10} /> 取消
                    </button>
                    <button
                      onClick={() => saveSection(section.key)}
                      disabled={saving || !editContent.trim()}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Save size={10} /> {saving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              ) : filled ? (
                <p className="text-[11px] text-gray-600 line-clamp-3 leading-relaxed">
                  {typeof ctx[section.key] === 'string'
                    ? ctx[section.key].slice(0, 200) + (ctx[section.key].length > 200 ? '...' : '')
                    : JSON.stringify(ctx[section.key]).slice(0, 200) + '...'}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 italic">暂未填写</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
