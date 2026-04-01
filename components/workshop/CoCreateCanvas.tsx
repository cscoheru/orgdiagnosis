"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";
import SmartNode, { type SmartNodeData } from "./SmartNode";
import { type SessionDetail, type AiSuggestion } from "@/lib/api/workshop-api";
import { Plus, Loader2 } from "lucide-react";

const elk = new ELK();

const nodeTypes: NodeTypes = { smartNode: SmartNode };

interface CoCreateCanvasProps {
  session: SessionDetail;
  onAddNode: (name: string, nodeType: string, description?: string, parentId?: string) => Promise<any>;
  onUpdateNode: (nodeId: string, patch: { name?: string; node_type?: string; description?: string }) => Promise<any>;
  onDeleteNode: (nodeId: string) => Promise<any>;
  onSuggestNodes: (data: { current_node_id: string; current_node_name: string; current_node_type: string; industry_context: string; existing_children: string[] }) => Promise<{ success: boolean; data?: { suggestions: AiSuggestion[] }; error?: string }>;
  onSelectNode: (nodeId: string | null) => void;
}

function buildTree(nodes: SessionDetail["nodes"], relations: SessionDetail["relations"]) {
  const childMap: Record<string, string[]> = {};
  const nodeMap: Record<string, SessionDetail["nodes"][0]> = {};
  for (const n of nodes) nodeMap[n._id] = n;
  for (const r of relations) {
    if (r.relation_type === "canvas_parent_child") {
      childMap[r.from_obj_id] = childMap[r.from_obj_id] || [];
      childMap[r.from_obj_id].push(r.to_obj_id);
    }
  }
  const childIds = new Set<string>();
  for (const r of relations) if (r.relation_type === "canvas_parent_child") childIds.add(r.to_obj_id);
  const roots = nodes.filter((n) => !childIds.has(n._id));
  return { nodeMap, childMap, roots };
}

export default function CoCreateCanvas({
  session,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onSuggestNodes,
  onSelectNode,
}: CoCreateCanvasProps) {
  const [suggestions, setSuggestions] = useState<Map<string, AiSuggestion[]>>(new Map());
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newRootName, setNewRootName] = useState("");

  const { nodeMap, childMap } = useMemo(
    () => buildTree(session.nodes, session.relations),
    [session.nodes, session.relations]
  );

  const { initialNodes, initialEdges } = useMemo(() => {
    const rfNodes: Node[] = [];
    const rfEdges: Edge[] = [];

    for (const node of session.nodes) {
      const props = node.properties;
      rfNodes.push({
        id: node._id,
        type: "smartNode",
        position: { x: 0, y: 0 },
        data: {
          label: props.name,
          nodeType: props.node_type || "scene",
          description: props.description,
          onUpdate: (patch) => onUpdateNode(node._id, patch),
          onDelete: () => onDeleteNode(node._id),
          onSuggest: () => handleSuggest(node._id, props.name, props.node_type),
        } as SmartNodeData,
      });
    }

    for (const rel of session.relations) {
      if (rel.relation_type === "canvas_parent_child") {
        rfEdges.push({
          id: `${rel.from_obj_id}-${rel.to_obj_id}`,
          source: rel.from_obj_id,
          target: rel.to_obj_id,
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        });
      }
    }

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [session.nodes, session.relations]);

  // Add ghost nodes from suggestions
  const allNodes = useMemo(() => {
    const nodes = [...initialNodes];
    const edges = [...initialEdges];
    for (const [parentId, suggs] of suggestions) {
      const parentIdx = nodes.findIndex((n) => n.id === parentId);
      const parentY = parentIdx >= 0 ? nodes[parentIdx].position.y : 0;
      suggs.forEach((s, i) => {
        const ghostId = `ghost-${parentId}-${i}`;
        nodes.push({
          id: ghostId,
          type: "smartNode",
          position: { x: 0, y: parentY + (i - suggs.length / 2) * 60 },
          data: {
            label: s.name,
            nodeType: s.type,
            reason: s.reason,
            isGhost: true,
            onAccept: () => handleAcceptGhost(parentId, s),
          } as SmartNodeData,
        });
        edges.push({
          id: `${parentId}-${ghostId}`,
          source: parentId,
          target: ghostId,
          type: "smoothstep",
          style: { stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "5 5" },
        });
      });
    }
    return { nodes, edges };
  }, [initialNodes, initialEdges, suggestions]);

  // elkjs layout
  const layoutedNodes = useMemo(() => {
    if (allNodes.nodes.length === 0) return allNodes.nodes;
    const graph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      },
      children: allNodes.nodes.map((n) => ({
        id: n.id,
        width: 160,
        height: 50,
      })),
      edges: allNodes.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };
    try {
      const layout = elk.layoutSync(graph);
      return allNodes.nodes.map((n) => {
        const elkNode = layout.children?.find((c) => c.id === n.id);
        if (elkNode) {
          return { ...n, position: { x: elkNode.x || 0, y: elkNode.y || 0 } };
        }
        return n;
      });
    } catch {
      return allNodes.nodes;
    }
  }, [allNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allNodes.edges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(allNodes.edges);
  }, [layoutedNodes, allNodes.edges, setNodes, setEdges]);

  const handleSuggest = async (nodeId: string, nodeName: string, nodeType: string) => {
    setLoadingNode(nodeId);
    const children = childMap[nodeId] || [];
    const childNames = children.map((cid) => nodeMap[cid]?.properties?.name || "").filter(Boolean);
    const res = await onSuggestNodes({
      current_node_id: nodeId,
      current_node_name: nodeName,
      current_node_type: nodeType,
      industry_context: session.session.properties.industry_context,
      existing_children: childNames,
    });
    if (res.success && res.data) {
      setSuggestions((prev) => new Map(prev).set(nodeId, res.data!.suggestions));
    }
    setLoadingNode(null);
  };

  const handleAcceptGhost = async (parentId: string, suggestion: AiSuggestion) => {
    await onAddNode(suggestion.name, suggestion.type, suggestion.reason, parentId);
    setSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  };

  const handleAddRoot = async () => {
    if (!newRootName.trim()) return;
    await onAddNode(newRootName.trim(), "scene");
    setNewRootName("");
    setShowAddRoot(false);
  };

  return (
    <div className="h-full relative">
      {/* Floating toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowAddRoot(!showAddRoot)}
          className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          添加根节点
        </button>
        {loadingNode && (
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            AI 思考中...
          </div>
        )}
      </div>

      {showAddRoot && (
        <div className="absolute top-14 left-3 z-10 bg-white border rounded-lg shadow-md p-3 flex items-center gap-2">
          <input
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRoot()}
            placeholder="输入根节点名称..."
            className="px-2 py-1 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={handleAddRoot} className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            添加
          </button>
          <button onClick={() => setShowAddRoot(false)} className="px-2 py-1 text-gray-500 text-sm hover:text-gray-700">
            取消
          </button>
        </div>
      )}

      {session.nodes.length === 0 && !showAddRoot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg">点击左上角「添加根节点」开始构建场景树</p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        fitView
        attributionPosition="bottom-left"
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={() => "#3b82f6"} />
      </ReactFlow>
    </div>
  );
}
