'use client';

/**
 * ProjectWorkflowContext — 在项目 layout 层集中获取并缓存所有工作流数据。
 *
 * 解决的问题：AgentPanel 移到 layout 后，无法访问子页面的 workflow step data。
 * 方案：layout mount 时并行拉取 4 种工作流的 all_step_data，缓存到 context。
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { startWorkflow } from '@/lib/api/workflow-client';

type WorkflowType = 'proposal' | 'diagnosis' | 'delivery' | 'strategy';

interface ProjectWorkflowData {
  data: Record<WorkflowType, Record<string, unknown> | null>;
  loading: boolean;
  /** Force re-fetch all workflow data (e.g. after user completes a step) */
  refresh: () => void;
}

const ProjectWorkflowContext = createContext<ProjectWorkflowData | null>(null);

export function useProjectWorkflow(): ProjectWorkflowData {
  const ctx = useContext(ProjectWorkflowContext);
  if (!ctx) throw new Error('useProjectWorkflow must be used within ProjectWorkflowProvider');
  return ctx;
}

const ALL_WORKFLOW_TYPES: WorkflowType[] = ['proposal', 'diagnosis', 'delivery', 'strategy'];

interface ProjectWorkflowProviderProps {
  projectId: string;
  children: ReactNode;
}

export function ProjectWorkflowProvider({ projectId, children }: ProjectWorkflowProviderProps) {
  const [data, setData] = useState<Record<WorkflowType, Record<string, unknown> | null>>({
    proposal: null,
    diagnosis: null,
    delivery: null,
    strategy: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    // Fetch all 4 workflow types in parallel
    const results = await Promise.allSettled(
      ALL_WORKFLOW_TYPES.map(async (type): Promise<[WorkflowType, Record<string, unknown> | null]> => {
        try {
          const res = await startWorkflow(projectId, type);
          if (res.success && res.data) {
            return [type, res.data.all_step_data || null];
          }
          return [type, null];
        } catch {
          return [type, null];
        }
      })
    );

    const next: Record<WorkflowType, Record<string, unknown> | null> = {
      proposal: null,
      diagnosis: null,
      delivery: null,
      strategy: null,
    };

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [type, stepData] = result.value;
        next[type] = stepData;
      }
    }

    setData(next);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <ProjectWorkflowContext.Provider value={{ data, loading, refresh }}>
      {children}
    </ProjectWorkflowContext.Provider>
  );
}

/**
 * Flatten workflow data into the format expected by the backend seed_mapper.
 *
 * Backend expects flat keys: smart_extract, milestone_plan, five_dimensions, phases, etc.
 * Our data is nested: { proposal: { smart_extract, milestone_plan }, diagnosis: { questionnaire, ... } }
 *
 * This function flattens the nesting and also maps some frontend keys to backend-expected keys.
 */
export function getCombinedWorkflowData(
  data: Record<WorkflowType, Record<string, unknown> | null>
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  // W1: proposal workflow
  const proposal = data.proposal;
  if (proposal) {
    // Direct pass-through of known keys
    if (proposal.smart_extract) flat.smart_extract = proposal.smart_extract;
    if (proposal.milestone_plan) flat.milestone_plan = proposal.milestone_plan;
    if (proposal.mds_content) flat.mds_content = proposal.mds_content;
    if (proposal.impl_outline) flat.impl_outline = proposal.impl_outline;
    if (proposal.template_select) flat.template_select = proposal.template_select;
  }

  // W2: diagnosis workflow
  const diagnosis = data.diagnosis;
  if (diagnosis) {
    if (diagnosis.questionnaire) flat.questionnaire = diagnosis.questionnaire;
    // Backend expects "five_dimensions" key, but frontend may store as "dashboard" step data
    if (diagnosis.dashboard) flat.five_dimensions = diagnosis.dashboard;
    if (diagnosis.five_dimensions) flat.five_dimensions = diagnosis.five_dimensions;
    if (diagnosis.ppt_output) flat.ppt_output = diagnosis.ppt_output;
  }

  // W3: delivery workflow
  const delivery = data.delivery;
  if (delivery) {
    if (delivery.phases) flat.phases = delivery.phases;
    if (delivery.team_members) flat.team_members = delivery.team_members;
    if (delivery.report_data) flat.report_data = delivery.report_data;
    if (delivery.create_order) {
      const order = delivery.create_order as Record<string, unknown>;
      if (order.team) flat.team_members = order.team;
      if (order.phases) flat.phases = order.phases;
    }
    if (delivery.phase_execute) {
      const exec = delivery.phase_execute as Record<string, unknown>;
      if (exec.phases) flat.phases = exec.phases;
    }
  }

  // Strategy: 战略解码 workflow
  const strategy = data.strategy;
  if (strategy) {
    if (strategy.strategy_data) flat.strategy_data = strategy.strategy_data;
    if (strategy.company_info) flat.company_info = strategy.company_info;
  }

  return flat;
}
