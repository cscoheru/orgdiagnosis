'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DiagnosisSession } from '@/types/diagnosis';

// 模拟数据
const mockSessions: DiagnosisSession[] = [
  {
    id: '1',
    client_id: 'client-1',
    created_by: 'user-1',
    raw_input: '客户访谈记录...',
    data: {} as any,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '2',
    client_id: 'client-2',
    created_by: 'user-1',
    raw_input: '战略会议记录...',
    data: {} as any,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DiagnosisSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: 从 API 获取数据
    // fetch('/api/diagnosis')
    //   .then(res => res.json())
    //   .then(result => {
    //     if (result.success) {
    //       setSessions(result.data);
    //     }
    //     setIsLoading(false);
    //   });

    // 使用模拟数据
    setTimeout(() => {
      setSessions(mockSessions);
      setIsLoading(false);
    }, 500);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">历史记录</h1>
          <p className="text-gray-500 mt-1">
            查看所有诊断会话记录
          </p>
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            暂无诊断记录
          </h3>
          <p className="text-gray-500 mb-6">
            开始您的第一次企业组织诊断
          </p>
          <Link
            href="/input"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            🚀 新建诊断
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/result/${session.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                      📊
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        诊断 #{session.id.slice(0, 8)}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {session.raw_input.slice(0, 50)}...
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {session.data?.overall_score || '--'} 分
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(session.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <span className="text-gray-400">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
