import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { KernelObject } from "@/lib/api/kernel-client";

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const mockMetaModelResponse = {
  success: true,
  data: {
    model_key: "Strategic_Goal",
    fields: [
      { field_name: "goal_name", field_type: "string", is_required: true, description: "目标名称" },
      { field_name: "priority", field_type: "enum", is_required: false, description: "优先级", enum_options: ["P0", "P1", "P2", "P3"] },
      { field_name: "is_active", field_type: "boolean", is_required: false, description: "是否激活" },
      { field_name: "weight", field_type: "integer", is_required: false, description: "权重" },
      { field_name: "org_ref", field_type: "reference", is_required: false, description: "组织引用" },
    ],
  },
};

const mockCreatedObject: KernelObject = {
  _key: "new1",
  _id: "sys_objects/new1",
  model_key: "Strategic_Goal",
  properties: { goal_name: "test" },
};

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

vi.mock("lucide-react", () => ({
  X: () => <span data-testid="icon-x" />,
  Plus: () => <span data-testid="icon-plus" />,
}));

const mockGetMetaModel = vi.fn();
const mockCreateObject = vi.fn();
const mockUpdateObject = vi.fn();

vi.mock("@/lib/api/kernel-client", () => ({
  getMetaModel: (...args: unknown[]) => mockGetMetaModel(...args),
  createObject: (...args: unknown[]) => mockCreateObject(...args),
  updateObject: (...args: unknown[]) => mockUpdateObject(...args),
}));

import InlineCreateModal from "@/components/performance/InlineCreateModal";

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────

const defaultProps = {
  modelKey: "Strategic_Goal",
  title: "创建战略目标",
  open: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

function renderModal(props: Partial<typeof defaultProps> = {}) {
  const fullProps = { ...defaultProps, ...props };
  return render(<InlineCreateModal {...fullProps} />);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("InlineCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetaModel.mockResolvedValue(mockMetaModelResponse);
    mockCreateObject.mockResolvedValue({ success: true, data: mockCreatedObject });
    mockUpdateObject.mockResolvedValue({ success: true, data: mockCreatedObject });
  });

  // ─── Rendering ───────────────────────────────

  it("returns null when open=false", () => {
    const { container } = renderModal({ open: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows title when open=true", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("创建战略目标")).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetching meta-model", () => {
    mockGetMetaModel.mockReturnValue(new Promise(() => {})); // never resolves
    renderModal();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    mockGetMetaModel.mockResolvedValue({
      success: false,
      error: "网络错误",
    });
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("网络错误")).toBeInTheDocument();
    });
  });

  // ─── Field types ─────────────────────────────

  it("renders enum field as a select element", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("优先级")).toBeInTheDocument();
    });
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("P0")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
  });

  it("renders boolean field as a checkbox", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("是否激活")).toBeInTheDocument();
    });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("renders integer field as input[type=number]", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("权重")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText("权重");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).type).toBe("number");
  });

  it("renders string field as input[type=text]", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("目标名称")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText("目标名称");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).type).toBe("text");
  });

  it("skips reference field types", async () => {
    renderModal();
    await waitFor(() => {
      // goal_name, priority, is_active, weight should be rendered
      // org_ref (reference) should NOT be rendered
      expect(screen.getByText("目标名称")).toBeInTheDocument();
    });
    expect(screen.queryByText("组织引用")).not.toBeInTheDocument();
  });

  it("marks required fields with asterisk", async () => {
    renderModal();
    await waitFor(() => {
      const label = screen.getByText("目标名称").closest("label");
      expect(label?.querySelector(".text-red-500")).toBeInTheDocument();
    });
  });

  // ─── Submission ──────────────────────────────

  it("create mode calls createObject with modelKey and form data", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("目标名称"), { target: { value: "test goal" } });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(mockCreateObject).toHaveBeenCalledWith("Strategic_Goal", {
        goal_name: "test goal",
      });
    });
  });

  it("edit mode calls updateObject with editKey and form data", async () => {
    renderModal({ editKey: "existing1", title: "编辑战略目标" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("目标名称"), { target: { value: "updated" } });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(mockUpdateObject).toHaveBeenCalledWith("existing1", {
        goal_name: "updated",
      });
    });
  });

  it("validates required fields before submission", async () => {
    renderModal();
    // Wait for fields to be fully loaded (not just the button to appear)
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("创建"));

    expect(mockCreateObject).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("请填写 目标名称")).toBeInTheDocument();
    });
  });

  it("shows error when createObject fails", async () => {
    mockCreateObject.mockResolvedValue({
      success: false,
      error: "服务器错误",
    });
    renderModal();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("目标名称"), { target: { value: "test" } });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(screen.getByText("服务器错误")).toBeInTheDocument();
    });
  });

  it("calls onCreated and onClose on success", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal({ onCreated, onClose });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("目标名称"), { target: { value: "test" } });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(mockCreatedObject);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ─── Interaction ─────────────────────────────

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await waitFor(() => {
      expect(screen.getByText("创建战略目标")).toBeInTheDocument();
    });

    // The backdrop is the outermost fixed div; clicking it should call onClose
    const backdrop = screen.getByText("创建战略目标").closest(".fixed");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on cancel button click", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await waitFor(() => {
      expect(screen.getByText("取消")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("取消"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on X button click", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await waitFor(() => {
      expect(screen.getByTestId("icon-x")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("icon-x"));
    expect(onClose).toHaveBeenCalled();
  });

  it("resets form when reopened", async () => {
    const { rerender } = renderModal({ open: true });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("目标名称")).toBeInTheDocument();
    });

    // Fill in a value
    fireEvent.change(screen.getByPlaceholderText("目标名称"), { target: { value: "old data" } });
    expect(screen.getByDisplayValue("old data")).toBeInTheDocument();

    // Close and reopen
    rerender(<InlineCreateModal {...defaultProps} open={false} />);
    rerender(<InlineCreateModal {...defaultProps} open={true} />);

    await waitFor(() => {
      // The form should be reset — no "old data" displayed
      expect(screen.queryByDisplayValue("old data")).not.toBeInTheDocument();
    });
  });
});
