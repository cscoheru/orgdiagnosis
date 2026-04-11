import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (must be before imports) ──

const mockCreatePlan = vi.fn();
const mockUpdatePlan = vi.fn();
vi.mock('@/lib/api/performance-api', () => ({
  createPlan: (...args: unknown[]) => mockCreatePlan(...args),
  updatePlan: (...args: unknown[]) => mockUpdatePlan(...args),
}));

const mockGetObjectsByModel = vi.fn();
const mockUpdateObject = vi.fn();
const mockDeleteObject = vi.fn();
vi.mock('@/lib/api/kernel-client', () => ({
  getObjectsByModel: (...args: unknown[]) => mockGetObjectsByModel(...args),
  updateObject: (...args: unknown[]) => mockUpdateObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="icon-plus" />,
  Settings2: () => <svg data-testid="icon-settings2" />,
  Target: () => <svg data-testid="icon-target" />,
  Trash2: () => <svg data-testid="icon-trash2" />,
  Edit3: () => <svg data-testid="icon-edit3" />,
  // Icons used by embedded ContextEnrichmentPanel
  FileText: () => <svg data-testid="icon-filetext" />,
  Upload: () => <svg data-testid="icon-upload" />,
  CheckCircle: () => <svg data-testid="icon-checkcircle" />,
  Circle: () => <svg data-testid="icon-circle" />,
  ArrowDownToLine: () => <svg data-testid="icon-arrowdown" />,
  Save: () => <svg data-testid="icon-save" />,
  X: () => <svg data-testid="icon-x" />,
}));

vi.mock('../../../components/performance/InlineCreateModal', () => ({
  __esModule: true,
  default: ({ title, open }: { title: string; open: boolean }) =>
    open ? <div data-testid="inline-create-modal">{title}</div> : null,
}));

// ── Imports (after mocks) ──

import PlanOverviewTab from '@/components/performance/PlanOverviewTab';
import type { PerformancePlan } from '@/types/performance';
import type { KernelObject } from '@/lib/api/kernel-client';

// ── Mock Data ──

const mockPlans: PerformancePlan[] = [
  {
    _key: 'plan1',
    properties: {
      plan_name: '测试方案',
      project_id: 'proj1',
      client_name: '客户A',
      industry: '科技',
      methodology: 'KPI',
      cycle_type: '年度',
      description: '这是一个测试方案',
      status: '草拟中',
    },
  },
  {
    _key: 'plan2',
    properties: {
      plan_name: '执行方案',
      project_id: 'proj1',
      client_name: '客户B',
      methodology: 'OKR',
      cycle_type: '季度',
      status: '执行中',
    },
  },
];

const mockGoals: KernelObject[] = [
  {
    _key: 'g1',
    _id: 'sys_objects/g1',
    model_key: 'Strategic_Goal',
    properties: { goal_name: '提升市场份额', priority: 'P0', owner: '张三', period: '2026' },
  },
  {
    _key: 'g2',
    _id: 'sys_objects/g2',
    model_key: 'Strategic_Goal',
    properties: { goal_name: '降低运营成本', priority: 'P1', owner: '李四' },
  },
];

const defaultProps = {
  projectId: 'proj-1',
  plans: [] as PerformancePlan[],
  activePlan: null as PerformancePlan | null,
  onSelectPlan: vi.fn(),
  onRefresh: vi.fn().mockResolvedValue(undefined),
};

// ── Helper ──

function renderComponent(props: Partial<typeof defaultProps> = {}) {
  return render(<PlanOverviewTab {...defaultProps} {...props} />);
}

// ── Tests ──

describe('PlanOverviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });
  });

  // ─── Empty State ───

  describe('empty state', () => {
    it('shows empty prompt when no plans', () => {
      renderComponent({ plans: [] });
      expect(screen.getByText('暂无绩效方案，点击上方按钮创建')).toBeInTheDocument();
    });

    it('shows the "新建方案" button', () => {
      renderComponent({ plans: [] });
      expect(screen.getByText('新建方案')).toBeInTheDocument();
    });

    it('renders the Settings2 icon in empty state', () => {
      renderComponent({ plans: [] });
      expect(screen.getByTestId('icon-settings2')).toBeInTheDocument();
    });
  });

  // ─── Plan List ───

  describe('plan list', () => {
    it('renders plan cards with name', () => {
      renderComponent({ plans: mockPlans });
      expect(screen.getByText('测试方案')).toBeInTheDocument();
      expect(screen.getByText('执行方案')).toBeInTheDocument();
    });

    it('renders methodology and cycle_type for each plan', () => {
      renderComponent({ plans: mockPlans });
      // Plan 1: KPI / 年度
      expect(screen.getByText('KPI · 年度 · 客户A')).toBeInTheDocument();
      // Plan 2: OKR / 季度
      expect(screen.getByText('OKR · 季度 · 客户B')).toBeInTheDocument();
    });

    it('highlights the active plan', () => {
      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });
      const activeCard = screen.getByText('测试方案').closest('div.cursor-pointer');
      expect(activeCard?.className).toContain('border-indigo-300');
      expect(activeCard?.className).toContain('bg-indigo-50/50');
    });

    it('does not highlight inactive plans', () => {
      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });
      const inactiveCard = screen.getByText('执行方案').closest('div.cursor-pointer');
      expect(inactiveCard?.className).toContain('border-gray-200');
    });

    it('shows status badge for each plan', () => {
      renderComponent({ plans: mockPlans });
      expect(screen.getByText('草拟中')).toBeInTheDocument();
      expect(screen.getByText('执行中')).toBeInTheDocument();
    });

    it('calls onSelectPlan when a plan card is clicked', () => {
      const onSelectPlan = vi.fn();
      renderComponent({ plans: mockPlans, onSelectPlan });
      fireEvent.click(screen.getByText('测试方案').closest('div.cursor-pointer')!);
      expect(onSelectPlan).toHaveBeenCalledTimes(1);
      expect(onSelectPlan).toHaveBeenCalledWith(mockPlans[0]);
    });

    it('renders plan description when present', () => {
      renderComponent({ plans: mockPlans });
      expect(screen.getByText('这是一个测试方案')).toBeInTheDocument();
    });
  });

  // ─── Create Plan ───

  describe('create plan', () => {
    it('shows create form on button click', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));
      expect(screen.getByText('新建绩效方案')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      expect(screen.getByPlaceholderText('例：XX公司 2026年度绩效方案')).toBeInTheDocument();
      expect(screen.getByText('客户名称')).toBeInTheDocument();
      expect(screen.getByText('所属行业')).toBeInTheDocument();
      expect(screen.getByText('评估方法 *')).toBeInTheDocument();
      expect(screen.getByText('考核周期 *')).toBeInTheDocument();
      expect(screen.getByText('涉及员工数')).toBeInTheDocument();
      expect(screen.getByText('方案概述')).toBeInTheDocument();
    });

    it('methodology dropdown has all options', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      const methodologySelect = screen.getByDisplayValue('KPI');
      fireEvent.change(methodologySelect, { target: { value: 'OKR' } });
      expect(screen.getByDisplayValue('OKR')).toBeInTheDocument();
    });

    it('calls createPlan and onRefresh on successful submit', async () => {
      mockCreatePlan.mockResolvedValue({
        success: true,
        data: { _key: 'new-plan', properties: { plan_name: '新方案' } },
      });

      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      fireEvent.change(screen.getByPlaceholderText('例：XX公司 2026年度绩效方案'), {
        target: { value: '新方案' },
      });
      fireEvent.click(screen.getByText('创建方案'));

      expect(mockCreatePlan).toHaveBeenCalledTimes(1);
      const callArgs = mockCreatePlan.mock.calls[0][0];
      expect(callArgs.plan_name).toBe('新方案');
      expect(callArgs.project_id).toBe('proj-1');
      expect(callArgs.methodology).toBe('KPI');
      expect(callArgs.cycle_type).toBe('年度');
      expect(callArgs.status).toBe('草拟中');

      await waitFor(() => {
        expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error on create failure', async () => {
      mockCreatePlan.mockResolvedValue({
        success: false,
        error: '网络错误',
      });

      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      fireEvent.change(screen.getByPlaceholderText('例：XX公司 2026年度绩效方案'), {
        target: { value: '会失败的方案' },
      });
      fireEvent.click(screen.getByText('创建方案'));

      await waitFor(() => {
        expect(screen.getByText('网络错误')).toBeInTheDocument();
      });
    });

    it('disables submit when plan name is empty', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      const submitBtn = screen.getByText('创建方案');
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit when plan name is filled', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));

      fireEvent.change(screen.getByPlaceholderText('例：XX公司 2026年度绩效方案'), {
        target: { value: '有效方案名' },
      });

      const submitBtn = screen.getByText('创建方案');
      expect(submitBtn).not.toBeDisabled();
    });

    it('hides create form on cancel', () => {
      renderComponent({ plans: [] });
      fireEvent.click(screen.getByText('新建方案'));
      expect(screen.getByText('新建绩效方案')).toBeInTheDocument();

      fireEvent.click(screen.getByText('取消'));
      expect(screen.queryByText('新建绩效方案')).not.toBeInTheDocument();
    });
  });

  // ─── Strategic Goals Section ───

  describe('strategic goals section', () => {
    it('does not render when no active plan', () => {
      renderComponent({ plans: mockPlans, activePlan: null });
      expect(screen.queryByText('战略目标')).not.toBeInTheDocument();
    });

    it('shows goals section when activePlan is set', () => {
      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });
      expect(screen.getByText('战略目标')).toBeInTheDocument();
    });

    it('fetches goals via getObjectsByModel when activePlan changes', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: mockGoals,
      });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      expect(mockGetObjectsByModel).toHaveBeenCalledWith('Strategic_Goal', 100);

      await waitFor(() => {
        expect(screen.getByText('提升市场份额')).toBeInTheDocument();
        expect(screen.getByText('降低运营成本')).toBeInTheDocument();
      });
    });

    it('renders goal list with priority badge', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: mockGoals,
      });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      await waitFor(() => {
        expect(screen.getByText('P0')).toBeInTheDocument();
        expect(screen.getByText('P1')).toBeInTheDocument();
      });
    });

    it('renders goal owner info', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: mockGoals,
      });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      await waitFor(() => {
        // Goal g1 has period + owner: "2026 · 张三"
        expect(screen.getByText('2026 · 张三')).toBeInTheDocument();
        // Goal g2 has only owner (no period), rendered as " · 李四"
        expect(screen.getByText(/· 李四/)).toBeInTheDocument();
      });
    });

    it('shows empty goals state when no goals returned', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      await waitFor(() => {
        expect(screen.getByText('暂无战略目标')).toBeInTheDocument();
        expect(screen.getByText('添加战略目标后，AI 生成组织绩效时将自动引用')).toBeInTheDocument();
      });
    });

    it('calls deleteObject when delete button is clicked', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: mockGoals,
      });
      mockDeleteObject.mockResolvedValue({ success: true });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      await waitFor(() => {
        expect(screen.getByText('提升市场份额')).toBeInTheDocument();
      });

      // The delete button has a Trash2 icon; find it within the goal row
      const trashIcons = screen.getAllByTestId('icon-trash2');
      fireEvent.click(trashIcons[0]);

      expect(mockDeleteObject).toHaveBeenCalledWith('g1');

      await waitFor(() => {
        expect(screen.queryByText('提升市场份额')).not.toBeInTheDocument();
      });
    });

    it('shows goal count in header', async () => {
      mockGetObjectsByModel.mockResolvedValue({
        success: true,
        data: mockGoals,
      });

      renderComponent({ plans: mockPlans, activePlan: mockPlans[0] });

      await waitFor(() => {
        expect(screen.getByText('(2个)')).toBeInTheDocument();
      });
    });
  });
});
