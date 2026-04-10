'use client';

/**
 * 绩效管理咨询 — 项目内路由
 *
 * 从项目 layout 继承 ProjectWorkflowProvider，
 * 渲染 PerformanceOverview 主组件。
 */

import PerformanceOverview from '@/components/performance/PerformanceOverview';

export default function PerformanceRoutePage() {
  return <PerformanceOverview />;
}
