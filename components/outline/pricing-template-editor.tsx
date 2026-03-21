'use client';

import { useState, useCallback } from 'react';

export interface PricingItem {
  id: string;
  category: string;
  item: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface PricingTemplateEditorProps {
  items: PricingItem[];
  onChange: (items: PricingItem[]) => void;
}

const DEFAULT_CATEGORIES = ['咨询费', '实施费', '培训费', '软件费', '差旅费', '其他'];

export default function PricingTemplateEditor({
  items,
  onChange,
}: PricingTemplateEditorProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const updateItem = useCallback((id: string, field: keyof PricingItem, value: string | number) => {
    onChange(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto-calculate amount when quantity or unitPrice changes
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  }, [items, onChange]);

  const addItem = useCallback(() => {
    const newItem: PricingItem = {
      id: `item_${Date.now()}`,
      category: '咨询费',
      item: '',
      description: '',
      unit: '人天',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  const deleteItem = useCallback((id: string) => {
    onChange(items.filter(item => item.id !== id));
  }, [items, onChange]);

  const duplicateItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      const newItem: PricingItem = {
        ...item,
        id: `item_${Date.now()}`,
      };
      const index = items.findIndex(i => i.id === id);
      const newItems = [...items];
      newItems.splice(index + 1, 0, newItem);
      onChange(newItems);
    }
  }, [items, onChange]);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PricingItem[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">项目报价表</h4>
        <button
          onClick={addItem}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 添加项目
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-24">类别</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">项目</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-32">说明</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">单位</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-16">数量</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 w-24">单价(¥)</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 w-28">金额(¥)</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  暂无报价项目，点击"添加项目"开始
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {/* Category */}
                  <td className="px-3 py-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {DEFAULT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>

                  {/* Item Name */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.item}
                      onChange={(e) => updateItem(item.id, 'item', e.target.value)}
                      placeholder="项目名称"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  {/* Description */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="简要说明"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-3 py-2 text-center">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="人天">人天</option>
                      <option value="人月">人月</option>
                      <option value="次">次</option>
                      <option value="套">套</option>
                      <option value="项">项</option>
                    </select>
                  </td>

                  {/* Quantity */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  {/* Unit Price */}
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => duplicateItem(item.id)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="复制"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Total Row */}
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={6} className="px-3 py-3 text-right font-medium text-gray-900">
                  合计金额：
                </td>
                <td className="px-3 py-3 text-right font-bold text-lg text-blue-600">
                  ¥{totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Summary by Category */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-700 mb-3">按类别汇总</h5>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(groupedItems).map(([category, categoryItems]) => {
              const categoryTotal = categoryItems.reduce((sum, item) => sum + item.amount, 0);
              return (
                <div key={category} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-sm text-gray-500">{category}</div>
                  <div className="text-lg font-medium text-gray-900">
                    ¥{categoryTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-400">{categoryItems.length} 项</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Add Templates */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500">快速添加：</span>
        {[
          { category: '咨询费', item: '高级顾问', unit: '人天', quantity: 10, unitPrice: 8000 },
          { category: '实施费', item: '项目经理', unit: '人月', quantity: 2, unitPrice: 50000 },
          { category: '培训费', item: '标准培训', unit: '次', quantity: 3, unitPrice: 10000 },
        ].map((template, i) => (
          <button
            key={i}
            onClick={() => {
              const newItem: PricingItem = {
                id: `item_${Date.now()}`,
                ...template,
                description: '',
                amount: template.quantity * template.unitPrice,
              };
              onChange([...items, newItem]);
            }}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            + {template.item}
          </button>
        ))}
      </div>
    </div>
  );
}
