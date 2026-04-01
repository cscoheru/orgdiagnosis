"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Sparkles, Pencil, Trash2 } from "lucide-react";

const NODE_TYPE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  scene: { bg: "#eff6ff", border: "#3b82f6", badge: "场景" },
  painpoint: { bg: "#fef2f2", border: "#ef4444", badge: "痛点" },
  idea: { bg: "#f0fdf4", border: "#22c55e", badge: "想法" },
  task: { bg: "#fefce8", border: "#eab308", badge: "任务" },
};

export interface SmartNodeData {
  label: string;
  nodeType: string;
  description?: string;
  isGhost?: boolean;
  reason?: string;
  onAccept?: () => void;
  onUpdate?: (patch: { name?: string; description?: string }) => void;
  onDelete?: () => void;
  onSuggest?: () => void;
}

export default function SmartNode({ data, id }: NodeProps & { data: SmartNodeData }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    setEditValue(data.label);
  }, [data.label]);

  const colors = NODE_TYPE_COLORS[data.nodeType] || NODE_TYPE_COLORS.scene;

  if (data.isGhost) {
    return (
      <div
        className="relative px-4 py-2 rounded-lg border-2 border-dashed opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
        style={{ borderColor: colors.border, background: colors.bg }}
        onClick={data.onAccept}
      >
        <Handle type="target" position={Position.Left} />
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: colors.border }}>
            {colors.badge}
          </span>
          <span className="text-sm font-medium">{data.label}</span>
        </div>
        {data.reason && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.reason}</p>
        )}
        <p className="text-xs text-blue-500 mt-1">点击采纳</p>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div
      className="relative px-4 py-2 rounded-lg border-2 shadow-sm min-w-[120px] max-w-[200px]"
      style={{ borderColor: colors.border, background: colors.bg }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: colors.border }}>
          {colors.badge}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                data.onUpdate?.({ name: editValue });
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="text-sm font-medium bg-transparent border-b border-blue-400 outline-none w-full"
          />
        ) : (
          <span className="text-sm font-medium truncate">{data.label}</span>
        )}
      </div>

      {showActions && !editing && (
        <div className="absolute -top-8 right-0 flex items-center gap-1 bg-white border rounded-lg shadow-md px-1 py-0.5">
          {data.onSuggest && (
            <button onClick={data.onSuggest} className="p-1 text-amber-500 hover:text-amber-600" title="AI 建议">
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-blue-600" title="编辑">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {data.onDelete && (
            <button onClick={data.onDelete} className="p-1 text-gray-500 hover:text-red-600" title="删除">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
