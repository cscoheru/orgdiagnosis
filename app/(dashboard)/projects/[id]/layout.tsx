'use client';

import { ReactNode, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import ProjectLifecycleSidebar from '@/components/project/ProjectLifecycleSidebar';
import AgentPanel from '@/components/agent/AgentPanel';
import { ProjectWorkflowProvider, useProjectWorkflow, getCombinedWorkflowData } from '@/components/project/ProjectWorkflowContext';
import { Sparkles } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Project = {
  id: string;
  name: string;
  client_name?: string | null;
  status: string;
  selected_modules?: string[];
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  requirement: '需求分析',
  diagnosing: '调研诊断',
  delivering: '交付中',
  completed: '已完成',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  requirement: 'bg-blue-100 text-blue-700',
  diagnosing: 'bg-amber-100 text-amber-700',
  delivering: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
};

// Map lifecycle stage to agent mode
const stageAgentModes: Record<string, 'proposal' | 'consulting_report'> = {
  proposal: 'proposal',
  diagnosis: 'consulting_report',
  delivery: 'consulting_report',
  cowork: 'consulting_report',
  competency: 'consulting_report',
  strategy: 'consulting_report',
  report: 'consulting_report',
};

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <ProjectWorkflowProvider projectId={projectId}>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectWorkflowProvider>
  );
}

function ProjectLayoutInner({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [agentBenchmarkId, setAgentBenchmarkId] = useState('');

  // Workflow data from context
  const { data: workflowData } = useProjectWorkflow();
  const combinedWorkflowData = useMemo(() => getCombinedWorkflowData(workflowData), [workflowData]);

  // Determine current lifecycle stage from pathname
  const currentStage = ['proposal', 'diagnosis', 'delivery', 'cowork', 'competency', 'strategy', 'report']
    .find(s => pathname.endsWith(`/${s}`)) || '';

  // Fetch project info
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const p = data.project;
          if (p && typeof p.selected_modules === 'string') {
            try { p.selected_modules = JSON.parse(p.selected_modules); } catch { p.selected_modules = []; }
          }
          setProject(p);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    if (projectId) fetchProject();
  }, [projectId]);

  // Fetch benchmark list for AI panel
  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/agent/blueprint/benchmarks`);
        if (res.ok) {
          const data = await res.json();
          const bms = Array.isArray(data) ? data : (data.items || []);
          if (bms.length > 0) setAgentBenchmarkId(bms[0]._key);
        }
      } catch { /* silent */ }
    };
    fetchBenchmarks();
  }, []);

  const agentMode = stageAgentModes[currentStage] || 'consulting_report';

  return (
    <div className="space-y-4">
      {/* Project Header */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <nav className="flex items-center gap-1.5 text-sm text-gray-400 flex-shrink-0">
              <Link href="/projects" className="hover:text-gray-600 transition-colors">项目列表</Link>
              <span>/</span>
            </nav>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {loading ? '...' : project?.name || '未知项目'}
              </h1>
              {project?.client_name && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{project.client_name}</p>
              )}
            </div>
          </div>
          {!loading && project && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                {statusLabels[project.status] || project.status}
              </span>
              {/* AI panel toggle */}
              <button
                onClick={() => setAiOpen(!aiOpen)}
                className={`p-2 rounded-lg border transition-colors ${
                  aiOpen
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
                title="AI 助手"
              >
                <Sparkles size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Three-column layout: Lifecycle Sidebar + Content + AI Panel */}
      <div className="flex gap-0 border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ height: 'calc(100vh - 14rem)' }}>
        {/* 1. Lifecycle sidebar */}
        <ProjectLifecycleSidebar className="border-r border-gray-200" />

        {/* 2. Main content */}
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* 3. AI panel (collapsible sidebar) */}
        {aiOpen && (
          <div className="w-[400px] flex-shrink-0 border-l border-gray-200">
            <AgentPanel
              projectId={projectId}
              mode={agentMode}
              benchmarkId={agentBenchmarkId}
              projectGoal={project?.name || ''}
              open={aiOpen}
              onClose={() => setAiOpen(false)}
              embedded
              workflowData={combinedWorkflowData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
