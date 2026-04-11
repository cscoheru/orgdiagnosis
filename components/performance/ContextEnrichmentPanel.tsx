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
      const res = await bridgeStrategyData(plan._key, plan.properties.project_id);
      if (res.success && res.data && (res.data as Record<string, unknown>).success !== false) {
        await onUpdated();
      } else {
        const payload = res.data as Record<string, string> | undefined;
        const msg = payload?.message || res.error || '导入失败';
        setError(msg);
      }
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
