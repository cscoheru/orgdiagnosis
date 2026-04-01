"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  getSession,
  exportSession,
  createEvaluation,
  deleteEvaluation,
  listEvaluations,
  updateEvaluation,
  listTags,
  createTag,
  tagNode,
  suggestNodes,
  suggestTags,
  createNode,
  updateNode,
  deleteNode,
  type SessionDetail,
  type EvaluationItem,
} from "@/lib/api/workshop-api";
import { ArrowLeft, Download, Layers, BarChart3, Tags } from "lucide-react";

// Dynamic imports for SSR compatibility
const CoCreateCanvas = dynamic(() => import("@/components/workshop/CoCreateCanvas"), { ssr: false });
const EvaluationMatrix = dynamic(() => import("@/components/workshop/EvaluationMatrix"), { ssr: false });
const TaggingSidebar = dynamic(() => import("@/components/workshop/TaggingSidebar"), { ssr: false });

type Tab = "canvas" | "matrix" | "tags";

export default function WorkshopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("canvas");
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [tagData, setTagData] = useState<Record<string, { category: any; tags: any[] }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    const res = await getSession(sessionId);
    if (res.success && res.data) {
      setSession(res.data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (activeTab === "matrix") {
      listEvaluations(sessionId).then((r) => {
        if (r.success && r.data) setEvaluations(r.data);
      });
    }
    if (activeTab === "tags") {
      listTags(sessionId).then((r) => {
        if (r.success && r.data) setTagData(r.data);
      });
    }
  }, [activeTab, sessionId]);

  // Canvas handlers
  const handleAddNode = async (name: string, nodeType: string, description?: string, parentId?: string) => {
    const res = await createNode(sessionId, name, nodeType, description, parentId);
    if (res.success) loadSession();
  };

  const handleUpdateNode = async (nodeId: string, patch: { name?: string; node_type?: string; description?: string }) => {
    await updateNode(sessionId, nodeId, patch);
    loadSession();
  };

  const handleDeleteNode = async (nodeId: string) => {
    await deleteNode(sessionId, nodeId);
    loadSession();
  };

  const handleSuggestNodes = async (data: Parameters<typeof suggestNodes>[1]) => {
    return suggestNodes(sessionId, data);
  };

  // Evaluation handlers
  const handleAddEvaluation = async (name: string) => {
    const res = await createEvaluation(sessionId, { name });
    if (res.success && res.data) {
      setEvaluations((prev) => [...prev, res.data!]);
    }
  };

  const handleUpdateEvaluation = async (evalId: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) => {
    const res = await updateEvaluation(sessionId, evalId, patch);
    if (res.success && res.data) {
      setEvaluations((prev) => prev.map((e) => (e._id === evalId ? res.data! : e)));
    }
  };

  const handleDeleteEvaluation = async (evalId: string) => {
    await deleteEvaluation(sessionId, evalId);
    setEvaluations((prev) => prev.filter((e) => e._id !== evalId));
  };

  // Tag handlers
  const handleSuggestTags = async (data: Parameters<typeof suggestTags>[1]) => {
    return suggestTags(sessionId, data);
  };

  const handleCreateTag = async (name: string, categoryId?: string) => {
    const res = await createTag(sessionId, name, categoryId);
    if (res.success && res.data) {
      const tr = await listTags(sessionId);
      if (tr.success && tr.data) setTagData(tr.data);
      return res.data;
    }
    return null;
  };

  const handleTagNode = async (nodeId: string, tagId: string) => {
    await tagNode(nodeId, tagId);
  };

  // Export handler
  const handleExport = async () => {
    const res = await exportSession(sessionId);
    if (!res.success || !res.data) return;
    const { workshop_title, items } = res.data;
    const headers = ["路径", "节点名称", "节点类型", "维度X", "维度Y", "维度Z", "维度W", "标签"];
    const rows = items.map((item) => [
      item.path,
      item.node_name,
      item.node_type,
      item.dim_x ?? "",
      item.dim_y ?? "",
      item.dim_z ?? "",
      item.dim_w ?? "",
      item.tags.join("; "),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workshop_title}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">加载工作坊...</div>;
  if (!session) return <div className="text-center py-20 text-red-500">工作坊不存在</div>;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "canvas", label: "画布", icon: <Layers className="w-4 h-4" /> },
    { key: "matrix", label: "矩阵", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "tags", label: "标签", icon: <Tags className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/workshop/cocreate")} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{session.session.properties.title}</h1>
            <p className="text-xs text-gray-500 line-clamp-1">{session.session.properties.industry_context}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b bg-gray-50 px-6 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "canvas" && (
          <CoCreateCanvas
            session={session}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onSuggestNodes={handleSuggestNodes}
            onSelectNode={setSelectedNodeId}
          />
        )}
        {activeTab === "matrix" && (
          <EvaluationMatrix
            items={evaluations}
            onAddItem={handleAddEvaluation}
            onUpdateItem={handleUpdateEvaluation}
            onDeleteItem={handleDeleteEvaluation}
          />
        )}
        {activeTab === "tags" && (
          <TaggingSidebar
            sessionId={sessionId}
            tagData={tagData}
            nodes={session.nodes}
            selectedNodeId={selectedNodeId}
            onSuggestTags={handleSuggestTags}
            onCreateTag={handleCreateTag}
            onTagNode={handleTagNode}
            onRefreshTags={() => listTags(sessionId).then((r) => { if (r.success && r.data) setTagData(r.data); })}
          />
        )}
      </div>
    </div>
  );
}
