'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import LayoutCanvas from '@/components/layout-editor/layout-canvas';
import LayoutToolbar from '@/components/layout-editor/layout-toolbar';
import PropertiesPanel from '@/components/layout-editor/layout-properties-panel';
import { LayoutDefinition, LayoutCategory, LAYOUT_CATEGORY_LABELS } from '@/lib/layout-types';
import { SYSTEM_LAYOUTS } from '@/lib/layout-api';

export default function LayoutEditorPage() {
  const router = useRouter();
  const params = useParams();
  const layoutId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layoutName, setLayoutName] = useState('新 Layout');
  const [layoutCategory, setLayoutCategory] = useState<LayoutCategory>('CUSTOM');
  const [layoutDescription, setLayoutDescription] = useState('');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load layout
  useEffect(() => {
    const loadLayout = () => {
      let layout: LayoutDefinition | null = null;

      // Check system layouts
      layout = SYSTEM_LAYOUTS.find(l => l.id === layoutId) || null;

      // Check custom layouts
      if (!layout) {
        const customLayouts = JSON.parse(localStorage.getItem('customLayouts') || '[]');
        layout = customLayouts.find((l: LayoutDefinition) => l.id === layoutId);
      }

      if (layout) {
        setLayoutName(layout.name);
        setLayoutCategory(layout.category);
        setLayoutDescription(layout.description);

        // Convert layout nodes to React Flow format
        const flowNodes: Node[] = layout.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            label: n.data.label,
            placeholder: n.data.placeholder,
            style: n.data.style,
          },
        }));

        const flowEdges: Edge[] = layout.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type || 'smoothstep',
          animated: e.animated,
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setHistory([{ nodes: flowNodes, edges: flowEdges }]);
        setHistoryIndex(0);
      } else if (layoutId === 'new') {
        // New layout with default node
        const defaultNodes: Node[] = [
          {
            id: 'node_1',
            type: 'shape',
            position: { x: 200, y: 100 },
            data: {
              label: '',
              placeholder: '双击编辑',
              style: {
                backgroundColor: '#dbeafe',
                borderColor: '#2563eb',
                width: 120,
                height: 80,
                borderRadius: 8,
              },
            },
          },
        ];
        setNodes(defaultNodes);
        setHistory([{ nodes: defaultNodes, edges: [] }]);
        setHistoryIndex(0);
      }

      setLoading(false);
    };

    loadLayout();
  }, [layoutId]);

  // Save to history
  const saveToHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: newNodes, edges: newEdges });
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Handle nodes change
  const handleNodesChange = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [edges, saveToHistory]);

  // Handle edges change
  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
    saveToHistory(nodes, newEdges);
  }, [nodes, saveToHistory]);

  // Update node
  const handleUpdateNode = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates,
              style: {
                ...(node.data as any).style,
                ...(updates.style || {}),
              },
            },
          };
        }
        return node;
      })
    );
  }, []);

  // Delete node
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }, []);

  // Add shape
  const handleAddShape = useCallback((type: 'rectangle' | 'circle' | 'diamond') => {
    const shapeStyles = {
      rectangle: { borderRadius: 8, backgroundColor: '#dbeafe', borderColor: '#2563eb' },
      circle: { borderRadius: 50, backgroundColor: '#dcfce7', borderColor: '#16a34a' },
      diamond: { borderRadius: 4, backgroundColor: '#f3e8ff', borderColor: '#9333ea' },
    };

    const newNode: Node = {
      id: `shape_${Date.now()}`,
      type: 'shape',
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: {
        label: '',
        placeholder: '双击编辑',
        style: {
          ...shapeStyles[type],
          width: 120,
          height: type === 'diamond' ? 80 : 80,
        },
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [nodes, edges, saveToHistory]);

  // Add text
  const handleAddText = useCallback(() => {
    const newNode: Node = {
      id: `text_${Date.now()}`,
      type: 'text',
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: {
        label: '文本',
        style: {
          fontSize: 14,
          fontWeight: '500',
        },
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [nodes, edges, saveToHistory]);

  // Add slot
  const handleAddSlot = useCallback((slotType: 'title' | 'content') => {
    const newNode: Node = {
      id: `slot_${Date.now()}`,
      type: 'slot',
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: {
        label: '',
        slotType,
        placeholder: slotType === 'title' ? '标题' : '内容',
        style: {
          width: 140,
          height: 60,
          borderColor: '#f59e0b',
        },
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [nodes, edges, saveToHistory]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Save layout
  const handleSave = useCallback(() => {
    setSaving(true);

    const layout = {
      id: layoutId === 'new' ? `layout_${Date.now()}` : layoutId,
      name: layoutName,
      category: layoutCategory,
      description: layoutDescription,
      thumbnail: '',
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'shape',
        position: { x: n.position.x, y: n.position.y },
        data: {
          label: (n.data as any)?.label || '',
          placeholder: (n.data as any)?.placeholder || '',
          style: (n.data as any)?.style || {},
        },
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || 'smoothstep',
        animated: e.animated || false,
      })),
      slots: nodes
        .filter((n) => n.type === 'slot')
        .map((n) => ({
          id: n.id,
          nodeId: n.id,
          type: (n.data as any)?.slotType || 'content',
          placeholder: (n.data as any)?.placeholder || '',
        })),
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const customLayouts = JSON.parse(localStorage.getItem('customLayouts') || '[]');
    const existingIndex = customLayouts.findIndex((l: any) => l.id === layout.id);

    if (existingIndex >= 0) {
      customLayouts[existingIndex] = layout;
    } else {
      customLayouts.push(layout);
    }

    localStorage.setItem('customLayouts', JSON.stringify(customLayouts));
    setSaving(false);

    alert('保存成功！');
    router.push('/layouts');
  }, [layoutId, layoutName, layoutCategory, layoutDescription, nodes, edges, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
        <button
          onClick={() => router.push('/layouts')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 flex items-center gap-4">
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="text-lg font-semibold text-gray-900 border-0 focus:ring-0 p-0 bg-transparent"
            placeholder="Layout 名称"
          />

          <select
            value={layoutCategory}
            onChange={(e) => setLayoutCategory(e.target.value as LayoutCategory)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          >
            {Object.entries(LAYOUT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          保存
        </button>
      </div>

      {/* Toolbar */}
      <LayoutToolbar
        onAddShape={handleAddShape}
        onAddText={handleAddText}
        onAddSlot={handleAddSlot}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          <LayoutCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          selectedNode={nodes.find((n) => n.id === selectedNodeId) || null}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  );
}
