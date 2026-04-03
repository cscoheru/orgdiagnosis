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
import EditPlanStep from '@/components/workflow/EditPlanStep';
import PhaseExecutionStep from '@/components/workflow/PhaseExecutionStep';
import PhaseReportStep from '@/components/workflow/PhaseReportStep';
import AgentPanel from '@/components/agent/AgentPanel';
import AIGenerateButton from '@/components/agent/AIGenerateButton';
import {
  startWorkflow,
  executeWorkflowStep,
  advanceWorkflowStep,
  getWorkflowState,
  type MilestonePlanResult,
  type PhaseData,
  type PhaseReportData,
} from '@/lib/api/workflow-client';
import type { CreateOrderFormData, TeamMemberInfo } from '@/lib/workflow/w3-types';
import { saveProjectOrder, getProjectOrder } from '@/lib/api/workflow-client';

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
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<PhaseReportData | null>(null);
  const [reportFilePath, setReportFilePath] = useState<string | null>(null);

  // Agent panel
  const [agentOpen, setAgentOpen] = useState(false);

  // Start workflow + restore state
  useEffect(() => {
    const init = async () => {
      // ── 1. Fetch W1 proposal data (milestone_plan) ──
      const proposalRes = await startWorkflow(projectId, 'proposal');
      if (proposalRes.success && proposalRes.data) {
        const proposalData = proposalRes.data.all_step_data || {};
        if (proposalData.milestone_plan) {
          const plan = proposalData.milestone_plan as Record<string, unknown>;
          setPlanData({
            project_goal: (plan.project_goal as string) || '',
            phases: ((plan.phases || []) as Array<Record<string, unknown>>).map((p, i) => ({
              phase_name: (p.phase_name as string) || '',
              phase_order: (p.phase_order as number) || i + 1,
              duration_weeks: p.duration_weeks as number | undefined,
              time_range: (p.time_range as string) || '',
              description: p.description as string | undefined,
              goals: (p.goals as string) || '',
              key_activities: (p.key_activities as string[]) || [],
              deliverables: (p.deliverables as string[]) || [],
            })),
            success_criteria: (plan.success_criteria as string[]) || [],
            main_tasks: (plan.main_tasks as string[]) || [],
            total_duration_weeks: plan.total_duration_weeks as number | undefined,
          });
        }
      }

      // ── 2. Start/restore delivery workflow ──
      const res = await startWorkflow(projectId, 'delivery');
      if (res.success && res.data) {
        const sid = res.data.session_id;
        setSessionId(sid);

        // Try to restore existing state
        const state = await getWorkflowState(sid);
        if (state.success && state.data) {
          const allData = state.data.all_step_data || {};

          // Restore plan data (override W1 data if we have saved order data)
          if (allData.create_order) {
            const orderData = allData.create_order as Record<string, unknown>;
            if (orderData.plan) {
              setPlanData(orderData.plan as unknown as MilestonePlanResult);
            }
            if (orderData.team) {
              setTeamMembers(orderData.team as TeamMemberInfo[]);
            }
          }

          // Restore phases (from edit_plan or phase_execute step)
          if (allData.edit_plan) {
            const editData = allData.edit_plan as Record<string, unknown>;
            if (editData.phases) {
              setPhases(editData.phases as unknown as PhaseData[]);
            }
          } else if (allData.phase_execute) {
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

      // Also try loading order for team members (if not restored from workflow state)
      if (teamMembers.length === 0) {
        const orderRes = await getProjectOrder(projectId);
        if (orderRes.success && orderRes.data) {
          const d = orderRes.data as Record<string, unknown>;
          if (d.team) setTeamMembers(d.team as TeamMemberInfo[]);
        }
      }
    };
    init();
  }, [projectId]);

  // Derive phases from planData when phases is empty (for EditPlanStep)
  useEffect(() => {
    if (planData && planData.phases.length > 0 && phases.length === 0) {
      setPhases(planData.phases.map((p, i) => ({
        phase_id: `phase-${i}`,
        phase_name: p.phase_name,
        phase_order: p.phase_order || i + 1,
        time_range: p.time_range || '',
        goals: p.goals,
        key_activities: p.key_activities || [],
        deliverables: p.deliverables || [],
        assignee_ids: [],
        notes: '',
        status: 'planned' as const,
        tasks: [],
      })));
    }
  }, [planData, phases.length]);

  // Step 1: Create order — save contract/team/schedule, then advance workflow
  const handleCreateOrder = useCallback(async (orderData: CreateOrderFormData) => {
    if (!sessionId || !planData) return;
    setLoading(true);
    try {
      // Build milestone date lookup: phase_name → "start~end"
      const milestoneMap: Record<string, string> = {};
      for (const m of orderData.milestone_dates || []) {
        if (m.planned_start || m.planned_end) {
          milestoneMap[m.phase_name] = `${m.planned_start || ''}~${m.planned_end || ''}`;
        }
      }

      // Convert plan phases to PhaseData, merging milestone dates + W1 key_activities
      const initialPhases: PhaseData[] = (planData.phases || []).map((p, i) => ({
        phase_id: `phase-${i}`,
        phase_name: p.phase_name,
        phase_order: p.phase_order || i + 1,
        time_range: milestoneMap[p.phase_name] || p.time_range || '',
        goals: p.goals,
        key_activities: p.key_activities || [],
        deliverables: p.deliverables || [],
        assignee_ids: [],
        notes: '',
        status: 'planned' as const,
        tasks: [],
      }));

      const res = await advanceWorkflowStep(sessionId, {
        plan: planData,
        phases: initialPhases,
      });
      if (res.success) {
        setPhases(initialPhases);
        setTeamMembers(orderData.team || []);
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
    <>
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
          projectId={projectId}
          onConfirm={handleCreateOrder}
          loading={loading}
        />
      )}

      {currentStep === 1 && (
        <EditPlanStep
          phases={phases}
          onPhasesChange={setPhases}
          teamMembers={teamMembers}
          onConfirm={handleConfirmPlan}
          loading={loading}
        />
      )}

      {currentStep === 2 && (
        <PhaseExecutionStep
          phases={phases}
          projectId={projectId}
          teamMembers={teamMembers}
          onPhaseStatusChange={handlePhaseStatusChange}
          onTriggerTask={handleTriggerTask}
          onRequestReport={handleRequestReport}
          loading={loading}
        />
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <PhaseReportStep
            phases={phases}
            selectedPhaseId={selectedPhaseId}
            reportData={reportData}
            onGenerate={handleGenerateReport}
            generating={loading}
            filePath={reportFilePath}
            onBack={handleBackToExecution}
          />

          {/* AI 一键生成：咨询报告（阶段工作启动后才可用） */}
          {phases.length > 0 && (
            <AIGenerateButton
              mode="consulting_report"
              projectId={projectId}
              benchmarkId="general"
              projectGoal="组织诊断咨询报告"
              disabled={!phases.some(p => p.status !== 'planned')}
              onClick={() => setAgentOpen(true)}
            />
          )}
        </div>
      )}
    </WorkflowStepNavigator>

    <AgentPanel
      projectId={projectId}
      mode="consulting_report"
      benchmarkId="general"
      projectGoal="组织诊断咨询报告"
      open={agentOpen}
      onClose={() => setAgentOpen(false)}
    />
    </>
  );
}
