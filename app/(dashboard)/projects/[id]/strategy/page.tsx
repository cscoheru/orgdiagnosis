'use client';

/**
 * 项目内战略解码 — 4 步工作流
 *
 * 从 strategydecoding 项目完整迁移：
 * ① 业绩诊断 (3力3平台) → ② 市场洞察 (SWOT/竞品) → ③ 目标设定 (三档目标) → ④ 战略执行 (BSC战略地图)
 *
 * 组件通过 useStore() 自行管理步骤导航和数据保存。
 * 此页面负责：workflow session 初始化、状态恢复、步骤进度条同步。
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { StrategyStoreProvider } from '@/components/strategy/StrategyContext';
import Step1Review from '@/components/strategy/Step1Review';
import Step2Insight from '@/components/strategy/Step2Insight';
import Step3Target from '@/components/strategy/Step3Target';
import Step4Execution from '@/components/strategy/Step4Execution';
import StrategyReport from '@/components/strategy/StrategyReport';

import {
  startWorkflow,
  getWorkflowState,
} from '@/lib/api/workflow-client';

const STEPS = [
  { id: 'performance_review', name: '业绩诊断' },
  { id: 'market_insight', name: '市场洞察' },
  { id: 'target_setting', name: '目标设定' },
  { id: 'strategy_execution', name: '战略执行' },
];

export default function StrategyPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [initialStep, setInitialStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Start workflow session
  useEffect(() => {
    const init = async () => {
      try {
        // 恢复已有的 session_id（localStorage 持久化）
        const storageKey = `strategy_session_${projectId}`;
        const savedSessionId = typeof window !== 'undefined'
          ? localStorage.getItem(storageKey)
          : null;

        const res = await startWorkflow(projectId, 'strategy', undefined, savedSessionId || undefined);
        if (res.success && res.data) {
          const sid = res.data.session_id;
          setSessionId(sid);

          // 持久化 session_id 到 localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, sid);
          }

          // Restore state
          const state = await getWorkflowState(sid);
          if (state.success && state.data) {
            const allData = state.data.all_step_data || {};
            if (allData.strategy_data) {
              setInitialData(allData.strategy_data);
            }

            const completed = new Set<string>();
            let activeStep = 0;
            for (const s of state.data.steps || []) {
              if (s.status === 'completed') {
                completed.add(s.id);
              } else if (s.status === 'active') {
                const idx = STEPS.findIndex(st => st.id === s.id);
                if (idx >= 0) activeStep = idx;
              }
            }
            setCompletedSteps(completed);
            if (completed.size > 0) {
              const firstNonCompleted = STEPS.findIndex(s => !completed.has(s.id));
              if (firstNonCompleted >= 0) activeStep = firstNonCompleted;
            }
            setInitialStep(activeStep);
          }
        }
      } catch { /* silent */ }
    };
    init();
  }, [projectId]);

  // Track step changes from components (via store setStep)
  const [activeStep, setActiveStep] = useState(0);
  const handleStepChange = useCallback((step: number) => {
    setActiveStep(step);
    // Mark previous steps as completed
    const completed = new Set(completedSteps);
    for (let i = 0; i < step; i++) {
      completed.add(STEPS[i]?.id);
    }
    setCompletedSteps(completed);
  }, [completedSteps]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <StrategyStoreProvider
      sessionId={sessionId}
      projectId={projectId}
      initialData={initialData}
      initialStep={initialStep}
      onStepChange={handleStepChange}
    >
      <div className="space-y-4">
        {/* Step progress indicator */}
        <div className="flex items-center gap-1 border-b border-gray-100 pb-3">
          {STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = completedSteps.has(step.id);
            return (
              <div key={step.id} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : isCompleted
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-400'
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? '✓' : idx + 1}
                  </span>
                  {step.name}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content — components manage their own navigation via useStore().setStep() */}
        {activeStep === 0 && <Step1Review />}
        {activeStep === 1 && <Step2Insight />}
        {activeStep === 2 && <Step3Target />}
        {activeStep === 3 && <Step4Execution />}
        {activeStep === 4 && <StrategyReport />}
      </div>
    </StrategyStoreProvider>
  );
}
