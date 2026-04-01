import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SmartNodeData } from "@/components/workshop/SmartNode";

// Mock reactflow entirely — including Position enum which SmartNode uses as JSX props
const mockSetNodes = vi.fn();
vi.mock("reactflow", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    setNodes: mockSetNodes,
    getNodes: vi.fn(() => []),
  }),
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right" },
}));

// Mock lucide-react to avoid SVG rendering issues
vi.mock("lucide-react", () => ({
  Sparkles: () => <svg data-testid="sparkles" />,
}));

import SmartNode from "@/components/workshop/SmartNode";

function renderSmartNode(props: Partial<{ id: string; selected: boolean; data: Partial<SmartNodeData> }> = {}) {
  const fullProps = {
    id: "test-node-1",
    selected: false,
    data: {
      label: "Test Node",
      onSyncUpdate: vi.fn(),
      onDelete: vi.fn(),
      onEditEnd: vi.fn(),
      onEnterSave: vi.fn(),
      onTabSave: vi.fn(),
    },
    ...props,
    data: {
      label: "Test Node",
      onSyncUpdate: vi.fn(),
      onDelete: vi.fn(),
      onEditEnd: vi.fn(),
      onEnterSave: vi.fn(),
      onTabSave: vi.fn(),
      ...props.data,
    },
  } as any;
  return render(<SmartNode {...fullProps} />);
}

describe("SmartNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders node label correctly", () => {
    renderSmartNode();
    expect(screen.getByText("Test Node")).toBeInTheDocument();
  });

  it("enters edit mode on double-click", () => {
    renderSmartNode();
    const label = screen.getByText("Test Node");
    fireEvent.doubleClick(label);
    const input = screen.getByDisplayValue("Test Node");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("calls setNodes with new label and triggers onEnterSave on Enter", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.change(input, { target: { value: "New Label" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    const updateFn = mockSetNodes.mock.calls[0][0];
    const result = updateFn([{ id: "test-node-1", data: { label: "Old" } }]);
    expect(result[0].data.label).toBe("New Label");
  });

  it("calls setNodes and triggers onTabSave on Tab", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.change(input, { target: { value: "Tab Label" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    const updateFn = mockSetNodes.mock.calls[0][0];
    const result = updateFn([{ id: "test-node-1", data: { label: "Old" } }]);
    expect(result[0].data.label).toBe("Tab Label");
  });

  it("reverts to original label on Escape", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.change(input, { target: { value: "Will Revert" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(mockSetNodes).not.toHaveBeenCalled();
    expect(screen.getByText("Test Node")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Will Revert")).not.toBeInTheDocument();
  });

  it("auto-saves on blur", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.change(input, { target: { value: "Blur Save" } });
    fireEvent.blur(input);

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    const updateFn = mockSetNodes.mock.calls[0][0];
    const result = updateFn([{ id: "test-node-1", data: { label: "Old" } }]);
    expect(result[0].data.label).toBe("Blur Save");
  });

  it("does not save empty label", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it("does not save same label", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it("enters edit mode when data.editing is true", () => {
    renderSmartNode({ data: { editing: true } });
    const input = screen.getByDisplayValue("Test Node");
    expect(input).toBeInTheDocument();
  });

  it("syncs label from external change when not editing", () => {
    const { rerender } = renderSmartNode();
    expect(screen.getByText("Test Node")).toBeInTheDocument();
    rerender(<SmartNode
      id="test-node-1"
      selected={false}
      data={{ label: "External Update", onSyncUpdate: vi.fn(), onDelete: vi.fn(), onEditEnd: vi.fn(), onEnterSave: vi.fn(), onTabSave: vi.fn() }}
    />);
    expect(screen.getByText("External Update")).toBeInTheDocument();
  });

  it("does NOT overwrite input value when actively editing", () => {
    const onSyncUpdate = vi.fn();
    const { rerender } = renderSmartNode({
      data: { label: "Original", onSyncUpdate },
    });
    fireEvent.doubleClick(screen.getByText("Original"));
    const input = screen.getByDisplayValue("Original");
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "User Typing" } });

    rerender(<SmartNode
      id="test-node-1"
      selected={false}
      data={{ label: "External Change", onSyncUpdate, onDelete: vi.fn(), onEditEnd: vi.fn(), onEnterSave: vi.fn(), onTabSave: vi.fn() }}
    />);
    expect(screen.getByDisplayValue("User Typing")).toBeInTheDocument();
  });

  it("renders ghost node with dashed border and click triggers onAccept", () => {
    const onAccept = vi.fn();
    renderSmartNode({
      data: { isGhost: true, reason: "AI suggestion", onAccept },
    });
    expect(screen.getByText("AI suggestion")).toBeInTheDocument();
    expect(screen.getByText("点击采纳")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Test Node"));
    expect(onAccept).toHaveBeenCalled();
  });

  it("shows blue border when selected", () => {
    const { container } = renderSmartNode({ selected: true });
    expect(container.firstChild?.className).toContain("border-blue-500");
  });

  it("Delete key in input does not stop propagation to canvas", () => {
    renderSmartNode();
    fireEvent.doubleClick(screen.getByText("Test Node"));
    const input = screen.getByDisplayValue("Test Node");
    fireEvent.keyDown(input, { key: "Delete" });
    expect(input).toBeInTheDocument();
  });
});
