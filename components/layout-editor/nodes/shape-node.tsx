'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface ShapeNodeData {
  label: string;
  placeholder?: string;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    width?: number;
    height?: number;
    borderRadius?: number;
  };
}

function ShapeNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ShapeNodeData;
  const { label, placeholder, style = {} } = nodeData;
  const {
    backgroundColor = '#dbeafe',
    borderColor = '#2563eb',
    textColor = '#1e40af',
    fontSize = 14,
    fontWeight = '500',
    width = 120,
    height = 80,
    borderRadius = 8,
  } = style;

  return (
    <div
      className={`relative transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      style={{
        width,
        height,
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'move',
      }}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />

      {/* Content */}
      <div
        style={{
          color: textColor,
          fontSize,
          fontWeight,
          textAlign: 'center',
          padding: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label || <span className="opacity-50">{placeholder || '双击编辑'}</span>}
      </div>
    </div>
  );
}

export default memo(ShapeNode);
