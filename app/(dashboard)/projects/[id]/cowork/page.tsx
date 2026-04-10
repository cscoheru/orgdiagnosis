'use client';

/**
 * 项目内智能共创 — 与客户协作共创场景、痛点、想法
 *
 * 复用 CoCreateCanvas 组件，session 关联到当前项目。
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import CoCreateCanvas from '@/components/workshop/CoCreateCanvas';
import type { SessionDetail } from '@/lib/api/workshop-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CoWorkPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [sessions, setSessions] = useState<Array<{ id: string; title: string; industry_context?: string }>>([]);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newIndustry, setNewIndustry] = useState('');

  // Fetch project's workshop sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workshop/sessions?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || data.sessions || []);
        setSessions(items.map((s: any) => ({
          id: s._key || s.id,
          title: s.title || '未命名共创',
          industry_context: s.properties?.industry_context || s.industry_context || '',
        })));
      }
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Load session detail
  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workshop/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // Auto-select first session
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      loadSession(sessions[0].id);
    }
  }, [sessions, activeSession, loadSession]);

  // Create new session
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/workshop/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          industry_context: newIndustry,
          project_id: projectId,
        }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewIndustry('');
        setShowCreate(false);
        fetchSessions();
      }
    } catch { /* silent */ }
  }, [newTitle, newIndustry, projectId, fetchSessions]);

  // Canvas callbacks
  const handleAddNode = async (name: string, nodeType: string, description?: string, parentId?: string) => {
    if (!activeSession) return null;
    const res = await fetch(`${API_BASE}/api/v1/workshop/sessions/${activeSession.session._key}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, node_type: nodeType, description, parent_node_id: parentId }),
    });
    if (!res.ok) throw new Error('Failed to add node');
    return res.json();
  };

  const handleUpdateNode = async (nodeId: string, patch: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/v1/workshop/sessions/${activeSession?.session._key}/nodes/${nodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update node');
    return res.json();
  };

  const handleDeleteNode = async (nodeId: string) => {
    const res = await fetch(`${API_BASE}/api/v1/workshop/sessions/${activeSession?.session._key}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete node');
  };

  const handleSuggestNodes = async (data: { current_node_id: string; current_node_name: string; current_node_type: string; industry_context: string; existing_children: string[] }) => {
    const res = await fetch(`${API_BASE}/api/v1/workshop/sessions/${activeSession?.session._key}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return { success: false, error: 'Failed to suggest' };
    return res.json();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">智能共创</h2>
          <p className="text-sm text-gray-500">与客户协作共创，AI 辅助生成洞察</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreate ? '取消' : '+ 新建共创'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="flex gap-2 items-end bg-gray-50 p-3 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">共创主题</label>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="例如：XX公司组织变革共创"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">行业背景</label>
            <input
              value={newIndustry}
              onChange={e => setNewIndustry(e.target.value)}
              placeholder="例如：制造业"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            创建
          </button>
        </div>
      )}

      {/* Session tabs */}
      {sessions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                activeSession?.session._key === s.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Canvas */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeSession ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 26rem)' }}>
          <CoCreateCanvas
            session={activeSession}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onReloadSession={() => loadSession(activeSession.session._key)}
            onSuggestNodes={handleSuggestNodes}
            onSelectNode={() => {}}
          />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <p className="text-sm">暂无共创会话</p>
          <p className="text-xs mt-1">点击「新建共创」开始</p>
        </div>
      ) : null}
    </div>
  );
}
