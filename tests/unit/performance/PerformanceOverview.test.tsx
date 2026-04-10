import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
  };
});

const mockListPlans = vi.fn();
const mockGetPerformanceOverview = vi.fn();
vi.mock('@/lib/api/performance-api', () => ({
  listPlans: (...args: unknown[]) => mockListPlans(...args),
  getPerformanceOverview: (...args: unknown[]) => mockGetPerformanceOverview(...args),
}));

vi.mock('@/components/performance/PlanOverviewTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="plan-tab">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/components/performance/OrgPerformanceTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="org-perf-tab">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/components/performance/PositionPerformanceTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="pos-perf-tab">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/components/performance/ReviewTemplateTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="template-tab">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/components/performance/AnalyticsTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="analytics-tab">{JSON.stringify(props)}</div>
  ),
}));
vi.mock('@/components/performance/ReportTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="report-tab">{JSON.stringify(props)}</div>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────

import PerformancePage from '@/components/performance/PerformanceOverview';

const MOCK_PROJECT_ID = 'proj-001';

const mockPlan = {
  _key: 'plan-001',
  properties: {
    plan_name: '2026 年度绩效方案',
    project_id: MOCK_PROJECT_ID,
    methodology: 'balanced_scorecard',
    cycle_type: 'annual',
  },
};

const mockOverview = {
  plans: 3,
  org_performances: 5,
  position_performances: 20,
  leaders: 8,
  professionals: 45,
  templates: 2,
  reviews: 30,
  calibrations: 1,
  auto_generated: 18,
  edited: 12,
};

function renderPage() {
  mockUseParams.mockReturnValue({ id: MOCK_PROJECT_ID });
  return render(<PerformancePage />);
}

// ─── Tests ────────────────────────────────────────────────

describe('PerformancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPlans.mockResolvedValue({
      success: true,
      data: [mockPlan],
    });
    mockGetPerformanceOverview.mockResolvedValue({
      success: true,
      data: mockOverview,
    });
  });

  // 1. Initialization: fetches plans on mount, auto-selects first plan, shows loading
  it('fetches plans and overview on mount, then auto-selects the first plan', async () => {
    renderPage();

    // loading spinner is shown initially
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    // After data loads, the plan tab should be visible with the first plan selected
    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    expect(mockListPlans).toHaveBeenCalledWith(MOCK_PROJECT_ID);
    expect(mockGetPerformanceOverview).toHaveBeenCalledWith(MOCK_PROJECT_ID);

    // The plan-tab mock renders props as JSON, so we can check the active plan was set
    const planTab = screen.getByTestId('plan-tab');
    expect(planTab.textContent).toContain('plan-001');
  });

  it('shows loading spinner while fetching data', () => {
    // Keep promises pending so loading stays true
    mockListPlans.mockReturnValue(new Promise(() => {}));
    mockGetPerformanceOverview.mockReturnValue(new Promise(() => {}));

    renderPage();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // 2. Header: renders page title
  it('renders the page title', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('绩效管理咨询')).toBeInTheDocument();
    });
  });

  it('renders overview stats subtitle when overview data is available', async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          '3 个方案 · 5 个部门绩效 · 20 个岗位绩效'
        )
      ).toBeInTheDocument();
    });
  });

  it('does not render overview stats when overview data is null', async () => {
    mockGetPerformanceOverview.mockResolvedValue({
      success: true,
      data: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('绩效管理咨询')).toBeInTheDocument();
    });

    expect(screen.queryByText(/个方案/)).not.toBeInTheDocument();
  });

  // 3. Tab navigation
  const tabNames = ['方案概览', '组织绩效', '岗位绩效', '考核表单', '数据分析', '报告生成'];

  it('renders all 6 tab buttons', async () => {
    renderPage();

    await waitFor(() => {
      tabNames.forEach((name) => {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      });
    });
  });

  it('highlights the active tab by default (方案概览)', async () => {
    renderPage();

    await waitFor(() => {
      const activeButton = screen.getByRole('button', { name: '方案概览' });
      expect(activeButton.className).toContain('bg-white');
      expect(activeButton.className).toContain('text-indigo-700');
    });
  });

  it('switches active tab on click and highlights the new tab', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    // Click "组织绩效" tab
    fireEvent.click(screen.getByRole('button', { name: '组织绩效' }));

    const orgButton = screen.getByRole('button', { name: '组织绩效' });
    expect(orgButton.className).toContain('bg-white');
    expect(orgButton.className).toContain('text-indigo-700');

    // Previous tab should lose active styling
    const planButton = screen.getByRole('button', { name: '方案概览' });
    expect(planButton.className).not.toContain('bg-white');
    expect(planButton.className).toContain('text-gray-500');
  });

  it('renders PlanOverviewTab when plan tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });
  });

  it('renders OrgPerformanceTab when org-perf tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '组织绩效' }));

    await waitFor(() => {
      expect(screen.getByTestId('org-perf-tab')).toBeInTheDocument();
    });

    // plan tab should no longer be visible
    expect(screen.queryByTestId('plan-tab')).not.toBeInTheDocument();
  });

  it('renders PositionPerformanceTab when pos-perf tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '岗位绩效' }));

    await waitFor(() => {
      expect(screen.getByTestId('pos-perf-tab')).toBeInTheDocument();
    });
  });

  it('renders ReviewTemplateTab when template tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '考核表单' }));

    await waitFor(() => {
      expect(screen.getByTestId('template-tab')).toBeInTheDocument();
    });
  });

  it('renders AnalyticsTab when analytics tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '数据分析' }));

    await waitFor(() => {
      expect(screen.getByTestId('analytics-tab')).toBeInTheDocument();
    });
  });

  it('renders ReportTab when report tab is active', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('plan-tab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '报告生成' }));

    await waitFor(() => {
      expect(screen.getByTestId('report-tab')).toBeInTheDocument();
    });
  });
});
