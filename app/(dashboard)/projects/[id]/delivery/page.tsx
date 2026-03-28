'use client';

/**
 * W3: 项目解决方案
 *
 * 4 步工作流：创建咨询订单 → 编辑项目计划 → 阶段推进 → 阶段总结报告
 * 核心是 Step 3（阶段推进），用户在整个交付周期内持续使用。
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import WorkflowStepNavigator from '@/components/workflow/WorkflowStepNavigator';
import type { StepDef } from '@/components/workflow/WorkflowStepNavigator';
import CreateOrderStep from '@/components/workflow/CreateOrderStep';
import PhaseExecutionStep from '@/components/workflow/PhaseExecutionStep';
import PhaseReportStep from '@/components/workflow/PhaseReportStep';
import {
  startWorkflow,
  executeWorkflowStep,
  advanceWorkflowStep,
  getWorkflowState,
  type MilestonePlanResult,
  type PhaseData,
  type PhaseReportData,
} from '@/lib/api/workflow-client';

const STEPS: StepDef[] = [
  { id: 'create_order', name: '创建订单' },
  { id: 'edit_plan', name: '编辑计划' },
  { id: 'phase_execute', name: '阶段推进' },
  { id: 'phase_report', name: '阶段报告' },
];

export default function DeliveryPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Workflow session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // W3 data
  const [planData, setPlanData] = useState<MilestonePlanResult | null>(null);
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<PhaseReportData | null>(null);
  const [reportFilePath, setReportFilePath] = useState<string | null>(null);

  // Start workflow + restore state
  useEffect(() => {
    const init = async () => {
      const res = await startWorkflow(projectId, 'delivery');
      if (res.success && res.data) {
        const sid = res.data.session_id;
        setSessionId(sid);

        // Try to restore existing state
        const state = await getWorkflowState(sid);
        if (state.success && state.data) {
          const allData = state.data.all_step_data || {};

          // Restore plan data if W1 was completed
          if (allData.create_order) {
            const orderData = allData.create_order as Record<string, unknown>;
            if (orderData.plan) {
              setPlanData(orderData.plan as unknown as MilestonePlanResult);
            }
          }

          // Restore phases
          if (allData.phase_execute) {
            const execData = allData.phase_execute as Record<string, unknown>;
            if (execData.phases) {
              setPhases(execData.phases as unknown as PhaseData[]);
            }
          }

          // Determine current step
          const completed = new Set<string>();
          let stepIdx = 0;
          for (const step of state.data.steps) {
            if (step.status === 'completed') {
              completed.add(step.id);
            } else if (step.status === 'active') {
              stepIdx = STEPS.findIndex(s => s.id === step.id);
              if (stepIdx < 0) stepIdx = 0;
            }
          }
          setCompletedSteps(completed);
          if (completed.size > 0) setCurrentStep(stepIdx || completed.size);
        }
      }
    };
    init();
  }, [projectId]);

  // Step 1: Create order — confirm inherited plan, project becomes delivering
  const handleCreateOrder = useCallback(async () => {
    if (!sessionId || !planData) return;
    setLoading(true);
    try {
      // Convert plan phases to PhaseData format
      const initialPhases: PhaseData[] = (planData.phases || []).map((p, i) => ({
        phase_id: `phase-${i}`,
        phase_name: p.phase_name,
        phase_order: p.phase_order || i + 1,
        time_range: p.time_range,
        goals: p.goals,
        deliverables: p.deliverables,
        status: 'planned' as const,
        tasks: [],
      }));

      const res = await advanceWorkflowStep(sessionId, {
        plan: planData,
        phases: initialPhases,
      });
      if (res.success) {
        setPhases(initialPhases);
        setCompletedSteps(prev => new Set([...prev, 'create_order']));
        setCurrentStep(1);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, planData]);

  // Step 2: Edit plan (save and advance)
  const handleConfirmPlan = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await advanceWorkflowStep(sessionId, {
        phases: phases,
      });
      if (res.success) {
        setCompletedSteps(prev => new Set([...prev, 'edit_plan']));
        setCurrentStep(2);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, phases]);

  // Phase management within Step 3
  const handlePhaseStatusChange = useCallback((phaseId: string, status: PhaseData['status']) => {
    setPhases(prev => prev.map(p => p.phase_id === phaseId ? { ...p, status } : p));
  }, []);

  // Trigger AI task for a phase
  const handleTriggerTask = useCallback(async (phaseId: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const phase = phases.find(p => p.phase_id === phaseId);
      const res = await executeWorkflowStep(sessionId, 'phase_execute', {
        phase_id: phaseId,
        phase_name: phase?.phase_name,
        goals: phase?.goals,
        deliverables: phase?.deliverables,
        phases: phases,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        // Update phase with new tasks from AI
        if (d.tasks) {
          const newTasks = d.tasks as PhaseData['tasks'];
          setPhases(prev => prev.map(p =>
            p.phase_id === phaseId
              ? { ...p, tasks: [...(p.tasks || []), ...(newTasks || [])] }
              : p,
          ));
        }
        // Also persist to workflow state
        await advanceWorkflowStep(sessionId, {
          phases: phases.map(p =>
            p.phase_id === phaseId
              ? { ...p, tasks: [...(p.tasks || []), ...((d.tasks as PhaseData['tasks']) || [])] }
              : p,
          ),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, phases]);

  // Request phase report → switch to step 3 (phase_report)
  const handleRequestReport = useCallback((phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setReportData(null);
    setReportFilePath(null);
    setCurrentStep(3);
  }, []);

  // Generate report content
  const handleGenerateReport = useCallback(async (phaseId: string) => {
    if (!sessionId) return;
    setLoading(true);
    setReportData(null);
    try {
      const phase = phases.find(p => p.phase_id === phaseId);
      const res = await executeWorkflowStep(sessionId, 'phase_report', {
        phase_id: phaseId,
        phase_name: phase?.phase_name,
        goals: phase?.goals,
        deliverables: phase?.deliverables,
        tasks: phase?.tasks,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        setReportData({
          phase_id: phaseId,
          phase_name: phase?.phase_name || '',
          storyline: (d.storyline as string) || '',
          arguments: (d.arguments as string[]) || [],
          evidence: (d.evidence as string[]) || [],
          supporting_materials: (d.supporting_materials as string[]) || [],
          deliverables: phase?.deliverables,
        });
        if (d.file_path) setReportFilePath(d.file_path as string);
        setCompletedSteps(prev => new Set([...prev, 'phase_report']));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, phases]);

  // Export report PPT
  const handleExportReportPPT = useCallback(async () => {
    if (!sessionId || !selectedPhaseId || !reportData) return;
    setLoading(true);
    try {
      const res = await executeWorkflowStep(sessionId, 'ppt_output', {
        report: reportData,
        phase_id: selectedPhaseId,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        if (d.file_path) setReportFilePath(d.file_path as string);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedPhaseId, reportData]);

  // Back from report to execution
  const handleBackToExecution = useCallback(() => {
    setCurrentStep(2);
    setSelectedPhaseId(null);
    setReportData(null);
    setReportFilePath(null);
  }, []);

  // Navigation
  const handlePrev = () => setCurrentStep(Math.max(0, currentStep - 1));
  const handleNext = () => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1));

  return (
    <WorkflowStepNavigator
      steps={STEPS}
      currentStepIndex={currentStep}
      completedSteps={completedSteps}
      onStepClick={setCurrentStep}
      onPrev={currentStep > 0 ? handlePrev : undefined}
      onNext={currentStep < STEPS.length - 1 ? handleNext : undefined}
      nextDisabled={loading}
      nextLabel={
        currentStep === STEPS.length - 1 ? '完成' : currentStep < STEPS.length - 1 ? '下一步' : undefined
      }
      hideNav={currentStep === 3 && !!reportFilePath}
    >
      {currentStep === 0 && (
        <CreateOrderStep
          planData={planData}
          onConfirm={handleCreateOrder}
          loading={loading}
        />
      )}

      {currentStep === 1 && (
        <EditPlanStepInline
          phases={phases}
          onPhasesChange={setPhases}
          onConfirm={handleConfirmPlan}
          loading={loading}
        />
      )}

      {currentStep === 2 && (
        <PhaseExecutionStep
          phases={phases}
          onPhaseStatusChange={handlePhaseStatusChange}
          onTriggerTask={handleTriggerTask}
          onRequestReport={handleRequestReport}
          loading={loading}
        />
      )}

      {currentStep === 3 && (
        <PhaseReportStep
          phases={phases}
          selectedPhaseId={selectedPhaseId}
          reportData={reportData}
          onGenerate={handleGenerateReport}
          generating={loading}
          filePath={reportFilePath}
          onBack={handleBackToExecution}
        />
      )}
    </WorkflowStepNavigator>
  );
}

/**
 * Inline edit plan component (Step 2)
 * Allows editing phase goals and deliverables before starting execution.
 */
function EditPlanStepInline({
  phases,
  onPhasesChange,
  onConfirm,
  loading,
}: {
  phases: PhaseData[];
  onPhasesChange: (phases: PhaseData[]) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const updatePhase = (index: number, field: string, value: string | string[]) => {
    const updated = [...phases];
    (updated[index] as any)[field] = value;
    onPhasesChange(updated);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">编辑项目计划</h3>
        <p className="text-sm text-gray-500 mt-1">
          确认各阶段目标和成果要求后，即可开始交付执行
        </p>
      </div>

      <div className="space-y-3">
        {phases.map((phase, i) => (
          <div key={phase.phase_id} className="border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                {phase.phase_order}
              </span>
              <span className="font-medium text-gray-900 text-sm">{phase.phase_name}</span>
            </div>
            <textarea
              value={phase.goals || ''}
              onChange={(e) => updatePhase(i, 'goals', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={2}
              placeholder="阶段目标"
            />
            <div>
              <label className="text-xs text-gray-500">成果要求（每行一项）</label>
              <textarea
                value={Array.isArray(phase.deliverables) ? phase.deliverables!.join('\n') : ''}
                onChange={(e) => updatePhase(i, 'deliverables', e.target.value.split('\n').filter(Boolean))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none mt-1"
                rows={2}
                placeholder="成果1&#10;成果2"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? '保存中...' : '确认计划，开始交付'}
        </button>
      </div>
    </div>
  );
}
