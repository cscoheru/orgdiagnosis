'use client';

import { useState } from 'react';
import type { PhaseData, PhaseReportData } from '@/lib/api/workflow-client';

interface PhaseReportStepProps {
  phases: PhaseData[];
  selectedPhaseId: string | null;
  reportData: PhaseReportData | null;
  onGenerate: (phaseId: string) => void;
  generating: boolean;
  filePath?: string | null;
  onBack: () => void;
}

export default function PhaseReportStep({
  phases,
  selectedPhaseId,
  reportData,
  onGenerate,
  generating,
  filePath,
  onBack,
}: PhaseReportStepProps) {
  const [editedReport, setEditedReport] = useState<PhaseReportData | null>(null);
  const current = editedReport || reportData;
  const selectedPhase = selectedPhaseId ? phases.find(p => p.phase_id === selectedPhaseId) : null;

  // Phase selector (if no phase selected yet)
  if (!selectedPhaseId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">阶段总结报告</h3>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
            返回阶段推进
          </button>
        </div>
        <p className="text-sm text-gray-500">选择要生成总结报告的阶段</p>
        <div className="space-y-2">
          {phases.map(phase => (
            <button
              key={phase.phase_id}
              onClick={() => onGenerate(phase.phase_id)}
              disabled={generating || phase.status === 'planned'}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  phase.status === 'completed' ? 'bg-green-100 text-green-700' :
                  phase.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {phase.phase_order}
                </span>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-800">{phase.phase_name}</div>
                  {phase.time_range && <div className="text-xs text-gray-400">{phase.time_range}</div>}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                phase.status === 'completed' ? 'bg-green-100 text-green-600' :
                phase.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {phase.status === 'completed' ? '可生成' : phase.status === 'in_progress' ? '进行中' : '未开始'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Generating state
  if (generating && !current) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
        <span className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto block" />
        <p className="text-gray-500">AI 正在生成 {selectedPhase?.phase_name} 阶段总结报告...</p>
      </div>
    );
  }

  // Report editing/viewing
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
            ← 返回
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            {selectedPhase?.phase_name} — 阶段总结报告
          </h3>
        </div>
        {filePath && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${filePath}`}
            download
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            下载 PPTX
          </a>
        )}
      </div>

      {current && (
        <>
          {/* Storyline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">核心观点 (Storyline)</label>
            <textarea
              value={current.storyline || ''}
              onChange={(e) => setEditedReport(prev => prev ? { ...prev, storyline: e.target.value } : { ...current, storyline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={2}
              placeholder="一句话概括本阶段的核心成果"
            />
          </div>

          {/* Arguments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">重要论点（每行一项）</label>
            <textarea
              value={(current.arguments || []).join('\n')}
              onChange={(e) => setEditedReport(prev => prev ? { ...prev, arguments: e.target.value.split('\n').filter(Boolean) } : { ...current, arguments: e.target.value.split('\n').filter(Boolean) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={4}
              placeholder="论点1&#10;论点2"
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">论据/数据支撑（每行一项）</label>
            <textarea
              value={(current.evidence || []).join('\n')}
              onChange={(e) => setEditedReport(prev => prev ? { ...prev, evidence: e.target.value.split('\n').filter(Boolean) } : { ...current, evidence: e.target.value.split('\n').filter(Boolean) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={4}
              placeholder="论据1&#10;论据2"
            />
          </div>

          {/* Supporting materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">支撑素材（每行一项）</label>
            <textarea
              value={(current.supporting_materials || []).join('\n')}
              onChange={(e) => setEditedReport(prev => prev ? { ...prev, supporting_materials: e.target.value.split('\n').filter(Boolean) } : { ...current, supporting_materials: e.target.value.split('\n').filter(Boolean) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={3}
              placeholder="行业报告&#10;案例参考"
            />
          </div>

          {/* Deliverables from phase */}
          {selectedPhase?.deliverables && selectedPhase.deliverables.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">阶段成果</h4>
              <div className="flex flex-wrap gap-1">
                {selectedPhase.deliverables.map((d, i) => (
                  <span key={i} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => onGenerate(selectedPhaseId!)}
              disabled={generating}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              重新生成
            </button>
            <button
              onClick={() => {
                // Export would be handled by parent via a callback
                // For now, the export trigger is via executeWorkflowStep
              }}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              生成 PPT
            </button>
          </div>

          {/* Download success */}
          {filePath && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-sm text-green-700">PPT 文件已生成</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
