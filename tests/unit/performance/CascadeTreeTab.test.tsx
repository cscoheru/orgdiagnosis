import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (must be before imports) ──

const mockGetCascadeTree = vi.fn();
const mockCascadeGenerate = vi.fn();
const mockDecomposePeriod = vi.fn();
vi.mock('@/lib/api/performance-api', () => ({
  getCascadeTree: (...args: unknown[]) => mockGetCascadeTree(...args),
  cascadeGenerate: (...args: unknown[]) => mockCascadeGenerate(...args),
  decomposePeriod: (...args: unknown[]) => mockDecomposePeriod(...args),
}));

const mockGetObjectsByModel = vi.fn();
vi.mock('@/lib/api/kernel-client', () => ({
  getObjectsByModel: (...args: unknown[]) => mockGetObjectsByModel(...args),
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  ChevronDown: () => <svg data-testid="icon-chevrondown" />,
  ChevronRight: () => <svg data-testid="icon-chevronright" />,
  GitBranch: () => <svg data-testid="icon-gitbranch" />,
  Building2: () => <svg data-testid="icon-building2" />,
  User: () => <svg data-testid="icon-user" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  RefreshCw: () => <svg data-testid="icon-refreshcw" />,
}));

// ── Imports (after mocks) ──

import CascadeTreeTab from '@/components/performance/CascadeTreeTab';
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

const mockOrgUnits = [
  {
    _key: 'org1',
    properties: { unit_name: '总公司' },
  },
  {
    _key: 'org2',
    properties: { unit_name: '技术部' },
  },
];

const mockTree = [
  {
    _key: 'op1',
    type: 'org_performance',
    name: '总公司绩效',
    perf_type: 'company',
    period_target: '2026年度',
    status: '已生成',
    children: [
      {
        _key: 'op2',
        type: 'org_performance',
        name: '技术部绩效',
        perf_type: 'department',
        period_target: '2026年度',
        status: '已生成',
        children: [],
      },
      {
        _key: 'pp1',
        type: 'position_performance',
        name: '技术总监岗位绩效',
        is_leader: true,
        status: '已生成',
        children: [],
      },
    ],
  },
];

const defaultProps = {
  projectId: 'proj-1',
  activePlan: null as PerformancePlan | null,
  onRefresh: vi.fn().mockResolvedValue(undefined),
};

// ── Helper ──

function renderComponent(props: Partial<typeof defaultProps> = {}) {
  return render(<CascadeTreeTab {...defaultProps} {...props} />);
}

// ── Tests ──

describe('CascadeTreeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCascadeTree.mockResolvedValue({ success: true, data: { tree: [] } });
    mockGetObjectsByModel.mockResolvedValue({ success: true, data: [] });
    mockCascadeGenerate.mockResolvedValue({
      success: true,
      data: { org_performances: 2, position_performances: 1 },
    });
    mockDecomposePeriod.mockResolvedValue({
      success: true,
      data: { periods_created: 4 },
    });
  });

  // ─── Empty State ───

  describe('empty state', () => {
    it('shows prompt when no active plan', () => {
      renderComponent({ activePlan: null });
      expect(screen.getByText('请先在「方案概览」中创建并选择一个绩效方案')).toBeInTheDocument();
    });

    it('shows empty tree hint when tree is empty', async () => {
      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('选择根部门并点击「一键级联生成」创建目标层级')).toBeInTheDocument();
      });
    });
  });

  // ─── Controls ───

  describe('controls', () => {
    it('shows root department selector', async () => {
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('选择根部门（公司总部）')).toBeInTheDocument();
        expect(screen.getByText('选择根部门...')).toBeInTheDocument();
      });
    });

    it('shows cascade generate button', () => {
      renderComponent({ activePlan: mockActivePlan });
      expect(screen.getByText('一键级联生成')).toBeInTheDocument();
    });

    it('disables cascade button when no root selected', () => {
      renderComponent({ activePlan: mockActivePlan });
      const btn = screen.getByText('一键级联生成');
      expect(btn).toBeDisabled();
    });

    it('shows refresh button', () => {
      renderComponent({ activePlan: mockActivePlan });
      expect(screen.getByTestId('icon-refreshcw')).toBeInTheDocument();
    });
  });

  // ─── Org Units ───

  describe('org units dropdown', () => {
    it('shows org units in dropdown', async () => {
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司')).toBeInTheDocument();
        expect(screen.getByText('技术部')).toBeInTheDocument();
      });
    });

    it('selects an org unit from dropdown', async () => {
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('选择根部门...');
      fireEvent.change(select, { target: { value: 'org1' } });

      // Button should now be enabled
      const btn = screen.getByText('一键级联生成');
      expect(btn).not.toBeDisabled();
    });
  });

  // ─── Cascade Generate ───

  describe('cascade generate', () => {
    it('calls cascadeGenerate with correct args', async () => {
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('选择根部门...');
      fireEvent.change(select, { target: { value: 'org1' } });
      fireEvent.click(screen.getByText('一键级联生成'));

      expect(mockCascadeGenerate).toHaveBeenCalledWith('plan1', 'org1');
    });

    it('calls onRefresh after successful cascade', async () => {
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('选择根部门...'), { target: { value: 'org1' } });
      fireEvent.click(screen.getByText('一键级联生成'));

      await waitFor(() => {
        expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error on cascade failure', async () => {
      mockCascadeGenerate.mockResolvedValue({ success: false, error: '级联生成失败' });
      mockGetObjectsByModel.mockResolvedValue({ success: true, data: mockOrgUnits });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('选择根部门...'), { target: { value: 'org1' } });
      fireEvent.click(screen.getByText('一键级联生成'));

      await waitFor(() => {
        expect(screen.getByText('级联生成失败')).toBeInTheDocument();
      });
    });
  });

  // ─── Tree Rendering ───

  describe('tree rendering', () => {
    it('renders tree nodes with names', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司绩效')).toBeInTheDocument();
      });
    });

    it('shows perf_type badges', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('公司级')).toBeInTheDocument();
      });

      // Children are collapsed — expand to see child badges
      fireEvent.click(screen.getByText('总公司绩效'));

      await waitFor(() => {
        expect(screen.getByText('部门级')).toBeInTheDocument();
      });
    });

    it('shows period_target', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('2026年度')).toBeInTheDocument();
      });
    });

    it('shows status badge', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('已生成')).toBeInTheDocument();
      });
    });

    it('shows "分解到季度" button for org_performance nodes', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        // Root node is visible with its decompose button
        expect(screen.getByText('总公司绩效')).toBeInTheDocument();
      });

      // Root has a decompose button
      const rootBtns = screen.getAllByText('分解到季度');
      expect(rootBtns.length).toBeGreaterThanOrEqual(1);

      // Expand to see child's decompose button
      fireEvent.click(screen.getByText('总公司绩效'));

      await waitFor(() => {
        // Now 2 org_performance nodes visible (root + child)
        const allBtns = screen.getAllByText('分解到季度');
        expect(allBtns).toHaveLength(2);
      });
    });

    it('expands/collapses children on click', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(screen.getByText('总公司绩效')).toBeInTheDocument();
      });

      // Initially children should be hidden (collapsed by default)
      expect(screen.queryByText('技术部绩效')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText('总公司绩效'));

      await waitFor(() => {
        expect(screen.getByText('技术部绩效')).toBeInTheDocument();
        expect(screen.getByText('技术总监岗位绩效')).toBeInTheDocument();
      });
    });
  });

  // ─── Decompose Period ───

  describe('decompose period', () => {
    it('calls decomposePeriod on click', async () => {
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        const btns = screen.getAllByText('分解到季度');
        expect(btns.length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getAllByText('分解到季度')[0]);

      expect(mockDecomposePeriod).toHaveBeenCalledWith('op1');
    });

    it('shows error on decompose failure', async () => {
      mockDecomposePeriod.mockResolvedValue({ success: false, error: '周期分解失败' });
      mockGetCascadeTree.mockResolvedValue({
        success: true,
        data: { tree: mockTree },
      });

      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        const btns = screen.getAllByText('分解到季度');
        expect(btns.length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getAllByText('分解到季度')[0]);

      await waitFor(() => {
        expect(screen.getByText('周期分解失败')).toBeInTheDocument();
      });
    });
  });

  // ─── Refresh ───

  describe('refresh', () => {
    it('calls getCascadeTree and getObjectsByModel on mount', async () => {
      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(mockGetCascadeTree).toHaveBeenCalledWith('plan1');
        expect(mockGetObjectsByModel).toHaveBeenCalledWith('Org_Unit', 100);
      });
    });

    it('re-fetches on refresh button click', async () => {
      renderComponent({ activePlan: mockActivePlan });

      await waitFor(() => {
        expect(mockGetCascadeTree).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByTestId('icon-refreshcw'));

      await waitFor(() => {
        expect(mockGetCascadeTree).toHaveBeenCalledTimes(2);
      });
    });
  });
});
