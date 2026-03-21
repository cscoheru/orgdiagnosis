'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface SlotNodeData {
  label: string;
  slotType: 'title' | 'content' | 'image';
  placeholder?: string;
  style?: {
    borderColor?: string;
    width?: number;
    height?: number;
  };
}

function SlotNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as SlotNodeData;
  const { label, slotType, placeholder, style = {} } = nodeData;
  const {
    borderColor = '#f59e0b',
    width = 140,
    height = 60,
  } = style;

  const typeIcons = {
    title: '📝',
    content: '📄',
    image: '🖼️',
  };

  return (
    <div
      className={`relative transition-all ${selected ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
      style={{
        width,
        height,
        backgroundColor: '#fffbeb',
        border: `2px dashed ${borderColor}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'move',
      }}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-400" />

      {/* Content */}
      <div className="flex items-center gap-2 text-amber-700">
        <span className="text-lg">{typeIcons[slotType] || '📄'}</span>
        <span className="text-sm font-medium">
          {label || <span className="opacity-60">{placeholder || '内容槽位'}</span>}
        </span>
      </div>

      {/* Slot indicator */}
      <div className="absolute -top-2 -right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
        <span className="text-white text-[10px]">S</span>
      </div>
    </div>
  );
}

export default memo(SlotNode);
