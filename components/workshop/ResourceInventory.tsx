'use client';

import { useState, useMemo } from 'react';
import type { CompetencyTerm, ModelType, LearningResource, ResourceType, BehaviorLevel } from '@/lib/workshop/competency-types';

interface ResourceInventoryProps {
  competencies: CompetencyTerm[];
}

const MODEL_CONFIG: Record<ModelType, { label: string; activeCls: string; countCls: string }> = {
  delivery_management: {
    label: '交付管理',
    activeCls: 'border-indigo-500 bg-indigo-50 text-indigo-700',
    countCls: 'bg-indigo-100 text-indigo-600',
  },
  business_management: {
    label: '项目/业务管理',
    activeCls: 'border-amber-500 bg-amber-50 text-amber-700',
    countCls: 'bg-amber-100 text-amber-600',
  },
};

const LEVEL_LABELS: Record<string, string> = {
  '初级': '在他人指导下工作',
  '中级': '独立工作',
  '高级': '赋能他人',
};

const RESOURCE_TYPE_CONFIG: Record<ResourceType, { icon: string; bg: string; text: string }> = {
  '书籍': { icon: '📕', bg: 'bg-blue-50', text: 'text-blue-700' },
  '视频': { icon: '🎬', bg: 'bg-rose-50', text: 'text-rose-700' },
  '在线课程': { icon: '💻', bg: 'bg-violet-50', text: 'text-violet-700' },
  '案例库': { icon: '📁', bg: 'bg-amber-50', text: 'text-amber-700' },
  '工具': { icon: '🔧', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  '模板': { icon: '📋', bg: 'bg-sky-50', text: 'text-sky-700' },
};

const LEVEL_COLORS: Record<BehaviorLevel, string> = {
  '初级': 'bg-sky-50 text-sky-600',
  '中级': 'bg-amber-50 text-amber-600',
  '高级': 'bg-purple-50 text-purple-600',
};

export default function ResourceInventory({ competencies }: ResourceInventoryProps) {
  const [activeModel, setActiveModel] = useState<ModelType>('delivery_management');
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Filter by model
  const modelComps = useMemo(() => {
    return competencies
      .filter((c) => c.model === activeModel)
      .sort((a, b) => b.score - a.score);
  }, [competencies, activeModel]);

  const selectedComp = useMemo(
    () => competencies.find((c) => c.term === selectedL1) || null,
    [competencies, selectedL1],
  );

  const selectedResources = useMemo(() => {
    if (!selectedComp?.resources?.length) return [];
    return selectedComp.resources;
  }, [selectedComp]);

  // Count all resources for this model
  const totalResources = useMemo(() => {
    return modelComps.reduce((s, c) => s + (c.resources?.length || 0), 0);
  }, [modelComps]);

  const totalL1 = modelComps.length;
  const totalL2 = modelComps.reduce((s, c) => s + c.secondary_terms.length, 0);

  const toggleL1 = (id: string) => {
    setExpandedL1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header + Model Switch */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">学习资源盘点</h2>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">
            {totalL1} 一级 · {totalL2} 二级 · {totalResources} 资源
          </div>
          <div className="flex gap-2">
            {(Object.keys(MODEL_CONFIG) as ModelType[]).map((model) => {
              const cfg = MODEL_CONFIG[model];
              const count = competencies.filter((c) => c.model === model).length;
              return (
                <button
                  key={model}
                  onClick={() => { setActiveModel(model); setSelectedL1(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    activeModel === model
                      ? cfg.activeCls
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {cfg.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-semibold ${cfg.countCls}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Competency Tree with resource indicators */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">能力模型</h3>
          </div>
          <div className="overflow-y-auto max-h-[520px]">
            {modelComps.map((comp) => {
              const isExpanded = expandedL1.has(comp.id);
              const resCount = comp.resources?.length || 0;
              return (
                <div key={comp.id} className="border-b border-gray-100">
                  {/* L1 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      toggleL1(comp.id);
                      setSelectedL1(comp.term);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && toggleL1(comp.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
                      selectedL1 === comp.term ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-gray-400 transition-transform text-xs ${isExpanded ? 'rotate-90' : ''}`}>
                      ▸
                    </span>
                    <span className="text-sm font-medium text-gray-900">{comp.term}</span>
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${
                      comp.origin === 'seed'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {comp.origin === 'seed' ? '种子' : '新'}
                    </span>
                    {resCount > 0 && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">
                        {resCount} 资源
                      </span>
                    )}
                  </div>

                  {/* L2 + Behaviors */}
                  {isExpanded && (
                    <div className="ml-6 border-l-2 border-gray-100 pl-3 pb-2">
                      {comp.secondary_terms.map((sec) => (
                        <div key={sec.id} className="mt-1.5">
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-400 mr-1">·</span>
                            {sec.term}
                            <span className="text-xs text-gray-400 ml-1">
                              ({sec.behaviors.length})
                            </span>
                          </div>
                          {sec.behaviors.length > 0 && (
                            <div className="ml-4 mt-0.5 space-y-0.5">
                              {sec.behaviors.map((b) => (
                                <div key={b.id} className="text-xs text-gray-500 flex items-start gap-1">
                                  <span className="text-gray-300">-</span>
                                  <span>
                                    [{b.level} · {LEVEL_LABELS[b.level] || b.level}] {b.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Resource List for selected competency */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              学习资源
              {selectedComp && (
                <span className="font-normal text-gray-400 ml-2">— {selectedComp.term}</span>
              )}
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[520px] p-4">
            {!selectedComp ? (
              <div className="text-sm text-gray-400 text-center py-12">
                <div className="text-3xl mb-2">📚</div>
                <p>请在左侧选择一个能力项</p>
                <p className="text-xs mt-1">查看 AI 推荐的学习资源</p>
              </div>
            ) : selectedResources.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-12">
                <div className="text-3xl mb-2">📭</div>
                <p>暂无资源</p>
                <p className="text-xs mt-1">运行 generate_resources.py 生成</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedResources.map((res, i) => {
                  const typeCfg = RESOURCE_TYPE_CONFIG[res.type as ResourceType] || RESOURCE_TYPE_CONFIG['书籍'];
                  const levelCls = LEVEL_COLORS[res.target_level as BehaviorLevel] || '';
                  return (
                    <div key={i} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{typeCfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{res.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeCfg.bg} ${typeCfg.text}`}>
                              {res.type}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${levelCls}`}>
                              {res.target_level}
                            </span>
                          </div>
                          {res.rationale && (
                            <p className="text-xs text-gray-500 mt-1">{res.rationale}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          备注 <span className="font-normal text-gray-400">(资源匹配差距、待补充项等)</span>
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={4}
          placeholder="记录资源匹配差距、待补充的学习资源等..."
        />
      </div>
    </div>
  );
}
