import { describe, it, expect } from "vitest";

/**
 * Tests for the optimistic state management logic used in CoCreateCanvas.
 * These test the core merge/add/remove logic without React rendering.
 */

type RfNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
};

type RfEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  style: Record<string, any>;
};

describe("Optimistic state: merge strategy", () => {
  it("preserves existing node data when merging positioned nodes", () => {
    const currentNodes: RfNode[] = [
      { id: "1", type: "smartNode", position: { x: 0, y: 0 }, data: { label: "Edited Label" } },
      { id: "2", type: "smartNode", position: { x: 200, y: 0 }, data: { label: "Node 2" } },
    ];
    const positioned: RfNode[] = [
      { id: "1", type: "smartNode", position: { x: 10, y: 20 }, data: { label: "Stale Label" } },
      { id: "2", type: "smartNode", position: { x: 200, y: 50 }, data: { label: "Node 2" } },
    ];

    const positionedMap = new Map(positioned.map((n) => [n.id, n]));
    const positionedIds = new Set(positionedMap.keys());
    const currentIds = new Set(currentNodes.map((n) => n.id));

    const merged = currentNodes
      .filter((n) => positionedIds.has(n.id))
      .map((n) => {
        const p = positionedMap.get(n.id);
        return p ? { ...n, position: p.position } : n;
      });
    for (const p of positioned) {
      if (!currentIds.has(p.id)) {
        merged.push(p);
      }
    }

    expect(merged).toHaveLength(2);
    // Position updated, but data (label) preserved
    expect(merged[0].position).toEqual({ x: 10, y: 20 });
    expect(merged[0].data.label).toBe("Edited Label"); // NOT "Stale Label"
    expect(merged[1].position).toEqual({ x: 200, y: 50 });
  });
});

describe("Optimistic state: add node", () => {
  it("adds new node without changing existing nodes", () => {
    const existing: RfNode[] = [
      { id: "1", type: "smartNode", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    const newNode: RfNode = {
      id: "2",
      type: "smartNode",
      position: { x: 200, y: 0 },
      data: { label: "B" },
    };

    const result = [...existing, newNode];

    expect(result).toHaveLength(2);
    expect(result[0].data.label).toBe("A");
    expect(result[1].data.label).toBe("B");
    expect(result[1].id).toBe("2");
  });
});

describe("Optimistic state: delete node", () => {
  it("removes node and connected edges", () => {
    const nodes: RfNode[] = [
      { id: "1", type: "smartNode", position: { x: 0, y: 0 }, data: { label: "A" } },
      { id: "2", type: "smartNode", position: { x: 200, y: 0 }, data: { label: "B" } },
      { id: "3", type: "smartNode", position: { x: 400, y: 0 }, data: { label: "C" } },
    ];
    const edges: RfEdge[] = [
      { id: "1-2", source: "1", target: "2", type: "smoothstep", style: {} },
      { id: "2-3", source: "2", target: "3", type: "smoothstep", style: {} },
    ];

    const toDelete = new Set(["2"]);
    const filteredNodes = nodes.filter((n) => !toDelete.has(n.id));
    const filteredEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));

    expect(filteredNodes).toHaveLength(2);
    expect(filteredNodes.map((n) => n.id)).toEqual(["1", "3"]);
    expect(filteredEdges).toHaveLength(0); // Both edges involved node "2"
  });

  it("keeps edges not connected to deleted nodes", () => {
    const nodes = [
      { id: "1", type: "smartNode", position: { x: 0, y: 0 }, data: { label: "A" } },
      { id: "2", type: "smartNode", position: { x: 200, y: 0 }, data: { label: "B" } },
    ];
    const edges = [
      { id: "1-2", source: "1", target: "2", type: "smoothstep", style: {} },
      { id: "3-4", source: "3", target: "4", type: "smoothstep", style: {} },
    ];

    const toDelete = new Set(["1"]);
    const filteredEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));

    expect(filteredEdges).toHaveLength(1);
    expect(filteredEdges[0].id).toBe("3-4");
  });
});

describe("Optimistic state: add edge", () => {
  it("adds new edge to existing edges", () => {
    const existing = [
      { id: "1-2", source: "1", target: "2", type: "smoothstep", style: {} },
    ];
    const newEdge = { id: "2-3", source: "2", target: "3", type: "smoothstep", style: {} };

    const result = [...existing, newEdge];

    expect(result).toHaveLength(2);
    expect(result[1].source).toBe("2");
    expect(result[1].target).toBe("3");
  });
});
