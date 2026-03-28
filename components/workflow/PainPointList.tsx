'use client';

import { createEmptyPainPoint, type PainPointItem } from '@/lib/workflow/w1-types';
import SeveritySelector from './SeveritySelector';

interface PainPointListProps {
  items: PainPointItem[];
  onItemsChange: (items: PainPointItem[]) => void;
  errors?: Record<string, string>;
}

export default function PainPointList({ items, onItemsChange, errors }: PainPointListProps) {
  const handleAdd = () => {
    onItemsChange([...items, createEmptyPainPoint()]);
  };

  const handleRemove = (id: string) => {
    onItemsChange(items.filter(p => p.id !== id));
  };

  const handleDescriptionChange = (id: string, description: string) => {
    onItemsChange(items.map(p => p.id === id ? { ...p, description } : p));
  };

  const handleSeverityChange = (id: string, severity: string) => {
    onItemsChange(items.map(p => p.id === id ? { ...p, severity: severity as PainPointItem['severity'] } : p));
  };

  return (
    <div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                placeholder="描述痛点..."
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              />
              <SeveritySelector
                value={item.severity}
                onChange={(severity) => handleSeverityChange(item.id, severity)}
              />
            </div>
            <button
              onClick={() => handleRemove(item.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 mt-0.5"
              title="删除此痛点"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="mt-2 text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
      >
        <span className="text-lg leading-none">+</span>
        添加痛点
      </button>
      {errors?.core_pain_points && (
        <p className="text-xs text-red-500 mt-1">{errors.core_pain_points}</p>
      )}
    </div>
  );
}
