'use client';

/**
 * W2: 调研诊断与报告
 *
 * 4 步工作流：结构化问卷 → 客户确认 → 五维仪表盘 → PPT 输出
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import WorkflowStepNavigator from '@/components/workflow/WorkflowStepNavigator';
import type { StepDef } from '@/components/workflow/WorkflowStepNavigator';
import StructuredQuestionnaireStep from '@/components/workflow/StructuredQuestionnaireStep';
import ClientConfirmStep from '@/components/workflow/ClientConfirmStep';
import FiveDimensionDashboard from '@/components/workflow/FiveDimensionDashboard';
import DiagnosisPPTStep from '@/components/workflow/DiagnosisPPTStep';
import AgentPanel from '@/components/agent/AgentPanel';
import AIGenerateButton from '@/components/agent/AIGenerateButton';
import {
  startWorkflow,
  executeWorkflowStep,
  advanceWorkflowStep,
  type QuestionnaireData,
} from '@/lib/api/workflow-client';
import type { FiveDimensionsData } from '@/types/diagnosis';

const STEPS: StepDef[] = [
  { id: 'questionnaire', name: '结构化问卷' },
  { id: 'client_confirm', name: '客户确认' },
  { id: 'dashboard', name: '五维仪表盘' },
  { id: 'ppt_output', name: 'PPT 输出' },
];

export default function DiagnosisPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Workflow session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Step data
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [analysisData, setAnalysisData] = useState<FiveDimensionsData | null>(null);
  const [pptFilePath, setPPTFilePath] = useState<string | null>(null);

  // Agent panel
  const [agentOpen, setAgentOpen] = useState(false);

  // Start workflow
  useEffect(() => {
    const init = async () => {
      const res = await startWorkflow(projectId, 'diagnosis');
      if (res.success && res.data) {
        setSessionId(res.data.session_id);
      }
    };
    init();
  }, [projectId]);

  // Step 1: Confirm questionnaire
  const handleConfirmQuestionnaire = useCallback(async (data: QuestionnaireData) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // Save questionnaire data to workflow
      const res = await advanceWorkflowStep(sessionId, { questionnaire: data });
      if (res.success) {
        setQuestionnaireData(data);
        setCompletedSteps(prev => new Set([...prev, 'questionnaire']));
        setCurrentStep(1);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 2: Client confirm (pure human step, advance workflow)
  const handleClientConfirm = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await advanceWorkflowStep(sessionId, {
        client_confirm: { confirmed: true, questionnaire: questionnaireData },
      });
      if (res.success) {
        setCompletedSteps(prev => new Set([...prev, 'client_confirm']));
        setCurrentStep(2);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, questionnaireData]);

  // Step 3: Generate five-dimension analysis
  const handleGenerateAnalysis = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await executeWorkflowStep(sessionId, 'dashboard', {
        questionnaire: questionnaireData,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        if (d.five_dimensions) {
          setAnalysisData(d.five_dimensions as unknown as FiveDimensionsData);
        }
        setCompletedSteps(prev => new Set([...prev, 'dashboard']));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, questionnaireData]);

  // Step 4: Export PPT
  const handleExportPPT = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await executeWorkflowStep(sessionId, 'ppt_output', {
        analysis: analysisData,
        questionnaire: questionnaireData,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        if (d.file_path) setPPTFilePath(d.file_path as string);
        setCompletedSteps(prev => new Set([...prev, 'ppt_output']));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, analysisData, questionnaireData]);

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
      hideNav={currentStep === STEPS.length - 1 && !!pptFilePath}
    >
      {currentStep === 0 && (
        <StructuredQuestionnaireStep
          onConfirm={handleConfirmQuestionnaire}
          generating={loading}
          initialData={questionnaireData}
        />
      )}

      {currentStep === 1 && (
        <ClientConfirmStep
          questionnaireData={questionnaireData}
          onConfirm={handleClientConfirm}
          loading={loading}
        />
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <FiveDimensionDashboard
            analysisData={analysisData}
            onGenerate={handleGenerateAnalysis}
            generating={loading}
          />
          {analysisData && (
            <AIGenerateButton
              mode="consulting_report"
              projectId={projectId}
              benchmarkId="general"
              projectGoal="组织诊断咨询报告"
              onClick={() => setAgentOpen(true)}
            />
          )}
        </div>
      )}

      {currentStep === 3 && (
        <DiagnosisPPTStep
          analysisData={analysisData}
          onGenerate={handleExportPPT}
          exporting={loading}
          filePath={pptFilePath}
        />
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
