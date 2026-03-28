'use client';

import { useState } from 'react';
import type { CompetencyTerm } from '@/lib/workshop/competency-types';

interface ResourceInventoryProps {
  competencies: CompetencyTerm[];
}

export default function ResourceInventory({ competencies }: ResourceInventoryProps) {
  const [resources, setResources] = useState<string[]>([
    '《项目管理实战》课程',
    '案例库: 华为战略解码实践',
    '《BLM业务领先模型》视频',
    'IBM咨询方法论手册',
  ]);
  const [newResource, setNewResource] = useState('');
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const toggleL1 = (id: string) => {
    setExpandedL1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addResource = () => {
    if (newResource.trim()) {
      setResources([...resources, newResource.trim()]);
      setNewResource('');
    }
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const totalL1 = competencies.length;
  const totalL2 = competencies.reduce((s, c) => s + c.secondary_terms.length, 0);
  const totalBehaviors = competencies.reduce(
    (s, c) => s + c.secondary_terms.reduce((s2, sec) => s2 + sec.behaviors.length, 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">学习资源盘点</h2>
        <div className="text-xs text-gray-400">
          {totalL1} 一级 · {totalL2} 二级 · {totalBehaviors} 行为 · {resources.length} 资源
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Competency Tree */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">能力模型 (完整)</h3>
          </div>
          <div className="overflow-y-auto max-h-[520px]">
            {competencies.map((comp) => {
              const isExpanded = expandedL1.has(comp.id);
              return (
                <div key={comp.id} className="border-b border-gray-100">
                  {/* L1 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleL1(comp.id)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleL1(comp.id)}
                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
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
                    <span className="ml-auto text-xs text-gray-400">
                      {comp.secondary_terms.length}
                    </span>
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
                          {/* Behaviors (compact) */}
                          {sec.behaviors.length > 0 && (
                            <div className="ml-4 mt-0.5 space-y-0.5">
                              {sec.behaviors.map((b) => (
                                <div key={b.id} className="text-xs text-gray-500 flex items-start gap-1">
                                  <span className="text-gray-300">-</span>
                                  <span>
                                    [{b.level}] {b.description}
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

        {/* Right: Resource List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">学习资源清单</h3>
          </div>
          <div className="p-4 space-y-3">
            {/* Resource items */}
            <div className="space-y-2">
              {resources.map((res, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="w-5 h-5 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">{res}</span>
                  <button
                    onClick={() => removeResource(i)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {resources.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无资源</p>
              )}
            </div>

            {/* Add resource */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                value={newResource}
                onChange={(e) => setNewResource(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addResource()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="输入资源名称后回车"
              />
              <button
                onClick={addResource}
                className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
              >
                添加
              </button>
            </div>
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
