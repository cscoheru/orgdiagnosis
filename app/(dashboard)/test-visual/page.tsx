'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import type { TopologyNode, TopologyLink } from '@/components/topology-editor';

const MermaidEditor = dynamic(() => import('@/components/mermaid-editor'), { ssr: false });
const TopologyEditor = dynamic(() => import('@/components/topology-editor'), { ssr: false });

const SAMPLE_MERMAID = `flowchart TD
    A[市场容量诊断] --> B{动态路由决策}
    B -->|强资源| C[顺向 A→B→C]
    B -->|弱资源| D[逆向 C→B→A]
    C --> E[B端终端建设]
    D --> F[C端消费者优先]
`;

const SAMPLE_NODES: TopologyNode[] = [
  { id: 'S1', label: '市场容量与资源诊断', group: 'strategy' },
  { id: 'S2', label: '动态路由决策', group: 'strategy' },
  { id: 'B', label: 'B端：立体化终端', group: 'front' },
  { id: 'K', label: 'K序列消费者', group: 'core', shape: 'circle' },
  { id: 'V', label: '微序列消费者', group: 'core', shape: 'circle' },
  { id: 'OP1', label: '① 信息认证验证', group: 'back' },
  { id: 'OP2', label: '② 排期与培育', group: 'back' },
];

const SAMPLE_LINKS: TopologyLink[] = [
  { id: 'l1', source: 'S1', target: 'S2', type: 'solid' },
  { id: 'l2', source: 'S2', target: 'B', type: 'strategy', label: '战略指导' },
  { id: 'l3', source: 'B', target: 'K', type: 'bidirectional', label: '双向链路' },
  { id: 'l4', source: 'K', target: 'V', type: 'bidirectional', label: 'K↔V转化' },
  { id: 'l5', source: 'K', target: 'OP1', type: 'solid', label: '全生命周期' },
  { id: 'l6', source: 'OP1', target: 'OP2', type: 'solid' },
];

/* ===== JSON format auto-detection & conversion ===== */

const GROUP_MAP: Record<string, string> = {
  'Strategic_Routing': 'strategy', 'strategic': 'strategy', 'strategy': 'strategy',
  'Front_End_Sources': 'front', 'front': 'front', 'frontend': 'front',
  'C_Center_Core': 'core', 'core': 'core', 'consumer': 'core',
  'Back_End_Operations': 'back', 'back': 'back', 'backend': 'back', 'operations': 'back',
  'System_Drop': 'warning', 'warning': 'warning', 'drop': 'warning',
};

function convertTopologyJSON(raw: any): { nodes: TopologyNode[]; links: TopologyLink[] } | null {
  // Format 1: Already in { nodes: [...], links: [...] } format
  if (raw.nodes && Array.isArray(raw.nodes) && raw.nodes.length > 0 && 'id' in raw.nodes[0]) {
    return {
      nodes: raw.nodes.map((n: any) => ({
        id: n.id, label: n.label || n.name || n.id,
        group: n.group || 'front', shape: n.shape, desc: n.desc || n.description,
        x: n.x, y: n.y,
      })),
      links: (raw.links || raw.edges || []).map((l: any, i: number) => ({
        id: l.id || `l${i}`,
        source: typeof l.source === 'string' ? l.source : l.from || l.source?.id,
        target: typeof l.target === 'string' ? l.target : l.to || l.target?.id,
        type: l.type || 'solid',
        label: l.label || l.description || '',
      })),
    };
  }

  // Format 2: 作战地图 nested format { nodes: { key: { L1_name, L2_L3_elements } }, bidirectional_edges: [...] }
  if (raw.nodes && typeof raw.nodes === 'object' && !Array.isArray(raw.nodes)) {
    const nodes: TopologyNode[] = [];
    const links: TopologyLink[] = [];
    let ni = 0, li = 0;

    for (const [key, val] of Object.entries(raw.nodes as Record<string, any>)) {
      const group = GROUP_MAP[key] || 'front';
      // Parent node
      const parentId = key;
      nodes.push({
        id: parentId,
        label: val.L1_name || val.name || key,
        group,
        desc: val.description || val.action || '',
      });

      // Children from L2_L3_elements
      if (Array.isArray(val.L2_L3_elements)) {
        val.L2_L3_elements.forEach((el: any) => {
          const childId = `${key}_${ni++}`;
          nodes.push({
            id: childId,
            label: el.name || el.action || '',
            group,
            desc: el.action || el.description || '',
          });
          links.push({ id: `l${li++}`, source: parentId, target: childId, type: 'solid' });
        });
      }
    }

    // Edges
    const edges = raw.bidirectional_edges || raw.edges || [];
    edges.forEach((edge: any) => {
      const fromKey = (edge.from || edge.source || '').split(' ')[0];
      const toKey = (edge.to || edge.target || '').split(' ')[0];
      // Match by partial key
      const fromNode = nodes.find(n =>
        n.id === fromKey || n.id.startsWith(fromKey) || fromKey.includes(n.id) || n.id.includes(fromKey)
      );
      const toNode = nodes.find(n =>
        n.id === toKey || n.id.startsWith(toKey) || toKey.includes(n.id) || n.id.includes(toKey)
      );
      if (fromNode && toNode) {
        links.push({
          id: `l${li++}`,
          source: fromNode.id,
          target: toNode.id,
          type: edge.type === '双向螺旋' || edge.type === '双向' ? 'bidirectional' :
                edge.type === '反馈' || edge.type === '反哺闭环' ? 'feedback' : 'solid',
          label: edge.description || edge.type || '',
        });
      }
    });

    return nodes.length > 0 ? { nodes, links } : null;
  }

  return null;
}

export default function TestVisualPage() {
  const [tab, setTab] = useState<'mermaid' | 'topology'>('mermaid');
  const [topoKey, setTopoKey] = useState(0);
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>(SAMPLE_NODES);
  const [topoLinks, setTopoLinks] = useState<TopologyLink[]>(SAMPLE_LINKS);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const handleJsonPaste = useCallback((text: string) => {
    setJsonInput(text);
    setJsonError('');
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      const result = convertTopologyJSON(parsed);
      if (result && result.nodes.length > 0) {
        setTopoNodes(result.nodes);
        setTopoLinks(result.links);
        setTopoKey(k => k + 1); // force re-mount for fresh layout
        setJsonExpanded(false);
      } else {
        setJsonError('无法识别 JSON 格式。支持: {nodes:[], links:[]} 或作戓地图嵌套格式');
      }
    } catch {
      setJsonError('JSON 解析失败，请检查格式');
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">可视化工具</h1>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setTab('mermaid')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'mermaid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >Mermaid</button>
          <button
            onClick={() => setTab('topology')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'topology' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >拓扑图</button>
        </div>
      </div>

      {tab === 'mermaid' && (
        <div>
          <p className="text-sm text-gray-500 mb-2">左侧输入 mermaid 代码，右侧实时预览。支持导出 SVG/PNG。</p>
          <MermaidEditor code={SAMPLE_MERMAID} height="450px" />
        </div>
      )}

      {tab === 'topology' && (
        <div>
          {/* JSON import bar */}
          <div className="mb-3">
            <button
              onClick={() => setJsonExpanded(!jsonExpanded)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>{jsonExpanded ? '▼' : '▶'}</span>
              粘贴 JSON 导入拓扑数据
            </button>
            {jsonExpanded && (
              <div className="mt-2 border rounded-lg p-3 bg-gray-50">
                <textarea
                  value={jsonInput}
                  onChange={(e) => handleJsonPaste(e.target.value)}
                  placeholder={`粘贴 JSON 到这里，自动解析预览。支持格式：\n\n格式1: { "nodes": [{ "id": "...", "label": "...", "group": "..." }], "links": [...] }\n格式2: 作战地图嵌套格式 { "nodes": { "key": { "L1_name": "...", "L2_L3_elements": [...] } }, "bidirectional_edges": [...] }`}
                  className="w-full h-40 p-2 text-xs font-mono border rounded bg-white resize-y outline-none focus:ring-1 focus:ring-blue-400"
                  spellCheck={false}
                />
                {jsonError && <p className="text-xs text-red-600 mt-1">{jsonError}</p>}
                {topoNodes.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    已加载 {topoNodes.length} 个节点，{topoLinks.length} 条连线
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-2">双击编辑卡片/箭头 · Delete 删除 · 拖拽不影响其他节点</p>
          <TopologyEditor
            key={topoKey}
            nodes={topoNodes}
            links={topoLinks}
            onChange={(n, l) => { setTopoNodes(n); setTopoLinks(l); }}
            height="520px"
          />
        </div>
      )}
    </div>
  );
}
