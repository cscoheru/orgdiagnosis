'use client';

import { useState, useMemo } from 'react';
import type { CompetencyTerm, SecondaryTerm, Behavior, BehaviorLevel, ModelType } from '@/lib/workshop/competency-types';

interface CompetencyExplorerProps {
  competencies: CompetencyTerm[];
  confirmedL1Terms: Record<ModelType, string[]>;
}

const LEVEL_STYLES: Record<BehaviorLevel, { bg: string; text: string; label: string }> = {
  '初级': { bg: 'bg-sky-50', text: 'text-sky-700', label: '初级 — 执行者' },
  '中级': { bg: 'bg-amber-50', text: 'text-amber-700', label: '中级 — 管理者' },
  '高级': { bg: 'bg-purple-50', text: 'text-purple-700', label: '高级 — 领导者' },
};

export default function CompetencyExplorer({
  competencies,
  confirmedL1Terms,
}: CompetencyExplorerProps) {
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);
  const [l2Notes, setL2Notes] = useState('');
  const [behaviorNotes, setBehaviorNotes] = useState('');

  // Use confirmed terms if available, otherwise top 8 per model
  const l1List = useMemo(() => {
    const allConfirmed = Object.values(confirmedL1Terms).flat();
    if (allConfirmed.length > 0) {
      return allConfirmed
        .map((term) => competencies.find((c) => c.term === term))
        .filter(Boolean) as CompetencyTerm[];
    }
    return [...competencies].sort((a, b) => b.score - a.score).slice(0, 8);
  }, [competencies, confirmedL1Terms]);

  const selectedComp = useMemo(
    () => competencies.find((c) => c.term === selectedL1) || null,
    [competencies, selectedL1],
  );

  const selectedSec = useMemo(
    () => selectedComp?.secondary_terms.find((s) => s.term === selectedL2) || null,
    [selectedComp, selectedL2],
  );

  const behaviorsByLevel = useMemo(() => {
    if (!selectedSec) return {} as Record<BehaviorLevel, Behavior[]>;
    const grouped: Record<string, Behavior[]> = {};
    for (const b of selectedSec.behaviors) {
      const level = b.level || '中级';
      if (!grouped[level]) grouped[level] = [];
      grouped[level].push(b);
    }
    return grouped as Record<BehaviorLevel, Behavior[]>;
  }, [selectedSec]);

  const totalBehaviors = selectedSec?.behaviors.length || 0;
  const totalL2 = selectedComp?.secondary_terms.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-xl font-bold text-gray-900">二级能力项与关键行为探索</h2>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-12 gap-4 h-[520px]">
        {/* Left: L1 List */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">一级能力项</h3>
          </div>
          <div className="overflow-y-auto h-full max-h-[480px]">
            {l1List.map((comp) => (
              <div
                key={comp.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedL1(comp.term); setSelectedL2(null); }}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedL1(comp.term)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                  selectedL1 === comp.term
                    ? 'bg-indigo-50 border-l-3 border-l-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${selectedL1 === comp.term ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {comp.term}
                  </span>
                  <span className="text-xs text-gray-400">
                    {comp.secondary_terms.length}
                  </span>
                </div>
                {comp.origin === 'discovered' && (
                  <span className="text-xs text-emerald-600">新发现</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Middle: L2 Terms */}
        <div className="col-span-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              二级能力项
              {selectedComp && (
                <span className="font-normal text-gray-400 ml-2">
                  — {selectedComp.term} ({totalL2})
                </span>
              )}
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[480px]">
            {!selectedComp ? (
              <div className="flex items-center justify-center h-64 text-sm text-gray-400">
                请在左侧选择一个一级能力项
              </div>
            ) : (
              selectedComp.secondary_terms.map((sec) => (
                <div
                  key={sec.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedL2(sec.term)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedL2(sec.term)}
                  className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                    selectedL2 === sec.term
                      ? 'bg-indigo-50 border-l-3 border-l-indigo-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${selectedL2 === sec.term ? 'font-medium text-indigo-700' : 'text-gray-800'}`}>
                      {sec.term}
                    </span>
                    <span className="text-xs text-gray-400">
                      {sec.behaviors.length} 行为
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Behaviors */}
        <div className="col-span-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              关键行为
              {selectedSec && (
                <span className="font-normal text-gray-400 ml-2">
                  — {selectedL2} ({totalBehaviors})
                </span>
              )}
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[480px] p-4 space-y-4">
            {!selectedSec ? (
              <div className="flex items-center justify-center h-64 text-sm text-gray-400">
                请在中间选择一个二级能力项
              </div>
            ) : (
              (['初级', '中级', '高级'] as BehaviorLevel[]).map((level) => {
                const behaviors = behaviorsByLevel[level];
                if (!behaviors?.length) return null;
                const style = LEVEL_STYLES[level];
                return (
                  <div key={level}>
                    <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold mb-2 ${style.bg} ${style.text}`}>
                      {style.label}
                    </div>
                    <ul className="space-y-2 ml-1">
                      {behaviors.map((b) => (
                        <li key={b.id} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                          {b.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Areas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            确认的二级能力项 <span className="font-normal text-gray-400">{'(每行: 一级项 > 二级项)'}</span>
          </h3>
          <textarea
            value={l2Notes}
            onChange={(e) => setL2Notes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            rows={4}
            placeholder={"战略解码 > 目标拆解\n战略解码 > 资源协同\n..."}
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            确认的关键行为 <span className="font-normal text-gray-400">(自由录入)</span>
          </h3>
          <textarea
            value={behaviorNotes}
            onChange={(e) => setBehaviorNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder={"目标拆解:\n- 能将公司级目标翻译为团队可执行的任务\n- ..."}
          />
        </div>
      </div>
    </div>
  );
}
