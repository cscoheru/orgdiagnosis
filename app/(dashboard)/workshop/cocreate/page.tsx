"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listSessions, createSession, type WorkshopSession } from "@/lib/api/workshop-api";
import { Plus, ArrowRight, Sparkles } from "lucide-react";

export default function CoCreatePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const res = await listSessions();
    if (res.success && res.data) setSessions(res.data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newIndustry.trim()) return;
    setCreating(true);
    const res = await createSession(newTitle.trim(), newIndustry.trim());
    if (res.success && res.data) {
      router.push(`/workshop/cocreate/${res.data._key}`);
    }
    setCreating(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            智能共创套件
          </h1>
          <p className="text-gray-500 mt-1">AI 辅助的结构化咨询共创工作坊</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建工作坊
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">创建工作坊</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工作坊标题</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="如：国窖终端动销共创会"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行业背景</label>
                <textarea
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="如：高端白酒销售，核心渠道为经销商和终端烟酒店..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newIndustry.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建并进入"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">还没有工作坊</p>
          <p className="text-gray-400 text-sm mt-1">点击上方按钮创建第一个智能共创工作坊</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <button
              key={s._id}
              onClick={() => router.push(`/workshop/cocreate/${s._key}`)}
              className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{s.properties.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{s.properties.industry_context}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
