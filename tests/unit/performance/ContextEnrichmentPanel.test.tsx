import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (must be before imports) ──

const mockEnrichPlanContext = vi.fn();
const mockBridgeStrategyData = vi.fn();
vi.mock('@/lib/api/performance-api', () => ({
  enrichPlanContext: (...args: unknown[]) => mockEnrichPlanContext(...args),
  bridgeStrategyData: (...args: unknown[]) => mockBridgeStrategyData(...args),
}));

vi.mock('lucide-react', () => ({
  FileText: () => <svg data-testid="icon-filetext" />,
  Upload: () => <svg data-testid="icon-upload" />,
  CheckCircle: () => <svg data-testid="icon-checkcircle" />,
  Circle: () => <svg data-testid="icon-circle" />,
  ArrowDownToLine: () => <svg data-testid="icon-arrowdown" />,
  Save: () => <svg data-testid="icon-save" />,
  X: () => <svg data-testid="icon-x" />,
}));

// ── Imports (after mocks) ──

import ContextEnrichmentPanel from '@/components/performance/ContextEnrichmentPanel';
import type { PerformancePlan } from '@/types/performance';

// ── Mock Data ──

const mockPlanEmpty: PerformancePlan = {
  _key: 'plan1',
  properties: {
    plan_name: '测试方案',
    project_id: 'proj1',
    client_name: '客户A',
    business_context: {},
  },
};

const mockPlanFilled: PerformancePlan = {
  _key: 'plan1',
  properties: {
    plan_name: '测试方案',
    project_id: 'proj1',
    client_name: '客户A',
    business_context: {
      client_profile: '一家大型制造业企业，年营收50亿',
      market_insights: '行业增长放缓，竞争加剧',
    },
  },
};

const defaultProps = {
  plan: mockPlanEmpty,
  onUpdated: vi.fn().mockResolvedValue(undefined),
};

// ── Helper ──

function renderComponent(props: Partial<typeof defaultProps> = {}) {
  return render(<ContextEnrichmentPanel {...defaultProps} {...props} />);
}

// ── Tests ──

describe('ContextEnrichmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrichPlanContext.mockResolvedValue({ success: true });
    mockBridgeStrategyData.mockResolvedValue({ success: true, data: { imported_sections: ['client_profile'] } });
  });

  // ─── Empty State ───

  describe('empty state', () => {
    it('shows 4 context sections with "暂未填写" placeholders', () => {
      renderComponent({ plan: mockPlanEmpty });
      expect(screen.getByText('客户概况')).toBeInTheDocument();
      expect(screen.getByText('业务复盘')).toBeInTheDocument();
      expect(screen.getByText('市场洞察')).toBeInTheDocument();
      expect(screen.getByText('战略方向')).toBeInTheDocument();

      // All 4 sections show "暂未填写"
      const placeholders = screen.getAllByText('暂未填写');
      expect(placeholders).toHaveLength(4);
    });

    it('shows filledCount as 0/4', () => {
      renderComponent({ plan: mockPlanEmpty });
      expect(screen.getByText('0/4 已填充')).toBeInTheDocument();
    });

    it('shows 4 Circle (empty) icons', () => {
      renderComponent({ plan: mockPlanEmpty });
      const circles = screen.getAllByTestId('icon-circle');
      expect(circles).toHaveLength(4);
    });

    it('each section has a "填写" button', () => {
      renderComponent({ plan: mockPlanEmpty });
      const fillButtons = screen.getAllByText('填写');
      expect(fillButtons).toHaveLength(4);
    });
  });

  // ─── Filled State ───

  describe('filled state', () => {
    it('shows green checkmark for filled sections', () => {
      renderComponent({ plan: mockPlanFilled });
      const checkmarks = screen.getAllByTestId('icon-checkcircle');
      expect(checkmarks).toHaveLength(2); // client_profile + market_insights
    });

    it('shows filledCount as 2/4', () => {
      renderComponent({ plan: mockPlanFilled });
      expect(screen.getByText('2/4 已填充')).toBeInTheDocument();
    });

    it('shows content summary for filled sections', () => {
      renderComponent({ plan: mockPlanFilled });
      expect(screen.getByText(/一家大型制造业企业/)).toBeInTheDocument();
      expect(screen.getByText(/行业增长放缓/)).toBeInTheDocument();
    });

    it('shows "编辑" button for filled sections', () => {
      renderComponent({ plan: mockPlanFilled });
      const editButtons = screen.getAllByText('编辑');
      expect(editButtons).toHaveLength(2);
    });
  });

  // ─── Edit Mode ───

  describe('edit mode', () => {
    it('shows textarea when "填写" is clicked', () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]); // client_profile
      expect(screen.getByPlaceholderText(/请输入客户基本信息/)).toBeInTheDocument();
    });

    it('shows Save and Cancel buttons in edit mode', () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]);
      expect(screen.getByText('保存')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
    });

    it('calls enrichPlanContext on save', async () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]); // client_profile

      const textarea = screen.getByPlaceholderText(/请输入客户基本信息/);
      fireEvent.change(textarea, { target: { value: '新客户信息' } });
      fireEvent.click(screen.getByText('保存'));

      expect(mockEnrichPlanContext).toHaveBeenCalledWith('plan1', 'client_profile', '新客户信息');
    });

    it('calls onUpdated after successful save', async () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]);
      fireEvent.change(screen.getByPlaceholderText(/请输入客户基本信息/), {
        target: { value: '测试内容' },
      });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(defaultProps.onUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error on save failure', async () => {
      mockEnrichPlanContext.mockResolvedValue({ success: false, error: '保存失败' });

      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]);
      fireEvent.change(screen.getByPlaceholderText(/请输入客户基本信息/), {
        target: { value: '内容' },
      });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(screen.getByText('保存失败')).toBeInTheDocument();
      });
    });

    it('closes edit mode on cancel', () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]);
      expect(screen.getByPlaceholderText(/请输入客户基本信息/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('取消'));
      expect(screen.queryByPlaceholderText(/请输入客户基本信息/)).not.toBeInTheDocument();
    });

    it('disables save button when content is empty', () => {
      renderComponent({ plan: mockPlanEmpty });
      fireEvent.click(screen.getAllByText('填写')[0]);

      const saveBtn = screen.getByText('保存');
      expect(saveBtn).toBeDisabled();
    });
  });

  // ─── Import ───

  describe('import from strategy', () => {
    it('shows import button', () => {
      renderComponent();
      expect(screen.getByText('从战略解码导入')).toBeInTheDocument();
    });

    it('calls bridgeStrategyData on import click', () => {
      renderComponent({ plan: mockPlanFilled });
      fireEvent.click(screen.getByText('从战略解码导入'));
      expect(mockBridgeStrategyData).toHaveBeenCalledWith('plan1', 'proj1');
    });

    it('shows error on import failure', async () => {
      mockBridgeStrategyData.mockResolvedValue({ success: false, error: '导入失败' });

      renderComponent();
      fireEvent.click(screen.getByText('从战略解码导入'));

      await waitFor(() => {
        expect(screen.getByText('导入失败')).toBeInTheDocument();
      });
    });
  });
});
