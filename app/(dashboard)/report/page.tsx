'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RequirementForm from '@/components/requirement-form';
import { ClientRequirement, startReport, pollUntilComplete } from '@/lib/report-api';

export default function ReportPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Fix hydration: only render overlay after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (requirement: ClientRequirement) => {
    setIsGenerating(true);
    setStatus('正在启动报告生成...');
    setProgress(10);

    try {
      // Start report generation
      const { task_id } = await startReport(requirement);
      setStatus('正在生成大纲...');
      setProgress(30);

      // Poll until outline is ready
      const result = await pollUntilComplete(
        task_id,
        (taskStatus) => {
          setProgress(Math.min(30 + taskStatus.progress_percentage * 0.3, 60));
          if (taskStatus.status === 'generating_outline') {
            setStatus('正在生成大纲...');
          } else if (taskStatus.status === 'outline_ready') {
            setStatus('大纲生成完成，跳转到编辑页面...');
            setProgress(70);
          }
        },
        2000,
        300000 // 5 minutes timeout
      );

      if (result.status === 'outline_ready') {
        setProgress(100);
        // Navigate to workspace for outline review
        router.push(`/report/workspace?task_id=${task_id}`);
      } else if (result.status === 'failed') {
        throw new Error(result.error_message || '生成失败');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      setStatus(`错误: ${error instanceof Error ? error.message : '未知错误'}`);
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">项目建议书生成</h1>
        <p className="mt-2 text-gray-600">
          填写客户需求信息，AI 将自动生成专业的项目建议书
        </p>
      </div>

      {/* Loading overlay - only render on client to avoid hydration mismatch */}
      {mounted && isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                ></div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{status}</h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{Math.round(progress)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <RequirementForm onSubmit={handleSubmit} isLoading={isGenerating} />

      {/* Tips */}
      <div className="mt-8 p-6 bg-amber-50 rounded-xl border border-amber-200">
        <h3 className="font-medium text-amber-900 mb-3">填写提示</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>行业背景和公司介绍越详细，生成的大纲越精准</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>核心痛点建议每个20-100字，清晰描述具体问题</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>项目目标建议使用 SMART 原则：具体、可衡量、可实现、相关性、时限性</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">•</span>
            <span>生成大纲后可以编辑修改，然后再生成详细内容</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
