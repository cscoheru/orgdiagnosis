'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';

import './reactflow.css';

import ShapeNode from './nodes/shape-node';
import TextNode from './nodes/text-node';
import SlotNode from './nodes/slot-node';

// Custom node types
const nodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  slot: SlotNode,
};

interface LayoutCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export default function LayoutCanvas({
  initialNodes,
  initialEdges,
  onNodesChange,
  onEdgesChange,
  selectedNodeId,
  onSelectNode,
}: LayoutCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  // Sync internal state with parent
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes);
      // Get the updated nodes after the change
      setNodes((nds) => {
        onNodesChange(nds);
        return nds;
      });
    },
    [onNodesChangeInternal, onNodesChange, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChangeInternal(changes);
      setEdges((eds) => {
        onEdgesChange(eds);
        return eds;
      });
    },
    [onEdgesChangeInternal, onEdgesChange, setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge(
        {
          ...params,
          type: 'smoothstep',
          animated: false,
        },
        edges
      );
      setEdges(newEdges);
      onEdgesChange(newEdges);
    },
    [edges, setEdges, onEdgesChange]
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Node types with selection styling
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <div className="w-full h-full bg-gray-50">
      <ReactFlow
        nodes={nodes.map((node) => ({
          ...node,
          selected: node.id === selectedNodeId,
        }))}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[10, 10]}
        proOptions={proOptions}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2, stroke: '#94a3b8' },
        }}
      >
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          style={{ width: 120, height: 80 }}
          nodeColor={(node) => {
            if (node.type === 'shape') return '#dbeafe';
            if (node.type === 'slot') return '#fef3c7';
            return '#f3f4f6';
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
}
