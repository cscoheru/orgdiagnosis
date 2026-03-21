'use client';

import { useState } from 'react';

interface StyleOverrides {
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  isItalic?: boolean;
  isUnderline?: boolean;
}

interface StyleToolboxProps {
  currentStyle?: StyleOverrides;
  onStyleChange: (style: StyleOverrides) => void;
  className?: string;
}

const FONT_SIZES = [
  { id: 'small', label: '小', size: '12px' },
  { id: 'medium', label: '中', size: '14px' },
  { id: 'large', label: '大', size: '16px' },
  { id: 'xlarge', label: '特大', size: '18px' },
];

const FONT_WEIGHTS = [
  { id: 'normal', label: '常规' },
  { id: 'medium', label: '中等' },
  { id: 'semibold', label: '半粗' },
  { id: 'bold', label: '粗体' },
];

const ALIGNMENTS = [
  { id: 'left', icon: '≡', label: '左对齐' },
  { id: 'center', icon: '☰', label: '居中' },
  { id: 'right', icon: '≡', label: '右对齐' },
];

const COLORS = [
  { id: 'default', color: '#1f2937', label: '默认' },
  { id: 'blue', color: '#2563eb', label: '蓝色' },
  { id: 'green', color: '#16a34a', label: '绿色' },
  { id: 'red', color: '#dc2626', label: '红色' },
  { id: 'purple', color: '#9333ea', label: '紫色' },
  { id: 'orange', color: '#ea580c', label: '橙色' },
  { id: 'gray', color: '#6b7280', label: '灰色' },
];

export default function StyleToolbox({
  currentStyle = {},
  onStyleChange,
  className = '',
}: StyleToolboxProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateStyle = (updates: Partial<StyleOverrides>) => {
    onStyleChange({ ...currentStyle, ...updates });
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">样式工具箱</h3>
            <p className="text-xs text-gray-500 mt-0.5">调整字体、颜色和格式</p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-5">
          {/* Font Size */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">字号大小</label>
            <div className="flex items-center gap-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => updateStyle({ fontSize: size.id as StyleOverrides['fontSize'] })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    currentStyle.fontSize === size.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                  style={{ fontSize: size.size }}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Weight */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">字体粗细</label>
            <div className="flex items-center gap-1">
              {FONT_WEIGHTS.map((weight) => (
                <button
                  key={weight.id}
                  onClick={() => updateStyle({ fontWeight: weight.id as StyleOverrides['fontWeight'] })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    currentStyle.fontWeight === weight.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                  style={{ fontWeight: weight.id }}
                >
                  {weight.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">对齐方式</label>
            <div className="flex items-center gap-1">
              {ALIGNMENTS.map((align) => (
                <button
                  key={align.id}
                  onClick={() => updateStyle({ textAlign: align.id as StyleOverrides['textAlign'] })}
                  className={`flex-1 py-2 rounded-lg border transition-colors ${
                    currentStyle.textAlign === align.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                  title={align.label}
                >
                  <span className="text-lg">{align.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Style Toggles */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">文字样式</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateStyle({ fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center text-lg transition-colors ${
                  currentStyle.fontWeight === 'bold'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
                title="粗体"
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => updateStyle({ isItalic: !currentStyle.isItalic })}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center text-lg transition-colors ${
                  currentStyle.isItalic
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
                title="斜体"
              >
                <em>I</em>
              </button>
              <button
                onClick={() => updateStyle({ isUnderline: !currentStyle.isUnderline })}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center text-lg transition-colors ${
                  currentStyle.isUnderline
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
                title="下划线"
              >
                <u>U</u>
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">文字颜色</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => updateStyle({ color: color.color })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    currentStyle.color === color.color
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.label}
                />
              ))}
              {/* Custom color input */}
              <div className="relative">
                <input
                  type="color"
                  value={currentStyle.color || '#1f2937'}
                  onChange={(e) => updateStyle({ color: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer opacity-0 absolute inset-0"
                />
                <div
                  className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
                  style={{ backgroundColor: currentStyle.color || '#1f2937' }}
                >
                  +
                </div>
              </div>
            </div>
          </div>

          {/* Quick Styles */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">快速样式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateStyle({ fontSize: 'large', fontWeight: 'bold', color: '#1f2937' })}
                className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 hover:bg-gray-100 border border-gray-200"
              >
                标题样式
              </button>
              <button
                onClick={() => updateStyle({ fontSize: 'medium', fontWeight: 'normal', color: '#4b5563' })}
                className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 hover:bg-gray-100 border border-gray-200"
              >
                正文样式
              </button>
              <button
                onClick={() => updateStyle({ fontSize: 'medium', fontWeight: 'semibold', color: '#2563eb' })}
                className="px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-600 hover:bg-blue-100 border border-blue-200"
              >
                强调样式
              </button>
              <button
                onClick={() => updateStyle({ fontSize: 'small', fontWeight: 'normal', color: '#6b7280' })}
                className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 hover:bg-gray-100 border border-gray-200"
              >
                注释样式
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => onStyleChange({})}
            className="w-full py-2 text-xs text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            重置为默认样式
          </button>
        </div>
      )}
    </div>
  );
}
