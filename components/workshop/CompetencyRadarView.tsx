'use client';

import { useState, useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { CompetencyTerm, ModelType, CompetencyOutput } from '@/lib/workshop/competency-types';

interface CompetencyRadarViewProps {
  competencies: CompetencyTerm[];
  meta?: CompetencyOutput['meta'];
  confirmedTerms: Record<ModelType, string[]>;
  onConfirmedTermsChange: (terms: Record<ModelType, string[]>) => void;
}

const COLORS = {
  seed: { stroke: '#3b82f6', fill: '#3b82f6', pill: 'bg-blue-100 text-blue-800 border-blue-300' },
  discovered: { stroke: '#10b981', fill: '#10b981', pill: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

const MODEL_CONFIG: Record<ModelType, { label: string; color: string; radarStroke: string; radarFill: string }> = {
  delivery_management: {
    label: '交付管理',
    color: '#6366f1',
    radarStroke: '#6366f1',
    radarFill: '#6366f1',
  },
  business_management: {
    label: '项目/业务管理',
    color: '#f59e0b',
    radarStroke: '#f59e0b',
    radarFill: '#f59e0b',
  },
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CompetencyTerm }> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const originLabel = data.origin === 'seed' ? '种子项' : '新发现';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-gray-900 text-sm">{data.term}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          data.origin === 'seed' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {originLabel}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-1">
        证据强度: <span className="font-medium text-gray-900">{(data.score * 100).toFixed(0)}%</span>
      </div>
      {data.description && (
        <div className="text-xs text-gray-600 mt-1 leading-relaxed">{data.description}</div>
      )}
      {data.sources?.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="text-xs text-gray-500 mb-1">来源:</div>
          <ul className="space-y-0.5">
            {data.sources.map((s: string, i: number) => (
              <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 单个模型的雷达图 + 胶囊 + 确认区 */
function ModelRadarSection({
  modelId,
  modelLabel,
  modelColor,
  items,
  confirmedTerms,
  onConfirmedTermsChange,
}: {
  modelId: ModelType;
  modelLabel: string;
  modelColor: string;
  items: CompetencyTerm[];
  confirmedTerms: string[];
  onConfirmedTermsChange: (terms: string[]) => void;
}) {
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  const sorted = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);
  const seedCount = sorted.filter((c) => c.origin === 'seed').length;
  const radarItems = sorted.slice(0, seedCount);
  const pillItems = sorted.slice(seedCount);

  const radarData = radarItems.map((item) => ({
    term: item.term,
    score: item.score,
    origin: item.origin,
    sources: item.sources,
    description: item.description,
    fullMark: 1,
  }));

  const hoveredCompetency = hoveredTerm
    ? items.find((c) => c.term === hoveredTerm) || null
    : null;

  return (
    <div className="space-y-4">
      {/* Model header */}
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: modelColor }} />
        <h3 className="text-lg font-bold text-gray-900">{modelLabel}</h3>
        <span className="text-xs text-gray-400">
          {radarItems.length} 雷达 + {pillItems.length} 备选
        </span>
      </div>

      {/* Radar + Source Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="term"
                  tick={{ fontSize: 13, fill: '#374151' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickCount={5}
                />
                <Radar
                  name="重要性"
                  dataKey="score"
                  stroke={modelColor}
                  fill={modelColor}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const payload = props?.payload as CompetencyTerm | undefined;
                    const color = payload?.origin === 'seed' ? '#3b82f6' : payload?.origin === 'discovered' ? '#10b981' : '#6b7280';
                    return <circle cx={props.cx} cy={props.cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Panel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-500 mb-3">溯源信息</h4>
          {hoveredCompetency ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">{hoveredCompetency.term}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  hoveredCompetency.origin === 'seed' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {hoveredCompetency.origin === 'seed' ? '种子' : '新发现'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                证据强度: <span className="font-semibold">{(hoveredCompetency.score * 100).toFixed(0)}%</span>
              </div>
              {hoveredCompetency.description && (
                <div className="text-sm text-gray-600 mt-2 leading-relaxed">{hoveredCompetency.description}</div>
              )}
              <ul className="space-y-1 mt-2">
                {hoveredCompetency.sources.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: modelColor }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">
              悬停查看溯源
            </p>
          )}
        </div>
      </div>

      {/* Pill Cloud */}
      {pillItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">备选池 ({pillItems.length} 项)</h4>
          <div className="flex flex-wrap gap-2">
            {pillItems.map((item) => (
              <div
                key={item.id}
                className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-all hover:shadow-md ${COLORS[item.origin].pill}`}
                onMouseEnter={() => setHoveredTerm(item.term)}
                onMouseLeave={() => setHoveredTerm(null)}
              >
                {item.term}
                <span className="ml-1.5 text-xs opacity-60">{(item.score * 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Area */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">
          专家确认区 <span className="font-normal text-gray-400">(每行一个能力项)</span>
        </h4>
        <textarea
          value={confirmedTerms.join('\n')}
          onChange={(e) => onConfirmedTermsChange(e.target.value.split('\n').filter(Boolean))}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          rows={4}
          placeholder="技术架构能力&#10;全栈实现能力&#10;..."
        />
        <div className="mt-1 text-xs text-gray-400">已确认 {confirmedTerms.length} 项</div>
      </div>
    </div>
  );
}

export default function CompetencyRadarView({
  competencies,
  confirmedTerms,
  onConfirmedTermsChange,
}: CompetencyRadarViewProps) {
  const [activeModel, setActiveModel] = useState<ModelType>('delivery_management');

  const modelGroups = useMemo(() => {
    const groups: Record<string, CompetencyTerm[]> = {};
    for (const c of competencies) {
      const m = c.model || 'delivery_management';
      if (!groups[m]) groups[m] = [];
      groups[m].push(c);
    }
    return groups;
  }, [competencies]);

  const models = Object.keys(modelGroups).sort() as ModelType[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">一级能力项研讨</h2>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            种子项 (已有模型)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            新发现项 (AI 补充)
          </span>
        </div>
      </div>

      {/* Model Toggle */}
      <div className="flex gap-2">
        {models.map((modelId) => {
          const cfg = MODEL_CONFIG[modelId] || MODEL_CONFIG.delivery_management;
          const items = modelGroups[modelId] || [];
          return (
            <button
              key={modelId}
              onClick={() => setActiveModel(modelId)}
              className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                activeModel === modelId
                  ? 'border-gray-900 bg-gray-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="font-bold text-gray-900">{cfg.label}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {items.length} 个能力项
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Model Radar */}
      {models.map((modelId) => {
        if (modelId !== activeModel) return null;
        const cfg = MODEL_CONFIG[modelId] || MODEL_CONFIG.delivery_management;
        return (
          <ModelRadarSection
            key={modelId}
            modelId={modelId}
            modelLabel={cfg.label}
            modelColor={cfg.color}
            items={modelGroups[modelId] || []}
            confirmedTerms={confirmedTerms[modelId] || []}
            onConfirmedTermsChange={(terms) =>
              onConfirmedTermsChange({ ...confirmedTerms, [modelId]: terms })
            }
          />
        );
      })}
    </div>
  );
}
