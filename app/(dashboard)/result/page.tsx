'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DiagnosisRecord {
  id: string;
  company_name: string;
  created_at: string;
  status: string;
  overall_score?: number;
}

export default function ResultListPage() {
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch from API
    // For now, show empty state
    setLoading(false);
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">企业名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">诊断时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">综合得分</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{record.company_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(record.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      record.status === 'completed' ? 'bg-green-100 text-green-700' :
                      record.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {record.status === 'completed' ? '已完成' :
                       record.status === 'processing' ? '处理中' : '待处理'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {record.overall_score ? (
                      <span className={`font-bold ${
                        record.overall_score >= 80 ? 'text-green-600' :
                        record.overall_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {record.overall_score}分
                      </span>
                    ) : '--'}
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
