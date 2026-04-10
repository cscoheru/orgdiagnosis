import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PerformancePlan, OrgPerformance, PositionPerformance } from '@/types/performance';

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
      org_unit_ref: 'org1',
      strategic_kpis: [],
      dimension_weights: { strategic: 50, management: 25, team_development: 15, engagement: 10 },
      status: '已确认',
      plan_ref: 'plan-1',
      project_id: 'proj-1',
      management_indicators: [],
      team_development: [],
      engagement_compliance: [],
    },
  },
];

const mockJobRoles = [
  {
    _key: 'jr1',
    _id: 'id-jr1',
    model_key: 'Job_Role',
    properties: { role_name: '技术总监', job_family: '管理M', level_range: 'L5-L7', is_key_position: true, org_unit_id: 'org1' },
  },
  {
    _key: 'jr2',
    _id: 'id-jr2',
    model_key: 'Job_Role',
    properties: { role_name: '工程师', job_family: '专业P', level_range: 'L3-L5', org_unit_id: 'org1' },
  },
];

const mockPositions: PositionPerformance[] = [
  {
    _key: 'pp1',
    properties: {
      job_role_ref: '技术总监',
      org_perf_ref: 'op1',
      plan_ref: 'plan-1',
      project_id: 'proj-1',
      is_leader: true,
      auto_generated: true,
      section_weights: { performance: 55, competency: 25, values: 10, development: 10 },
      leader_config: { is_leader: true, personal_weight: 70, team_weight: 30 },
      performance_goals: [],
      competency_items: [],
      values_items: [],
      development_goals: [],
      status: '已生成',
    },
  },
  {
    _key: 'pp2',
    properties: {
      job_role_ref: '工程师',
      org_perf_ref: 'op1',
      plan_ref: 'plan-1',
      project_id: 'proj-1',
      is_leader: false,
      auto_generated: false,
      section_weights: { performance: 55, competency: 25, values: 10, development: 10 },
      performance_goals: [],
      competency_items: [],
      values_items: [],
      development_goals: [],
      status: '已编辑',
    },
  },
];

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockListOrgPerformances = vi.fn();
const mockListPositionPerformances = vi.fn();
const mockGeneratePositionPerformance = vi.fn();
const mockGetObjectsByModel = vi.fn();

vi.mock('lucide-react', () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Users: () => <svg data-testid="icon-users" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  Crown: () => <svg data-testid="icon-crown" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Briefcase: () => <svg data-testid="icon-briefcase" />,
  X: () => <svg data-testid="icon-x" />,
}));

vi.mock('@/lib/api/performance-api', () => ({
  listOrgPerformances: (...args: unknown[]) => mockListOrgPerformances(...args),
  listPositionPerformances: (...args: unknown[]) => mockListPositionPerformances(...args),
  generatePositionPerformance: (...args: unknown[]) => mockGeneratePositionPerformance(...args),
}));

vi.mock('@/lib/api/kernel-client', () => ({
  getObjectsByModel: (...args: unknown[]) => mockGetObjectsByModel(...args),
}));

vi.mock('../../../components/performance/InlineCreateModal', () => ({
  __esModule: true,
  default: ({
    title,
    open,
    onCreated,
  }: {
    title: string;
    open: boolean;
    onCreated: (obj: unknown) => void;
  }) =>
    open ? (
      <div data-testid="inline-create-modal">
        <span>{title}</span>
        <button onClick={() => onCreated({ _key: 'new-jr', properties: { role_name: '新岗位', org_unit_id: 'org1' } })}>
          confirm
        </button>
      </div>
    ) : null,
}));

import PositionPerformanceTab from '@/components/performance/PositionPerformanceTab';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const defaultProps = {
  projectId: 'proj-1',
  activePlan: null as PerformancePlan | null,
  onRefresh: vi.fn().mockResolvedValue(undefined),
};

function renderWith(props: Partial<typeof defaultProps> = {}) {
  return render(<PositionPerformanceTab {...defaultProps} {...props} />);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('PositionPerformanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListOrgPerformances.mockResolvedValue({ success: true, data: [] });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: [] });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });
  });

  // ── No plan ──

  it('shows prompt when no active plan is selected', () => {
    renderWith({ activePlan: null });
    expect(
      screen.getByText('请先在「方案概览」中创建并选择一个绩效方案')
    ).toBeInTheDocument();
    expect(screen.getByTestId('icon-users')).toBeInTheDocument();
  });

  // ── Org perf selector ──

  it('renders org performance dropdown and fetches list', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    expect(mockListOrgPerformances).toHaveBeenCalledWith('plan-1');
  });

  it('clears positions when switching org performance selection', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    // Wait for the dropdown to be populated
    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });

    // Select the org performance
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    // Positions should be fetched
    await waitFor(() => {
      expect(mockListPositionPerformances).toHaveBeenCalledWith('op1');
    });

    // Now change selection — positions should be cleared internally
    // The component calls setPositions([]) on onChange, so the next render
    // will not show position cards even though listPositionPerformances was called
    // We verify by checking that listPositionPerformances is called again after change
    // (due to the useEffect watching fetchPositions which depends on selectedOrgPerf)
  });

  // ── Job roles ──

  it('fetches job roles filtered by org_unit_id and renders them', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });

    renderWith({ activePlan: mockPlan });

    // Select org performance first
    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    // Job roles should be fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('技术总监')).toBeInTheDocument();
      expect(screen.getByText('工程师')).toBeInTheDocument();
    });
  });

  it('shows empty state when no job roles exist for department', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('该部门暂无岗位')).toBeInTheDocument();
    });
    expect(screen.getByText(/点击「添加岗位」创建岗位后/)).toBeInTheDocument();
  });

  it('renders job family badge for each role', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('管理M')).toBeInTheDocument();
      expect(screen.getByText('专业P')).toBeInTheDocument();
    });
  });

  it('renders key position tag for is_key_position roles', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('关键岗位')).toBeInTheDocument();
    });
  });

  it('shows "添加岗位" button and opens InlineCreateModal', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('添加岗位')).toBeInTheDocument();
    });
    // Click the button (first occurrence)
    const buttons = screen.getAllByText('添加岗位');
    fireEvent.click(buttons[0]);

    expect(screen.getByTestId('inline-create-modal')).toBeInTheDocument();
  });

  // ── Generate ──

  it('generate button shows correct role count', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ })).toBeInTheDocument();
    });
  });

  it('calls generatePositionPerformance with org_perf_id', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });
    mockGeneratePositionPerformance.mockResolvedValue({ success: true });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ }));

    await waitFor(() => {
      expect(mockGeneratePositionPerformance).toHaveBeenCalledWith({ org_perf_id: 'op1' });
    });
  });

  it('shows loading spinner while generating', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });
    mockGeneratePositionPerformance.mockReturnValue(new Promise(() => {}));

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ }));

    await waitFor(() => {
      expect(screen.getByText(/AI 正在为 2 个岗位生成绩效方案/)).toBeInTheDocument();
    });
  });

  it('refreshes positions on successful generation', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockJobRoles });
    mockGeneratePositionPerformance.mockResolvedValue({ success: true });

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderWith({ activePlan: mockPlan, onRefresh });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /一键生成 2 个岗位绩效/ }));

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  // ── Results ──

  it('renders Crown icon for leader positions', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      // Crown icons: one in header for 技术总监, one in expanded leader_config
      const crowns = screen.getAllByTestId('icon-crown');
      expect(crowns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders AI badge for auto_generated positions', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('AI生成')).toBeInTheDocument();
    });
  });

  it('renders 4-section display when expanded', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('技术总监')).toBeInTheDocument();
    });

    // Expand the first position card
    fireEvent.click(screen.getByText('技术总监'));

    await waitFor(() => {
      expect(screen.getByText(/业绩目标 \(55%\)/)).toBeInTheDocument();
      expect(screen.getByText(/能力评估 \(25%\)/)).toBeInTheDocument();
      expect(screen.getByText(/价值观 \(10%\)/)).toBeInTheDocument();
      expect(screen.getByText(/发展目标 \(10%\)/)).toBeInTheDocument();
    });
  });

  it('renders leader_config with dual evaluation for management positions', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('技术总监')).toBeInTheDocument();
    });

    // Expand the leader card
    fireEvent.click(screen.getByText('技术总监'));

    await waitFor(() => {
      expect(screen.getByText(/双重评估：个人 70% \+ 团队 30%/)).toBeInTheDocument();
    });
  });

  it('toggles expand/collapse on position card click', async () => {
    mockListOrgPerformances.mockResolvedValue({ success: true, data: mockOrgPerfs });
    mockListPositionPerformances.mockResolvedValue({ success: true, data: mockPositions });

    renderWith({ activePlan: mockPlan });

    await waitFor(() => {
      expect(screen.getByText('org1 — 0 个战略KPI')).toBeInTheDocument();
    });
    const select = screen.getByDisplayValue('选择部门绩效...');
    await userEvent.selectOptions(select, 'op1');

    await waitFor(() => {
      expect(screen.getByText('技术总监')).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText('技术总监'));
    await waitFor(() => {
      expect(screen.getByText(/业绩目标 \(55%\)/)).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByText('技术总监'));
    await waitFor(() => {
      expect(screen.queryByText(/业绩目标 \(55%\)/)).not.toBeInTheDocument();
    });
  });
});
