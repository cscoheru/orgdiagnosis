'use client';

import { useState } from 'react';

interface DynamicListInputProps {
  items: string[];
  onItemsChange: (items: string[]) => void;
  placeholder?: string;
  label: string;
  addButtonLabel?: string;
  required?: boolean;
  minItems?: number;
  rows?: number;
}

export default function DynamicListInput({
  items,
  onItemsChange,
  placeholder = '输入内容后按回车添加',
  label,
  addButtonLabel = '添加',
  required = false,
  minItems = 1,
  rows = 1,
}: DynamicListInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onItemsChange([...items, trimmed]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onItemsChange(updated);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <textarea
                value={item}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                rows={rows}
              />
              <button
                onClick={() => handleRemove(i)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="删除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Input for new item */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {addButtonLabel}
        </button>
      </div>
      {required && items.filter(Boolean).length < minItems && (
        <p className="text-xs text-red-400 mt-1">至少需要 {minItems} 项</p>
      )}
    </div>
  );
}
