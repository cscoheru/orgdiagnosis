'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface TextNodeData {
  label: string;
  placeholder?: string;
  style?: {
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
  };
}

function TextNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TextNodeData;
  const { label, placeholder, style = {} } = nodeData;
  const {
    textColor = '#374151',
    fontSize = 14,
    fontWeight = '500',
  } = style;

  return (
    <div
      className={`relative transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-2 rounded' : ''}`}
      style={{
        color: textColor,
        fontSize,
        fontWeight,
        padding: '4px 8px',
        minWidth: 40,
        textAlign: 'center',
        cursor: 'move',
      }}
    >
      {/* Connection handles (smaller for text) */}
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-gray-400 !opacity-0 hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-gray-400 !opacity-0 hover:!opacity-100" />

      {/* Content */}
      <span>
        {label || <span className="opacity-50">{placeholder || '文本'}</span>}
      </span>
    </div>
  );
}

export default memo(TextNode);
