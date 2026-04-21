'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const MermaidEditor = dynamic(() => import('@/components/mermaid-editor'), { ssr: false });
const TopologyEditor = dynamic(() => import('@/components/topology-editor'), { ssr: false });

const SAMPLE_MERMAID = `flowchart TD
    A[市场容量诊断] --> B{动态路由决策}
    B -->|强资源| C[顺向 A→B→C]
    B -->|弱资源| D[逆向 C→B→A]
    C --> E[B端终端建设]
    D --> F[C端消费者优先]
`;

const SAMPLE_NODES = [
  { id: 'S1', label: '市场容量与资源诊断', group: 'strategy' },
  { id: 'S2', label: '动态路由决策', group: 'strategy' },
  { id: 'B', label: 'B端：立体化终端', group: 'front' },
  { id: 'K', label: 'K序列消费者', group: 'core', shape: 'circle' as const },
  { id: 'V', label: '微序列消费者', group: 'core', shape: 'circle' as const },
  { id: 'OP1', label: '① 信息认证验证', group: 'back' },
  { id: 'OP2', label: '② 排期与培育', group: 'back' },
];

const SAMPLE_LINKS = [
  { id: 'l1', source: 'S1', target: 'S2', type: 'solid' as const },
  { id: 'l2', source: 'S2', target: 'B', type: 'strategy' as const, label: '战略指导' },
  { id: 'l3', source: 'B', target: 'K', type: 'bidirectional' as const, label: '双向链路' },
  { id: 'l4', source: 'K', target: 'V', type: 'bidirectional' as const, label: 'K↔V转化' },
  { id: 'l5', source: 'K', target: 'OP1', type: 'solid' as const, label: '全生命周期' },
  { id: 'l6', source: 'OP1', target: 'OP2', type: 'solid' as const },
];

export default function TestVisualPage() {
  const [tab, setTab] = useState<'mermaid' | 'topology'>('mermaid');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">可视化组件测试</h1>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('mermaid')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'mermaid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >Mermaid 编辑器</button>
        <button
          onClick={() => setTab('topology')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'topology' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >拓扑图编辑器</button>
      </div>
      {tab === 'mermaid' && (
        <div>
          <p className="text-sm text-gray-500 mb-2">左侧输入 mermaid 代码，右侧实时预览。支持导出 SVG/PNG。</p>
          <MermaidEditor code={SAMPLE_MERMAID} height="450px" />
        </div>
      )}
      {tab === 'topology' && (
        <div>
          <p className="text-sm text-gray-500 mb-2">双击编辑卡片/箭头。Delete 删除。拖拽不影响其他节点。</p>
          <TopologyEditor
            nodes={SAMPLE_NODES}
            links={SAMPLE_LINKS}
            onChange={(n, l) => console.log('changed', n, l)}
            height="500px"
          />
        </div>
      )}
    </div>
  );
}
