'use client';

/**
 * Tab 4: 考核表单模板
 *
 * 基于岗位绩效 AI 生成考核表单模板 + 评分模型。
 * 展示已生成的模板列表。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listPositionPerformances,
  listTemplates,
  generateReviewTemplate,
} from '@/lib/api/performance-api';
import type { PerformancePlan, ReviewTemplate, PositionPerformance } from '@/types/performance';
import { Sparkles, FileText, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

export default function ReviewTemplateTab({ projectId, activePlan, onRefresh }: Props) {
  const [positions, setPositions] = useState<PositionPerformance[]>([]);
  const [selectedPos, setSelectedPos] = useState<string>('');
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!activePlan) return;
    const res = await listPositionPerformances(activePlan._key);
    if (res.success && res.data) {
      setPositions(Array.isArray(res.data) ? res.data : []);
    }
  }, [activePlan]);

  const fetchTemplates = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const res = await listTemplates(activePlan._key);
      if (res.success && res.data) {
        setTemplates(Array.isArray(res.data) ? res.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleGenerate = async () => {
    if (!selectedPos) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateReviewTemplate({ pos_perf_id: selectedPos });
      if (res.success) {
        await fetchTemplates();
        await onRefresh();
      } else {
        setError(res.error || '生成失败');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">选择岗位绩效</label>
          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">选择要生成考核表单的岗位...</option>
            {positions.map((pos) => (
              <option key={pos._key} value={pos._key}>
                {pos.properties.job_role_ref}
                {pos.properties.is_leader ? ' (管理岗)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedPos || generating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          {generating ? 'AI 生成中...' : 'AI 生成考核表单'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>尚未生成考核表单模板</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const p = tpl.properties;
            const isExpanded = expandedKey === tpl._key;

            return (
              <div key={tpl._key} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedKey(isExpanded ? null : tpl._key)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{p.template_name}</h4>
                      <p className="text-xs text-gray-500">
                        {p.template_type} · 权重合计 {p.total_weight}%
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{p.status}</span>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {/* Sections */}
                    {p.sections?.map((section, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">{section.section_name}</span>
                          <span className="text-xs text-gray-400">{section.weight}%</span>
                        </div>
                        {section.items?.map((item, j) => (
                          <div key={j} className="text-xs text-gray-600 ml-3 py-0.5">
                            {item.name}
                            {item.weight && <span className="text-gray-400 ml-1">({item.weight}%)</span>}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Reviewer Config */}
                    {p.reviewer_config && (
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(p.reviewer_config)
                          .filter(([, v]) => v)
                          .map(([k]) => (
                            <span key={k} className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded">
                              {k === 'self_review' ? '自评' :
                               k === 'manager_review' ? '上级评' :
                               k === 'peer_review' ? '同事评' :
                               k === 'subordinate_review' ? '下级评' : '外部评'}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
