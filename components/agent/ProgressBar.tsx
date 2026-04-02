'use client';

/**
 * ProgressBar — Agent 会话进度条

 * 显示当前标杆模板的分析进度和节点状态。
 */
interface ProgressBarProps {
  progress: number;
  currentNode: string;
  benchmarkTitle: string;
}

export default function ProgressBar({ progress, currentNode, benchmarkTitle }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="truncate max-w-[200px]" title={benchmarkTitle}>
          {benchmarkTitle}
        </span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {currentNode && (
        <p className="text-xs text-gray-400">
          当前: {currentNode}
        </p>
      )}
    </div>
  );
}
