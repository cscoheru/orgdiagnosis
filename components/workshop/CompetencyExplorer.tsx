'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CompetencyTerm, SecondaryTerm, Behavior, BehaviorLevel, ModelType } from '@/lib/workshop/competency-types';
import { Sparkles, Loader2, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ── AI 响应类型 ──────────────────────────────────────────────

interface AIResponse {
  code?: string;
  term: string;
  model: string;
  secondary_terms: {
    code?: string;
    term: string;
    description?: string;
    behaviors: { level: string; description: string }[];
  }[];
}

interface DataVersion {
  id: string;
  name: string;
  prompt: string;
  data: CompetencyTerm[];
}

// ── 默认校准 prompt ──────────────────────────────────────────

const DEFAULT_PROMPT =
  '请对当前能力模型进行全面分析和优化。\n' +
  '重点：\n' +
  '1. 将 DM 所有 L3 从任务描述改为能力描述\n' +
  '2. 优化所有 L2 命名为能力导向\n' +
  '3. 确保 DM-26 质量与运行保障 有完整的 L2+L3\n' +
  '4. 检查整体结构完整性';

// ── Props ────────────────────────────────────────────────────

interface CompetencyExplorerProps {
  competencies: CompetencyTerm[];
  confirmedL1Terms: Record<ModelType, string[]>;
}

// ── 常量 ─────────────────────────────────────────────────────

const LEVEL_STYLES: Record<BehaviorLevel, { bg: string; text: string; label: string }> = {
  '初级': { bg: 'bg-sky-50', text: 'text-sky-700', label: '初级 · 在他人指导下工作' },
  '中级': { bg: 'bg-amber-50', text: 'text-amber-700', label: '中级 · 独立工作' },
  '高级': { bg: 'bg-purple-50', text: 'text-purple-700', label: '高级 · 赋能他人' },
};

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

// ── 组件 ─────────────────────────────────────────────────────

export default function CompetencyExplorer({
  competencies,
  confirmedL1Terms,
}: CompetencyExplorerProps) {
  // 原有状态
  const [activeModel, setActiveModel] = useState<ModelType>('delivery_management');
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);
  const [l2Notes, setL2Notes] = useState('');
  const [behaviorNotes, setBehaviorNotes] = useState('');

  // AI 版本状态
  const [versions, setVersions] = useState<DataVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);

  // ── AI 结构化分析 ──────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!customPrompt.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/competency/calibrate/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt.trim() }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const transformed: CompetencyTerm[] = json.data.map((item: AIResponse, idx: number) => ({
          id: `ai_${idx}`,
          code: item.code,
          term: item.term,
          score: 0,
          origin: 'discovered' as const,
          model: item.model as ModelType,
          sources: ['AI优化'],
          secondary_terms: (item.secondary_terms || []).map((sec, sIdx) => ({
            id: `ai_sec_${idx}_${sIdx}`,
            code: sec.code,
            term: sec.term,
            description: sec.description,
            behaviors: (sec.behaviors || []).map((b, bIdx) => ({
              id: `ai_b_${idx}_${sIdx}_${bIdx}`,
              description: b.description,
              level: b.level as BehaviorLevel,
            })),
          })),
        }));
        const newVersion: DataVersion = {
          id: `v_${Date.now()}`,
          name: `校准 #${versions.length + 1}`,
          prompt: customPrompt.trim(),
          data: transformed,
        };
        setVersions((prev) => [...prev, newVersion]);
        setActiveVersionId(newVersion.id);
        setShowPromptInput(false);
        setSelectedL1(null);
        setSelectedL2(null);
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [customPrompt, isAnalyzing, versions.length]);

  const deleteVersion = useCallback(
    (id: string) => {
      setVersions((prev) => prev.filter((v) => v.id !== id));
      if (activeVersionId === id) setActiveVersionId(null);
    },
    [activeVersionId],
  );

  // 当前展示的数据源
  const activeVersion = versions.find((v) => v.id === activeVersionId);
  const displayCompetencies = activeVersion ? activeVersion.data : competencies;

  // ── 数据处理 ──────────────────────────────────────────

  const modelComps = useMemo(() => {
    const filtered = displayCompetencies.filter((c) => c.model === activeModel);
    const seeds = filtered.filter((c) => c.origin === 'seed').sort((a, b) => b.score - a.score);
    const discovered = filtered.filter((c) => c.origin === 'discovered').sort((a, b) => b.score - a.score);
    return [...seeds, ...discovered];
  }, [displayCompetencies, activeModel]);

  const selectedComp = useMemo(
    () => displayCompetencies.find((c) => c.term === selectedL1) || null,
    [displayCompetencies, selectedL1],
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

  const switchModel = (model: ModelType) => {
    setActiveModel(model);
    setSelectedL1(null);
    setSelectedL2(null);
  };

  // ── 渲染 ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        {/* Row 1: Title + AI button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">二级能力项与关键行为探索</h2>
          <button
            onClick={() => {
              setShowPromptInput((v) => !v);
              if (!showPromptInput) setCustomPrompt(DEFAULT_PROMPT);
            }}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isAnalyzing ? '分析中...' : 'AI 校准'}
          </button>
        </div>

        {/* Row 2: Version pills + Model switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 items-center">
            {/* 预计算数据 pill */}
            <button
              onClick={() => setActiveVersionId(null)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                !activeVersionId
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200'
                  : 'text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              预计算数据
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                !activeVersionId ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {competencies.length}
              </span>
            </button>

            {/* AI 版本 pills */}
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVersionId(v.id)}
                className={`group px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  activeVersionId === v.id
                    ? 'bg-white text-violet-700 shadow-sm border border-violet-200'
                    : 'text-gray-500 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {v.name}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  activeVersionId === v.id ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {v.data.length}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteVersion(v.id);
                  }}
                  className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <X size={10} />
                </span>
              </button>
            ))}
          </div>

          {/* Model switcher */}
          <div className="flex gap-2">
            {(Object.keys(MODEL_CONFIG) as ModelType[]).map((model) => {
              const cfg = MODEL_CONFIG[model];
              const count = displayCompetencies.filter((c) => c.model === model).length;
              return (
                <button
                  key={model}
                  onClick={() => switchModel(model)}
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

        {/* Row 3: Prompt input (collapsible) */}
        {showPromptInput && (
          <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-700">自定义校准条件</span>
              <button
                onClick={() => setShowPromptInput(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              placeholder="描述你的校准需求，例如：只优化 DM-06 的 L3 行为描述..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPromptInput(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={!customPrompt.trim() || isAnalyzing}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    生成校准
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:h-[520px]">
        {/* Left: L1 List */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              一级能力项
              <span className="font-normal text-gray-400 ml-2">({modelComps.length})</span>
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[280px] md:max-h-[480px]">
            {modelComps.map((comp) => (
              <div
                key={comp.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedL1(comp.term); setSelectedL2(null); }}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedL1(comp.term)}
                title={comp.description}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                  selectedL1 === comp.term
                    ? 'bg-indigo-50 border-l-3 border-l-indigo-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${selectedL1 === comp.term ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {comp.code && <span className="font-mono text-xs opacity-60 mr-1">{comp.code}</span>}
                    {comp.term}
                  </span>
                  <span className="text-xs text-gray-400">
                    {comp.secondary_terms.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    comp.sources?.[0] === 'AI优化'
                      ? 'bg-violet-50 text-violet-600'
                      : comp.origin === 'seed'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {comp.sources?.[0] === 'AI优化' ? 'AI' : comp.origin === 'seed' ? '种子' : '发现'}
                  </span>
                  {comp.score > 0 && (
                    <span className="text-xs text-gray-400 font-mono">
                      {comp.score.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: L2 Terms */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
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
          <div className="overflow-y-auto max-h-[280px] md:max-h-[480px]">
            {!selectedComp ? (
              <div className="flex items-center justify-center h-32 md:h-64 text-sm text-gray-400">
                请在上方选择一个一级能力项
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
                      {sec.code && <span className="font-mono text-xs opacity-60 mr-1">{sec.code}</span>}
                      {sec.term}
                    </span>
                    <span className="text-xs text-gray-400">
                      {sec.behaviors.length} 行为
                    </span>
                  </div>
                  {sec.description && (
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {sec.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Behaviors */}
        <div className="md:col-span-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
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
          <div className="overflow-y-auto max-h-[280px] md:max-h-[480px] p-4 space-y-4">
            {!selectedSec ? (
              <div className="flex items-center justify-center h-32 md:h-64 text-sm text-gray-400">
                请在上方选择一个二级能力项
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
                          {b.code && <span className="font-mono text-xs text-gray-400 flex-shrink-0">{b.code}</span>}
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
