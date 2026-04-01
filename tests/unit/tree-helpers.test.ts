import { describe, it, expect } from "vitest";
import { buildTreeNodeMap, getSiblingsFlat, flattenAllNodes } from "@/lib/workshop/tree-utils";
import type { TreeNode } from "@/lib/workshop/tree-utils";

describe("buildTreeNodeMap", () => {
  const emptyNodes = [];
  const emptyRelations = [];

  it("returns empty maps for empty input", () => {
    const { rootNodes, nodeMap, parentMap } = buildTreeNodeMap(emptyNodes, emptyRelations);
    expect(rootNodes).toHaveLength(0);
    expect(nodeMap.size).toBe(0);
    expect(parentMap.size).toBe(0);
  });

  it("creates a single root node", () => {
    const nodes = [{ _id: "1", _key: "1", model_key: "Canvas_Node", properties: { name: "Root", node_type: "scene", workshop_id: "ws1" } }];
    const { rootNodes, nodeMap } = buildTreeNodeMap(nodes, emptyRelations);
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].id).toBe("1");
    expect(rootNodes[0].parentId).toBeNull();
    expect(nodeMap.get("1")?.children).toHaveLength(0);
  });

  it("builds parent-child relationships", () => {
    const nodes = [
      { _id: "1", _key: "1", model_key: "Canvas_Node", properties: { name: "Parent", node_type: "scene", workshop_id: "ws1" } },
      { _id: "2", _key: "2", model_key: "Canvas_Node", properties: { name: "Child", node_type: "scene", workshop_id: "ws1" } },
    ];
    const relations = [{ _key: "r1", _id: "rel/r1", from_obj_id: "1", to_obj_id: "2", relation_type: "canvas_parent_child" }];
    const { rootNodes, nodeMap, parentMap } = buildTreeNodeMap(nodes, relations);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].id).toBe("1");
    expect(rootNodes[0].children).toHaveLength(1);
    expect(rootNodes[0].children[0].id).toBe("2");
    expect(parentMap.get("2")).toBe("1");
  });

  it("handles multiple roots", () => {
    const nodes = [
      { _id: "1", _key: "1", model_key: "Canvas_Node", properties: { name: "Root1", node_type: "scene", workshop_id: "ws1" } },
      { _id: "2", _key: "2", model_key: "Canvas_Node", properties: { name: "Root2", node_type: "scene", workshop_id: "ws1" } },
    ];
    const { rootNodes } = buildTreeNodeMap(nodes, []);
    expect(rootNodes).toHaveLength(2);
  });

  it("handles deeply nested children", () => {
    const nodes = [
      { _id: "1", _key: "1", model_key: "Canvas_Node", properties: { name: "A", node_type: "scene", workshop_id: "ws1" } },
      { _id: "2", _key: "2", model_key: "Canvas_Node", properties: { name: "B", node_type: "scene", workshop_id: "ws1" } },
      { _id: "3", _key: "3", model_key: "Canvas_Node", properties: { name: "C", node_type: "scene", workshop_id: "ws1" } },
    ];
    const relations = [
      { _key: "r1", _id: "rel/r1", from_obj_id: "1", to_obj_id: "2", relation_type: "canvas_parent_child" },
      { _key: "r2", _id: "rel/r2", from_obj_id: "2", to_obj_id: "3", relation_type: "canvas_parent_child" },
    ];
    const { rootNodes, nodeMap } = buildTreeNodeMap(nodes, relations);
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].children[0].id).toBe("2");
    expect(rootNodes[0].children[0].children[0].id).toBe("3");
    expect(nodeMap.get("3")?.parentId).toBe("2");
  });

  it("ignores non-parent-child relations", () => {
    const nodes = [
      { _id: "1", _key: "1", model_key: "Canvas_Node", properties: { name: "A", node_type: "scene", workshop_id: "ws1" } },
      { _id: "2", _key: "2", model_key: "Canvas_Node", properties: { name: "B", node_type: "scene", workshop_id: "ws1" } },
    ];
    const relations = [
      { _key: "r1", _id: "rel/r1", from_obj_id: "1", to_obj_id: "2", relation_type: "canvas_node_to_tag" },
    ];
    const { rootNodes, parentMap } = buildTreeNodeMap(nodes, relations);
    expect(rootNodes).toHaveLength(2);
    expect(parentMap.size).toBe(0);
  });
});

describe("getSiblingsFlat", () => {
  it("returns just the root node when it has no parent", () => {
    const roots: TreeNode[] = [{ id: "1", parentId: null, children: [] }];
    expect(getSiblingsFlat(roots, "1")).toEqual(["1"]);
  });

  it("returns siblings for a child node", () => {
    const roots: TreeNode[] = [{
      id: "1", parentId: null, children: [
        { id: "2", parentId: "1", children: [] },
        { id: "3", parentId: "1", children: [] },
      ],
    }];
    const siblings = getSiblingsFlat(roots, "2");
    expect(siblings).toHaveLength(2);
    expect(siblings).toContain("2");
    expect(siblings).toContain("3");
  });

  it("returns only itself for an only child", () => {
    const roots: TreeNode[] = [{
      id: "1", parentId: null, children: [
        { id: "2", parentId: "1", children: [] },
      ],
    }];
    expect(getSiblingsFlat(roots, "2")).toEqual(["2"]);
  });
});

describe("flattenAllNodes", () => {
  it("flattens a deep tree", () => {
    const roots: TreeNode[] = [{
      id: "1", parentId: null, children: [{
        id: "2", parentId: "1", children: [{
          id: "3", parentId: "2", children: [],
        }],
      }],
    }];
    const flat = flattenAllNodes(roots);
    expect(flat).toHaveLength(3);
    expect(flat.map((n) => n.id)).toEqual(["1", "2", "3"]);
  });
});
