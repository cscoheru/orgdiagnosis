"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus, Check } from "lucide-react";
import type { AiTagSuggestion } from "@/lib/api/workshop-api";

interface TaggingSidebarProps {
  sessionId: string;
  tagData: Record<string, { category: any; tags: any[] }>;
  nodes: any[];
  selectedNodeId: string | null;
  onSuggestTags: (data: { target_text: string; node_id: string; existing_tags: { name: string; category: string }[] }) => Promise<{ success: boolean; data?: any; error?: string }>;
  onCreateTag: (name: string, categoryId?: string) => Promise<any>;
  onTagNode: (nodeId: string, tagId: string) => Promise<any>;
  onRefreshTags: () => void;
}

const CATEGORY_STYLES: Record<string, string> = {
  "场景维": "bg-blue-100 text-blue-700 border-blue-300",
  "痛点维": "bg-red-100 text-red-700 border-red-300",
  "技能维": "bg-green-100 text-green-700 border-green-300",
  "格式维": "bg-purple-100 text-purple-700 border-purple-300",
};

const AI_TAG_KEYS = ["context_tags", "pain_tags", "skill_tags", "format_tags"] as const;
const AI_TAG_LABELS: Record<string, string> = {
  context_tags: "场景维",
  pain_tags: "痛点维",
  skill_tags: "技能维",
  format_tags: "格式维",
};

export default function TaggingSidebar({
  sessionId,
  tagData,
  nodes,
  selectedNodeId,
  onSuggestTags,
  onCreateTag,
  onTagNode,
  onRefreshTags,
}: TaggingSidebarProps) {
  const [aiTags, setAiTags] = useState<Record<string, AiTagSuggestion[]> | null>(null);
  const [selectedPills, setSelectedPills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n._id === selectedNodeId);

  const handleSuggest = async () => {
    if (!selectedNode) return;
    setLoading(true);
    const props = selectedNode.properties;
    const existingTags: { name: string; category: string }[] = [];
    for (const [catName, group] of Object.entries(tagData)) {
      for (const tag of group.tags) {
        existingTags.push({ name: tag.properties.name, category: catName });
      }
    }
    const res = await onSuggestTags({
      target_text: `${props.name}${props.description ? "：" + props.description : ""}`,
      node_id: selectedNode._id,
      existing_tags: existingTags,
    });
    if (res.success && res.data) {
      setAiTags(res.data);
      setSelectedPills(new Set());
    }
    setLoading(false);
  };

  const togglePill = (tagName: string) => {
    setSelectedPills((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  const handleAdopt = async (tagName: string, categoryKey: string) => {
    setAdopting(tagName);
    const catName = AI_TAG_LABELS[categoryKey];
    const group = tagData[catName];
    const categoryId = group?.category?._id;
    await onCreateTag(tagName, categoryId);
    setAdopting(null);
  };

  const handleSaveTags = async () => {
    if (!selectedNode) return;
    for (const tagName of selectedPills) {
      for (const group of Object.values(tagData)) {
        const tag = group.tags.find((t: any) => t.properties.name === tagName);
        if (tag) {
          await onTagNode(selectedNode._id, tag._id);
        }
      }
    }
    setSelectedPills(new Set());
    setAiTags(null);
    onRefreshTags();
  };

  return (
    <div className="h-full flex">
      {/* Node selector */}
      <div className="w-[200px] border-r bg-white overflow-y-auto p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">选择节点</h3>
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-400">请先在画布中创建节点</p>
        ) : (
          <div className="space-y-1">
            {nodes.map((node) => (
              <button
                key={node._id}
                onClick={() => { setSelectedPills(new Set()); setAiTags(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${
                  selectedNodeId === node._id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                {node.properties.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag panel */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {!selectedNode ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            请在左侧选择一个节点
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{selectedNode.properties.name}</h2>
                <p className="text-xs text-gray-500">标签配置</p>
              </div>
              <button
                onClick={handleSuggest}
                disabled={loading}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI 智能分析标签
              </button>
            </div>

            {/* AI suggested tags */}
            {aiTags && (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">AI 推荐标签</h3>
                {AI_TAG_KEYS.map((key) => {
                  const tags = aiTags[key] || [];
                  if (tags.length === 0) return null;
                  return (
                    <div key={key} className="p-3 bg-white border rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-2">{AI_TAG_LABELS[key]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => {
                          const isSelected = selectedPills.has(tag.name);
                          return (
                            <span
                              key={tag.name}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-all ${
                                tag.is_new
                                  ? isSelected
                                    ? "bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-300"
                                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                  : isSelected
                                    ? (CATEGORY_STYLES[AI_TAG_LABELS[key]] || "bg-blue-100 text-blue-700 border-blue-300") + " ring-1 ring-blue-300"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                              }`}
                              onClick={() => togglePill(tag.name)}
                            >
                              {tag.is_new && <span className="font-bold">NEW</span>}
                              {tag.name}
                              {tag.is_new && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAdopt(tag.name, key); }}
                                  className="ml-0.5 text-amber-600 hover:text-amber-800"
                                  disabled={adopting === tag.name}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {selectedPills.size > 0 && (
                  <button
                    onClick={handleSaveTags}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    保存标签配置 ({selectedPills.size})
                  </button>
                )}
              </div>
            )}

            {/* Existing tags by category */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">已有标签库</h3>
              {Object.entries(tagData).length === 0 ? (
                <p className="text-xs text-gray-400">暂无标签，使用 AI 分析或手动创建</p>
              ) : (
                Object.entries(tagData).map(([catName, group]) => (
                  <div key={catName} className="p-3 bg-white border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.category?.properties?.color }} />
                      <span className="text-xs font-medium text-gray-700">{catName}</span>
                      <span className="text-xs text-gray-400">({group.tags.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag: any) => (
                        <span key={tag._id} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                          {tag.properties.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
