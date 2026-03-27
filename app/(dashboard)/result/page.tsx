'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DiagnosisRecord {
  id: string;
  created_at: string;
  overall_score: number;
  preview: string;
}

export default function ResultListPage() {
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch(`${API_BASE}/api/diagnosis?limit=50`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setRecords(data);
      } catch (e) {
        console.error('Failed to fetch diagnosis records:', e);
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载诊断记录...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📈 诊断结果</h1>
          <p className="text-gray-500 mt-1">查看历史诊断记录和报告</p>
        </div>
        <Link
          href="/input"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <span>📝</span>
          新建诊断
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700 text-sm">
          后端服务不可用 ({error})，显示为空列表。请确保后端已启动。
        </div>
      )}

      {/* Records List */}
      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-6xl block mb-4">📭</span>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无诊断记录</h2>
          <p className="text-gray-500 mb-4">开始您的第一次组织健康度诊断</p>
          <Link
            href="/input"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <span>📝</span>
            开始诊断
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">摘要</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">诊断时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">综合得分</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                    {record.preview || '无预览'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(record.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${
                      record.overall_score >= 80 ? 'text-green-600' :
                      record.overall_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {record.overall_score}分
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/result/${record.id}`}
                      className="text-blue-500 hover:text-blue-700 text-sm"
                    >
                      查看详情 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
