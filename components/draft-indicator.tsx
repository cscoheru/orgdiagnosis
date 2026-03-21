'use client';

import { useState, useEffect } from 'react';

interface DraftIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date | null;
  ageText?: string | null;
  onRestore?: () => void;
  onClear?: () => void;
  showRestoreOption?: boolean;
}

export default function DraftIndicator({
  status,
  lastSaved,
  ageText,
  onRestore,
  onClear,
  showRestoreOption = false,
}: DraftIndicatorProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Status icons and colors
  const statusConfig = {
    idle: { icon: '💾', color: 'text-gray-400', text: '草稿未保存' },
    saving: { icon: '⏳', color: 'text-blue-500', text: '保存中...' },
    saved: { icon: '✓', color: 'text-green-500', text: '已保存' },
    error: { icon: '⚠️', color: 'text-red-500', text: '保存失败' },
  };

  const config = statusConfig[status];

  return (
    <div className="relative">
      {/* Status indicator */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-colors ${
          status === 'saved' ? 'bg-green-50 hover:bg-green-100' :
          status === 'saving' ? 'bg-blue-50 hover:bg-blue-100' :
          status === 'error' ? 'bg-red-50 hover:bg-red-100' :
          'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <span className={config.color}>
          {status === 'saving' ? (
            <span className="animate-pulse">{config.icon}</span>
          ) : (
            config.icon
          )}
        </span>
        <span className="text-gray-600">
          {status === 'saved' && ageText ? `${config.text} (${ageText})` : config.text}
        </span>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            {/* Last saved info */}
            {lastSaved && (
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                上次保存: {lastSaved.toLocaleTimeString()}
              </div>
            )}

            {/* Restore option */}
            {showRestoreOption && onRestore && (
              <button
                onClick={() => {
                  onRestore();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
              >
                <span>↻</span>
                恢复草稿
              </button>
            )}

            {/* Clear draft */}
            {onClear && (
              <button
                onClick={() => {
                  if (confirm('确定要清除草稿吗？')) {
                    onClear();
                    setShowMenu(false);
                  }
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <span>🗑️</span>
                清除草稿
              </button>
            )}

            {/* Manual save */}
            <button
              onClick={() => {
                // Trigger manual save by dispatching custom event
                window.dispatchEvent(new CustomEvent('draft-manual-save'));
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>💾</span>
              立即保存
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook for draft indicator state
 */
export function useDraftIndicator() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const markSaving = () => setStatus('saving');
  const markSaved = () => {
    setStatus('saved');
    setLastSaved(new Date());
  };
  const markError = () => setStatus('error');
  const markIdle = () => setStatus('idle');

  return {
    status,
    lastSaved,
    markSaving,
    markSaved,
    markError,
    markIdle,
    setLastSaved,
  };
}
