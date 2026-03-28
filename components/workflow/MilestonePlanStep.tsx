'use client';

import { useState, useEffect } from 'react';
import { PAIN_SEVERITY_OPTIONS, createEmptyPhase, type EnhancedPhase, type EnhancedMilestonePlanData, type EnhancedSmartExtractData, validateStep2 } from '@/lib/workflow/w1-types';
import { exportPlanToMD } from '@/lib/workflow/export-md';
import DynamicListInput from './DynamicListInput';
import PhaseCard from './PhaseCard';

interface MilestonePlanStepProps {
  extractedData: EnhancedSmartExtractData | null;
  clientName: string;
  onGenerate: () => void;
  onConfirm: (data: EnhancedMilestonePlanData) => void;
  generating: boolean;
  planData: EnhancedMilestonePlanData | null;
}

const DEFAULT_PLAN: EnhancedMilestonePlanData = {
  project_goal: '',
  phases: [createEmptyPhase(1)],
  success_criteria: [],
  main_tasks: [],
  total_duration_weeks: 2,
};

export default function MilestonePlanStep({
  extractedData,
  clientName,
  onGenerate,
  onConfirm,
  generating,
  planData,
}: MilestonePlanStepProps) {
  const [data, setData] = useState<EnhancedMilestonePlanData>(planData || DEFAULT_PLAN);

  // Sync planData prop into local state when AI generates new data
  useEffect(() => {
    if (planData) {
      setData(planData);
    }
  }, [planData]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleConfirm = () => {
    const validationErrors = validateStep2(data);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onConfirm(data);
  };

  const addPhase = () => {
    const order = data.phases.length + 1;
    setData(prev => ({
      ...prev,
      phases: [...prev.phases, createEmptyPhase(order)],
    }));
  };

  const removePhase = (id: string) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.filter(p => p.id !== id),
    }));
  };

  const updatePhase = (id: string, updated: EnhancedPhase) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map(p => (p.id === id ? updated : p)),
    }));
  };

  const totalWeeks = data.phases.reduce((sum, p) => sum + p.duration_weeks, 0);

  const getSeverityLabel = (severity: string) =>
    PAIN_SEVERITY_OPTIONS.find(o => o.value === severity)?.label || severity;

  return (
    <div className="space-y-6">
      {/* Context Summary */}
      {extractedData && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">需求摘要</h3>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-4">
              {extractedData.client_name && (
                <div>
                  <span className="text-gray-500">客户：</span>
                  <span className="font-medium">{extractedData.client_name}</span>
                </div>
              )}
              {extractedData.industry && (
                <div>
                  <span className="text-gray-500">行业：</span>
                  <span className="font-medium">{extractedData.industry}</span>
                </div>
              )}
              {extractedData.company_scale && (
                <div>
                  <span className="text-gray-500">规模：</span>
                  <span>{extractedData.company_scale}</span>
                </div>
              )}
            </div>
            {extractedData.core_pain_points.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500 flex-shrink-0">痛点：</span>
                {extractedData.core_pain_points.map(p => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      PAIN_SEVERITY_OPTIONS.find(o => o.value === p.severity)?.bg || 'bg-gray-100'
                    } ${
                      PAIN_SEVERITY_OPTIONS.find(o => o.value === p.severity)?.color || 'text-gray-600'
                    }`}
                  >
                    {getSeverityLabel(p.severity)} {p.description}
                  </span>
                ))}
              </div>
            )}
            {extractedData.expected_goals.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500 flex-shrink-0">目标：</span>
                {extractedData.expected_goals.filter(Boolean).map((g, i) => (
                  <span key={i} className="text-gray-700">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Button */}
      {!data.project_goal && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                AI 生成中...
              </span>
            ) : (
              '一键生成里程碑计划'
            )}
          </button>
          <p className="text-xs text-gray-400 mt-2">AI 将根据需求信息生成项目目标和阶段计划</p>
        </div>
      )}

      {/* Plan Form */}
      {data.project_goal && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Project Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              项目总体目标 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={data.project_goal}
              onChange={(e) => setData(prev => ({ ...prev, project_goal: e.target.value }))}
              placeholder="描述项目总体目标..."
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.project_goal ? 'border-red-300' : 'border-gray-200'}`}
              rows={2}
            />
            {errors.project_goal && <p className="text-xs text-red-500 mt-1">{errors.project_goal}</p>}
          </div>

          {/* Total Duration */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">预计总周期：</span>
            <span className="text-sm font-bold text-blue-600">{totalWeeks} 周</span>
            {errors.phases && <p className="text-xs text-red-500 ml-2">{errors.phases}</p>}
          </div>

          {/* Phases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">阶段规划</h3>
              <button
                onClick={addPhase}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                + 添加阶段
              </button>
            </div>
            <div className="space-y-3">
              {data.phases.map((phase, i) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  index={i}
                  onChange={(updated) => updatePhase(phase.id, updated)}
                  onRemove={() => removePhase(phase.id)}
                  canRemove={data.phases.length > 1}
                />
              ))}
            </div>
          </div>

          {/* Main Tasks */}
          <DynamicListInput
            items={data.main_tasks}
            onItemsChange={(main_tasks) => setData(prev => ({ ...prev, main_tasks }))}
            label="主要工作任务"
            placeholder="输入主要工作任务后按回车"
            addButtonLabel="添加任务"
          />

          {/* Success Criteria */}
          <DynamicListInput
            items={data.success_criteria}
            onItemsChange={(success_criteria) => setData(prev => ({ ...prev, success_criteria }))}
            label="成功标准"
            placeholder="输入成功标准后按回车"
            addButtonLabel="添加标准"
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
          >
            {generating ? '重新生成中...' : '重新生成'}
          </button>
          <button
            onClick={() => exportPlanToMD(data, clientName)}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            导出 MD
          </button>
        </div>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
        >
          确认计划
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
