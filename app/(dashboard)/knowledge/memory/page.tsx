'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listMemory,
  saveMemory,
  deleteMemory,
  type KnowledgeEntry,
} from '@/lib/agent-api';

type MemoryTab = 'all' | 'client' | 'methodology' | 'project' | 'reference';

const TABS: { key: MemoryTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'client', label: '客户' },
  { key: 'methodology', label: '方法论' },
  { key: 'project', label: '项目' },
  { key: 'reference', label: '参考资源' },
];

const TYPE_COLORS: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  methodology: 'bg-purple-100 text-purple-700',
  project: 'bg-green-100 text-green-700',
  reference: 'bg-orange-100 text-orange-700',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: '手动',
  agent: 'Agent',
  dream: 'AutoDream',
};

export default function MemoryPage() {
  const [activeTab, setActiveTab] = useState<MemoryTab>('all');
  const [items, setItems] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('methodology');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMemory({
        memory_type: activeTab === 'all' ? undefined : activeTab,
        limit: 100,
      });
      setItems(result.items);
    } catch (e) {
      console.error('Failed to load memory:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    try {
      await saveMemory({
        memory_type: formType,
        title: formTitle,
        content: formContent,
        tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setFormTitle('');
      setFormContent('');
      setFormTags('');
      setShowForm(false);
      loadItems();
    } catch (e) {
      console.error('Failed to save:', e);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('确定删除此知识条目？')) return;
    try {
      await deleteMemory(key);
      loadItems();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI 顾问的知识积累 — {items.length} 条记录
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          {showForm ? '取消' : '+ 新增知识'}
        </button>
      </div>

      {/* 新增表单 */}
      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="client">客户</option>
                <option value="methodology">方法论</option>
                <option value="project">项目</option>
                <option value="reference">参考资源</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">标签（逗号分隔）</label>
              <input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="行业, 方法, ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">标题</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="简短标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">内容（Markdown）</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="知识内容..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!formTitle.trim() || !formContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          暂无知识条目。点击「+ 新增知识」或完成咨询会话后 AutoDream 自动积累。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const props = item.properties;
            return (
              <div
                key={item._key}
                className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[props.memory_type] || 'bg-gray-100 text-gray-600'}`}>
                        {props.memory_type}
                      </span>
                      {props.source_type && (
                        <span className="text-xs text-gray-400">
                          {SOURCE_LABELS[props.source_type] || props.source_type}
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900">{props.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {props.content}
                    </p>
                    {props.tags && props.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {props.tags.map((tag) => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item._key)}
                    className="text-gray-400 hover:text-red-500 ml-3 shrink-0"
                    title="删除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
