'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  FileText,
  Search,
  Rocket,
  Users,
  Brain,
  Target,
  FileOutput,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BarChart3,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StepInfo {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'complete';
}

interface LifecycleStage {
  id: string;
  name: string;
  href: string;
  icon: React.ReactNode;
  group: 'workflow' | 'cowork' | 'output';
  steps?: StepInfo[];
  progress?: number;
}

// Static stage definitions
const STAGES: Omit<LifecycleStage, 'progress' | 'steps'>[] = [
  {
    id: 'proposal',
    name: '需求分析',
    href: 'proposal',
    icon: <FileText size={16} />,
    group: 'workflow',
  },
  {
    id: 'diagnosis',
    name: '调研诊断',
    href: 'diagnosis',
    icon: <Search size={16} />,
    group: 'workflow',
  },
  {
    id: 'delivery',
    name: '交付执行',
    href: 'delivery',
    icon: <Rocket size={16} />,
    group: 'workflow',
  },
  {
    id: 'cowork',
    name: '智能共创',
    href: 'cowork',
    icon: <Sparkles size={16} />,
    group: 'cowork',
  },
  {
    id: 'competency',
    name: '能力研讨',
    href: 'competency',
    icon: <Brain size={16} />,
    group: 'cowork',
  },
  {
    id: 'strategy',
    name: '战略解码',
    href: 'strategy',
    icon: <Target size={16} />,
    group: 'cowork',
  },
  {
    id: 'report',
    name: '报告输出',
    href: 'report',
    icon: <FileOutput size={16} />,
    group: 'output',
  },
];

interface ProjectLifecycleSidebarProps {
  className?: string;
}

export default function ProjectLifecycleSidebar({ className = '' }: ProjectLifecycleSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;

  const [stages, setStages] = useState<LifecycleStage[]>(STAGES.map(s => ({ ...s, steps: [], progress: 0 })));
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['proposal']));

  // Determine active stage from pathname
  const activeStage = stages.find(s => pathname.endsWith(s.href));

  // Fetch workflow progress for all 3 workflow types
  useEffect(() => {
    if (!projectId) return;

    const workflowTypes = ['proposal', 'diagnosis', 'delivery'];
    const fetchProgress = async () => {
      setStages(prev => prev.map(s => ({ ...s, steps: [], progress: 0 })));

      for (const wt of workflowTypes) {
        try {
          // Start workflow to get session (non-destructive if already exists)
          const startRes = await fetch(`${API_BASE}/api/v2/workflow/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId, workflow_type: wt }),
          });
          if (!startRes.ok) continue;
          const startData = await startRes.json();
          const sessionId = startData.session_id;
          if (!sessionId) continue;

          // Get workflow state for step status
          const stateRes = await fetch(`${API_BASE}/api/v2/workflow/${sessionId}/state`);
          if (!stateRes.ok) continue;
          const stateData = await stateRes.json();

          const workflowSteps = (stateData.steps || []).map((s: { id: string; status: string }) => ({
            id: s.id,
            name: s.id,
            status: s.status === 'completed' ? 'complete' as const
              : s.status === 'active' ? 'active' as const
              : 'pending' as const,
          }));

          const total = workflowSteps.length || 1;
          const completed = workflowSteps.filter((s: { status: string }) => s.status === 'complete').length;

          setStages(prev => prev.map(s =>
            s.id === wt ? { ...s, steps: workflowSteps, progress: completed / total } : s
          ));
        } catch {
          // Silently fail — stages stay at progress 0
        }
      }
    };

    fetchProgress();
  }, [projectId]);

  // Auto-expand active stage
  useEffect(() => {
    if (activeStage) {
      setExpandedStages(prev => {
        const next = new Set(prev);
        next.add(activeStage.id);
        return next;
      });
    }
  }, [activeStage]);

  const toggleExpand = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const groups = [
    { key: 'workflow', label: '工作流' },
    { key: 'cowork', label: '协作工具' },
    { key: 'output', label: '输出' },
  ];

  return (
    <nav className={`w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto ${className}`}>
      <div className="py-3">
        {groups.map((group, gi) => {
          const groupStages = stages.filter(s => s.group === group.key);
          if (groupStages.length === 0) return null;

          return (
            <div key={group.key} className={gi > 0 ? 'mt-4' : ''}>
              {/* Group label */}
              <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>

              {groupStages.map(stage => {
                const isActive = activeStage?.id === stage.id;
                const isExpanded = expandedStages.has(stage.id);
                const hasSteps = stage.steps && stage.steps.length > 0;

                return (
                  <div key={stage.id}>
                    <button
                      onClick={() => hasSteps ? toggleExpand(stage.id) : undefined}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'text-blue-700 bg-blue-50 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {hasSteps ? (
                        isExpanded
                          ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                          : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5" />
                      )}

                      <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{stage.icon}</span>

                      <span className="flex-1 text-left truncate">{stage.name}</span>

                      {stage.progress != null && stage.progress > 0 && stage.progress < 1 && (
                        <span className="text-[11px] text-gray-400">
                          {Math.round(stage.progress * 100)}%
                        </span>
                      )}
                      {(stage.progress ?? 0) >= 1 && (
                        <span className="text-[11px] text-green-600">✓</span>
                      )}
                    </button>

                    {/* Expanded steps */}
                    {isExpanded && hasSteps && (
                      <div className="ml-8 mr-3 mb-1 space-y-0.5">
                        {stage.steps!.map(step => (
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
                        {/* Mini progress bar */}
                        <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${(stage.progress ?? 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
