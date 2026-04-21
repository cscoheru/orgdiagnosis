'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './topology-editor.css';

/* ===== Types ===== */
export interface TopologyNode {
  id: string;
  label: string;
  group: string;
  shape?: 'rect' | 'circle';
  desc?: string;
  x?: number;
  y?: number;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  type: 'solid' | 'bidirectional' | 'feedback' | 'strategy';
  label?: string;
}

interface TopologyEditorProps {
  nodes: TopologyNode[];
  links: TopologyLink[];
  onChange?: (nodes: TopologyNode[], links: TopologyLink[]) => void;
  readOnly?: boolean;
  height?: string;
}

/* ===== Constants ===== */
const GROUP_BG: Record<string, string> = {
  strategy: '#4a504a', front: '#2d579a', core: '#d92a2a', back: '#e68a00', warning: '#ffe6e6',
};
const GROUP_TEXT: Record<string, string> = {
  strategy: '#fff', front: '#fff', core: '#fff', back: '#fff', warning: '#d92a2a',
};
const GROUP_STROKE: Record<string, string> = {
  strategy: '#3a3a3a', front: '#1e3d6e', core: '#b02020', back: '#b36b00', warning: '#d92a2a',
};
const LINK_COLOR: Record<string, string> = {
  solid: '#94a3b8', bidirectional: '#2d579a', feedback: '#e68a00', strategy: '#4a504a',
};
const CARD_W = 150, CARD_H = 48;

/* ===== Modal state ===== */
interface ModalState {
  type: 'node' | 'link' | null;
  editing?: TopologyNode | TopologyLink;
  newX?: number;
  newY?: number;
  srcId?: string;
  tgtId?: string;
}

export default function TopologyEditor({
  nodes: propNodes,
  links: propLinks,
  onChange,
  readOnly = false,
  height = '600px',
}: TopologyEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  // Internal state (deep clone to avoid mutation)
  const [nodes, setNodes] = useState<TopologyNode[]>(() => JSON.parse(JSON.stringify(propNodes)));
  const [links, setLinks] = useState<TopologyLink[]>(() => JSON.parse(JSON.stringify(propLinks)));
  const [selectedId, setSelectedId] = useState<{ type: 'node' | 'link'; id: string } | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [mode, setMode] = useState<'select' | 'addNode' | 'addLink'>('select');
  const [addLinkSource, setAddLinkSource] = useState<string | null>(null);
  const [status, setStatus] = useState('就绪');
  const nextId = useRef(100);
  const initDone = useRef(false);

  // Sync props → internal (only on mount or explicit prop change)
  useEffect(() => {
    setNodes(JSON.parse(JSON.stringify(propNodes)));
    setLinks(JSON.parse(JSON.stringify(propLinks)));
    initDone.current = false; // re-layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propNodes, propLinks]);

  /* ===== D3 Render ===== */
  const render = useCallback(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const containerW = containerRef.current?.clientWidth || 800;
    const containerH = containerRef.current?.clientHeight || 600;

    // --- Layout (force once, then freeze) ---
    if (!initDone.current) {
      const simNodes = nodes.map(n => ({
        ...n,
        x: n.x ?? containerW / 2 + (Math.random() - 0.5) * 100,
        y: n.y ?? containerH / 2 + (Math.random() - 0.5) * 100,
      }));
      const simLinks = links.map(l => ({ ...l }));
      const sim = d3.forceSimulation(simNodes as d3.SimulationNodeDatum[])
        .force('link', d3.forceLink(simLinks as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
          .id((d: any) => d.id).distance(170).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-500))
        .force('center', d3.forceCenter(containerW / 2, containerH / 2))
        .force('collide', d3.forceCollide().radius(85))
        .stop();
      for (let i = 0; i < 250; i++) sim.tick();
      simNodes.forEach(n => { (n as any).fx = n.x; (n as any).fy = n.y; });
      setNodes([...simNodes]);
      initDone.current = true;
      return; // will re-render via state change
    }

    // --- Clear ---
    g.selectAll('*').remove();

    // --- Defs (arrow markers) ---
    const defs = g.append('defs');
    const uniqueColors = [...new Set(Object.values(LINK_COLOR))];
    uniqueColors.forEach(c => {
      defs.append('marker')
        .attr('id', `te-arr-${c.replace('#', '')}`)
        .attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', c);
    });

    // --- Links ---
    const resolve = (ref: any): TopologyNode =>
      typeof ref === 'string' ? nodes.find(n => n.id === ref) || { id: ref, label: ref, group: 'front', x: 0, y: 0 } as any : ref;

    const linkSel = g.append('g').selectAll('line')
      .data(links).join('line')
      .attr('class', d => {
        let cls = 'te-link';
        if (d.type === 'bidirectional') cls += ' te-link-bidirectional';
        else if (d.type === 'feedback') cls += ' te-link-feedback';
        else if (d.type === 'strategy') cls += ' te-link-strategy';
        if (selectedId?.type === 'link' && selectedId?.id === d.id) cls += ' selected';
        return cls;
      })
      .attr('stroke', d => LINK_COLOR[d.type] || '#94a3b8')
      .attr('stroke-width', d => (!d.label && d.type === 'solid') ? 1.5 : 2)
      .attr('marker-end', d => `url(#te-arr-${(LINK_COLOR[d.type] || '#94a3b8').replace('#', '')})`)
      .attr('x1', d => (resolve(d.source) as any).x)
      .attr('y1', d => (resolve(d.source) as any).y)
      .attr('x2', d => (resolve(d.target) as any).x)
      .attr('y2', d => (resolve(d.target) as any).y);

    if (!readOnly) {
      linkSel.on('click', (_e: MouseEvent, d: TopologyLink) => {
        setSelectedId({ type: 'link', id: d.id });
        setStatus(`箭头: ${(resolve(d.source) as any).label} → ${(resolve(d.target) as any).label}`);
        render();
      }).on('dblclick', (_e: MouseEvent, d: TopologyLink) => {
        setModal({ type: 'link', editing: d });
      });
    }

    // --- Edge labels ---
    links.filter(l => l.label).forEach(d => {
      const s = resolve(d.source) as any, t = resolve(d.target) as any;
      const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2 - 7;
      const txt = d.label!.length > 16 ? d.label!.substring(0, 14) + '…' : d.label;
      const lbl = g.append('g');
      const tmp = lbl.append('text').attr('font-size', '9px').text(txt ?? '').node()!;
      const bw = tmp.getBBox().width;
      lbl.select('text').remove();
      lbl.append('rect').attr('class', 'te-edge-bg')
        .attr('x', mx - bw / 2 - 3).attr('y', my - 9).attr('width', bw + 6).attr('height', 14).attr('rx', 3);
      lbl.append('text').attr('class', 'te-edge-label')
        .attr('x', mx).attr('y', my).attr('text-anchor', 'middle').text(txt ?? '');
    });

    // --- Nodes ---
    const nodeSel = g.append('g').selectAll('g')
      .data(nodes, (d: any) => d.id).join('g')
      .attr('class', d => {
        let cls = 'te-node';
        if (selectedId?.type === 'node' && selectedId?.id === d.id) cls += ' selected';
        return cls;
      })
      .attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);

    // Drag
    if (!readOnly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (nodeSel as any).call(
        d3.drag<SVGGElement, any, any>()
          .on('start', function (_e: any, d: any) { d.fx = d.x; d.fy = d.y; })
          .on('drag', function (e: any, d: any) {
            d.fx = e.x; d.fy = e.y; d.x = e.x; d.y = e.y;
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
            linkSel.attr('x1', (l: any) => (resolve(l.source) as any).x)
              .attr('y1', (l: any) => (resolve(l.source) as any).y)
              .attr('x2', (l: any) => (resolve(l.target) as any).x)
              .attr('y2', (l: any) => (resolve(l.target) as any).y);
          })
          .on('end', function (_e: any, d: any) {
            d.fx = d.x; d.fy = d.y;
            setNodes([...nodes]);
            onChange?.(nodes, links);
          })
      );
      nodeSel.on('click', (_e: MouseEvent, d: TopologyNode) => {
        if (mode === 'addLink') {
          if (!addLinkSource) {
            setAddLinkSource(d.id);
            setStatus(`来源: ${d.label}，点击目标卡片`);
          } else if (addLinkSource !== d.id) {
            setModal({ type: 'link', srcId: addLinkSource, tgtId: d.id });
            setAddLinkSource(null);
            setMode('select');
          }
          return;
        }
        setSelectedId({ type: 'node', id: d.id });
        setStatus(`卡片: ${d.label}`);
        render();
      }).on('dblclick', (_e: MouseEvent, d: TopologyNode) => {
        setModal({ type: 'node', editing: d });
      });
    }

    // Draw shapes
    nodeSel.each(function (d) {
      const el = d3.select(this);
      const bg = GROUP_BG[d.group] || '#6b7280';
      const stroke = GROUP_STROKE[d.group] || '#374151';
      const txt = GROUP_TEXT[d.group] || '#fff';
      const shape = d.shape || 'rect';

      if (shape === 'circle') {
        el.append('circle').attr('class', 'te-node-bg')
          .attr('r', 40).attr('fill', bg).attr('stroke', stroke);
      } else {
        el.append('rect').attr('class', 'te-node-bg')
          .attr('x', -CARD_W / 2).attr('y', -CARD_H / 2)
          .attr('width', CARD_W).attr('height', CARD_H)
          .attr('rx', 8).attr('ry', 8)
          .attr('fill', bg).attr('stroke', stroke)
          .attr('stroke-dasharray', d.group === 'warning' ? '5 3' : 'none');
      }

      const parts = splitLabel(d.label);
      if (shape === 'circle') {
        el.append('text').attr('text-anchor', 'middle')
          .attr('dy', parts.length > 1 ? -5 : 2).attr('fill', txt).text(parts[0]);
        if (parts.length > 1) {
          el.append('text').attr('text-anchor', 'middle').attr('dy', 10)
            .attr('fill', txt).attr('opacity', 0.8).attr('font-size', '9px').text(parts.slice(1).join('：'));
        }
      } else {
        el.append('text').attr('text-anchor', 'middle')
          .attr('dy', parts.length > 1 ? -4 : 2).attr('fill', txt)
          .text(parts[0] + (parts.length > 1 ? '：' : ''));
        if (parts.length > 1) {
          el.append('text').attr('text-anchor', 'middle').attr('dy', 10)
            .attr('fill', txt).attr('class', 'te-subtitle').text(parts.slice(1).join('：'));
        }
      }
    });

  }, [nodes, links, selectedId, mode, addLinkSource, readOnly, onChange]);

  function splitLabel(label: string): string[] {
    if (label.includes('：')) return label.split('：');
    if (label.includes(':')) return label.split(':');
    return [label];
  }

  /* ===== SVG Init ===== */
  useEffect(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', containerW)
      .attr('height', containerH)
      .node()!;
    svgRef.current = svg;

    const g = d3.select(svg).append('g').node()!;
    gRef.current = g;

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => { d3.select(g).attr('transform', event.transform); });
    d3.select(svg).call(zoomBehavior);

    // Click background to deselect
    d3.select(svg).on('click', (e: MouseEvent) => {
      if (e.target === svg) {
        if (mode === 'addNode') {
          const transform = d3.zoomTransform(svg);
          const [mx, my] = d3.pointer(e, g);
          const px = (mx - transform.x) / transform.k;
          const py = (my - transform.y) / transform.k;
          setModal({ type: 'node', newX: px, newY: py });
          setMode('select');
        } else {
          setSelectedId(null);
          setStatus('就绪');
          render();
        }
      }
    });

    return () => { d3.select(svg).remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Re-render on state change ===== */
  useEffect(() => { render(); }, [render]);

  /* ===== Resize ===== */
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current && containerRef.current) {
        d3.select(svgRef.current)
          .attr('width', containerRef.current.clientWidth)
          .attr('height', containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ===== Keyboard ===== */
  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (modal.type) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) { deleteSelected(); e.preventDefault(); }
      }
      if (e.key === 'Escape') { setSelectedId(null); setMode('select'); setStatus('就绪'); render(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, modal, readOnly]);

  /* ===== Actions ===== */
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    if (selectedId.type === 'node') {
      const nid = selectedId.id;
      const newNodes = nodes.filter(n => n.id !== nid);
      const newLinks = links.filter(l => {
        const sid = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tid = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return sid !== nid && tid !== nid;
      });
      setNodes(newNodes);
      setLinks(newLinks);
      onChange?.(newNodes, newLinks);
    } else {
      const newLinks = links.filter(l => l.id !== selectedId.id);
      setLinks(newLinks);
      onChange?.(nodes, newLinks);
    }
    setSelectedId(null);
    setStatus('已删除');
  }, [selectedId, nodes, links, onChange]);

  /* ===== Modal save ===== */
  const saveNodeModal = (formData: { label: string; group: string; shape: string; desc: string }) => {
    if (!formData.label.trim()) return;
    if (modal.editing) {
      const newNodes = nodes.map(n =>
        n.id === (modal.editing as TopologyNode).id
          ? { ...n, label: formData.label, group: formData.group, shape: formData.shape as 'rect' | 'circle', desc: formData.desc }
          : n
      );
      setNodes(newNodes);
      onChange?.(newNodes, links);
    } else {
      const id = `N${nextId.current++}`;
      const x = modal.newX ?? 400, y = modal.newY ?? 300;
      const newNode: TopologyNode & { fx: number; fy: number } = { id, label: formData.label, group: formData.group, shape: formData.shape as 'rect' | 'circle', desc: formData.desc, x, y, fx: x, fy: y };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      onChange?.(newNodes, links);
    }
    setModal({ type: null });
  };

  const saveLinkModal = (formData: { source: string; target: string; type: string; label: string }) => {
    if (formData.source === formData.target) return;
    const typedType = formData.type as TopologyLink['type'];
    if (modal.editing) {
      const newLinks = links.map(l =>
        l.id === (modal.editing as TopologyLink).id
          ? { ...l, source: formData.source, target: formData.target, type: typedType, label: formData.label }
          : l
      );
      setLinks(newLinks);
      onChange?.(nodes, newLinks);
    } else {
      const id = `L${nextId.current++}`;
      const newLinks = [...links, { id, source: formData.source, target: formData.target, type: typedType, label: formData.label }];
      setLinks(newLinks as TopologyLink[]);
      onChange?.(nodes, newLinks as TopologyLink[]);
    }
    setModal({ type: null });
  };

  const deleteFromModal = () => {
    if (modal.editing) {
      if ('group' in modal.editing) {
        // Node
        const nid = (modal.editing as TopologyNode).id;
        const newNodes = nodes.filter(n => n.id !== nid);
        const newLinks = links.filter(l => {
          const sid = typeof l.source === 'string' ? l.source : (l.source as any).id;
          const tid = typeof l.target === 'string' ? l.target : (l.target as any).id;
          return sid !== nid && tid !== nid;
        });
        setNodes(newNodes); setLinks(newLinks);
        onChange?.(newNodes, newLinks);
      } else {
        const newLinks = links.filter(l => l.id !== (modal.editing as TopologyLink).id);
        setLinks(newLinks);
        onChange?.(nodes, newLinks);
      }
    }
    setSelectedId(null);
    setModal({ type: null });
  };

  const exportJSON = () => {
    const out = {
      nodes: nodes.map(n => ({ ...n, x: Math.round((n as any).x || 0), y: Math.round((n as any).y || 0) })),
      links: links.map(l => ({
        ...l,
        source: typeof l.source === 'string' ? l.source : (l.source as any).id,
        target: typeof l.target === 'string' ? l.target : (l.target as any).id,
      })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'topology.json'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ===== JSX ===== */
  return (
    <div className="topology-editor relative flex flex-col border rounded-lg overflow-hidden bg-white" style={{ height }}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border-b text-xs">
          <button
            onClick={() => { setMode('select'); setStatus('就绪'); }}
            className={`px-2 py-1 rounded ${mode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >选择/拖拽</button>
          <button
            onClick={() => { setMode('addNode'); setStatus('点击空白处放置新卡片'); }}
            className={`px-2 py-1 rounded ${mode === 'addNode' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
          >+ 卡片</button>
          <button
            onClick={() => { setMode('addLink'); setAddLinkSource(null); setStatus('先点来源，再点目标'); }}
            className={`px-2 py-1 rounded ${mode === 'addLink' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
          >+ 箭头</button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button onClick={() => { if (selectedId) setModal({ type: selectedId.type, editing: selectedId.type === 'node' ? nodes.find(n => n.id === selectedId.id) : links.find(l => l.id === selectedId.id) }); }}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
          >编辑</button>
          <button onClick={deleteSelected}
            className="px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded"
          >删除</button>
          <div className="flex-1" />
          <button onClick={exportJSON} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700">导出 JSON</button>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative" />

      {/* Status */}
      <div className="te-status">{status}{mode !== 'select' ? ` · 模式: ${mode === 'addNode' ? '添加卡片' : '添加箭头'}` : ''}</div>

      {/* Node Modal */}
      {modal.type === 'node' && (
        <NodeModal
          node={modal.editing as TopologyNode | undefined}
          onSave={saveNodeModal}
          onDelete={modal.editing ? deleteFromModal : undefined}
          onClose={() => setModal({ type: null })}
        />
      )}

      {/* Link Modal */}
      {modal.type === 'link' && (
        <LinkModal
          link={modal.editing as TopologyLink | undefined}
          nodes={nodes}
          defaultSource={modal.srcId}
          defaultTarget={modal.tgtId}
          onSave={saveLinkModal}
          onDelete={modal.editing ? deleteFromModal : undefined}
          onClose={() => setModal({ type: null })}
        />
      )}
    </div>
  );
}

/* ===== Sub-components ===== */

function NodeModal({
  node, onSave, onDelete, onClose,
}: {
  node?: TopologyNode;
  onSave: (data: { label: string; group: string; shape: string; desc: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node?.label ?? '');
  const [group, setGroup] = useState(node?.group ?? 'front');
  const [shape, setShape] = useState(node?.shape ?? 'rect');
  const [desc, setDesc] = useState(node?.desc ?? '');
  const isNew = !node;

  return (
    <div className="te-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="te-modal" onClick={e => e.stopPropagation()}>
        <h4>{isNew ? '添加卡片' : '编辑卡片'}</h4>
        <label>名称</label>
        <input value={label} onChange={e => setLabel(e.target.value)} autoFocus />
        <label>层级</label>
        <select value={group} onChange={e => setGroup(e.target.value)}>
          <option value="strategy">L1 战略路由层</option>
          <option value="front">前端触达层</option>
          <option value="core">C端核心底座</option>
          <option value="back">后端运营闭环</option>
          <option value="warning">数据剔除</option>
        </select>
        <label>形状</label>
        <select value={shape} onChange={e => setShape(e.target.value as 'rect' | 'circle')}>
          <option value="rect">圆角矩形</option>
          <option value="circle">圆形</option>
        </select>
        <label>描述</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="te-btn-row">
          {onDelete && <button className="te-btn te-btn-delete" onClick={onDelete}>删除</button>}
          <button className="te-btn te-btn-cancel" onClick={onClose}>取消</button>
          <button className="te-btn te-btn-primary" onClick={() => onSave({ label, group, shape, desc })}>保存</button>
        </div>
      </div>
    </div>
  );
}

function LinkModal({
  link, nodes, defaultSource, defaultTarget, onSave, onDelete, onClose,
}: {
  link?: TopologyLink;
  nodes: TopologyNode[];
  defaultSource?: string;
  defaultTarget?: string;
  onSave: (data: { source: string; target: string; type: string; label: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isNew = !link;
  const opts = nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>);
  const [source, setSource] = useState(
    link ? (typeof link.source === 'string' ? link.source : (link.source as any).id) : defaultSource ?? nodes[0]?.id ?? ''
  );
  const [target, setTarget] = useState(
    link ? (typeof link.target === 'string' ? link.target : (link.target as any).id) : defaultTarget ?? nodes[0]?.id ?? ''
  );
  const [type, setType] = useState(link?.type ?? 'solid');
  const [label, setLabel] = useState(link?.label ?? '');

  return (
    <div className="te-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="te-modal" onClick={e => e.stopPropagation()}>
        <h4>{isNew ? '添加箭头' : '编辑箭头'}</h4>
        <label>来源</label>
        <select value={source} onChange={e => setSource(e.target.value)}>{opts}</select>
        <label>目标</label>
        <select value={target} onChange={e => setTarget(e.target.value)}>{opts}</select>
        <label>类型</label>
        <select value={type} onChange={e => setType(e.target.value as TopologyLink['type'])}>
          <option value="solid">实线（单向）</option>
          <option value="bidirectional">双向</option>
          <option value="feedback">反馈（虚线）</option>
          <option value="strategy">战略指导（点划线）</option>
        </select>
        <label>标签</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="箭头上的文字" />
        <div className="te-btn-row">
          {onDelete && <button className="te-btn te-btn-delete" onClick={onDelete}>删除</button>}
          <button className="te-btn te-btn-cancel" onClick={onClose}>取消</button>
          <button className="te-btn te-btn-primary" onClick={() => onSave({ source, target, type, label })}>保存</button>
        </div>
      </div>
    </div>
  );
}
