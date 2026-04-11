import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (must be before imports) ──

const mockListStrategicGoals = vi.fn();
const mockCreateStrategicGoal = vi.fn();
const mockUpdateStrategicGoal = vi.fn();
const mockDecomposeInitiative = vi.fn();
vi.mock('@/lib/api/performance-api', () => ({
  listStrategicGoals: (...args: unknown[]) => mockListStrategicGoals(...args),
  createStrategicGoal: (...args: unknown[]) => mockCreateStrategicGoal(...args),
  updateStrategicGoal: (...args: unknown[]) => mockUpdateStrategicGoal(...args),
  decomposeInitiative: (...args: unknown[]) => mockDecomposeInitiative(...args),
}));

const mockGetObjectsByModel = vi.fn();
vi.mock('@/lib/api/kernel-client', () => ({
  getObjectsByModel: (...args: unknown[]) => mockGetObjectsByModel(...args),
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Pencil: () => <svg data-testid="icon-pencil" />,
  Save: () => <svg data-testid="icon-save" />,
  X: () => <svg data-testid="icon-x" />,
  Trash2: () => <svg data-testid="icon-trash2" />,
  ChevronDown: () => <svg data-testid="icon-chevrondown" />,
  ChevronRight: () => <svg data-testid="icon-chevronright" />,
  Target: () => <svg data-testid="icon-target" />,
  Lightbulb: () => <svg data-testid="icon-lightbulb" />,
  TrendingUp: () => <svg data-testid="icon-trendingup" />,
  DollarSign: () => <svg data-testid="icon-dollar" />,
  BarChart3: () => <svg data-testid="icon-barchart" />,
  GraduationCap: () => <svg data-testid="icon-gradcap" />,
}));

// ── Imports (after mocks) ──

import StrategicGoalsTab from '@/components/performance/StrategicGoalsTab';
import type { PerformancePlan } from '@/types/performance';

// ── Mock Data ──

const mockActivePlan: PerformancePlan = {
  _key: 'plan1',
  properties: {
    plan_name: '测试方案',
    project_id: 'proj1',
    client_name: '客户A',
  },
};

const mockGoalsData = [
  {
    _key: 'g1',
    properties: {
      goal_name: '提升市场份额',
      goal_type: 'operational_kpi',
      priority: 'P0',
      status: '进行中',
      target_value: 30,
    },
  },
  {
    _key: 'g2',
    properties: {
      goal_name: '数字化转型',
      goal_type: 'strategic_initiative',
      priority: 'P1',
      status: '进行中',
      milestones: [
        { phase: '阶段1', date: '2026-03', deliverable: '需求分析' },
      ],
    },
  },
  {
    _key: 'g3',
    properties: {
      goal_name: '营收增长',
      goal_type: 'revenue_target',
      priority: 'P0',
      status: '进行中',
      target_value: 100,
    },
  },
];

const mockInitiatives = [
  {
    _key: 'ini1',
    _id: 'sys_objects/ini1',
    model_key: 'Strategic_Initiative',
    properties: {
      initiative_name: '车间自动化升级',
      status: '进行中',
      description: '全面升级产线自动化水平',
      milestones: [],
    },
  },
];

const defaultProps = {
  projectId: 'proj-1',
  activePlan: null as PerformancePlan | null,
  onRefresh: vi.fn().mockResolvedValue(undefined),
};

// ── Helper ──

function renderComponent(props: Partial<typeof defaultProps> = {}) {
  return render(<StrategicGoalsTab {...defaultProps} {...props} />);
}

// ── Tests ──

describe('StrategicGoalsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });
    mockCreateStrategicGoal.mockResolvedValue({ success: true });
    mockDecomposeInitiative.mockResolvedValue({ success: true, data: { milestones_count: 2 } });
  });

  // ─── Empty State ───

  describe('empty state', () => {
    it('shows prompt when no active plan', () => {
      renderComponent({ activePlan: null });
      expect(screen.getByText('请先在「方案概览」中创建并选择一个绩效方案')).toBeInTheDocument();
    });

    it('shows empty state when no goals and no initiatives', async () => {
      renderComponent({ activePlan: mockActivePlan });
      await waitFor(() => {
        expect(screen.getByText('暂无战略目标，请添加或从战略解码导入')).toBeInTheDocument();
      });
    });
  });

  // ─── Goals List ───

  describe('goals list', () => {
    it('fetches goals on mount with activePlan', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });
      expect(mockListStrategicGoals).toHaveBeenCalledWith('proj-1');
    });

    it('renders goals grouped by type', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('提升市场份额')).toBeInTheDocument();
        expect(screen.getByText('数字化转型')).toBeInTheDocument();
        expect(screen.getByText('营收增长')).toBeInTheDocument();
      });
    });

    it('shows type group headers', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('运营指标')).toBeInTheDocument();
        expect(screen.getByText('战略举措')).toBeInTheDocument();
        expect(screen.getByText('营收目标')).toBeInTheDocument();
      });
    });

    it('shows target value when present', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('目标: 30')).toBeInTheDocument();
        expect(screen.getByText('目标: 100')).toBeInTheDocument();
      });
    });

    it('shows milestones count when present', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('1 里程碑')).toBeInTheDocument();
      });
    });

    it('shows priority badges', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: mockGoalsData });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('P0')).toBeInTheDocument();
        expect(screen.getByText('P1')).toBeInTheDocument();
      });
    });
  });

  // ─── Strategic Initiatives ───

  describe('strategic initiatives', () => {
    it('shows initiatives section when initiatives exist', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockInitiatives });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('车间自动化升级')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows AI decompose button for initiatives', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockInitiatives });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('AI 分解')).toBeInTheDocument();
      });
    });

    it('calls decomposeInitiative on AI decompose click', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockInitiatives });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('AI 分解')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('AI 分解'));

      expect(mockDecomposeInitiative).toHaveBeenCalledWith('ini1', 'plan1');
    });

    it('shows description when initiative is expanded', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockInitiatives });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('车间自动化升级')).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText('车间自动化升级'));

      await waitFor(() => {
        expect(screen.getByText('全面升级产线自动化水平')).toBeInTheDocument();
      });
    });

    it('shows "尚未分解" hint for initiatives without milestones', async () => {
      mockListStrategicGoals.mockResolvedValue({ success: true, data: [] });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockInitiatives });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('车间自动化升级')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('车间自动化升级'));

      await waitFor(() => {
        expect(screen.getByText(/尚未分解/)).toBeInTheDocument();
      });
    });
  });

  // ─── Create Goal ───

  describe('create goal', () => {
    it('disables add button when name is empty', () => {
      renderComponent({ activePlan: mockActivePlan });
      const addBtn = screen.getByText('添加目标');
      expect(addBtn).toBeDisabled();
    });

    it('enables add button when name is filled', () => {
      renderComponent({ activePlan: mockActivePlan });
      const input = screen.getByPlaceholderText('输入目标名称...');
      fireEvent.change(input, { target: { value: '新目标' } });
      const addBtn = screen.getByText('添加目标');
      expect(addBtn).not.toBeDisabled();
    });

    it('calls createStrategicGoal on add click', async () => {
      mockCreateStrategicGoal.mockResolvedValue({ success: true });

      renderComponent({ activePlan: mockActivePlan });
      fireEvent.change(screen.getByPlaceholderText('输入目标名称...'), {
        target: { value: '新目标' },
      });
      fireEvent.click(screen.getByText('添加目标'));

      expect(mockCreateStrategicGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_name: '新目标',
          goal_type: 'operational_kpi',
          priority: 'P2',
          status: '进行中',
        }),
      );
    });

    it('shows error on create failure', async () => {
      mockCreateStrategicGoal.mockResolvedValue({ success: false, error: '创建失败' });

      renderComponent({ activePlan: mockActivePlan });
      fireEvent.change(screen.getByPlaceholderText('输入目标名称...'), {
        target: { value: '会失败的目标' },
      });
      fireEvent.click(screen.getByText('添加目标'));

      await waitFor(() => {
        expect(screen.getByText('创建失败')).toBeInTheDocument();
      });
    });
  });

  // ─── Controls ───

  describe('controls', () => {
    it('renders goal type selector', () => {
      renderComponent({ activePlan: mockActivePlan });
      expect(screen.getByText('目标类型')).toBeInTheDocument();
    });

    it('renders priority selector', () => {
      renderComponent({ activePlan: mockActivePlan });
      // P2 is default
      expect(screen.getByDisplayValue('P2')).toBeInTheDocument();
    });
  });
});
