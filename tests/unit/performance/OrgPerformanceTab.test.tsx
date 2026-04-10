import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PerformancePlan, OrgPerformance } from '@/types/performance';

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const mockPlan: PerformancePlan = {
  _key: 'plan-1',
  properties: {
    plan_name: '2026年度绩效方案',
    project_id: 'proj-1',
    methodology: 'KPI',
    cycle_type: '年度',
    status: '执行中',
  },
};

const mockOrgPerfs: OrgPerformance[] = [
  {
    _key: 'op1',
    properties: {
      org_unit_ref: '技术部',
      strategic_kpis: [{ name: 'KPI1', metric: '收入', weight: 30, target: '100万', unit: '元', source_goal: 'g1' }],
      dimension_weights: { strategic: 50, management: 25, team_development: 15, engagement: 10 },
      status: '生成中',
      plan_ref: 'plan-1',
      project_id: 'proj-1',
      management_indicators: [],
      team_development: [],
      engagement_compliance: [],
    },
  },
];

const mockGoals = [
  { _key: 'g1', _id: 'id-g1', model_key: 'Strategic_Goal', properties: { goal_name: '目标1', priority: 'P0' } },
  { _key: 'g2', _id: 'id-g2', model_key: 'Strategic_Goal', properties: { goal_name: '目标2', priority: 'P1' } },
];

const mockOrgUnits = [
  { _key: 'ou1', _id: 'id-ou1', model_key: 'Org_Unit', properties: { unit_name: '技术部', unit_type: '职能部门' } },
  { _key: 'ou2', _id: 'id-ou2', model_key: 'Org_Unit', properties: { unit_name: '市场部', unit_type: '职能部门' } },
];

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockGenerateOrgPerformance = vi.fn();
const mockListOrgPerformances = vi.fn();
const mockGetObjectsByModel = vi.fn();

vi.mock('lucide-react', () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Building2: () => <svg data-testid="icon-building2" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Target: () => <svg data-testid="icon-target" />,
  X: () => <svg data-testid="icon-x" />,
}));

vi.mock('@/lib/api/performance-api', () => ({
  generateOrgPerformance: (...args: unknown[]) => mockGenerateOrgPerformance(...args),
  listOrgPerformances: (...args: unknown[]) => mockListOrgPerformances(...args),
}));

vi.mock('@/lib/api/kernel-client', () => ({
  getObjectsByModel: (...args: unknown[]) => mockGetObjectsByModel(...args),
}));

vi.mock('../../../components/performance/InlineCreateModal', () => ({
  __esModule: true,
  default: ({ title, open, onCreated }: { title: string; open: boolean; onCreated: (obj: unknown) => void }) =>
    open ? (
      <div data-testid="inline-create-modal">
        <span>{title}</span>
        <button onClick={() => onCreated({ _key: 'new-ou', properties: { unit_name: '新部门' } })}>confirm</button>
      </div>
    ) : null,
}));

import OrgPerformanceTab from '@/components/performance/OrgPerformanceTab';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const defaultProps = {
  projectId: 'proj-1',
  activePlan: null as PerformancePlan | null,
  onRefresh: vi.fn().mockResolvedValue(undefined),
};

function renderWith(props: Partial<typeof defaultProps> = {}) {
  return render(<OrgPerformanceTab {...defaultProps} {...props} />);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('OrgPerformanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListOrgPerformances.mockResolvedValue({ success: true, data: [] });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });
  });

  // ── No plan ──

  it('shows prompt when no active plan is selected', () => {
    renderWith({ activePlan: null });
    expect(
      screen.getByText('请先在「方案概览」中创建并选择一个绩效方案')
    ).toBeInTheDocument();
    expect(screen.getByTestId('icon-building2')).toBeInTheDocument();
  });

  // ── Data preparation ──

  it('fetches Strategic_Goal and Org_Unit on mount when plan is active', () => {
    renderWith({ activePlan: mockPlan });
    expect(mockGetObjectsByModel).toHaveBeenCalledWith('Strategic_Goal', 100);
    expect(mockGetObjectsByModel).toHaveBeenCalledWith('Org_Unit', 100);
    expect(mockListOrgPerformances).toHaveBeenCalledWith('plan-1');
  });

  it('renders goal count and goal names', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Strategic_Goal') return Promise.resolve({ success: true, data: mockGoals });
      return Promise.resolve({ success: true, data: mockOrgUnits });
    });

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText(/已关联的战略目标 \(2\)/)).toBeInTheDocument();
    });
    expect(screen.getByText('目标1')).toBeInTheDocument();
    expect(screen.getByText('目标2')).toBeInTheDocument();
  });

  it('renders org unit dropdown with options', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });
    expect(screen.getByText('市场部')).toBeInTheDocument();
  });

  it('shows "新建部门" button that opens InlineCreateModal', async () => {
    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      const buttons = screen.getAllByText('新建部门');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('新建部门')[0]); // click the button, not modal title
    expect(screen.getByTestId('inline-create-modal')).toBeInTheDocument();
  });

  // ── Generate ──

  it('disables generate button when no department is selected', async () => {
    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
      expect(btn).toBeDisabled();
    });
  });

  it('enables generate button after selecting a department', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('选择要生成绩效的部门...');
    await userEvent.selectOptions(select, 'ou1');

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
      expect(btn).not.toBeDisabled();
    });
  });

  it('calls generateOrgPerformance with plan_id and org_unit_id', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });
    mockGenerateOrgPerformance.mockResolvedValue({ success: true });

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('选择要生成绩效的部门...');
    await userEvent.selectOptions(select, 'ou1');

    const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(mockGenerateOrgPerformance).toHaveBeenCalledWith({
        plan_id: 'plan-1',
        org_unit_id: 'ou1',
      });
    });
  });

  it('shows loading spinner while generating', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });

    // Return a promise that never resolves to keep "generating" state
    mockGenerateOrgPerformance.mockReturnValue(new Promise(() => {}));

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('选择要生成绩效的部门...');
    await userEvent.selectOptions(select, 'ou1');

    const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('AI 正在基于战略目标生成分部门绩效...')).toBeInTheDocument();
    });
  });

  it('refreshes data on successful generation', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });
    mockGenerateOrgPerformance.mockResolvedValue({ success: true });

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderWith({ activePlan: mockPlan, onRefresh });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('选择要生成绩效的部门...');
    await userEvent.selectOptions(select, 'ou1');

    const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
      expect(mockListOrgPerformances).toHaveBeenCalled();
    });
  });

  it('shows error message on generation failure', async () => {
    mockGetObjectsByModel.mockImplementation((model: string) => {
      if (model === 'Org_Unit') return Promise.resolve({ success: true, data: mockOrgUnits });
      return Promise.resolve({ success: true, data: [] });
    });
    mockGenerateOrgPerformance.mockResolvedValue({ success: false, error: '后端服务异常' });

    renderWith({ activePlan: mockPlan });
    await waitFor(() => {
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('选择要生成绩效的部门...');
    await userEvent.selectOptions(select, 'ou1');

    const btn = screen.getByRole('button', { name: /AI 生成部门绩效/ });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('后端服务异常')).toBeInTheDocument();
    });
  });

  // ── Results ──

  it('renders expandable result cards', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('部门绩效 — 技术部')).toBeInTheDocument();
    });
    expect(screen.getByText(/1 个战略KPI/)).toBeInTheDocument();
    expect(screen.getByText(/生成结果 \(1个部门\)/)).toBeInTheDocument();
  });

  it('renders 4-dimension weights in expanded card', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('部门绩效 — 技术部')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText('部门绩效 — 技术部'));

    await waitFor(() => {
      expect(screen.getByText(/战略KPI \(50%\)/)).toBeInTheDocument();
      expect(screen.getByText(/部门管理 \(25%\)/)).toBeInTheDocument();
      expect(screen.getByText(/团队发展 \(15%\)/)).toBeInTheDocument();
      expect(screen.getByText(/敬业度\/合规 \(10%\)/)).toBeInTheDocument();
    });
  });

  it('toggles expand/collapse on click', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('部门绩效 — 技术部')).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText('部门绩效 — 技术部'));
    await waitFor(() => {
      expect(screen.getByText(/战略KPI \(50%\)/)).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByText('部门绩效 — 技术部'));
    await waitFor(() => {
      expect(screen.queryByText(/战略KPI \(50%\)/)).not.toBeInTheDocument();
    });
  });

  it('renders status label from ORG_PERF_STATUS_LABELS', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('生成中')).toBeInTheDocument();
    });
  });
});
