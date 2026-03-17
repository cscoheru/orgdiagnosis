'use client';

import type { FiveDimensionsData, WarningItem, DimensionKey } from '@/types/diagnosis';
import { DIMENSION_LABELS, getScoreLevel } from '@/types/diagnosis';

interface WarningCardsProps {
  data: FiveDimensionsData;
  threshold?: number;
}

export function WarningCards({ data, threshold = 60 }: WarningCardsProps) {
  // 收集所有低于阈值的 L3 项目
  const warningItems: WarningItem[] = [];

  const dimensionKeys: DimensionKey[] = ['strategy', 'structure', 'performance', 'compensation', 'talent'];

  dimensionKeys.forEach((dimKey) => {
    const dimension = data[dimKey];
    if (!dimension?.L2_categories) return;

    Object.entries(dimension.L2_categories).forEach(([l2Key, l2Category]) => {
      if (!l2Category.L3_items) return;

      Object.entries(l2Category.L3_items).forEach(([l3Key, l3Item]) => {
        if (l3Item.score < threshold) {
          warningItems.push({
            name: `${dimKey}.${l2Key}.${l3Key}`,
            label: `${DIMENSION_LABELS[dimKey]} → ${l2Category.label || l2Key} → ${l3Key}`,
            score: l3Item.score,
            status: getScoreLevel(l3Item.score),
            evidence: l3Item.evidence || '无证据',
          });
        }
      });
    });
  });

  // 按分数排序（最低的在前）
  warningItems.sort((a, b) => a.score - b.score);

  if (warningItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ✅ 无预警项目
        </h3>
        <p className="text-gray-600">
          所有维度评分均在 {threshold} 分以上，组织整体运行良好。
        </p>
      </div>
    );
  }

  const statusConfig = {
    danger: {
      icon: '🔴',
      label: '高风险',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
    },
    warning: {
      icon: '🟡',
      label: '中风险',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
    },
    success: {
      icon: '🟢',
      label: '良好',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          ⚠️ 风险预警 ({warningItems.length} 项)
        </h3>
        <span className="text-sm text-gray-500">
          评分低于 {threshold} 分的维度
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {warningItems.map((item, index) => {
          const config = statusConfig[item.status];
          return (
            <div
              key={index}
              className={`p-4 rounded-xl border ${config.borderColor} ${config.bgColor}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{config.icon}</span>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {item.evidence}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.textColor}`}>
                    {config.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${config.textColor}`}>
                    {item.score}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">分</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
