'use client';

/**
 * W1: 需求分析与建议书（增强版 6 步工作流）
 *
 *   1. 基本信息与需求（增强：详细表单 + AI 智能提取）
 *   2. 核心需求与计划（增强：阶段规划 + 关键活动 + 成功标准）
 *   3. MDS 幻灯片（单张 Million Dollar Slide）
 *   4. 详细大纲（按阶段分组，4 要素/页）
 *   5. PPT 模板与布局（主题 + 逐页 layout）
 *   6. 生成 PPTX（对接 v2 renderer）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import WorkflowStepNavigator from '@/components/workflow/WorkflowStepNavigator';
import type { StepDef } from '@/components/workflow/WorkflowStepNavigator';
import SmartExtractStep, { type SmartExtractStepRef } from '@/components/workflow/SmartExtractStep';
import MilestonePlanStep from '@/components/workflow/MilestonePlanStep';
import MDSContentStep from '@/components/workflow/MDSContentStep';
import ImplementationOutlineStep from '@/components/workflow/ImplementationOutlineStep';
import TemplateSelectionStep from '@/components/workflow/TemplateSelectionStep';
import PPTOutputStep from '@/components/workflow/PPTOutputStep';
import {
  startWorkflow,
  executeWorkflowStep,
  advanceWorkflowStep,
  smartExtract,
  generateOutlineSection,
  generateOutlineActivity,
} from '@/lib/api/workflow-client';
import {
  mapExtractResponse,
  mapPlanResponse,
  mapMDSResponse,
  mapOutlineResponse,
  type EnhancedSmartExtractData,
  type EnhancedMilestonePlanData,
  type MDSSingleSlide,
  type DetailedOutlineData,
  type TemplateSelectionData,
} from '@/lib/workflow/w1-types';

const STEPS: StepDef[] = [
  { id: 'smart_extract', name: '基本信息与需求' },
  { id: 'milestone_plan', name: '核心需求与计划' },
  { id: 'mds_content', name: 'MDS 幻灯片' },
  { id: 'impl_outline', name: '详细大纲' },
  { id: 'template_select', name: 'PPT 模板与布局' },
  { id: 'ppt_output', name: '生成 PPTX' },
];

export default function ProposalPage() {
  const params = useParams();
  const projectId = params.id as string;
  const smartExtractRef = useRef<SmartExtractStepRef>(null);

  // Workflow session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step data
  const [extractedData, setExtractedData] = useState<EnhancedSmartExtractData | null>(null);
  const [planData, setPlanData] = useState<EnhancedMilestonePlanData | null>(null);
  const [mdsData, setMDSData] = useState<MDSSingleSlide | null>(null);
  const [outlineData, setOutlineData] = useState<DetailedOutlineData | null>(null);
  const [templateData, setTemplateData] = useState<TemplateSelectionData | null>(null);
  const [pptFilePath, setPPTFilePath] = useState<string | null>(null);
  const [generatingSection, setGeneratingSection] = useState<number | null>(null);
  const [generatingActivity, setGeneratingActivity] = useState<[number, number] | null>(null);

  // Start workflow (or restore existing session)
  useEffect(() => {
    const init = async () => {
      const res = await startWorkflow(projectId, 'proposal');
      if (res.success && res.data) {
        setSessionId(res.data.session_id);

        // Restore step data from saved state
        const allData = res.data.all_step_data || {};
        if (allData.smart_extract) {
          setExtractedData(mapExtractResponse(allData.smart_extract as unknown as Record<string, unknown>));
        }
        if (allData.milestone_plan) {
          setPlanData(mapPlanResponse(allData.milestone_plan as unknown as Record<string, unknown>));
        }
        if (allData.mds_content) {
          setMDSData(mapMDSResponse(allData.mds_content as unknown as Record<string, unknown>));
        }
        if (allData.impl_outline) {
          setOutlineData(mapOutlineResponse(allData.impl_outline as unknown as Record<string, unknown>));
        }
        if (allData.template_select) {
          setTemplateData(allData.template_select as unknown as TemplateSelectionData);
        }

        // Restore completed steps
        const completed = new Set<string>();
        const steps = res.data.steps || [];
        for (const s of steps) {
          if (s.status === 'completed') completed.add(s.id);
          // Find the first non-completed step
        }
        setCompletedSteps(completed);

        // Set current step to the first non-completed step
        const currentIdx = steps.findIndex(s => s.status !== 'completed');
        if (currentIdx >= 0) setCurrentStep(currentIdx);
      }
    };
    init();
  }, [projectId]);

  // Step 1: Smart extract
  const handleSmartExtract = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const res = await smartExtract(text);
      if (res.success && res.data) {
        const mapped = mapExtractResponse(res.data as unknown as Record<string, unknown>);
        setExtractedData(mapped);
        smartExtractRef.current?.populate(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmStep1 = useCallback(async (data: EnhancedSmartExtractData) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await advanceWorkflowStep(sessionId, { smart_extract: data });
      setCompletedSteps(prev => new Set([...prev, 'smart_extract']));
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 2: Generate milestone plan
  const handleGeneratePlan = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await executeWorkflowStep(sessionId, 'milestone_plan', {
        smart_extract: extractedData,
      });
      if (res.success && res.data) {
        const mapped = mapPlanResponse(res.data);
        setPlanData(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, extractedData]);

  const handleConfirmPlan = useCallback(async (data: EnhancedMilestonePlanData) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      setPlanData(data);
      await advanceWorkflowStep(sessionId, { milestone_plan: data });
      setCompletedSteps(prev => new Set([...prev, 'milestone_plan']));
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 3: MDS is auto-generated from planData (no AI needed)

  const handleConfirmMDS = useCallback(async (data: MDSSingleSlide) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await advanceWorkflowStep(sessionId, { mds_content: data });
      setCompletedSteps(prev => new Set([...prev, 'mds_content']));
      setCurrentStep(3);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 4: Generate outline by section
  const handleGenerateOutlineSection = useCallback(async (sectionIndex: number) => {
    if (!sessionId) return;
    setGeneratingSection(sectionIndex);
    setStepError(null);
    try {
      const res = await generateOutlineSection(sessionId, sectionIndex);
      if (res.success && res.data) {
        const section = mapOutlineResponse({ sections: [res.data] } as unknown as Record<string, unknown>);
        if (section.sections.length > 0) {
          setOutlineData(prev => {
            if (!prev) return section;
            const updated = { ...prev, sections: [...prev.sections] };
            updated.sections[sectionIndex] = section.sections[0];
            return updated;
          });
        }
      } else {
        setStepError(res.error || '阶段大纲生成失败');
      }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : '阶段大纲生成出错');
    } finally {
      setGeneratingSection(null);
    }
  }, [sessionId]);

  // Step 4: Generate outline by activity
  const handleGenerateOutlineActivity = useCallback(async (sectionIndex: number, activityIndex: number) => {
    if (!sessionId) return;
    setGeneratingActivity([sectionIndex, activityIndex]);
    setStepError(null);
    try {
      const res = await generateOutlineActivity(sessionId, sectionIndex, activityIndex);
      if (res.success && res.data) {
        // res.data is a single activity object
        const activityData = res.data as Record<string, unknown>;
        setOutlineData(prev => {
          if (!prev) return prev;
          const updated = { ...prev, sections: [...prev.sections] };
          const section = { ...updated.sections[sectionIndex], activities: [...updated.sections[sectionIndex].activities] };
          section.activities[activityIndex] = {
            id: (activityData.id as string) || section.activities[activityIndex]?.id || '',
            activity_name: (activityData.activity_name as string) || section.activities[activityIndex]?.activity_name || '',
            slides: (activityData.slides as any[]) || [],
          };
          updated.sections[sectionIndex] = section;
          return updated;
        });
      } else {
        setStepError(res.error || '活动大纲生成失败');
      }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : '活动大纲生成出错');
    } finally {
      setGeneratingActivity(null);
    }
  }, [sessionId]);

  const handleConfirmOutline = useCallback(async (data: DetailedOutlineData) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await advanceWorkflowStep(sessionId, { impl_outline: data });
      setCompletedSteps(prev => new Set([...prev, 'impl_outline']));
      setCurrentStep(4);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 5: Template & layout selection (frontend only, just advance)
  const handleConfirmTemplate = useCallback(async (data: TemplateSelectionData) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await advanceWorkflowStep(sessionId, { template_select: data });
      setTemplateData(data);
      setCompletedSteps(prev => new Set([...prev, 'template_select']));
      setCurrentStep(5);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Step 6: Export PPT
  const handleExportPPT = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setPPTFilePath(null); // Reset so user always sees "Generate" button
    try {
      const res = await executeWorkflowStep(sessionId, 'ppt_output', {
        smart_extract: extractedData,
        milestone_plan: planData,
        mds_content: mdsData,
        impl_outline: outlineData,
        template_select: templateData,
      });
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>;
        if (d.file_path) setPPTFilePath(d.file_path as string);
        setCompletedSteps(prev => new Set([...prev, 'ppt_output']));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, extractedData, planData, mdsData, outlineData, templateData]);

  // Navigation
  const handlePrev = () => { setStepError(null); setCurrentStep(Math.max(0, currentStep - 1)); };
  const handleNext = () => { setStepError(null); setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1)); };

  return (
    <>
    <WorkflowStepNavigator
      steps={STEPS}
      currentStepIndex={currentStep}
      completedSteps={completedSteps}
      onStepClick={(i: number) => { setStepError(null); setCurrentStep(i); }}
      onPrev={currentStep > 0 ? handlePrev : undefined}
      onNext={currentStep < STEPS.length - 1 ? handleNext : undefined}
      nextDisabled={loading}
      nextLabel={
        currentStep === STEPS.length - 1 ? '完成' : '下一步'
      }
      hideNav={currentStep === STEPS.length - 1 && !!pptFilePath}
    >
      {currentStep === 0 && (
        <SmartExtractStep
          ref={smartExtractRef}
          onExtract={handleSmartExtract}
          onConfirm={handleConfirmStep1}
          loading={loading}
          initialData={extractedData}
          onNext={handleNext}
        />
      )}

      {currentStep === 1 && (
        <MilestonePlanStep
          extractedData={extractedData}
          clientName={extractedData?.client_name || ''}
          onGenerate={handleGeneratePlan}
          onConfirm={handleConfirmPlan}
          generating={loading}
          planData={planData}
        />
      )}

      {currentStep === 2 && (
        <MDSContentStep
          planData={planData}
          clientName={extractedData?.client_name || ''}
          mdsData={mdsData}
          onConfirm={handleConfirmMDS}
        />
      )}

      {currentStep === 3 && (
        <ImplementationOutlineStep
          mdsData={mdsData}
          planData={planData}
          outlineData={outlineData}
          onGenerateSection={handleGenerateOutlineSection}
          onGenerateActivity={handleGenerateOutlineActivity}
          onConfirm={handleConfirmOutline}
          generatingSection={generatingSection}
          generatingActivity={generatingActivity}
          error={stepError}
        />
      )}

      {currentStep === 4 && (
        <TemplateSelectionStep
          outlineData={outlineData}
          templateData={templateData}
          onConfirm={handleConfirmTemplate}
          onOutlineChange={setOutlineData}
        />
      )}

      {currentStep === 5 && (
        <PPTOutputStep
          templateData={templateData}
          onExport={handleExportPPT}
          exporting={loading}
          filePath={pptFilePath}
          slideCount={outlineData?.sections.reduce((sum, s) => sum + s.activities.reduce((a, act) => a + act.slides.length, 0), 0)}
        />
      )}
    </WorkflowStepNavigator>
    </>
  );
}
