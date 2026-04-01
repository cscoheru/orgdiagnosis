import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import type { SessionDetail } from "@/lib/api/workshop-api";

// ─── Mocks ───

vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockELK {
    layout() {
      return Promise.resolve({
        id: "root",
        children: [
          { id: "node-1", x: 0, y: 0, width: 150, height: 40 },
          { id: "node-2", x: 200, y: 0, width: 150, height: 40 },
        ],
      });
    }
  },
}));

vi.mock("@/components/workshop/SmartNode", () => ({
  default: ({ id, data, selected }: any) => (
    <div data-testid={`smart-node-${id}`} className={selected ? "selected" : ""}>
      {data?.editing ? (
        <input data-testid={`edit-${id}`} defaultValue={data.label} />
      ) : (
        <span data-testid={`label-${id}`}>{data?.label}</span>
      )}
      <div data-testid="handle" />
      <div data-testid="handle" />
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <svg data-testid="plus" />,
  X: () => <svg data-testid="x" />,
  Sparkles: () => <svg data-testid="sparkles" />,
}));

import CoCreateCanvas from "@/components/workshop/CoCreateCanvas";

function createMockSession(overrides?: Partial<SessionDetail>): SessionDetail {
  return {
    session: { _id: "session-1", _key: "session-1", properties: { name: "Test Workshop", industry_context: "tech" } },
    nodes: [
      { _id: "node-1", _key: "node-1", model_key: "Canvas_Node", properties: { name: "Root Node", node_type: "scene", workshop_id: "ws1" } },
      { _id: "node-2", _key: "node-2", model_key: "Canvas_Node", properties: { name: "Child Node", node_type: "scene", workshop_id: "ws1" } },
    ],
    relations: [
      { _key: "r1", _id: "rel/r1", from_obj_id: "node-1", to_obj_id: "node-2", relation_type: "canvas_parent_child" },
    ],
    ...overrides,
  } as SessionDetail;
}

const defaultProps = {
  onAddNode: vi.fn(() => Promise.resolve({ success: true, data: { _id: "new-1", _key: "new-1", properties: { name: "新节点", node_type: "scene" } } })),
  onUpdateNode: vi.fn(() => Promise.resolve({ success: true })),
  onDeleteNode: vi.fn(() => Promise.resolve({ success: true })),
  onReloadSession: vi.fn(() => Promise.resolve()),
  onSuggestNodes: vi.fn(() => Promise.resolve({ success: true, data: { suggestions: [] } })),
  onSelectNode: vi.fn(),
};

describe("CoCreateCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when session has no nodes", async () => {
    const session = createMockSession({ nodes: [], relations: [] });
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    expect(screen.getByText("点击「添加节点」开始")).toBeInTheDocument();
  });

  it("renders session nodes", async () => {
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    expect(screen.getByText("Root Node")).toBeInTheDocument();
    expect(screen.getByText("Child Node")).toBeInTheDocument();
  });

  it("shows add root button and can toggle dialog", async () => {
    const session = createMockSession({ nodes: [], relations: [] });
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    expect(screen.getByText("添加节点")).toBeInTheDocument();
    fireEvent.click(screen.getByText("添加节点"));
    expect(screen.getByText("添加根节点")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入节点标题...")).toBeInTheDocument();
  });

  it("shows keyboard shortcuts hint when node is selected", async () => {
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    expect(screen.queryByText("同级")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Root Node"));
    expect(screen.getByText("同级")).toBeInTheDocument();
    expect(screen.getByText("子级")).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();
  });

  it("shows navigation hints: arrows, F2, Escape", async () => {
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    fireEvent.click(screen.getByText("Root Node"));
    const hintBar = screen.getByText("同级").closest("div")!;
    expect(within(hintBar).getByText("↑↓←→")).toBeInTheDocument();
    expect(within(hintBar).getByText("F2")).toBeInTheDocument();
    expect(within(hintBar).getByText("Esc")).toBeInTheDocument();
  });

  it("pane click clears selectedNodeId (hides hint bar)", async () => {
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} session={session} />);
    });
    fireEvent.click(screen.getByText("Root Node"));
    expect(screen.getByText("同级")).toBeInTheDocument();
    // Click the ReactFlow pane background (real ReactFlow uses .react-flow__pane)
    const pane = document.querySelector(".react-flow__pane");
    if (pane) {
      fireEvent.click(pane);
    } else {
      // Fallback: click the container div
      fireEvent.click(document.querySelector(".react-flow")!);
    }
    expect(screen.queryByText("同级")).not.toBeInTheDocument();
  });

  it("Enter key triggers onAddNode for sibling creation", async () => {
    const onAddNode = vi.fn(() => Promise.resolve({
      success: true,
      data: { _id: "sibling-1", _key: "sibling-1", properties: { name: "新节点", node_type: "scene" } },
    }));
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} onAddNode={onAddNode} session={session} />);
    });
    fireEvent.click(screen.getByText("Root Node"));
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onAddNode).toHaveBeenCalledTimes(1);
  });

  it("Tab key triggers onAddNode with parentId for child creation", async () => {
    const onAddNode = vi.fn(() => Promise.resolve({
      success: true,
      data: { _id: "child-1", _key: "child-1", properties: { name: "新节点", node_type: "scene" } },
    }));
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} onAddNode={onAddNode} session={session} />);
    });
    fireEvent.click(screen.getByText("Root Node"));
    await act(async () => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(onAddNode).toHaveBeenCalledWith("新节点", "scene", undefined, "node-1");
  });

  it("keyboard handler does nothing when no node is selected", async () => {
    const onAddNode = vi.fn();
    const session = createMockSession();
    await act(async () => {
      render(<CoCreateCanvas {...defaultProps} onAddNode={onAddNode} session={session} />);
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onAddNode).not.toHaveBeenCalled();
  });
});
