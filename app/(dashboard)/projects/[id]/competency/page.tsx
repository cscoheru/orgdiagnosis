'use client';

/**
 * 项目内能力研讨 — 完整 4-tab 视图
 *
 * 从 workshop/competency 迁移，适配项目上下文。
 * Tab 1: 分析流程 (DataFlowDiagram)
 * Tab 2: 一级能力研讨 (CompetencyRadarView)
 * Tab 3: 二级与行为探索 (CompetencyExplorer)
 * Tab 4: 学习资源盘点 (ResourceInventory)
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchCompetencyMaterials, saveFinalModel } from '@/lib/api/competency-api';
import type { CompetencyOutput, ModelType } from '@/lib/workshop/competency-types';
import CompetencyRadarView from '@/components/workshop/CompetencyRadarView';
import CompetencyExplorer from '@/components/workshop/CompetencyExplorer';
import ResourceInventory from '@/components/workshop/ResourceInventory';
import DataFlowDiagram from '@/components/workshop/DataFlowDiagram';
import CompetencyCalibrationChat from '@/components/workshop/CompetencyCalibrationChat';

type TabId = 'flow' | 'l1' | 'explorer' | 'resources' | 'calibration';

const TABS: { id: TabId; name: string }[] = [
  { id: 'flow', name: '分析流程' },
  { id: 'l1', name: '一级能力研讨' },
  { id: 'explorer', name: '二级与行为探索' },
  { id: 'resources', name: '学习资源盘点' },
  { id: 'calibration', name: '能力模型校准' },
];

export default function CompetencyPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>('flow');
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
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">数据未就绪</h2>
        <p className="text-gray-500">{error || '请先运行预计算脚本生成能力模型数据。'}</p>
      </div>
    );
  }

  const competencies = data.competencies;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">能力研讨</h2>
          <p className="text-sm text-gray-500">
            {competencies.length} 个能力项 · 已确认 {totalConfirmed} 项
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
      {activeTab === 'flow' && (
        <DataFlowDiagram meta={data.meta} />
      )}

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

      {activeTab === 'calibration' && (
        <CompetencyCalibrationChat data={data} />
      )}
    </div>
  );
}
