'use client';

import { ReactNode } from 'react';

export interface StepDef {
  id: string;
  name: string;
}

interface WorkflowStepNavigatorProps {
  steps: StepDef[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  onStepClick: (index: number) => void;
  children: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  hideNav?: boolean;
}

export default function WorkflowStepNavigator({
  steps,
  currentStepIndex,
  completedSteps,
  onStepClick,
  children,
  onPrev,
  onNext,
  nextDisabled = false,
  nextLabel = '下一步',
  prevLabel = '上一步',
  hideNav = false,
}: WorkflowStepNavigatorProps) {
  return (
    <div className="space-y-4">
      {/* Step bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = i === currentStepIndex;
            const isClickable = isCompleted || isCurrent || i === currentStepIndex + 1;

            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => isClickable && onStepClick(i)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : isCompleted
                        ? 'text-green-600 hover:bg-green-50'
                        : isClickable
                          ? 'text-gray-600 hover:bg-gray-50'
                          : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'border-2 border-blue-500 text-blue-700'
                          : 'border border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{step.name}</span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={`w-6 lg:w-8 h-px mx-0.5 ${
                      isCompleted ? 'bg-green-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {children}

      {/* Navigation buttons */}
      {!hideNav && (onPrev || onNext) && (
        <div className="flex justify-between">
          <div>
            {onPrev && (
              <button
                onClick={onPrev}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {prevLabel}
              </button>
            )}
          </div>
          <div>
            {onNext && (
              <button
                onClick={onNext}
                disabled={nextDisabled}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
