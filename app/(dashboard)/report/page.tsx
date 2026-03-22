'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RequirementForm from '@/components/requirement-form';
import {
  ClientRequirement,
  startReport,
  pollUntilComplete,
  confirmModules,
  confirmPageTitles,
} from '@/lib/report-api';
import {
  getProject,
  saveRequirement,
  type ProjectWithDetails,
  type RequirementFormData,
} from '@/lib/project-api';

const AUTOSAVE_DELAY = 1000; // 1 second debounce

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get projectId - use null initially to avoid hydration mismatch
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Project state
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFormDataRef = useRef<ClientRequirement | null>(null);
  const isMountedRef = useRef(true);

  // Fix hydration: only render overlay after mount
  // Also set projectId from searchParams after mount
  useEffect(() => {
    setMounted(true);
    const id = searchParams.get('project');
    setProjectId(id);
    return () => {
      isMountedRef.current = false;
    };
  }, [searchParams]);

  // Load project data if projectId is provided
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        setLoading(true);
        console.log('[Report] Loading project:', projectId);
        const projectData = await getProject(projectId);
        console.log('[Report] Project loaded:', projectData?.id);

        if (!isMountedRef.current) return;

        if (!projectData) {
          alert('项目不存在，将跳转到项目管理页面');
          router.push('/projects');
          return;
        }

        setProject(projectData);

        // Set initial form data from requirement
        if (projectData.requirement) {
          const req = projectData.requirement;
          const formData: ClientRequirement = {
            client_name: req.client_name || '',
            industry: req.industry || '',
            industry_background: '',
            company_intro: '',
            company_scale: '',
            core_pain_points: (req.pain_points as string[]) || [''],
            pain_severity: 'medium',
            project_goals: (req.goals as string[]) || [''],
            success_criteria: [''],
            phase_planning: [{
              phase_id: 'phase_1',
              phase_name: '诊断阶段',
              duration_weeks: 4,
              key_activities: [''],
              deliverables: [''],
            }],
            main_tasks: [''],
            deliverables: [''],
            gantt_chart_data: [],
            five_d_diagnosis: undefined,
          };
          initialFormDataRef.current = formData;

          if (req.last_saved_at) {
            setLastSaved(new Date(req.last_saved_at));
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        alert('加载项目失败');
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadProject();
  }, [projectId, router]);

  // Auto-save handler for project-based form
  const handleAutoSave = useCallback(async (data: ClientRequirement, step: number) => {
    if (!projectId) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (!projectId) return; // Double-check after timeout

        setSaveStatus('saving');

        const requirementData: RequirementFormData = {
          client_name: data.client_name,
          industry: data.industry,
          company_stage: data.company_scale,
          employee_count: data.company_scale ? parseInt(data.company_scale) : undefined,
          pain_points: data.core_pain_points,
          goals: data.project_goals,
          timeline: undefined,
          report_type: 'comprehensive',
          slide_count: 20,
          focus_areas: [],
          reference_materials: [],
          tone: 'professional',
          language: 'zh-CN',
          template_style: 'consulting',
        };

        await saveRequirement(projectId, requirementData, step);

        setLastSaved(new Date());
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error: any) {
        console.error('Auto-save failed:', error?.message || error);
        console.error('Error details:', error);
        setSaveStatus('idle');
      }
    }, AUTOSAVE_DELAY);
  }, [projectId]);

  const handleSubmit = async (requirement: ClientRequirement) => {
    console.log('[Report] handleSubmit called with requirement:', requirement);
    if (!isMountedRef.current) return;

    setIsGenerating(true);
    setStatus('正在启动报告生成...');
    setProgress(10);

    try {
      // If project-based, save final requirement first
      if (projectId) {
        await handleAutoSave(requirement, 4);
      }

      // Start report generation
      const reportRequirement = projectId
        ? { ...requirement, project_id: projectId }
        : requirement;

      const { task_id } = await startReport(reportRequirement);

      if (!isMountedRef.current) return;
      setStatus('正在生成核心模块...');
      setProgress(20);

      // Multi-level workflow: Step 1 - Wait for modules_ready
      let result = await pollUntilComplete(
        task_id,
        (taskStatus) => {
          if (!isMountedRef.current) return;
          if (taskStatus.status === 'generating_modules') {
            setStatus('正在生成核心模块...');
            setProgress(15);
          } else if (taskStatus.status === 'modules_ready') {
            setStatus('核心模块已生成，准备生成页面标题...');
            setProgress(25);
          }
        },
        2000,
        120000 // 2 minutes for modules
      );

      if (!isMountedRef.current) return;

      // Auto-confirm modules and continue to page titles
      if (result.status === 'modules_ready') {
        setStatus('确认核心模块...');
        setProgress(28);
        await confirmModules(task_id);

        if (!isMountedRef.current) return;
        setStatus('正在生成页面标题...');
        setProgress(30);

        // Step 2 - Wait for page_titles_ready
        result = await pollUntilComplete(
          task_id,
          (taskStatus) => {
            if (!isMountedRef.current) return;
            if (taskStatus.status === 'generating_page_titles') {
              setStatus('正在生成页面标题...');
              setProgress(32);
            } else if (taskStatus.status === 'page_titles_ready') {
              setStatus('页面标题已生成，准备生成内容...');
              setProgress(40);
            }
          },
          2000,
          120000 // 2 minutes for page titles
        );
      }

      if (!isMountedRef.current) return;

      // Auto-confirm page titles and continue to slides
      if (result.status === 'page_titles_ready') {
        setStatus('确认页面标题...');
        setProgress(42);
        await confirmPageTitles(task_id);

        if (!isMountedRef.current) return;
        setStatus('正在生成幻灯片内容...');
        setProgress(45);

        // Step 3 - Wait for slides_ready
        result = await pollUntilComplete(
          task_id,
          (taskStatus) => {
            if (!isMountedRef.current) return;
            const progressValue = 45 + taskStatus.progress_percentage * 0.35;
            setProgress(Math.min(progressValue, 80));
            if (taskStatus.status === 'generating_slides') {
              setStatus('正在生成幻灯片内容...');
            } else if (taskStatus.status === 'slides_ready' || taskStatus.status === 'outline_ready') {
              setStatus('内容生成完成，跳转到编辑页面...');
              setProgress(90);
            }
          },
          2000,
          300000 // 5 minutes for slides
        );
      }

      if (!isMountedRef.current) return;

      // Handle legacy workflow (outline_ready directly)
      if (result.status === 'generating_outline') {
        setStatus('正在生成大纲...');
        setProgress(30);
        result = await pollUntilComplete(
          task_id,
          (taskStatus) => {
            if (!isMountedRef.current) return;
            setProgress(Math.min(30 + taskStatus.progress_percentage * 0.3, 60));
          },
          2000,
          300000
        );
      }

      if (!isMountedRef.current) return;

      if (
        result.status === 'slides_ready' ||
        result.status === 'outline_ready' ||
        result.status === 'completed'
      ) {
        setProgress(100);
        setStatus('生成完成，跳转到编辑页面...');

        // Navigate to workspace
        const workspaceUrl = projectId
          ? `/report/workspace?project=${projectId}&task_id=${task_id}`
          : `/report/workspace?task_id=${task_id}`;
        router.push(workspaceUrl);
      } else if (result.status === 'failed') {
        throw new Error(result.error_message || '生成失败');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      if (isMountedRef.current) {
        setStatus(`错误: ${error instanceof Error ? error.message : '未知错误'}`);
        setIsGenerating(false);
        setProgress(0);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-500">加载项目数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {project ? `项目: ${project.name}` : '项目建议书生成'}
            </h1>
            <p className="mt-2 text-gray-600">
              填写客户需求信息，AI 将自动生成专业的项目建议书
            </p>
          </div>

          {/* Project status indicator */}
          {project && (
            <div className="flex items-center gap-3">
              {/* Save status indicator */}
              <div className="text-sm text-gray-500 flex items-center gap-2">
                {saveStatus === 'saving' && (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span>保存中...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>已保存</span>
                  </>
                )}
                {saveStatus === 'idle' && mounted && lastSaved && (
                  <span>
                    上次保存: {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>

              <span className="px-2 py-1 text-xs font-medium border border-gray-300 rounded">
                步骤 {project.requirement?.form_step || 1}/4
              </span>
            </div>
          )}
        </div>

        {/* Project navigation */}
        {project && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <button
              onClick={() => router.push('/projects')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← 返回项目列表
            </button>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              当前步骤: 需求录入
            </span>
          </div>
        )}
      </div>

      {/* Loading overlay - only render on client to avoid hydration mismatch */}
      {mounted && isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                ></div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{status}</h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{Math.round(progress)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <RequirementForm
        onSubmit={handleSubmit}
        isLoading={isGenerating}
        initialData={initialFormDataRef.current || undefined}
        onAutoSave={projectId ? handleAutoSave : undefined}
      />

      {/* Tips */}
      <div className="mt-8 p-6 bg-amber-50 rounded-xl border border-amber-200">
        <h3 className="font-medium text-amber-900 mb-3">填写提示</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>行业背景和公司介绍越详细，生成的大纲越精准</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>核心痛点建议每个20-100字，清晰描述具体问题</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>项目目标建议使用 SMART 原则：具体、可衡量、可实现、相关性、时限性</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>生成大纲后可以编辑修改，然后再生成详细内容</span>
          </li>
          {projectId && (
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-green-800">所有输入自动保存到数据库，刷新页面不会丢失</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ReportLoading() {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
        <p className="mt-4 text-gray-500">加载中...</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportLoading />}>
      <ReportContent />
    </Suspense>
  );
}
