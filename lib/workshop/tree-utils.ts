/**
 * Tree helper utilities for the CoCreateCanvas workshop module.
 * Extracted from CoCreateCanvas.tsx for testability.
 */

export interface TreeNode {
  id: string;
  parentId: string | null;
  children: TreeNode[];
}

export interface SessionNode {
  _id: string;
  _key: string;
  model_key: string;
  properties: {
    name: string;
    node_type: string;
    description?: string;
    workshop_id: string;
  };
}

export interface SessionRelation {
  _key: string;
  _id: string;
  from_obj_id: string;
  to_obj_id: string;
  relation_type: string;
}

/**
 * Flatten a tree of TreeNodes into a flat list (depth-first).
 */
export function flattenAllNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const root of roots) {
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      for (const child of current.children) {
        stack.push(child);
      }
    }
  }
  return result;
}

/**
 * Build a tree structure from flat nodes + relations.
 * Returns root nodes, a node lookup map, and a parentId map.
 */
export function buildTreeNodeMap(
  nodes: SessionNode[],
  relations: SessionRelation[]
): { rootNodes: TreeNode[]; nodeMap: Map<string, TreeNode>; parentMap: Map<string, string | null> } {
  const nodeMap = new Map<string, TreeNode>();
  const parentMap = new Map<string, string | null>();

  for (const n of nodes) {
    nodeMap.set(n._id, { id: n._id, parentId: null, children: [] });
  }

  for (const r of relations) {
    if (r.relation_type === "canvas_parent_child") {
      const child = nodeMap.get(r.to_obj_id);
      const parent = nodeMap.get(r.from_obj_id);
      if (child && parent) {
        child.parentId = r.from_obj_id;
        parent.children.push(child);
        parentMap.set(r.to_obj_id, r.from_obj_id);
      }
    }
  }

  const rootNodes = Array.from(nodeMap.values()).filter((n) => n.parentId === null);
  return { rootNodes, nodeMap, parentMap };
}

/**
 * Get sibling node IDs (same parent) for a given node.
 * Returns just the root itself if the node is a root.
 */
export function getSiblingsFlat(treeNodes: TreeNode[], nodeId: string): string[] {
  const allNodes = flattenAllNodes(treeNodes);
  const childrenMap = new Map<string, string[]>();

  for (const n of allNodes) {
    const pid = n.parentId ?? "root";
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(n.id);
  }

  const node = allNodes.find((n) => n.id === nodeId);
  if (!node || !node.parentId) return [nodeId]; // root
  return childrenMap.get(node.parentId) || [];
}
