"use client";

import { useState, useRef, useEffect, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { Plus, Trash2 } from "lucide-react";
import type { EvaluationItem } from "@/lib/api/workshop-api";

// Recharts types for the inner chart component
interface ChartProps {
  items: EvaluationItem[];
}

// Dynamic import the chart component to avoid SSR issues
const ChartComponent = dynamic(() => import("./EvaluationChart"), { ssr: false }) as ComponentType<ChartProps>;

interface EvaluationMatrixProps {
  items: EvaluationItem[];
  onAddItem: (name: string) => Promise<any>;
  onUpdateItem: (id: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
}

const DEFAULT_DIMENSIONS = [
  { key: "dim_x", label: "痛点极值" },
  { key: "dim_y", label: "业务价值" },
  { key: "dim_z", label: "能力鸿沟" },
];

export default function EvaluationMatrix({ items, onAddItem, onUpdateItem, onDeleteItem }: EvaluationMatrixProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSliderChange = (id: string, key: string, value: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdateItem(id, { [key]: value });
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const highlightedItems = items.filter((item) => item.properties.dim_x > 3 && item.properties.dim_y > 3);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAddItem(newName.trim());
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div className="h-full flex">
      {/* Left Panel */}
      <div className="w-[380px] border-r bg-white overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">评价项</h2>
          <button onClick={() => setShowAdd(true)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-3 border rounded-lg flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="评价项名称..."
              className="flex-1 px-2 py-1 border rounded text-sm outline-none"
              autoFocus
            />
            <button onClick={handleAdd} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">确定</button>
            <button onClick={() => setShowAdd(false)} className="px-2 py-1 text-gray-500 text-sm">取消</button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">暂无评价项，请添加</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item._id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{item.properties.name}</span>
                  <button onClick={() => onDeleteItem(item._id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {DEFAULT_DIMENSIONS.map((dim) => (
                  <div key={dim.key} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 w-16 shrink-0">{dim.label}</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={item.properties[dim.key as keyof typeof item.properties] as number}
                      onChange={(e) => handleSliderChange(item._id, dim.key, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 accent-blue-600"
                    />
                    <span className="text-xs text-gray-600 w-6 text-right">
                      {item.properties[dim.key as keyof typeof item.properties] as number}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {highlightedItems.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 mb-1">高优先场景 ({highlightedItems.length})</h3>
            <ul className="text-xs text-red-700 space-y-0.5">
              {highlightedItems.map((item) => (
                <li key={item._id}>{item.properties.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right Panel - Scatter Chart */}
      <div className="flex-1 p-4 bg-gray-50">
        <div className="h-full">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              添加评价项后，散点图将在此显示
            </div>
          ) : (
            <ChartComponent items={items} />
          )}
        </div>
      </div>
    </div>
  );
}
