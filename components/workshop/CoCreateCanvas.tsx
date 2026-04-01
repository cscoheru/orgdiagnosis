"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  NodeTypes,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";
import SmartNode, { type SmartNodeData } from "./SmartNode";
import { type SessionDetail, type AiSuggestion, createRelation } from "@/lib/api/workshop-api";
import { buildTreeNodeMap, getSiblingsFlat } from "@/lib/workshop/tree-utils";
import type { TreeNode } from "@/lib/workshop/tree-utils";
import { Plus, X } from "lucide-react";

const elk = new ELK();
const nodeTypes: NodeTypes = { smartNode: SmartNode };

interface CoCreateCanvasProps {
  session: SessionDetail;
  onAddNode: (name: string, nodeType: string, description?: string, parentId?: string) => Promise<any>;
  onUpdateNode: (nodeId: string, patch: { name?: string; node_type?: string; description?: string }) => Promise<any>;
  onDeleteNode: (nodeId: string) => Promise<any>;
  onReloadSession: () => Promise<void>;
  onSuggestNodes: (data: { current_node_id: string; current_node_name: string; current_node_type: string; industry_context: string; existing_children: string[] }) => Promise<{ success: boolean; data?: { suggestions: AiSuggestion[] }; error?: string }>;
  onSelectNode: (nodeId: string | null) => void;
}

// ─── Component ───

function CoCreateCanvasInner({
  session,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onReloadSession,
  onSuggestNodes,
  onSelectNode,
}: CoCreateCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const [suggestions, setSuggestions] = useState<Map<string, AiSuggestion[]>>(new Map());
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newRootName, setNewRootName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const pendingEditRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  // Keep a ref to latest session for callbacks (avoids stale closures)
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Refs for stable callbacks — avoids stale closures when node data is preserved across merges
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const actionRefs = useRef<any>({});
  // actionRefs is updated below after function definitions

  // ─── Build ReactFlow nodes/edges (before useNodesState so deps are ready) ───

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
          onSyncUpdate: (patch: { name?: string }) => {
            actionRefs.current.onUpdateNode(node._id, patch);
          },
          onSuggest: () => actionRefs.current.handleSuggest(node._id, props.name, props.node_type),
          onEnterSave: () => {
            const sid = selectedNodeIdRef.current;
            if (sid) actionRefs.current.createSiblingNode(sid);
          },
          onTabSave: () => {
            const sid = selectedNodeIdRef.current;
            if (sid) actionRefs.current.createChildNode(sid);
          },
          onEditEnd: () => {},
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

  // Ghost nodes from suggestions
  const allNodes = useMemo(() => {
    const ns = [...initialNodes];
    const es = [...initialEdges];
    for (const [parentId, suggs] of suggestions) {
      const parentIdx = ns.findIndex((n) => n.id === parentId);
      const parentY = parentIdx >= 0 ? ns[parentIdx].position.y : 0;
      suggs.forEach((s, i) => {
        const ghostId = `ghost-${parentId}-${i}`;
        ns.push({
          id: ghostId,
          type: "smartNode",
          position: { x: 0, y: parentY + (i - suggs.length / 2) * 60 },
          data: {
            label: s.name,
            reason: s.reason,
            isGhost: true,
            onAccept: () => handleAcceptGhost(parentId, s),
          } as SmartNodeData,
        });
        es.push({
          id: `${parentId}-${ghostId}`,
          source: parentId,
          target: ghostId,
          type: "smoothstep",
          style: { stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "5 5" },
        });
      });
    }
    return { nodes: ns, edges: es };
  }, [initialNodes, initialEdges, suggestions]);

  // State hooks — MUST be before any useCallback that references nodes/edges
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { rootNodes, nodeMap, parentMap } = useMemo(
    () => buildTreeNodeMap(session.nodes, session.relations),
    [session.nodes, session.relations]
  );

  // ─── Node operations ───

  const createNodeWithFocus = useCallback(async (name: string, parentId?: string) => {
    const res = await onAddNode(name || "新节点", "scene", undefined, parentId);
    if (res?.success && res.data) {
      const newNode = res.data;
      const newId = newNode._id;
      // Determine position: offset from parent or default
      const parentPos = parentId
        ? nodes.find((n) => n.id === parentId)?.position
        : undefined;
      const pos = parentPos
        ? { x: parentPos.x + 200, y: parentPos.y + 60 }
        : { x: 100 + nodes.length * 50, y: 100 + nodes.length * 50 };

      // Optimistically add node to ReactFlow
      setNodes((nds) => [
        ...nds,
        {
          id: newId,
          type: "smartNode",
          position: pos,
          data: {
            label: newNode.properties?.name || name || "新节点",
            onSyncUpdate: (patch: { name?: string }) => actionRefs.current.onUpdateNode(newId, patch),
            onSuggest: () => actionRefs.current.handleSuggest?.(newId, newNode.properties?.name || "", newNode.properties?.node_type || "scene"),
            onEnterSave: () => {
              const sid = selectedNodeIdRef.current;
              if (sid) actionRefs.current.createSiblingNode(sid);
            },
            onTabSave: () => {
              const sid = selectedNodeIdRef.current;
              if (sid) actionRefs.current.createChildNode(sid);
            },
            onEditEnd: () => {},
          } as SmartNodeData,
        },
      ]);
      // Optimistically add edge if parent exists
      if (parentId) {
        setEdges((eds) => [
          ...eds,
          {
            id: `${parentId}-${newId}`,
            source: parentId,
            target: newId,
            type: "smoothstep",
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          },
        ]);
      }
      pendingEditRef.current = newId;
    }
  }, [onAddNode, nodes, setNodes, setEdges]);

  const createSiblingNode = useCallback(async (nodeId: string) => {
    const parentId = parentMap.get(nodeId);
    if (parentId) {
      await createNodeWithFocus("新节点", parentId);
    } else {
      await createNodeWithFocus("新节点");
    }
  }, [parentMap, createNodeWithFocus]);

  const createChildNode = useCallback(async (nodeId: string) => {
    await createNodeWithFocus("新节点", nodeId);
  }, [createNodeWithFocus]);

  const selectSibling = useCallback((nodeId: string, direction: number) => {
    const siblings = getSiblingsFlat(rootNodes, nodeId);
    const idx = siblings.indexOf(nodeId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < siblings.length) {
      setSelectedNodeId(siblings[newIdx]);
    }
  }, [rootNodes]);

  const selectFirstChild = useCallback((nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (node && node.children.length > 0) {
      setSelectedNodeId(node.children[0].id);
    }
  }, [nodeMap]);

  const selectParent = useCallback((nodeId: string) => {
    const parentId = parentMap.get(nodeId);
    if (parentId) {
      setSelectedNodeId(parentId);
    }
  }, [parentMap]);

  // ─── Keyboard handler (CAPTURE phase — fires before ReactFlow) ───

  // ─── Multi-delete helper ───

  const deleteSelectedNodes = useCallback(async (nodeIds: string[]) => {
    // Optimistically remove from ReactFlow (instant feedback)
    const idSet = new Set(nodeIds);
    setNodes((nds) => nds.filter((n) => !idSet.has(n.id)));
    setEdges((eds) => eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)));
    setSelectedNodeId(null);
    // Fire-and-forget API deletes
    for (const id of nodeIds) {
      onDeleteNode(id).catch(console.error);
    }
  }, [onDeleteNode, setNodes, setEdges]);

  // ─── Keyboard handler (CAPTURE phase — fires before ReactFlow) ───

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (showAddRoot) return;

      // Delete: works with ReactFlow multi-selection (nodes + edges)
      if (e.key === "Delete" || e.key === "Backspace") {
        const rfSelectedNodes = reactFlowInstance.getNodes().filter(n => n.selected).map(n => n.id);
        const rfSelectedEdges = reactFlowInstance.getEdges().filter(e => e.selected).map(e => e.id);
        if (rfSelectedNodes.length > 0 || rfSelectedEdges.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (rfSelectedNodes.length > 0) deleteSelectedNodes(rfSelectedNodes);
          if (rfSelectedEdges.length > 0) {
            setEdges((eds) => eds.filter((e) => !rfSelectedEdges.includes(e.id)));
            // Fire-and-forget API delete for relations
            for (const edgeId of rfSelectedEdges) {
              const edge = reactFlowInstance.getEdges().find(e => e.id === edgeId);
              if (edge) onDeleteNode(edge.target).catch(console.error);
            }
          }
        }
        return;
      }

      // All other shortcuts require selectedNodeId
      if (!selectedNodeId) return;

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          createSiblingNode(selectedNodeId);
          break;
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          createChildNode(selectedNodeId);
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          selectSibling(selectedNodeId, -1);
          break;
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          selectSibling(selectedNodeId, +1);
          break;
        case "ArrowRight":
          e.preventDefault();
          e.stopPropagation();
          selectFirstChild(selectedNodeId);
          break;
        case "ArrowLeft":
          e.preventDefault();
          e.stopPropagation();
          selectParent(selectedNodeId);
          break;
        case "F2":
          e.preventDefault();
          e.stopPropagation();
          reactFlowInstance.setNodes((nds) =>
            nds.map((n) =>
              n.id === selectedNodeId
                ? { ...n, data: { ...n.data, editing: true } }
                : n
            )
          );
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setSelectedNodeId(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // CAPTURE phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [selectedNodeId, showAddRoot, createSiblingNode, createChildNode, deleteSelectedNodes, selectSibling, selectFirstChild, selectParent, reactFlowInstance]);

  // Keep refs in sync with latest functions (used by node data callbacks)
  // Updated below after handleSuggest is defined
  actionRefs.current = { onUpdateNode, createSiblingNode, createChildNode };

  // ─── Click blank to deselect ───

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ─── Build ReactFlow nodes/edges ───

  /**
   * handleSuggest uses ref to access latest session, avoiding stale closure.
   * This is called from SmartNode's data.onSuggest callback.
   */
  const handleSuggest = useCallback(async (nodeId: string, nodeName: string, nodeType: string) => {
    setLoadingNode(nodeId);
    // Use ref to get latest nodeMap data
    const s = sessionRef.current;
    const { nodeMap: currentMap } = buildTreeNodeMap(s.nodes, s.relations);
    const children = currentMap.get(nodeId)?.children || [];
    const childNames = children.map((c) => {
      const n = s.nodes.find((sn) => sn._id === c.id);
      return n?.properties?.name || "";
    }).filter(Boolean);
    const res = await onSuggestNodes({
      current_node_id: nodeId,
      current_node_name: nodeName,
      current_node_type: nodeType,
      industry_context: s.session.properties.industry_context,
      existing_children: childNames,
    });
    if (res.success && res.data) {
      setSuggestions((prev) => new Map(prev).set(nodeId, res.data!.suggestions));
    }
    setLoadingNode(null);
  }, [onSuggestNodes]);

  // Update actionRefs with handleSuggest (defined above)
  actionRefs.current.handleSuggest = handleSuggest;

  useEffect(() => {
    // Only run layout on initial mount — subsequent ops update ReactFlow state directly
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    setEdges(allNodes.edges);
    if (allNodes.nodes.length === 0) {
      setNodes([]);
      return;
    }
    const graph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "30",
        "elk.layered.spacing.nodeNodeBetweenLayers": "60",
      },
      children: allNodes.nodes.map((n) => ({
        id: n.id,
        width: 150,
        height: 40,
      })),
      edges: allNodes.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };
    elk.layout(graph).then((layout) => {
      const positioned = allNodes.nodes.map((n) => {
        const elkNode = layout.children?.find((c) => c.id === n.id);
        if (elkNode) {
          return { ...n, position: { x: elkNode.x || 0, y: elkNode.y || 0 } };
        }
        return n;
      });
      /**
       * MERGE STRATEGY: Preserve existing node data (including optimistic edits
       * from SmartNode's setNodes). Only update positions and handle structural
       * changes (add/remove). This prevents edits from reverting when session reloads.
       */
      setNodes((currentNodes) => {
        if (currentNodes.length === 0) return positioned;
        const positionedMap = new Map(positioned.map(n => [n.id, n]));
        const positionedIds = new Set(positionedMap.keys());
        const currentIds = new Set(currentNodes.map(n => n.id));
        // Update existing nodes: position only, preserve data (including optimistic label edits)
        const updated = currentNodes
          .filter(n => positionedIds.has(n.id)) // Remove deleted nodes
          .map(n => {
            const p = positionedMap.get(n.id);
            return p ? { ...n, position: p.position } : n;
          });
        // Add new nodes
        for (const p of positioned) {
          if (!currentIds.has(p.id)) {
            updated.push(p);
          }
        }
        return updated;
      });
    }).catch(() => {
      setNodes(allNodes.nodes);
    });
  }, [allNodes.nodes, allNodes.edges, setNodes, setEdges]);

  // ─── Focus editing after layout ───

  useEffect(() => {
    if (pendingEditRef.current && nodes.length > 0) {
      const editId = pendingEditRef.current;
      pendingEditRef.current = null;
      const timer = setTimeout(() => {
        const node = nodes.find((n) => n.id === editId);
        if (node) {
          reactFlowInstance.setNodes((nds) =>
            nds.map((n) =>
              n.id === editId
                ? { ...n, selected: true, data: { ...n.data, editing: true } }
                : n
            )
          );
          setSelectedNodeId(editId);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [nodes, reactFlowInstance]);

  // ─── AI suggest accept ───

  const handleAcceptGhost = useCallback(async (parentId: string, suggestion: AiSuggestion) => {
    const res = await onAddNode(suggestion.name, suggestion.type || "scene", suggestion.reason, parentId);
    if (res?.success && res.data) {
      const newNode = res.data;
      const newId = newNode._id;
      const parentPos = nodes.find((n) => n.id === parentId)?.position;
      const pos = parentPos
        ? { x: parentPos.x + 200, y: parentPos.y }
        : { x: 100, y: 100 };

      // Add real node, remove ghost nodes
      setNodes((nds) => {
        const filtered = nds.filter((n) => !n.id.startsWith(`ghost-${parentId}-`));
        return [
          ...filtered,
          {
            id: newId,
            type: "smartNode",
            position: pos,
            data: {
              label: suggestion.name,
              onSyncUpdate: (patch: { name?: string }) => actionRefs.current.onUpdateNode(newId, patch),
              onSuggest: () => actionRefs.current.handleSuggest?.(newId, suggestion.name, suggestion.type || "scene"),
              onEnterSave: () => {
                const sid = selectedNodeIdRef.current;
                if (sid) actionRefs.current.createSiblingNode(sid);
              },
              onTabSave: () => {
                const sid = selectedNodeIdRef.current;
                if (sid) actionRefs.current.createChildNode(sid);
              },
              onEditEnd: () => {},
            } as SmartNodeData,
          },
        ];
      });
      setEdges((eds) => {
        const filtered = eds.filter((e) => !e.id.startsWith(`${parentId}-ghost-`));
        return [
          ...filtered,
          {
            id: `${parentId}-${newId}`,
            source: parentId,
            target: newId,
            type: "smoothstep",
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          },
        ];
      });
    }
    // Clear suggestions for this parent regardless
    setSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  }, [onAddNode, nodes, setNodes, setEdges]);

  // ─── Add root ───

  const handleAddRoot = useCallback(async () => {
    if (!newRootName.trim()) return;
    const res = await onAddNode(newRootName.trim(), "scene");
    if (res?.success && res.data) {
      const newNode = res.data;
      const newId = newNode._id;
      setNodes((nds) => [
        ...nds,
        {
          id: newId,
          type: "smartNode",
          position: { x: 50 + nodes.length * 50, y: 50 + nodes.length * 50 },
          data: {
            label: newRootName.trim(),
            onSyncUpdate: (patch: { name?: string }) => actionRefs.current.onUpdateNode(newId, patch),
            onSuggest: () => actionRefs.current.handleSuggest?.(newId, newRootName.trim(), "scene"),
            onEnterSave: () => {
              const sid = selectedNodeIdRef.current;
              if (sid) actionRefs.current.createSiblingNode(sid);
            },
            onTabSave: () => {
              const sid = selectedNodeIdRef.current;
              if (sid) actionRefs.current.createChildNode(sid);
            },
            onEditEnd: () => {},
          } as SmartNodeData,
        },
      ]);
      pendingEditRef.current = newId;
    }
    setNewRootName("");
    setShowAddRoot(false);
  }, [newRootName, onAddNode, nodes, setNodes]);

  // ─── Manual connection ───

  const onConnect = useCallback(async (connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return;
    await createRelation(source, target, "canvas_parent_child");
    // Optimistically add edge to ReactFlow
    setEdges((eds) => [
      ...eds,
      {
        id: `${source}-${target}`,
        source,
        target,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      },
    ]);
  }, [setEdges]);

  return (
    <div className="h-full relative" tabIndex={0}>
      {/* Floating toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowAddRoot(!showAddRoot)}
          className="px-3 py-1.5 bg-white border rounded-lg shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          添加节点
        </button>
        {loadingNode && (
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm flex items-center gap-1">
            <span className="animate-spin">✨</span>
            AI 思考中...
          </div>
        )}
      </div>

      {/* Add root dialog */}
      {showAddRoot && (
        <div className="absolute top-14 left-3 z-10 bg-white border rounded-lg shadow-md p-3 w-[240px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">添加根节点</span>
            <button onClick={() => setShowAddRoot(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRoot()}
            placeholder="输入节点标题..."
            className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleAddRoot}
            disabled={!newRootName.trim()}
            className="w-full mt-2 px-2 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            添加
          </button>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {selectedNodeId && !showAddRoot && (
        <div className="absolute bottom-3 left-3 z-10 px-3 py-2 bg-white/90 backdrop-blur border rounded-lg text-xs text-gray-400 space-x-3">
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Enter</kbd> 同级</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Tab</kbd> 子级</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Del</kbd> 删除</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↑↓←→</kbd> 导航</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">F2</kbd> 编辑</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Esc</kbd> 取消</span>
        </div>
      )}

      {/* Empty state */}
      {session.nodes.length === 0 && !showAddRoot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400 space-y-2">
            <p className="text-lg">点击「添加节点」开始</p>
            <p className="text-sm">选中节点后 Enter/Tab/Delete/方向键</p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(event, node) => {
          const isMultiSelect = event.metaKey || event.ctrlKey;
          if (isMultiSelect) {
            // Toggle this node's selection
            setNodes((nds) =>
              nds.map((n) => (n.id === node.id ? { ...n, selected: !n.selected } : n))
            );
          } else {
            // Single select: deselect all, select this one
            setNodes((nds) =>
              nds.map((n) => ({ ...n, selected: n.id === node.id }))
            );
            setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
            setSelectedNodeId(node.id);
          }
        }}
        onEdgeClick={(event, edge) => {
          const isMultiSelect = event.metaKey || event.ctrlKey;
          if (isMultiSelect) {
            setEdges((eds) =>
              eds.map((e) => (e.id === edge.id ? { ...e, selected: !e.selected } : e))
            );
          } else {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            setEdges((eds) => eds.map((e) => ({ ...e, selected: e.id === edge.id })));
            setSelectedNodeId(null);
          }
        }}
        onPaneClick={onPaneClick}
        fitView
        attributionPosition="bottom-left"
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
        connectOnClick={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        panOnDrag={true}
        selectionOnDrag={true}
        selectionKeyCode="Shift"
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={() => "#94a3b8"} />
      </ReactFlow>

      {/* ReactFlow cursor and selection overrides */}
      <style jsx global>{`
        /* Canvas: default arrow cursor, grabbing only when actively panning */
        .react-flow__pane.draggable {
          cursor: default !important;
        }
        .react-flow__pane.dragging {
          cursor: grabbing !important;
        }
        /* Nodes: pointer on hover, grabbing when dragging */
        .react-flow__node.selectable {
          cursor: default !important;
        }
        .react-flow__node.draggable {
          cursor: grab !important;
        }
        .react-flow__node.draggable.dragging {
          cursor: grabbing !important;
        }
        /* Edges: clickable for selection */
        .react-flow__edge-path {
          cursor: pointer !important;
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #3b82f6 !important;
          stroke-width: 2.5 !important;
        }
        /* Selection box */
        .react-flow__selection {
          border: 1px dashed #3b82f6 !important;
          background: rgba(59, 130, 246, 0.08) !important;
        }
      `}</style>
    </div>
  );
}

export default function CoCreateCanvas(props: CoCreateCanvasProps) {
  return (
    <ReactFlowProvider>
      <CoCreateCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
