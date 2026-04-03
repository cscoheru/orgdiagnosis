'use client';

/**
 * AIGenerateButton — "AI 一键生成" 入口按钮
 *
 * 在 W1/W2/W3 工作流完成后显示，点击后打开 AgentPanel 侧滑面板。
 * 支持两种模式：proposal（建议书）和 consulting_report（咨询报告）。
 */

interface AIGenerateButtonProps {
  mode: 'proposal' | 'consulting_report';
  projectId: string;
  benchmarkId: string;
  projectGoal: string;
  disabled?: boolean;
  onClick: () => void;
}

export default function AIGenerateButton({
  mode,
  disabled,
  onClick,
}: AIGenerateButtonProps) {
  const isProposal = mode === 'proposal';

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isProposal
          ? 'border-amber-200 bg-amber-50'
          : 'border-blue-200 bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {isProposal ? 'AI 智能生成建议书' : 'AI 智能生成咨询报告'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {isProposal
              ? '基于已收集的需求信息，AI 将自动生成专业项目建议书'
              : '基于需求分析和诊断数据，AI 将自动生成完整咨询报告'}
          </p>
        </div>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
              : isProposal
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isProposal ? 'AI 生成建议书' : 'AI 生成咨询报告'}
        </button>
      </div>
    </div>
  );
}
