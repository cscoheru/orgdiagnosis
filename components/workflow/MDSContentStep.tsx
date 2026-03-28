'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EnhancedMilestonePlanData, MDSSingleSlide } from '@/lib/workflow/w1-types';
import { createMDSFromPlan, uid } from '@/lib/workflow/w1-types';
import { exportMDSToMD } from '@/lib/workflow/export-md';
import DynamicListInput from './DynamicListInput';

interface MDSContentStepProps {
  planData: EnhancedMilestonePlanData | null;
  clientName: string;
  mdsData: MDSSingleSlide | null;
  onConfirm: (data: MDSSingleSlide) => void;
}

export default function MDSContentStep({
  planData,
  clientName,
  mdsData,
  onConfirm,
}: MDSContentStepProps) {
  const [data, setData] = useState<MDSSingleSlide | null>(null);

  // 优先使用已确认的 mdsData（有内容时），否则从 planData 自动生成
  useEffect(() => {
    if (mdsData && mdsData.rows.length > 0) {
      setData(mdsData);
    } else if (planData && planData.phases.length > 0) {
      setData(createMDSFromPlan(planData, clientName));
    }
  }, [mdsData, planData, clientName]);

  const update = useCallback((partial: Partial<MDSSingleSlide>) => {
    setData(prev => prev ? { ...prev, ...partial } : null);
  }, []);

  // ── 阶段列操作 ──

  const updatePhase = (index: number, field: string, value: string | number) => {
    if (!data) return;
    const phases = [...data.phases];
    phases[index] = { ...phases[index], [field]: value };
    update({ phases });
  };

  const addPhase = () => {
    if (!data) return;
    const newPhase = { id: uid(), phase_name: `阶段 ${data.phases.length + 1}`, duration_weeks: 2 };
    const rows = data.rows.map(r => ({ ...r, cells: [...r.cells, ''] }));
    update({ phases: [...data.phases, newPhase], rows });
  };

  const removePhase = (index: number) => {
    if (!data || data.phases.length <= 1) return;
    const phases = data.phases.filter((_, i) => i !== index);
    const rows = data.rows.map(r => ({ ...r, cells: r.cells.filter((_, i) => i !== index) }));
    update({ phases, rows });
  };

  // ── 行操作 ──

  const addRow = (type: 'activity' | 'deliverable') => {
    if (!data) return;
    const cells = data.phases.map(() => '');
    update({ rows: [...data.rows, { id: uid(), type, cells }] });
  };

  const removeRow = (index: number) => {
    if (!data) return;
    update({ rows: data.rows.filter((_, i) => i !== index) });
  };

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    if (!data) return;
    const rows = [...data.rows];
    const cells = [...rows[rowIndex].cells];
    // 确保数组长度与阶段数一致
    while (cells.length < data.phases.length) cells.push('');
    cells[cellIndex] = value;
    rows[rowIndex] = { ...rows[rowIndex], cells };
    update({ rows });
  };

  const updateRowType = (rowIndex: number, type: 'activity' | 'deliverable') => {
    if (!data) return;
    const rows = [...data.rows];
    rows[rowIndex] = { ...rows[rowIndex], type };
    update({ rows });
  };

  const totalWeeks = data?.phases.reduce((sum, p) => sum + p.duration_weeks, 0) || 0;

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
        请先完成上一步「核心需求与计划」
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* 顶部基本信息 */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">幻灯片标题</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => update({ title: e.target.value })}
            className="w-full px-3 py-2 text-lg font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">项目总体目标</label>
            <textarea
              value={data.project_goal}
              onChange={(e) => update({ project_goal: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">核心信息（价值主张）</label>
            <textarea
              value={data.key_message}
              onChange={(e) => update({ key_message: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-blue-50/50"
              rows={2}
              placeholder="一句话概括为什么选择我们..."
            />
          </div>
        </div>
      </div>

      {/* 可编辑表格 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-24 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  类型
                </th>
                {data.phases.map((phase, i) => (
                  <th key={phase.id} className="px-3 py-2.5 text-left min-w-[160px] border-r border-gray-200 last:border-r-0">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={phase.phase_name}
                        onChange={(e) => updatePhase(i, 'phase_name', e.target.value)}
                        className="flex-1 px-1.5 py-0.5 text-xs font-semibold border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <input
                        type="number"
                        value={phase.duration_weeks}
                        onChange={(e) => updatePhase(i, 'duration_weeks', parseInt(e.target.value) || 1)}
                        className="w-12 px-1 py-0.5 text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        min={1}
                      />
                      <span className="text-xs text-gray-400">周</span>
                      {data.phases.length > 1 && (
                        <button
                          onClick={() => removePhase(i)}
                          className="p-0.5 text-gray-300 hover:text-red-500 rounded"
                          title="删除阶段"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2.5 w-10">
                  <button
                    onClick={addPhase}
                    className="w-7 h-7 text-xs text-blue-500 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 hover:border-blue-400 transition-colors"
                    title="添加阶段"
                  >
                    +
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  {/* 类型选择 */}
                  <td className="px-3 py-2 border-r border-gray-200 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-1">
                      <select
                        value={row.type}
                        onChange={(e) => updateRowType(ri, e.target.value as 'activity' | 'deliverable')}
                        className={`text-xs px-1.5 py-0.5 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          row.type === 'activity'
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                        }`}
                      >
                        <option value="activity">活动</option>
                        <option value="deliverable">成果</option>
                      </select>
                      <button
                        onClick={() => removeRow(ri)}
                        className="p-0.5 text-gray-300 hover:text-red-500 rounded"
                        title="删除行"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                  {/* 各阶段单元格 */}
                  {data.phases.map((_, ci) => (
                    <td key={ci} className="px-1.5 py-1.5 border-r border-gray-100 last:border-r-0">
                      <input
                        type="text"
                        value={row.cells[ci] || ''}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none ${
                          row.type === 'activity'
                            ? 'border-gray-100 bg-white'
                            : 'border-green-100 bg-green-50/30'
                        }`}
                        placeholder={row.type === 'activity' ? '活动内容' : '交付成果'}
                      />
                    </td>
                  ))}
                  {/* 占位对齐 */}
                  <td />
                </tr>
              ))}
              {/* 空状态 */}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={data.phases.length + 2} className="px-3 py-8 text-center text-gray-400 text-xs">
                    暂无活动或成果，点击下方按钮添加
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 添加行按钮 */}
        <div className="flex gap-2 px-3 py-2.5 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => addRow('activity')}
            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            + 活动
          </button>
          <button
            onClick={() => addRow('deliverable')}
            className="px-3 py-1.5 text-xs text-green-600 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
          >
            + 成果
          </button>
          <span className="text-xs text-gray-400 self-center ml-2">
            {totalWeeks} 周总周期 · {data.phases.length} 个阶段 · {data.rows.filter(r => r.type === 'activity').length} 项活动 · {data.rows.filter(r => r.type === 'deliverable').length} 项成果
          </span>
        </div>
      </div>

      {/* 预期成果 */}
      <DynamicListInput
        items={data.expected_outcomes}
        onItemsChange={(expected_outcomes) => update({ expected_outcomes })}
        label="预期成果"
        placeholder="输入预期成果后按回车"
        addButtonLabel="添加成果"
        rows={1}
      />

      {/* 确认按钮 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => data && exportMDSToMD(data)}
          className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          导出 MD
        </button>
        <button
          onClick={() => onConfirm(data)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          确认 → 详细大纲
        </button>
      </div>
    </div>
  );
}
