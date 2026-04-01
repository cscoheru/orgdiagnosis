'use client';

import type { ThemeInfo } from '@/lib/workflow/w1-types';

interface SlideThumbnailCardProps {
  title: string;
  layoutId: string;
  theme: ThemeInfo | null;
  selected?: boolean;
  onClick?: () => void;
  onRecommend?: () => void;
  recommending?: boolean;
  slideIndex?: number;
  sectionName?: string;
}

/** Map layout category from layoutId prefix */
function getLayoutCategory(layoutId: string): string {
  const prefix = layoutId.split('_')[0];
  const map: Record<string, string> = {
    centered: 'KEY_INSIGHT',
    parallel: 'PARALLEL',
    matrix: 'MATRIX',
    process: 'PROCESS',
    timeline: 'TIMELINE',
    table: 'TABLE',
    dataviz: 'DATA_VIZ',
    data: 'DATA_VIZ',
    hierarchy: 'HIERARCHY',
    section: 'SECTION',
    title: 'TITLE',
    comparison: 'PARALLEL',
    swot: 'MATRIX',
    quote: 'KEY_INSIGHT',
    list: 'HIERARCHY',
  };
  return map[prefix] || 'KEY_INSIGHT';
}

/** Extract block count from layoutId suffix */
function getBlockCount(layoutId: string): number {
  const parts = layoutId.split('_');
  const last = parts[parts.length - 1];
  const num = parseInt(last, 10);
  return isNaN(num) ? 3 : Math.min(num, 6);
}

/** Get theme colors with fallbacks */
function getColors(theme: ThemeInfo | null) {
  const colors = theme?.preview_colors || ['#3b82f6', '#1e40af', '#60a5fa'];
  return {
    primary: colors[0] || '#3b82f6',
    secondary: colors[1] || colors[0] || '#1e40af',
    accent: colors[2] || colors[0] || '#60a5fa',
    bg: '#ffffff',
    text: '#1f2937',
    muted: '#9ca3af',
    cardBg: '#f9fafb',
  };
}

/** Render layout structure blocks inside slide body */
function LayoutBlocks({ category, count, colors }: { category: string; count: number; colors: ReturnType<typeof getColors> }) {
  const baseBlock = 'rounded-sm';
  const gap = 'gap-1';

  switch (category) {
    case 'KEY_INSIGHT':
      return (
        <div className="flex items-center justify-center h-full p-2">
          <div className={`${baseBlock} w-3/4 h-1/2`} style={{ backgroundColor: colors.primary + '30', borderLeft: `3px solid ${colors.primary}` }} />
        </div>
      );

    case 'PARALLEL': {
      const cols = Math.max(2, Math.min(count, 4));
      return (
        <div className={`flex ${gap} h-full p-2`}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className={`flex-1 ${baseBlock}`} style={{
              backgroundColor: i === 0 ? colors.primary + '25' : colors.accent + '15',
              borderTop: `2px solid ${i === 0 ? colors.primary : colors.accent}`,
            }} />
          ))}
        </div>
      );
    }

    case 'MATRIX':
      return (
        <div className={`grid grid-cols-2 ${gap} h-full p-2`}>
          {[colors.primary, colors.accent, colors.secondary, colors.muted].map((c, i) => (
            <div key={i} className={`${baseBlock}`} style={{
              backgroundColor: c + '20',
              borderTop: `2px solid ${c}`,
            }} />
          ))}
        </div>
      );

    case 'PROCESS':
      return (
        <div className="flex items-center justify-between h-full p-2 px-3">
          {Array.from({ length: Math.max(2, Math.min(count, 5)) }).map((_, i, arr) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`${baseBlock} flex-1 h-2/3`} style={{
                backgroundColor: colors.primary + '25',
                borderLeft: `2px solid ${colors.primary}`,
              }} />
              {i < arr.length - 1 && (
                <span className="text-[6px] mx-0.5" style={{ color: colors.muted }}>&#9654;</span>
              )}
            </div>
          ))}
        </div>
      );

    case 'TIMELINE':
      return (
        <div className="flex flex-col justify-center h-full p-2">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-2 right-2 h-px" style={{ backgroundColor: colors.muted }} />
            {Array.from({ length: Math.max(3, Math.min(count, 6)) }).map((_, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full" style={{
                  backgroundColor: i === 0 ? colors.primary : colors.accent,
                }} />
                <div className="w-4 h-1 mt-0.5 rounded-sm" style={{ backgroundColor: colors.cardBg }} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'TABLE':
      return (
        <div className={`grid grid-rows-[1fr_1fr_1fr_1fr] ${gap} h-full p-2`}>
          {[...Array(4)].map((_, row) => (
            <div key={row} className={`grid grid-cols-${count + 1} gap-px`}>
              {Array.from({ length: Math.min(count + 1, 5) }).map((_, col) => (
                <div key={col} className="h-full rounded-[1px]" style={{
                  backgroundColor: col === 0 ? colors.primary + '20' : colors.cardBg,
                }} />
              ))}
            </div>
          ))}
        </div>
      );

    case 'DATA_VIZ':
      return (
        <div className="flex items-end justify-around h-full p-2 pb-3">
          {[0.8, 0.5, 0.9, 0.6, 0.7].slice(0, count).map((h, i) => (
            <div key={i} className="w-2/12 rounded-t-sm" style={{
              height: `${h * 100}%`,
              backgroundColor: i === Math.floor(count / 2) ? colors.primary : colors.accent + '60',
            }} />
          ))}
        </div>
      );

    case 'HIERARCHY':
      return (
        <div className={`flex flex-col ${gap} h-full p-2 justify-center`}>
          {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
            <div key={i} className={`${baseBlock} flex items-center`} style={{
              height: `${100 / Math.min(count, 5)}%`,
              paddingLeft: `${(i + 1) * 12}px`,
              backgroundColor: i === 0 ? colors.primary + '25' : colors.cardBg,
              borderLeft: `2px solid ${i === 0 ? colors.primary : 'transparent'}`,
            }} />
          ))}
        </div>
      );

    case 'SECTION':
      return (
        <div className="flex items-center justify-center h-full p-2">
          <div className="w-3/5 h-2/3 flex flex-col items-center justify-center gap-1">
            <div className="w-1/3 h-1 rounded-full" style={{ backgroundColor: colors.primary }} />
            <div className="w-2/3 h-1 rounded" style={{ backgroundColor: colors.muted }} />
            <div className="w-3/4 h-1 rounded" style={{ backgroundColor: colors.muted }} />
          </div>
        </div>
      );

    case 'TITLE':
      return (
        <div className="flex flex-col items-center justify-center h-full p-2 gap-1">
          <div className="w-3/4 h-1/3 rounded-sm" style={{ backgroundColor: colors.primary + '20' }} />
          <div className="w-1/2 h-1 rounded" style={{ backgroundColor: colors.muted }} />
          <div className="w-1/3 h-1 rounded" style={{ backgroundColor: colors.accent + '40' }} />
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full p-2">
          <div className={`${baseBlock} w-full h-2/3`} style={{ backgroundColor: colors.primary + '15' }} />
        </div>
      );
  }
}

export default function SlideThumbnailCard({
  title,
  layoutId,
  theme,
  selected = false,
  onClick,
  onRecommend,
  recommending = false,
  slideIndex,
  sectionName,
}: SlideThumbnailCardProps) {
  const category = getLayoutCategory(layoutId);
  const blockCount = getBlockCount(layoutId);
  const colors = getColors(theme);

  const isTitle = category === 'TITLE';
  const isSection = category === 'SECTION';

  return (
    <div
      onClick={onClick}
      className={`group relative flex-shrink-0 cursor-pointer transition-all ${
        selected
          ? 'ring-2 ring-blue-500 ring-offset-2'
          : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1'
      }`}
    >
      {/* Slide card */}
      <div
        className="w-[200px] rounded-lg overflow-hidden shadow-sm border border-gray-200"
        style={{ aspectRatio: '16/9' }}
      >
        {/* Header bar */}
        {!isTitle && (
          <div
            className="h-[18%] flex items-center px-2"
            style={{ backgroundColor: colors.primary }}
          >
            {!isSection && (
              <span className="text-[5px] text-white/90 truncate font-medium leading-none">
                {sectionName || '章节标题'}
              </span>
            )}
          </div>
        )}

        {/* Title slide: full color background */}
        {isTitle && (
          <div
            className="h-full flex flex-col items-center justify-center gap-0.5 p-2"
            style={{ backgroundColor: colors.primary }}
          >
            <div className="w-3/4 h-1.5 bg-white/80 rounded-sm" />
            <div className="w-1/2 h-1 bg-white/50 rounded-sm" />
            <div className="w-1/3 h-1 bg-white/30 rounded-sm" />
          </div>
        )}

        {/* Body with layout blocks */}
        {!isTitle && (
          <div
            className="relative"
            style={{ height: isSection ? '100%' : '82%' }}
          >
            <LayoutBlocks category={category} count={blockCount} colors={colors} />
          </div>
        )}
      </div>

      {/* Info below card */}
      <div className="mt-1.5 px-0.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-700 truncate flex-1 font-medium" title={title}>
            {slideIndex && <span className="text-gray-400 mr-0.5">{slideIndex}.</span>}
            {title}
          </p>
          {onRecommend && (
            <button
              onClick={(e) => { e.stopPropagation(); onRecommend(); }}
              disabled={recommending}
              className="text-[9px] text-blue-500 hover:text-blue-700 disabled:opacity-40 ml-1 flex-shrink-0"
            >
              {recommending ? '...' : 'AI'}
            </button>
          )}
        </div>
        <p className="text-[8px] text-gray-400 truncate">{category}</p>
      </div>
    </div>
  );
}
