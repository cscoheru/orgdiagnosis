'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  TableProperties,
  TrendingUp,
  Target,
  BarChart,
  Users,
  DollarSign,
  Settings,
} from 'lucide-react';
import type { ActionPlanRow, Step3Data, MatrixData } from '@/types/strategy';
import { generateBSCCards, mapBSCToActionPlan } from '@/lib/zhipu-api';

// 3力3平台列定义
const FORCE_COLUMNS = [
  { key: 'salesForce' as const, label: '销售力', icon: TrendingUp, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  { key: 'productForce' as const, label: '产品力', icon: Target, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
  { key: 'deliveryForce' as const, label: '交付力', icon: BarChart, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
] as const;

const PLATFORM_COLUMNS = [
  { key: 'hr' as const, label: '人力', icon: Users, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  { key: 'financeAssets' as const, label: '财务&资产', icon: DollarSign, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' },
  { key: 'digitalProcess' as const, label: '数字化&流程', icon: Settings, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
] as const;

// 从 Step 3 matrixData 生成 ActionPlanRows (前4列)
function buildRowsFromMatrix(step3: Step3Data | undefined): ActionPlanRow[] {
  if (!step3?.matrixData) return [];

  const md = step3.matrixData;
  const rows: ActionPlanRow[] = [];
  let seq = 1;

  const addCell = (client: string, product: string) => {
    const key = `${client}_${product}`;
    const value = md.values[key] || 0;
    if (value > 0 || true) { // 即使值为0也显示行，让用户填写
      rows.push({
        id: `row_${seq}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        seqNumber: seq++,
        customerGroup: client,
        product: product,
        revenueTarget: value,
        salesForce: '',
        productForce: '',
        deliveryForce: '',
        hr: '',
        financeAssets: '',
        digitalProcess: '',
        isCustom: false,
      });
    }
  };

  // 老客户 × 老产品
  for (const c of md.oldClients) {
    for (const p of md.oldProducts) addCell(c, p);
  }
  // 老客户 × 新产品
  for (const c of md.oldClients) {
    for (const p of md.newProducts) addCell(c, p);
  }
  // 新客户 × 老产品
  for (const c of md.newClients) {
    for (const p of md.oldProducts) addCell(c, p);
  }
  // 新客户 × 新产品
  for (const c of md.newClients) {
    for (const p of md.newProducts) addCell(c, p);
  }

  return rows;
}

export default function ActionPlanTable() {
  const { data, setData, modelConfig } = useStore();
  const [rows, setRows] = useState<ActionPlanRow[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bscGenerated, setBscGenerated] = useState(false);

  // 初始化：从 step3 矩阵 + step4 已保存数据恢复
  useEffect(() => {
    const step3 = data.step3 as Step3Data | undefined;
    const step4 = data.step4;

    // 优先使用已保存的 actionPlanTable
    if (step4?.actionPlanTable && step4.actionPlanTable.length > 0) {
      setRows(step4.actionPlanTable);
    } else {
      // 从 Step 3 矩阵自动生成
      const matrixRows = buildRowsFromMatrix(step3);
      setRows(matrixRows);
    }

    // 检查是否已有 BSC 卡片
    if (step4?.bscCards && step4.bscCards.length > 0) {
      setBscGenerated(true);
    }
  }, []); // 只在组件挂载时执行一次

  // 更新单个单元格
  const updateCell = (rowId: string, field: keyof ActionPlanRow, value: string | number) => {
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, [field]: value } : r
    ));
  };

  // 删除行
  const deleteRow = (rowId: string) => {
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== rowId);
      // 重新编号
      return filtered.map((r, i) => ({ ...r, seqNumber: i + 1 }));
    });
  };

  // 添加自定义行
  const addCustomRow = () => {
    const newId = `row_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setRows(prev => [
      ...prev,
      {
        id: newId,
        seqNumber: prev.length + 1,
        customerGroup: '',
        product: '',
        revenueTarget: 0,
        salesForce: '',
        productForce: '',
        deliveryForce: '',
        hr: '',
        financeAssets: '',
        digitalProcess: '',
        isCustom: true,
      },
    ]);
  };

  // AI 智能映射：BSC → 3力3平台
  const handleAIMap = async () => {
    if (rows.length === 0) {
      alert('请先填写行动计划表的基本数据');
      return;
    }

    setIsMapping(true);
    try {
      const step2 = data.step2;
      const swot = step2?.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
      const tows = step2?.towsStrategies;
      const direction = step2?.strategicDirection;

      // 1. 先生成 BSC 卡片（如果还没有）
      let bscCards = data.step4?.bscCards as any;
      if (!bscCards || bscCards.length === 0) {
        const generated = await generateBSCCards(
          modelConfig.apiKey,
          swot,
          tows,
          direction
        );
        bscCards = generated;
        setBscGenerated(true);
      }

      // 2. 转换 bscCards 为 mapBSCToActionPlan 需要的格式
      // bscCards 可能是 BSCCard[] (旧格式) 或 { financial, customer, ... } (新格式)
      let bscInput;
      if (Array.isArray(bscCards)) {
        // 旧格式 BSCCard[] → 转换
        bscInput = {
          financial: { description: bscCards.find(c => c.id === 'financial')?.description || '', items: bscCards.find(c => c.id === 'financial')?.items || [] },
          customer: { description: bscCards.find(c => c.id === 'customer')?.description || '', items: bscCards.find(c => c.id === 'customer')?.items || [] },
          internalProcess: { description: bscCards.find(c => c.id === 'internalProcess')?.description || '', items: bscCards.find(c => c.id === 'internalProcess')?.items || [] },
          learningGrowth: { description: bscCards.find(c => c.id === 'learningGrowth')?.description || '', items: bscCards.find(c => c.id === 'learningGrowth')?.items || [] },
        };
      } else {
        bscInput = bscCards;
      }

      // 3. 调用 AI 映射
      const mapped = await mapBSCToActionPlan(
        modelConfig.apiKey,
        bscInput,
        rows.map(r => ({
          seqNumber: r.seqNumber,
          customerGroup: r.customerGroup,
          product: r.product,
          revenueTarget: r.revenueTarget,
        }))
      );

      // 4. 更新行数据 (JSON.parse 返回 string keys，用 as any 安全访问)
      const getVal = (obj: Record<number, string>, idx: number) =>
        (obj as any)[String(idx)] as string | undefined;
      setRows(prev => prev.map((row, idx) => ({
        ...row,
        salesForce: getVal(mapped.salesForce, idx) || row.salesForce,
        productForce: getVal(mapped.productForce, idx) || row.productForce,
        deliveryForce: getVal(mapped.deliveryForce, idx) || row.deliveryForce,
        hr: getVal(mapped.hr, idx) || row.hr,
        financeAssets: getVal(mapped.financeAssets, idx) || row.financeAssets,
        digitalProcess: getVal(mapped.digitalProcess, idx) || row.digitalProcess,
      })));
    } catch (error: any) {
      alert(`AI 映射失败: ${error.message || '请检查 API 配置'}`);
    } finally {
      setIsMapping(false);
    }
  };

  // 保存
  const handleSave = async () => {
    await setData('step4', {
      ...(data.step4 || { bscConfirmed: false, actionPlanTable: [], strategyMap: null }),
      actionPlanTable: rows,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 计算营收总计
  const totalRevenue = useMemo(
    () => rows.reduce((sum, r) => sum + (r.revenueTarget || 0), 0),
    [rows]
  );

  // 计算已填充的 3力3平台 列数
  const filledCells = useMemo(
    () => rows.reduce((count, r) => {
      const fields = ['salesForce', 'productForce', 'deliveryForce', 'hr', 'financeAssets', 'digitalProcess'] as const;
      return count + fields.filter(f => r[f].trim()).length;
    }, 0),
    [rows]
  );
  const totalCells = rows.length * 6;

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <TableProperties className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            3力3平台行动计划表
          </h3>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {rows.length} 行 · 营收总计 {totalRevenue.toLocaleString()} 万
          </span>
          {totalCells > 0 && (
            <span className="text-xs text-gray-400 dark:text-slate-500">
              填充率 {Math.round((filledCells / totalCells) * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAIMap}
            disabled={isMapping || rows.length === 0}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-all"
          >
            {isMapping ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI 映射中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AI 智能填充
              </>
            )}
          </button>
          <button
            onClick={addCustomRow}
            className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-slate-700 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            添加行
          </button>
          <button
            onClick={handleSave}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-slate-500">
            <TableProperties className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无行动计划数据</p>
            <p className="text-xs mt-1">请先在 Step 3 中填写客户-产品矩阵</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {/* 序号 */}
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-800 px-2 py-2 text-center font-semibold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 w-10">
                    #
                  </th>
                  {/* 客户群 */}
                  <th className="sticky left-10 z-10 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 min-w-[100px]">
                    客户群
                  </th>
                  {/* 产品 */}
                  <th className="sticky left-[176px] z-10 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 min-w-[100px]">
                    产品
                  </th>
                  {/* 营收目标 */}
                  <th className="bg-gray-50 dark:bg-slate-800 px-3 py-2 text-right font-semibold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 min-w-[80px]">
                    营收目标(万)
                  </th>

                  {/* 3力 */}
                  {FORCE_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-center font-semibold border border-gray-200 dark:border-slate-700 min-w-[160px] ${col.color}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <col.icon className="w-3.5 h-3.5" />
                        {col.label}
                      </div>
                    </th>
                  ))}

                  {/* 3平台 */}
                  {PLATFORM_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-center font-semibold border border-gray-200 dark:border-slate-700 min-w-[160px] ${col.color}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <col.icon className="w-3.5 h-3.5" />
                        {col.label}
                      </div>
                    </th>
                  ))}

                  {/* 操作 */}
                  <th className="bg-gray-50 dark:bg-slate-800 px-2 py-2 text-center font-semibold text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 w-10">
                    &nbsp;
                  </th>
                </tr>
              </thead>

              {/* 3力 分隔行 */}
              <tbody>
                <tr>
                  <td colSpan={4} className="bg-blue-50 dark:bg-blue-900/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-slate-700">
                    基础数据 (来自 Step 3)
                  </td>
                  {FORCE_COLUMNS.map(col => (
                    <td
                      key={col.key}
                      colSpan={1}
                      className="bg-blue-50 dark:bg-blue-900/10 px-3 py-1 text-center text-xs font-bold text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-slate-700"
                    >
                      3力 (业务层)
                    </td>
                  ))}
                  {PLATFORM_COLUMNS.map(col => (
                    <td
                      key={col.key}
                      colSpan={1}
                      className="bg-purple-50 dark:bg-purple-900/10 px-3 py-1 text-center text-xs font-bold text-purple-700 dark:text-purple-300 border border-gray-200 dark:border-slate-700"
                    >
                      3平台 (支撑层)
                    </td>
                  ))}
                  <td className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700" />
                </tr>

                {/* 数据行 */}
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* 序号 */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-2 py-2 text-center text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 font-mono">
                      {row.seqNumber}
                    </td>
                    {/* 客户群 */}
                    <td className={`sticky left-10 z-10 bg-white dark:bg-slate-900 px-3 py-2 border border-gray-200 dark:border-slate-700 ${
                      row.isCustom ? '' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {row.isCustom ? (
                        <input
                          type="text"
                          value={row.customerGroup}
                          onChange={e => updateCell(row.id, 'customerGroup', e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                          placeholder="输入客户群"
                        />
                      ) : (
                        <span className="text-xs">{row.customerGroup}</span>
                      )}
                    </td>
                    {/* 产品 */}
                    <td className={`sticky left-[176px] z-10 bg-white dark:bg-slate-900 px-3 py-2 border border-gray-200 dark:border-slate-700`}>
                      {row.isCustom ? (
                        <input
                          type="text"
                          value={row.product}
                          onChange={e => updateCell(row.id, 'product', e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                          placeholder="输入产品"
                        />
                      ) : (
                        <span className="text-xs">{row.product}</span>
                      )}
                    </td>
                    {/* 营收目标 */}
                    <td className="px-3 py-2 text-right border border-gray-200 dark:border-slate-700">
                      {row.isCustom ? (
                        <input
                          type="number"
                          value={row.revenueTarget || ''}
                          onChange={e => updateCell(row.id, 'revenueTarget', Number(e.target.value) || 0)}
                          className="w-full bg-transparent border-none outline-none text-xs text-right text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                          {row.revenueTarget.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* 3力 可编辑列 */}
                    {FORCE_COLUMNS.map(col => (
                      <td key={col.key} className="px-1 py-1 border border-gray-200 dark:border-slate-700">
                        <textarea
                          value={row[col.key]}
                          onChange={e => updateCell(row.id, col.key, e.target.value)}
                          rows={2}
                          className="w-full bg-transparent border-none outline-none resize-none text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 leading-relaxed"
                          placeholder="点击填写..."
                        />
                      </td>
                    ))}

                    {/* 3平台 可编辑列 */}
                    {PLATFORM_COLUMNS.map(col => (
                      <td key={col.key} className="px-1 py-1 border border-gray-200 dark:border-slate-700">
                        <textarea
                          value={row[col.key]}
                          onChange={e => updateCell(row.id, col.key, e.target.value)}
                          rows={2}
                          className="w-full bg-transparent border-none outline-none resize-none text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 leading-relaxed"
                          placeholder="点击填写..."
                        />
                      </td>
                    ))}

                    {/* 删除按钮 */}
                    <td className="px-1 py-1 border border-gray-200 dark:border-slate-700 text-center">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                        title="删除此行"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* 合计行 */}
                <tr className="font-semibold">
                  <td colSpan={3} className="bg-gray-50 dark:bg-slate-800 px-3 py-2 text-right text-xs text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                    合计
                  </td>
                  <td className="bg-gray-50 dark:bg-slate-800 px-3 py-2 text-right text-xs font-bold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-slate-700 font-mono">
                    {totalRevenue.toLocaleString()}
                  </td>
                  <td colSpan={6} className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700" />
                  <td className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
