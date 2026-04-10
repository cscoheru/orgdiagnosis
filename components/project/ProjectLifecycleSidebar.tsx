'use client';

/**
 * 项目工作流侧边栏
 *
 * 三个工作流（需求分析、调研诊断、交付执行）完全独立，无前后依赖。
 * 每个工作流可独立展开查看步骤进度。
 */

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Search,
  Rocket,
  FileOutput,
  ChevronDown,
  ChevronRight,
  Target,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 步骤 ID → 友好名称映射
const STEP_NAMES: Record<string, Record<string, string>> = {
  proposal: {
    smart_extract: 'SMART 需求提取',
    milestone_plan: '里程碑规划',
    mds_content: 'MDS 内容生成',
    impl_outline: '实施概要',
    template_select: '模板选择',
  },
  diagnosis: {
    questionnaire: '结构化问卷',
    client_confirm: '客户确认',
    dashboard: '五维仪表盘',
    ppt_output: 'PPT 输出',
  },
  delivery: {
    phases: '阶段规划',
    team_members: '团队配置',
    report_data: '报告数据',
    create_order: '创建工单',
    phase_execute: '阶段执行',
  },
};

interface StepInfo {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'complete';
}

interface WorkflowItem {
  id: string;
  name: string;
  href: string;
  icon: React.ReactNode;
  steps: StepInfo[];
  progress: number;
}

const WORKFLOW_DEFS: { id: string; name: string; href: string; icon: React.ReactNode }[] = [
  { id: 'proposal', name: '需求分析', href: 'proposal', icon: <FileText size={16} /> },
  { id: 'diagnosis', name: '调研诊断', href: 'diagnosis', icon: <Search size={16} /> },
  { id: 'delivery', name: '交付执行', href: 'delivery', icon: <Rocket size={16} /> },
];

interface ProjectLifecycleSidebarProps {
  className?: string;
}

export default function ProjectLifecycleSidebar({ className = '' }: ProjectLifecycleSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;

  const [workflows, setWorkflows] = useState<WorkflowItem[]>(
    WORKFLOW_DEFS.map(w => ({ ...w, steps: [], progress: 0 }))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeId = WORKFLOW_DEFS.find(w => pathname.endsWith(w.href))?.id;

  // Fetch workflow progress
  useEffect(() => {
    if (!projectId) return;

    const fetchAll = async () => {
      const updated = await Promise.all(
        WORKFLOW_DEFS.map(async (def) => {
          try {
            const startRes = await fetch(`${API_BASE}/api/v2/workflow/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ project_id: projectId, workflow_type: def.id }),
            });
            if (!startRes.ok) return { ...def, steps: [], progress: 0 };

            const { session_id } = await startRes.json();
            if (!session_id) return { ...def, steps: [], progress: 0 };

            const stateRes = await fetch(`${API_BASE}/api/v2/workflow/${session_id}/state`);
            if (!stateRes.ok) return { ...def, steps: [], progress: 0 };

            const stateData = await stateRes.json();
            const nameMap = STEP_NAMES[def.id] || {};
            const steps = (stateData.steps || []).map((s: { id: string; status: string }) => ({
              id: s.id,
              name: nameMap[s.id] || s.id,
              status: s.status === 'completed' ? 'complete' as const
                : s.status === 'active' ? 'active' as const
                : 'pending' as const,
            }));
            const total = steps.length || 1;
            const completed = steps.filter((s: StepInfo) => s.status === 'complete').length;
            return { ...def, steps, progress: completed / total };
          } catch {
            return { ...def, steps: [], progress: 0 };
          }
        })
      );
      setWorkflows(updated);
    };

    fetchAll();
  }, [projectId]);

  // Auto-expand active workflow
  useEffect(() => {
    if (activeId) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.add(activeId);
        return next;
      });
    }
  }, [activeId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav className={`w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto ${className}`}>
      <div className="py-3">
        {/* 工作流标题 */}
        <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          工作流
        </div>

        {workflows.map(wf => {
          const isActive = activeId === wf.id;
          const isExpanded = expanded.has(wf.id);
          const hasSteps = wf.steps.length > 0;

          const itemClass = `w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
            isActive
              ? 'text-blue-700 bg-blue-50 font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`;

          return (
            <div key={wf.id}>
              <button
                onClick={() => {
                  toggleExpand(wf.id);
                  // Also navigate if no steps yet or clicking an inactive workflow
                  if (!hasSteps || !isActive) {
                    // Use Link-like behavior via router
                  }
                }}
                className={itemClass}
              >
                {isExpanded && hasSteps
                  ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                  : hasSteps
                  ? <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                  : <span className="w-3.5" />
                }
                <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{wf.icon}</span>
                <Link href={`/projects/${projectId}/${wf.href}`} className="flex-1 text-left truncate hover:text-blue-600">
                  {wf.name}
                </Link>
                {wf.progress > 0 && wf.progress < 1 && (
                  <span className="text-[11px] text-gray-400">{Math.round(wf.progress * 100)}%</span>
                )}
                {wf.progress >= 1 && (
                  <span className="text-[11px] text-green-600">✓</span>
                )}
              </button>

              {/* Expanded steps */}
              {isExpanded && hasSteps && (
                <div className="ml-8 mr-3 mb-1 space-y-0.5">
                  {wf.steps.map(step => (
                    <div
                      key={step.id}
                      className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 rounded"
                    >
                      {step.status === 'complete' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      ) : step.status === 'active' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      )}
                      <span className="truncate">{step.name}</span>
                    </div>
                  ))}
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${wf.progress * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 报告输出 */}
        <div className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            输出
          </div>
          <Link
            href={`/projects/${projectId}/report`}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
              pathname.endsWith('/report')
                ? 'text-blue-700 bg-blue-50 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="w-3.5" />
            <span className={pathname.endsWith('/report') ? 'text-blue-600' : 'text-gray-400'}>
              <FileOutput size={16} />
            </span>
            <span className="flex-1 text-left truncate">报告输出</span>
          </Link>
        </div>

        {/* 咨询工具 */}
        <div className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            咨询工具
          </div>
          <Link
            href={`/projects/${projectId}/performance`}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
              pathname.endsWith('/performance')
                ? 'text-blue-700 bg-blue-50 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="w-3.5" />
            <span className={pathname.endsWith('/performance') ? 'text-blue-600' : 'text-gray-400'}>
              <Target size={16} />
            </span>
            <span className="flex-1 text-left truncate">绩效管理</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
