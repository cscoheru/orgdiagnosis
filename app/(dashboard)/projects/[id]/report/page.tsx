'use client';

/**
 * 报告输出中心 — 统一查看项目所有工作流报告和协作产出
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReportCard from '@/components/report/ReportCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">报告输出</h2>
        <p className="text-sm text-gray-500">查看和导出项目各阶段的报告与协作产出</p>
      </div>

      {/* Workflow Reports */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-3">工作流报告</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ReportCard
            title="建议书"
            subtitle="W1 需求分析 — 项目建议书 PPTX"
            type="pptx"
            status="empty"
            onGenerate={() => {}}
          />
          <ReportCard
            title="诊断报告"
            subtitle="W2 调研诊断 — 组织诊断报告"
            type="pptx"
            status="empty"
            onGenerate={() => {}}
          />
          <ReportCard
            title="交付报告"
            subtitle="W3 交付执行 — 阶段性交付报告"
            type="ai"
            status="empty"
            onGenerate={() => {}}
          />
        </div>
      </section>

      {/* Collaboration Outputs */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-3">协作产出</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ReportCard
            title="共创画布"
            subtitle="智能共创 — 场景/痛点/想法画布"
            type="pdf"
            status="empty"
            onGenerate={() => {}}
          />
          <ReportCard
            title="能力模型"
            subtitle="能力研讨 — 组织能力模型"
            type="pdf"
            status="empty"
            onGenerate={() => {}}
          />
          <ReportCard
            title="战略解码"
            subtitle="战略解码 — BSC 战略地图与行动表"
            type="pptx"
            status="empty"
            onGenerate={() => {}}
          />
        </div>
      </section>
    </div>
  );
}
