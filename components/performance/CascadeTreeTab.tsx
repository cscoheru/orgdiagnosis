'use client';

/**
 * Phase 4: 级联树可视化
 *
 * 树形布局展示公司→部门→岗位的目标层级。
 * 每个节点显示：名称、周期、状态、权重完成率。
 * "一键级联生成" + "分解到季度" 操作。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCascadeTree,
  cascadeGenerate,
  decomposePeriod,
} from '@/lib/api/performance-api';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import type { PerformancePlan } from '@/types/performance';
import { Sparkles, ChevronDown, ChevronRight, GitBranch, Building2, User, Calendar, RefreshCw } from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Types ── */

interface TreeNode {
  _key: string;
  type: 'org_performance' | 'position_performance';
  name: string;
  perf_type?: string;
  period_target?: string;
  status: string;
  dimension_weights?: Record<string, number>;
  is_leader?: boolean;
  children: TreeNode[];
}

/* ── Component ── */

export default function CascadeTreeTab({ projectId, activePlan, onRefresh }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [orgUnits, setOrgUnits] = useState<KernelObject[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [decomposing, setDecomposing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  /* ── Fetch ── */

  const fetchTree = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const [treeRes, orgRes] = await Promise.all([
        getCascadeTree(activePlan._key),
        getObjectsByModel('Org_Unit', 100),
      ]);
      if (treeRes.success && treeRes.data) {
        setTree(treeRes.data.tree as TreeNode[]);
      }
      if (orgRes.success && orgRes.data) {
        setOrgUnits(Array.isArray(orgRes.data) ? orgRes.data : []);
      }
    } finally { setLoading(false); }
  }, [activePlan]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  /* ── Handlers ── */

  const handleCascade = async () => {
    if (!selectedRoot || !activePlan) return;
    setCascading(true);
    setError(null);
    try {
      const res = await cascadeGenerate(activePlan._key, selectedRoot);
      if (res.success) {
        await fetchTree();
        await onRefresh();
      } else {
        setError(res.error || '级联生成失败');
      }
    } finally { setCascading(false); }
  };

  const handleDecompose = async (orgPerfKey: string) => {
    setDecomposing(orgPerfKey);
    setError(null);
    try {
      const res = await decomposePeriod(orgPerfKey);
      if (res.success) {
        await fetchTree();
        await onRefresh();
      } else {
        setError(res.error || '周期分解失败');
      }
    } finally { setDecomposing(null); }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ── Empty state ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <GitBranch size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">选择根部门（公司总部）</label>
          <select
            value={selectedRoot}
            onChange={(e) => setSelectedRoot(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">选择根部门...</option>
            {orgUnits.map(ou => (
              <option key={ou._key} value={ou._key}>
                {(ou.properties.unit_name as string) || ou._key}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCascade}
          disabled={!selectedRoot || cascading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          {cascading ? '级联生成中...' : '一键级联生成'}
        </button>
        <button
          onClick={fetchTree}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Tree */}
      {!loading && (
        <>
          {tree.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <GitBranch size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">选择根部门并点击「一键级联生成」创建目标层级</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500">级联树</span>
              </div>
              <div className="p-4">
                {tree.map(node => (
                  <TreeNodeComponent
                    key={node._key}
                    node={node}
                    depth={0}
                    expandedKeys={expandedKeys}
                    onToggle={toggleExpand}
                    onDecompose={handleDecompose}
                    decomposing={decomposing}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Tree Node Sub-Component ── */

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
  onDecompose: (key: string) => Promise<void>;
  decomposing: string | null;
}

function TreeNodeComponent({ node, depth, expandedKeys, onToggle, onDecompose, decomposing }: TreeNodeProps) {
  const expanded = expandedKeys.has(node._key);
  const hasChildren = node.children && node.children.length > 0;
  const isOrg = node.type === 'org_performance';
  const isPosition = node.type === 'position_performance';

  const STATUS_COLORS: Record<string, string> = {
    '生成中': 'bg-blue-100 text-blue-700',
    '待确认': 'bg-amber-100 text-amber-700',
    '已确认': 'bg-green-100 text-green-700',
    '已分解': 'bg-purple-100 text-purple-700',
    '已生成': 'bg-blue-100 text-blue-700',
    '已编辑': 'bg-amber-100 text-amber-700',
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => hasChildren && onToggle(node._key)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />
        ) : (
          <span className="w-3" />
        )}

        {isOrg ? (
          <Building2 size={13} className={node.perf_type === 'company' ? 'text-indigo-500' : 'text-gray-500'} />
        ) : (
          <User size={13} className={node.is_leader ? 'text-amber-500' : 'text-gray-400'} />
        )}

        <span className="text-xs font-medium text-gray-800 truncate max-w-[200px]">{node.name}</span>

        {node.perf_type && (
          <span className={`text-[9px] px-1 py-0 rounded ${node.perf_type === 'company' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
            {node.perf_type === 'company' ? '公司级' : '部门级'}
          </span>
        )}

        {node.period_target && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Calendar size={9} /> {node.period_target}
          </span>
        )}

        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[node.status] || 'bg-gray-100 text-gray-500'}`}>
          {node.status}
        </span>

        {isOrg && node._key && (
          <button
            onClick={(e) => { e.stopPropagation(); onDecompose(node._key); }}
            disabled={decomposing === node._key}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
          >
            <GitBranch size={9} />
            {decomposing === node._key ? '分解中...' : '分解到季度'}
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeComponent
              key={child._key}
              node={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              onDecompose={onDecompose}
              decomposing={decomposing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
