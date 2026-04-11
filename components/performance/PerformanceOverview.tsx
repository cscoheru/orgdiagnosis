'use client';

/**
 * 绩效管理咨询 — 主页面
 *
 * 8 个 Tab:
 * 1. 方案概览 — 创建/查看绩效方案
 * 2. 战略目标 — 管理战略目标 + AI 分解举措
 * 3. 组织绩效 — AI 生成部门四维度绩效
 * 4. 岗位绩效 — 一键生成 + 编辑岗位四分区绩效
 * 5. 考核表单 — AI 生成考核表单模板
 * 6. 级联分解 — 目标层级分解 + 周期管理
 * 7. 数据分析 — 评分分布、偏差分析
 * 8. 报告生成 — AI 生成咨询报告
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  listPlans,
  getPerformanceOverview,
  type PerformancePlan,
  type PerformanceOverview as OverviewType,
} from '@/lib/api/performance-api';
import PlanOverviewTab from './PlanOverviewTab';
import StrategicGoalsTab from './StrategicGoalsTab';
import OrgPerformanceTab from './OrgPerformanceTab';
import PositionPerformanceTab from './PositionPerformanceTab';
import ReviewTemplateTab from './ReviewTemplateTab';
import CascadeTreeTab from './CascadeTreeTab';
import AnalyticsTab from './AnalyticsTab';
import ReportTab from './ReportTab';

type TabId = 'plan' | 'goals' | 'org-perf' | 'pos-perf' | 'template' | 'cascade' | 'analytics' | 'report';

const TABS: { id: TabId; name: string }[] = [
  { id: 'plan', name: '方案概览' },
  { id: 'goals', name: '战略目标' },
  { id: 'org-perf', name: '组织绩效' },
  { id: 'pos-perf', name: '岗位绩效' },
  { id: 'template', name: '考核表单' },
  { id: 'cascade', name: '级联分解' },
  { id: 'analytics', name: '数据分析' },
  { id: 'report', name: '报告生成' },
];

export default function PerformancePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>('plan');
  const [plans, setPlans] = useState<PerformancePlan[]>([]);
  const [activePlan, setActivePlan] = useState<PerformancePlan | null>(null);
  const [overview, setOverview] = useState<OverviewType | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [planRes, overviewRes] = await Promise.all([
        listPlans(projectId),
        getPerformanceOverview(projectId),
      ]);
      if (planRes.success && planRes.data) {
        const planList = Array.isArray(planRes.data) ? planRes.data : [];
        setPlans(planList);
        if (!activePlan && planList.length > 0) {
          setActivePlan(planList[0]);
        }
      }
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, activePlan]);

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">绩效管理咨询</h2>
          {overview && (
            <p className="text-sm text-gray-500">
              {overview.plans} 个方案 · {overview.org_performances} 个部门绩效 · {overview.position_performances} 个岗位绩效
            </p>
          )}
        </div>
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
      {activeTab === 'plan' && (
        <PlanOverviewTab
          projectId={projectId}
          plans={plans}
          activePlan={activePlan}
          onSelectPlan={setActivePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'goals' && (
        <StrategicGoalsTab
          projectId={projectId}
          activePlan={activePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'org-perf' && (
        <OrgPerformanceTab
          projectId={projectId}
          activePlan={activePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'pos-perf' && (
        <PositionPerformanceTab
          projectId={projectId}
          activePlan={activePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'template' && (
        <ReviewTemplateTab
          projectId={projectId}
          activePlan={activePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'cascade' && (
        <CascadeTreeTab
          projectId={projectId}
          activePlan={activePlan}
          onRefresh={refreshData}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab projectId={projectId} />
      )}

      {activeTab === 'report' && (
        <ReportTab projectId={projectId} />
      )}
    </div>
  );
}
