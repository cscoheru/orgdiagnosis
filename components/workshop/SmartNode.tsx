"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "reactflow";
import { Sparkles } from "lucide-react";

export interface SmartNodeData {
  label: string;
  isGhost?: boolean;
  reason?: string;
  onAccept?: () => void;
  /** API sync callback — fire-and-forget, does NOT reload nodes */
  onSyncUpdate?: (patch: { name?: string }) => void;
  onDelete?: () => void;
  onSuggest?: () => void;
  editing?: boolean;
  onEditEnd?: () => void;
  onEnterSave?: () => void;
  onTabSave?: () => void;
}

export default function SmartNode({ id, data, selected }: NodeProps & { data: SmartNodeData }) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local edit value when external label changes (e.g. new node created)
  useEffect(() => {
    setEditValue(data.label);
  }, [data.label]);

  // Enter editing mode when parent sets data.editing = true
  useEffect(() => {
    if (data.editing) {
      setEditing(true);
    }
  }, [data.editing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    data.onEditEnd?.();
  }, [data.onEditEnd]);

  /**
   * Optimistic save: update ReactFlow store IMMEDIATELY so the label
   * never reverts, then fire-and-forget the API sync.
   */
  const save = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === data.label) return;

    // 1. Update ReactFlow store optimistically (instant UI update)
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, label: trimmed } }
          : n
      )
    );

    // 2. Sync to API in background (fire-and-forget, no reload)
    data.onSyncUpdate?.({ name: trimmed });
  }, [id, data.label, data.onSyncUpdate, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      save(editValue);
      data.onEnterSave?.();
      stopEditing();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      save(editValue);
      data.onTabSave?.();
      stopEditing();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditValue(data.label);
      stopEditing();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      return; // let input handle text deletion
    }
    e.stopPropagation();
  }, [editValue, data.label, data.onEnterSave, data.onTabSave, save, stopEditing]);

  const handleBlur = useCallback(() => {
    save(editValue);
    stopEditing();
  }, [editValue, save, stopEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  // ─── Ghost node ───
  if (data.isGhost) {
    return (
      <div
        className="px-4 py-2 rounded-lg border-2 border-dashed opacity-70 cursor-pointer hover:opacity-100 transition-all bg-white/50"
        onClick={data.onAccept}
      >
        <Handle type="target" position={Position.Left} className="!bg-gray-300 !w-2 !h-2" />
        <div className="flex items-center gap-2">
          <span className="text-sm">{data.label}</span>
        </div>
        {data.reason && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{data.reason}</p>
        )}
        <p className="text-xs text-blue-500 mt-0.5">点击采纳</p>
        <Handle type="source" position={Position.Right} className="!bg-gray-300 !w-2 !h-2" />
      </div>
    );
  }

  // ─── Normal node ───
  return (
    <div
      className={`relative px-4 py-2 rounded-lg border-2 bg-white min-w-[100px] max-w-[220px] select-none transition-shadow ${
        selected
          ? "border-blue-500 shadow-md shadow-blue-100"
          : hovered
            ? "border-gray-300 shadow-sm"
            : "border-gray-200"
      }`}
      style={{ cursor: editing ? "text" : "default" }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !border-2 ${
          selected ? "!bg-blue-500 !border-blue-500" : "!bg-gray-300 !border-gray-300"
        }`}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="text-sm font-medium bg-transparent outline-none w-full"
          style={{ minWidth: 60 }}
        />
      ) : (
        <span className="text-sm font-medium truncate">{data.label}</span>
      )}

      {/* AI suggest button */}
      {hovered && !editing && data.onSuggest && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onSuggest?.(); }}
          className="absolute -top-2 -right-2 p-1 bg-amber-50 border border-amber-200 rounded-full shadow-sm text-amber-500 hover:bg-amber-100 z-10"
          title="AI 推荐子节点"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2.5 !h-2.5 !border-2 ${
          selected ? "!bg-blue-500 !border-blue-500" : "!bg-gray-300 !border-gray-300"
        }`}
      />
    </div>
  );
}
