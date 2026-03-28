'use client';

import { useState, useEffect } from 'react';
import { fetchCompetencyMaterials, saveFinalModel } from '@/lib/api/competency-api';
import type { CompetencyOutput, ModelType } from '@/lib/workshop/competency-types';
import CompetencyRadarView from '@/components/workshop/CompetencyRadarView';
import CompetencyExplorer from '@/components/workshop/CompetencyExplorer';
import ResourceInventory from '@/components/workshop/ResourceInventory';

type TabId = 'l1' | 'explorer' | 'resources';

const TABS: { id: TabId; name: string }[] = [
  { id: 'l1', name: '一级能力项研讨' },
  { id: 'explorer', name: '二级与行为探索' },
  { id: 'resources', name: '学习资源盘点' },
];

export default function CompetencyWorkshopPage() {
  const [activeTab, setActiveTab] = useState<TabId>('l1');
  const [data, setData] = useState<CompetencyOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmedTerms, setConfirmedTerms] = useState<Record<ModelType, string[]>>({
    delivery_management: [],
    business_management: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const result = await fetchCompetencyMaterials();
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const totalConfirmed = Object.values(confirmedTerms).flat().length;

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      await saveFinalModel({
        confirmed_at: new Date().toISOString(),
        l1_terms: confirmedTerms,
        l2_terms: {},
        behaviors: {},
        resources: [],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">加载预计算数据...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">数据未就绪</h2>
        <p className="text-gray-500 mb-4">
          {error || '请先运行预计算脚本生成能力模型数据。'}
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600 font-mono">
          <code>cd backend</code><br />
          <code>python scripts/competency/precompute.py</code>
        </div>
      </div>
    );
  }

  const competencies = data.competencies;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competency Co-pilot</h1>
          <p className="text-sm text-gray-500">
            数字化中心能力模型共创 · {competencies.length} 个能力项 · 已确认 {totalConfirmed} 项
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || totalConfirmed === 0}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {saved ? '已保存 ✓' : saving ? '保存中...' : '保存确认结果'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'l1' && (
        <CompetencyRadarView
          competencies={competencies}
          meta={data.meta}
          confirmedTerms={confirmedTerms}
          onConfirmedTermsChange={setConfirmedTerms}
        />
      )}

      {activeTab === 'explorer' && (
        <CompetencyExplorer
          competencies={competencies}
          confirmedL1Terms={confirmedTerms}
        />
      )}

      {activeTab === 'resources' && (
        <ResourceInventory competencies={competencies} />
      )}
    </div>
  );
}
