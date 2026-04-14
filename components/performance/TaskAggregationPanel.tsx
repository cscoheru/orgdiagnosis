'use client';

/**
 * 部门任务归集面板
 *
 * 纵轴：6 个维度（三力三平台）
 * 横轴：部门（可自由添加）
 * 每个单元格：从 actionPlanTable 智能聚合的任务 + 承接部门标签
 *
 * 放置在战略目标 tab 中。
 */

import { useState, useMemo, useCallback } from 'react';
import type { PerformancePlan } from '@/types/performance';
import {
  LayoutGrid,
  TrendingUp,
  Target,
  BarChart,
  Users,
  DollarSign,
  Settings,
  Plus,
  X,
  GripVertical,
} from 'lucide-react';

interface Props {
  plan: PerformancePlan;
}

interface ActionRow {
  seqNumber: number;
  customerGroup: string;
  product: string;
  revenueTarget: number;
  salesForce: string;
  productForce: string;
  deliveryForce: string;
  hr: string;
  financeAssets: string;
  digitalProcess: string;
}

/* ── 6 个维度定义 ── */

interface DimensionDef {
  key: keyof ActionRow;
  label: string;
  icon: React.ElementType;
  color: string;
  headerBg: string;
  itemBg: string;
  /** 默认承接部门 */
  defaultDept: string;
  /** 聚合提示词（用于指导 AI 或用户理解） */
  aggregationHint: string;
}

const DIMENSIONS: DimensionDef[] = [
  {
    key: 'salesForce',
    label: '销售力',
    icon: TrendingUp,
    color: 'text-blue-700',
    headerBg: 'bg-blue-600',
    itemBg: 'bg-blue-50/50',
    defaultDept: '销售部',
    aggregationHint: '合并相似销售策略，按客户/渠道/区域归类',
  },
  {
    key: 'productForce',
    label: '产品力',
    icon: Target,
    color: 'text-amber-700',
    headerBg: 'bg-amber-600',
    itemBg: 'bg-amber-50/50',
    defaultDept: '产品部',
    aggregationHint: '按项目、品类、新老产品、技术方向整合',
  },
  {
    key: 'deliveryForce',
    label: '交付力',
    icon: BarChart,
    color: 'text-emerald-700',
    headerBg: 'bg-emerald-600',
    itemBg: 'bg-emerald-50/50',
    defaultDept: '运营部',
    aggregationHint: '从供应链→生产→前端交付的产线、工艺、团队任务',
  },
  {
    key: 'hr',
    label: '人力资源',
    icon: Users,
    color: 'text-purple-700',
    headerBg: 'bg-purple-600',
    itemBg: 'bg-purple-50/50',
    defaultDept: '人力资源部',
    aggregationHint: '三力所产生的人才需求：招聘、选拔、培养、晋升、淘汰',
  },
  {
    key: 'financeAssets',
    label: '财务&资产',
    icon: DollarSign,
    color: 'text-rose-700',
    headerBg: 'bg-rose-600',
    itemBg: 'bg-rose-50/50',
    defaultDept: '财务部',
    aggregationHint: '三力及人资的财务开支：四费（销售、管理、研发、财务费用）',
  },
  {
    key: 'digitalProcess',
    label: '数字化&流程',
    icon: Settings,
    color: 'text-cyan-700',
    headerBg: 'bg-cyan-600',
    itemBg: 'bg-cyan-50/50',
    defaultDept: 'IT部',
    aggregationHint: '流程优化带来的数字化系统新建、升级、实施、运维项目',
  },
];

/* ── 智能聚合：合并相同/相似任务 ── */

function smartAggregate(items: string[]): string[] {
  // 过滤空值
  const valid = items.filter((s) => s && s.trim());
  if (valid.length === 0) return [];

  // 去除完全相同的条目
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of valid) {
    const normalized = item.trim().replace(/\s+/g, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(item.trim());
    }
  }
  return unique;
}

/* ── 组件 ── */

export default function TaskAggregationPanel({ plan }: Props) {
  const rows = useMemo<ActionRow[]>(() => {
    const ctx = (plan.properties.business_context as Record<string, string>) || {};
    const raw = ctx.action_plans;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [plan.properties.business_context]);

  // 部门列表（可自由添加）
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState('');
  const [addingDept, setAddingDept] = useState(false);

  // 每个 维度 × 部门 的任务分配
  const [taskMap, setTaskMap] = useState<Record<string, Record<string, string>>>({});

  // 初始化：为每个维度自动分配默认部门
  useMemo(() => {
    if (departments.length === 0 && rows.length > 0) {
      const defaultDepts = new Set<string>();
      for (const dim of DIMENSIONS) {
        // 从该维度的所有非空任务中提取部门关键词
        const allTasks = rows.map((r) => String(r[dim.key] || '')).filter(Boolean);
        if (allTasks.length > 0) {
          defaultDepts.add(dim.defaultDept);
        }
      }
      setDepartments(Array.from(defaultDepts));
    }
  }, [rows]);

  // 初始化 taskMap：每个维度用默认部门
  useMemo(() => {
    if (Object.keys(taskMap).length === 0 && departments.length > 0) {
      const initial: Record<string, Record<string, string>> = {};
      for (const dim of DIMENSIONS) {
        initial[dim.key] = {};
        initial[dim.key][dim.defaultDept] = smartAggregate(rows.map((r) => String(r[dim.key] || ''))).join('\n');
      }
      setTaskMap(initial);
    }
  }, [departments, rows]);

  const addDepartment = useCallback(() => {
    if (!newDept.trim()) return;
    setDepartments((prev) => [...prev, newDept.trim()]);
    // 初始化新部门的所有维度为空
    setTaskMap((prev) => {
      const updated = { ...prev };
      for (const dim of DIMENSIONS) {
        if (!updated[dim.key]) updated[dim.key] = {};
        if (!updated[dim.key][newDept.trim()]) {
          updated[dim.key][newDept.trim()] = '';
        }
      }
      return updated;
    });
    setNewDept('');
    setAddingDept(false);
  }, [newDept]);

  const removeDepartment = useCallback((dept: string) => {
    setDepartments((prev) => prev.filter((d) => d !== dept));
    setTaskMap((prev) => {
      const updated = { ...prev };
      for (const dim of DIMENSIONS) {
        if (updated[dim.key]) {
          const dimMap = { ...updated[dim.key] };
          delete dimMap[dept];
          updated[dim.key] = dimMap;
        }
      }
      return updated;
    });
  }, []);

  const updateTask = useCallback((dimKey: string, dept: string, value: string) => {
    setTaskMap((prev) => ({
      ...prev,
      [dimKey]: { ...prev[dimKey], [dept]: value },
    }));
  }, []);

  if (rows.length === 0) return null;

  const Icon = LayoutGrid;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">部门任务归集</span>
          <span className="text-xs text-gray-400">{rows.length} 个业务单元 · {departments.length} 个部门</span>
        </div>
        <button
          onClick={() => setAddingDept(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Plus size={12} /> 添加部门
        </button>
      </div>

      {/* Add Department Input */}
      {addingDept && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 bg-indigo-50/30">
          <input
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
            placeholder="输入部门名称，如：品牌部、企管部..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={addDepartment}
            disabled={!newDept.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            确认
          </button>
          <button
            onClick={() => { setAddingDept(false); setNewDept(''); }}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Department Tags */}
      {departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-gray-100">
          {departments.map((dept) => (
            <span
              key={dept}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 rounded-full"
            >
              {dept}
              <button
                onClick={() => removeDepartment(dept)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead>
            <tr>
              {/* Dimension column */}
              <th className="sticky left-0 z-10 px-3 py-2.5 bg-white text-left text-xs font-semibold text-gray-700 border-b border-gray-200 min-w-[120px] w-[140px]">
                <div className="flex items-center gap-1.5">
                  <GripVertical size={12} className="text-gray-300" />
                  维度
                </div>
              </th>
              {/* Department columns */}
              {departments.map((dept) => (
                <th
                  key={dept}
                  className="px-3 py-2.5 bg-gray-50 text-center text-xs font-medium text-gray-600 border-b border-gray-200 min-w-[220px]"
                >
                  {dept}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((dim) => {
              const dimTasks = smartAggregate(rows.map((r) => String(r[dim.key] || '')));
              const dimTaskMap = taskMap[dim.key] || {};
              const hasContent = departments.some((d) => dimTaskMap[d]?.trim());

              return (
                <tr key={dim.key} className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
                  {/* Dimension Label */}
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-100 align-top">
                    <div className={`flex items-center gap-1.5 ${dim.color}`}>
                      <dim.icon size={13} />
                      <span className="font-semibold text-xs">{dim.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 ml-5 leading-tight">{dim.aggregationHint}</p>
                  </td>

                  {/* Department Cells */}
                  {departments.map((dept) => {
                    const cellValue = dimTaskMap[dept] || '';

                    return (
                      <td key={dept} className={`px-2 py-2 border-r border-gray-100 align-top ${dim.itemBg}`}>
                        <textarea
                          value={cellValue}
                          onChange={(e) => updateTask(dim.key, dept, e.target.value)}
                          placeholder={
                            dim.key === 'salesForce' ? '合并同类销售策略...' :
                            dim.key === 'productForce' ? '按项目/品类整合...' :
                            dim.key === 'deliveryForce' ? '供应链→生产→交付...' :
                            dim.key === 'hr' ? '招聘/培养/晋升...' :
                            dim.key === 'financeAssets' ? '四费/预算...' :
                            '数字化项目/流程优化...'
                          }
                          className="w-full h-20 px-2 py-1.5 text-[11px] leading-relaxed bg-white/80 border border-gray-200 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-300"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
