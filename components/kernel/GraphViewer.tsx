"use client";

/**
 * GraphViewer — 基于 ReactFlow 的内核图谱可视化
 *
 * 用法:
 *   <GraphViewer startObjId="sys_objects/1" />
 */

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
} from "reactflow";
import "reactflow/dist/style.css";
import { queryGraph, type GraphData, type KernelObject, type KernelRelation } from "@/lib/api/kernel-client";

interface GraphViewerProps {
  startObjId?: string;
  depth?: number;
  direction?: "OUTBOUND" | "INBOUND" | "ANY";
  height?: string | number;
}

// 领域 → 颜色映射
const MODEL_COLORS: Record<string, string> = {
  Strategic_Goal: "#ef4444",
  Strategic_Initiative: "#f97316",
  Market_Context: "#eab308",
  Org_Unit: "#22c55e",
  Job_Role: "#06b6d4",
  Process_Flow: "#14b8a6",
  Performance_Metric: "#8b5cf6",
  Competency: "#a855f7",
  Review_Cycle: "#ec4899",
  Salary_Band: "#f59e0b",
  Pay_Component: "#fbbf24",
  Market_Benchmark: "#d97706",
  Employee: "#3b82f6",
  Talent_Pipeline: "#6366f1",
  Learning_Development: "#818cf8",
  Consulting_Engagement: "#64748b",
};

function getModelColor(modelKey: string): string {
  return MODEL_COLORS[modelKey] || "#6b7280";
}

// 将图谱数据转换为 ReactFlow 节点和边
function graphToReactFlow(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seen = new Set<string>();

  // 根节点
  const root = data.root;
  if (root) {
    seen.add(root._id);
    const label = String(root.properties.name || root.properties[root.model_key === "Employee" ? "name" : Object.keys(root.properties)[0]] || root._key);
    nodes.push({
      id: root._id,
      position: { x: 300, y: 50 },
      data: {
        label: label.length > 20 ? label.slice(0, 18) + "..." : label,
        modelKey: root.model_key,
        properties: root.properties,
      },
      style: {
        background: getModelColor(root.model_key),
        color: "#fff",
        border: "2px solid " + getModelColor(root.model_key),
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
      },
    });
  }

  // 从关系构建边和节点
  if (data.relations) {
    const objectMap = new Map<string, KernelObject>();
    objectMap.set(root._id, root);

    // 在 tree 中查找所有节点
    const buildFromTree = (tree: Record<string, unknown>, parentId: string, depth: number) => {
      if (!tree) return;
      const children = Array.isArray(tree.children) ? tree.children : [];
      for (const child of children) {
        const childId = child._id || child.id;
        if (!seen.has(childId)) {
          seen.add(childId);
          const label = String(
            child.properties?.name ||
            child.properties?.[Object.keys(child.properties || {})[0]] ||
            childId
          );
          const angle = (children.indexOf(child) / children.length) * Math.PI * 2;
          const radius = 180 + depth * 120;
          nodes.push({
            id: childId,
            position: {
              x: 300 + Math.cos(angle) * radius,
              y: 50 + Math.sin(angle) * radius,
            },
            data: {
              label: label.length > 20 ? label.slice(0, 18) + "..." : label,
              modelKey: child.model_key || "",
              properties: child.properties || {},
            },
            style: {
              background: getModelColor(child.model_key || ""),
              color: "#fff",
              border: "1px solid " + getModelColor(child.model_key || ""),
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
            },
          });
        }

        // 添加边
        if (!edges.find((e) => e.source === parentId && e.target === childId)) {
          edges.push({
            id: `${parentId}-${childId}`,
            source: parentId,
            target: childId,
            label: child.relation_type || "",
            type: "smoothstep",
            style: {
              stroke: "#94a3b8",
              strokeWidth: 1.5,
              fontSize: 10,
            },
          });
        }

        buildFromTree(child, childId, depth + 1);
      }
    };

    buildFromTree(data.tree, root._id, 1);
  }

  return { nodes, edges };
}

export default function GraphViewer({
  startObjId,
  depth = 2,
  direction = "OUTBOUND",
  height = "500px",
}: GraphViewerProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGraph = useCallback(async () => {
    if (!startObjId) return;
    setLoading(true);
    setError("");

    const res = await queryGraph(startObjId, depth, direction);
    if (res.success && res.data) {
      setGraphData(res.data);
    } else {
      setError(res.error || "加载图谱失败");
    }
    setLoading(false);
  }, [startObjId, depth, direction]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => (graphData ? graphToReactFlow(graphData) : { nodes: [], edges: [] }),
    [graphData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const modelKeys = useMemo(() => {
    const keys = new Set<string>();
    if (graphData) {
      keys.add(graphData.root.model_key);
      graphData.relations?.forEach((r) => {
        // relations don't have model_key directly, get from nodes
      });
      const treeChildren = Array.isArray(graphData.tree?.children) ? graphData.tree.children : [];
      for (const c of treeChildren) {
        if (typeof c === "object" && c !== null && "model_key" in c) {
          keys.add((c as Record<string, unknown>).model_key as string);
        }
      }
    }
    return Array.from(keys);
  }, [graphData]);

  if (!startObjId) {
    return (
      <div className="text-center text-gray-400 py-12">
        请选择一个对象作为图谱起点
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse text-center text-gray-400 py-12">
        加载图谱中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-12">{error}</div>
    );
  }

  return (
    <div>
      {/* 图例 */}
      <div className="flex flex-wrap gap-2 mb-2">
        {modelKeys.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 text-xs"
          >
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ background: getModelColor(key) }}
            />
            {key}
          </span>
        ))}
      </div>

      {/* ReactFlow */}
      <div style={{ height, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => String(n.style?.background || "#6b7280")}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
