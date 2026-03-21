'use client';

import { Node } from '@xyflow/react';

interface PropertiesPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, updates: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export default function PropertiesPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 p-4">
        <div className="text-center text-gray-400 py-8">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-sm">选择一个元素<br />查看和编辑属性</p>
        </div>
      </div>
    );
  }

  const data = selectedNode.data as any;
  const style = data?.style || {};
  const nodeType = selectedNode.type;

  const handleStyleChange = (key: string, value: any) => {
    onUpdateNode(selectedNode.id, {
      style: {
        ...style,
        [key]: value,
      },
    });
  };

  const handleDataChange = (key: string, value: any) => {
    onUpdateNode(selectedNode.id, {
      [key]: value,
    });
  };

  return (
    <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {nodeType === 'shape' && '形状属性'}
          {nodeType === 'text' && '文本属性'}
          {nodeType === 'slot' && '槽位属性'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Info */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">标签</label>
          <input
            type="text"
            value={data?.label || ''}
            onChange={(e) => handleDataChange('label', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="输入标签"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">占位符</label>
          <input
            type="text"
            value={data?.placeholder || ''}
            onChange={(e) => handleDataChange('placeholder', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="输入占位符文本"
          />
        </div>

        {/* Style - for shapes */}
        {nodeType === 'shape' && (
          <>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-medium text-gray-500 mb-3">样式</h4>

              {/* Background Color */}
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">背景色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={style.backgroundColor || '#dbeafe'}
                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.backgroundColor || '#dbeafe'}
                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              {/* Border Color */}
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">边框色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={style.borderColor || '#2563eb'}
                    onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.borderColor || '#2563eb'}
                    onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">文字色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={style.textColor || '#1e40af'}
                    onChange={(e) => handleStyleChange('textColor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.textColor || '#1e40af'}
                    onChange={(e) => handleStyleChange('textColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              {/* Size */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">宽度</label>
                  <input
                    type="number"
                    value={style.width || 120}
                    onChange={(e) => handleStyleChange('width', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">高度</label>
                  <input
                    type="number"
                    value={style.height || 80}
                    onChange={(e) => handleStyleChange('height', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Font Size */}
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">字号</label>
                <input
                  type="range"
                  min={10}
                  max={32}
                  value={style.fontSize || 14}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-right text-xs text-gray-400">{style.fontSize || 14}px</div>
              </div>

              {/* Border Radius */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">圆角</label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={style.borderRadius || 8}
                  onChange={(e) => handleStyleChange('borderRadius', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-right text-xs text-gray-400">{style.borderRadius || 8}px</div>
              </div>
            </div>
          </>
        )}

        {/* Slot Type - for slots */}
        {nodeType === 'slot' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">槽位类型</label>
            <select
              value={data?.slotType || 'content'}
              onChange={(e) => handleDataChange('slotType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="title">标题</option>
              <option value="content">内容</option>
              <option value="image">图片</option>
            </select>
          </div>
        )}

        {/* Delete Button */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
          >
            删除此元素
          </button>
        </div>
      </div>
    </div>
  );
}
