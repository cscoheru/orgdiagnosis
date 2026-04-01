'use client';

/**
 * CSS Slide Content Renderer
 *
 * Frontend mirror of backend LayoutRenderer (visual_elements.py).
 * Renders OutlineSlide data into CSS layouts that match what python-pptx would produce.
 *
 * Layout routing mirrors backend:
 *   LayoutRenderer.render() → layout category → _render_key_insight() / _render_parallel() / etc.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { OutlineSlide, ThemeInfo } from '@/lib/workflow/w1-types';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface SlideContent {
  title: string;
  key_message: string;
  bullets: string[];
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  textDark: string;
  textLight: string;
  bg: string;
  white: string;
}

interface SlideContentRendererProps {
  slideData: OutlineSlide;
  layoutId: string;
  theme: ThemeInfo | null;
  /** Controls visual scale. Uses CSS transform for thumbnail fidelity. */
  scale: 'thumbnail' | 'preview' | 'full';
  /** Override scale with a custom numeric value (e.g. 0.6, 1.2, 1.5). Takes priority over `scale` prop. */
  customScale?: number;
  /** Enable inline editing (only effective at scale='full') */
  editable?: boolean;
  /** Callback when slide content changes during editing */
  onSlideChange?: (slide: OutlineSlide) => void;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Internal slide canvas size — all layouts render at this resolution */
const SLIDE_W = 800;
const SLIDE_H = 450;

/** Scale factors: thumbnail ≈ PowerPoint left panel, preview ≈ half, full = actual */
const SCALE_VALUES = { thumbnail: 0.22, preview: 0.5, full: 1 } as const;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Map layout ID prefix → category (mirrors backend LayoutRouter) */
function getLayoutCategory(layoutId: string): string {
  const prefix = layoutId.split('_')[0].toLowerCase();
  const map: Record<string, string> = {
    key: 'KEY_INSIGHT',
    centered: 'KEY_INSIGHT',
    parallel: 'PARALLEL',
    bullet: 'BULLET',
    matrix: 'MATRIX',
    process: 'PROCESS',
    timeline: 'TIMELINE',
    table: 'TABLE',
    dataviz: 'DATA_VIZ',
    data: 'DATA_VIZ',
    hierarchy: 'HIERARCHY',
    pyramid: 'HIERARCHY',
    section: 'SECTION',
    title: 'TITLE',
    comparison: 'TABLE',
    swot: 'MATRIX',
    quote: 'KEY_INSIGHT',
    list: 'BULLET',
  };
  return map[prefix] || 'BULLET';
}

/** Extract theme colors with fallback */
function getThemeColors(theme: ThemeInfo | null): ThemeColors {
  const c = theme?.preview_colors || ['#00528B', '#336699', '#E74C3C'];
  return {
    primary: c[0] || '#00528B',
    secondary: c[1] || c[0] || '#336699',
    accent: c[2] || c[0] || '#E74C3C',
    textDark: '#333333',
    textLight: '#808080',
    bg: '#F5F5F5',
    white: '#FFFFFF',
  };
}

/** Map OutlineSlide → backend content format (see LayoutRenderer.render params) */
function mapSlideToContent(slide: OutlineSlide): SlideContent {
  return {
    title: slide.title || '',
    key_message: slide.storyline || '',
    bullets: [...(slide.arguments || []), ...(slide.evidence || [])],
  };
}

/** Parse layout params from layout ID (e.g., PARALLEL_03 → {count:3}) */
function getLayoutParams(layoutId: string): { count: number; direction: string; rows: number; cols: number } {
  const parts = layoutId.split('_');
  let count = 3, direction = 'horizontal', rows = 2, cols = 2;

  const last = parts[parts.length - 1];
  const num = parseInt(last, 10);
  if (!isNaN(num)) count = num;

  if (layoutId.includes('_V')) direction = 'vertical';
  if (layoutId.includes('_H')) direction = 'horizontal';
  if (layoutId.includes('2x3')) { rows = 2; cols = 3; }
  if (layoutId.includes('3x3')) { rows = 3; cols = 3; }

  return { count, direction, rows, cols };
}

// ──────────────────────────────────────────────
// Editable Inline Text
// ──────────────────────────────────────────────

function EditableText({
  value,
  onChange,
  style,
  className = '',
  as: Tag = 'div',
  placeholder = '点击编辑...',
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2';
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onChange(draft.trim());
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }, [commit, value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  if (!onChange) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  if (editing) {
    return (
      <Tag
        ref={ref as any}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={className}
        style={{ ...style, outline: '2px solid #3b82f6', outlineOffset: '2px', borderRadius: '2px', cursor: 'text' }}
      >
        {draft}
      </Tag>
    );
  }

  return (
    <Tag
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`${className} cursor-text hover:ring-1 hover:ring-blue-400 rounded`}
      style={style}
    >
      {value || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{placeholder}</span>}
    </Tag>
  );
}

// ──────────────────────────────────────────────
// Editable Bullet List
// ──────────────────────────────────────────────

function EditableBullets({
  items,
  onChange,
  colors,
  maxItems = 6,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  colors: ThemeColors;
  maxItems?: number;
}) {
  const update = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, '']);

  if (!onChange) {
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((b, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <span style={{ color: colors.primary, fontWeight: 700, fontSize: 14, flexShrink: 0, width: 20 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color: colors.textDark, lineHeight: 1.4 }}>{b}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((b, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
            <span style={{ color: colors.primary, fontWeight: 700, fontSize: 13, flexShrink: 0, width: 18, paddingTop: 2 }}>{i + 1}.</span>
            <EditableText
              value={b}
              onChange={(v) => update(i, v)}
              as="span"
              className="flex-1"
              style={{ fontSize: 13, color: colors.textDark, lineHeight: 1.4, display: 'inline-block', minWidth: 200 }}
              placeholder={`论点 ${i + 1}...`}
            />
            <button
              onClick={() => remove(i)}
              style={{ color: '#ccc', fontSize: 12, cursor: 'pointer', flexShrink: 0, padding: '2px 4px', lineHeight: 1 }}
              title="删除"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {items.length < maxItems && (
        <button
          onClick={add}
          style={{ color: colors.primary, fontSize: 12, cursor: 'pointer', padding: '4px 8px', border: `1px dashed ${colors.primary}30`, borderRadius: 4, background: 'none', marginTop: 4 }}
        >
          + 添加论点
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Slide Header (shared by most layouts)
// ──────────────────────────────────────────────

function SlideHeader({
  content,
  colors,
  editable,
  onTitleChange,
}: {
  content: SlideContent;
  colors: ThemeColors;
  editable?: boolean;
  onTitleChange?: (v: string) => void;
}) {
  return (
    <div style={{ padding: '16px 32px 8px' }}>
      <EditableText
        value={content.title}
        onChange={onTitleChange || (() => {})}
        as="h2"
        className="m-0"
        style={{ fontSize: 22, fontWeight: 700, color: colors.textDark, lineHeight: 1.3, margin: 0 }}
        placeholder="页面标题"
      />
      {content.key_message && (
        <EditableText
          value={content.key_message}
          onChange={() => {}}
          as="p"
          style={{ fontSize: 13, color: colors.primary, fontWeight: 600, marginTop: 6, lineHeight: 1.4, margin: '6px 0 0' }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: TITLE (Cover slide)
// ──────────────────────────────────────────────

function TitleSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  return (
    <div style={{
      width: SLIDE_W, height: SLIDE_H, background: colors.primary,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative line */}
      <div style={{ position: 'absolute', top: '52%', left: '30%', right: '30%', height: 2, background: colors.accent, opacity: 0.6 }} />
      {/* Title */}
      <div style={{ textAlign: 'center', zIndex: 1, maxWidth: 600 }}>
        <EditableText
          value={content.title}
          onChange={onTitleChange || (() => {})}
          as="h1"
          className="m-0"
          style={{ fontSize: 36, fontWeight: 800, color: colors.white, lineHeight: 1.2, margin: 0 }}
          placeholder="演示标题"
        />
        {content.key_message && (
          <EditableText
            value={content.key_message}
            onChange={() => {}}
            as="p"
            style={{ fontSize: 16, color: `${colors.white}CC`, marginTop: 16, lineHeight: 1.5 }}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: SECTION (Section divider)
// ──────────────────────────────────────────────

function SectionSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  return (
    <div style={{
      width: SLIDE_W, height: SLIDE_H, background: colors.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Accent line */}
      <div style={{ width: 60, height: 4, background: colors.accent, borderRadius: 2, marginBottom: 20 }} />
      <EditableText
        value={content.title}
        onChange={onTitleChange || (() => {})}
        as="h1"
        style={{ fontSize: 32, fontWeight: 700, color: colors.primary, textAlign: 'center', margin: 0 }}
        placeholder="章节标题"
      />
      {content.key_message && (
        <EditableText
          value={content.key_message}
          onChange={() => {}}
          as="p"
          style={{ fontSize: 15, color: colors.textLight, marginTop: 12, textAlign: 'center', maxWidth: 500 }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: KEY_INSIGHT (Centered emphasis)
// ──────────────────────────────────────────────

function KeyInsightSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white }}>
      <div style={{ padding: '20px 32px 0' }}>
        <EditableText
          value={content.title}
          onChange={onTitleChange || (() => {})}
          as="h2"
          style={{ fontSize: 20, fontWeight: 700, color: colors.textDark, textAlign: 'center', margin: 0 }}
          placeholder="页面标题"
        />
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 60px',
      }}>
        <div style={{
          background: `${colors.primary}08`, borderLeft: `4px solid ${colors.primary}`,
          padding: '24px 32px', borderRadius: '0 8px 8px 0', width: '100%',
        }}>
          <EditableText
            value={content.key_message || content.bullets[0] || ''}
            onChange={() => {}}
            as="p"
            style={{ fontSize: 24, fontWeight: 700, color: colors.primary, lineHeight: 1.5, textAlign: 'center', margin: 0 }}
            placeholder="核心观点"
          />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: BULLET (Numbered list)
// ──────────────────────────────────────────────

function BulletSlide({ content, colors, editable, onTitleChange, onBulletsChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void; onBulletsChange?: (b: string[]) => void;
}) {
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{ flex: 1, padding: '8px 48px 16px', overflow: 'hidden' }}>
        <EditableBullets items={content.bullets} onChange={onBulletsChange || (() => {})} colors={colors} maxItems={6} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: PARALLEL (Side-by-side cards)
// ──────────────────────────────────────────────

function ParallelSlide({ content, colors, layoutId, editable, onTitleChange, onBulletsChange }: {
  content: SlideContent; colors: ThemeColors; layoutId: string;
  editable?: boolean; onTitleChange?: (v: string) => void; onBulletsChange?: (b: string[]) => void;
}) {
  const params = getLayoutParams(layoutId);
  const n = Math.max(2, Math.min(content.bullets.length || params.count, 6));
  const bullets = content.bullets.slice(0, n);

  // Card colors cycle through theme
  const cardColors = [colors.primary, colors.secondary, colors.accent, colors.primary, colors.secondary, colors.accent];

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{
        flex: 1, display: 'flex', gap: 12, padding: '8px 32px 20px', alignItems: 'stretch',
      }}>
        {bullets.map((bullet, i) => {
          // Split bullet into title:description
          const parts = bullet.split(/[：:]/, 1);
          const title = parts[0] || '';
          const desc = parts[1] || '';
          return (
            <div key={i} style={{
              flex: 1, background: colors.bg, borderRadius: 8, padding: '14px 16px',
              borderTop: `3px solid ${cardColors[i % cardColors.length]}`,
              display: 'flex', flexDirection: 'column',
            }}>
              <EditableText
                value={title}
                onChange={(v) => {
                  if (onBulletsChange) {
                    const next = [...content.bullets];
                    next[i] = desc ? `${v}：${desc}` : v;
                    onBulletsChange(next);
                  }
                }}
                as="div"
                style={{ fontSize: 13, fontWeight: 700, color: colors.textDark, lineHeight: 1.3, marginBottom: 6 }}
                placeholder="标题"
              />
              {desc && (
                <EditableText
                  value={desc}
                  onChange={(v) => {
                    if (onBulletsChange) {
                      const next = [...content.bullets];
                      next[i] = `${title}：${v}`;
                      onBulletsChange(next);
                    }
                  }}
                  as="p"
                  style={{ fontSize: 11, color: colors.textLight, lineHeight: 1.4, flex: 1, margin: 0 }}
                />
              )}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: cardColors[i % cardColors.length],
                color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 'auto',
              }}>
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: MATRIX (Grid)
// ──────────────────────────────────────────────

function MatrixSlide({ content, colors, layoutId, editable, onTitleChange, onBulletsChange }: {
  content: SlideContent; colors: ThemeColors; layoutId: string;
  editable?: boolean; onTitleChange?: (v: string) => void; onBulletsChange?: (b: string[]) => void;
}) {
  const params = getLayoutParams(layoutId);
  const cols = params.cols || 2;
  const rows = params.rows || 2;
  const bullets = content.bullets.slice(0, rows * cols);
  const quadColors = [colors.primary, colors.secondary, colors.accent, `${colors.primary}88`];

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 10, padding: '8px 32px 20px',
      }}>
        {bullets.map((bullet, i) => {
          const parts = bullet.split(/[：:]/, 1);
          const title = parts[0] || '';
          const desc = parts[1] || bullet;
          return (
            <div key={i} style={{
              background: quadColors[i % quadColors.length],
              borderRadius: 8, padding: '16px 14px', display: 'flex', flexDirection: 'column',
            }}>
              <EditableText
                value={title}
                onChange={() => {}}
                as="div"
                style={{ fontSize: 13, fontWeight: 700, color: colors.white, marginBottom: 6, lineHeight: 1.3 }}
              />
              <EditableText
                value={desc}
                onChange={() => {}}
                as="p"
                style={{ fontSize: 11, color: `${colors.white}CC`, lineHeight: 1.4, flex: 1, margin: 0 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: PROCESS (Step flow)
// ──────────────────────────────────────────────

function ProcessSlide({ content, colors, layoutId, editable, onTitleChange, onBulletsChange }: {
  content: SlideContent; colors: ThemeColors; layoutId: string;
  editable?: boolean; onTitleChange?: (v: string) => void; onBulletsChange?: (b: string[]) => void;
}) {
  const params = getLayoutParams(layoutId);
  const isVertical = params.direction === 'vertical';
  const steps = content.bullets.slice(0, Math.min(content.bullets.length, 6));
  const stepColors = [colors.primary, colors.secondary, colors.accent, colors.primary, colors.secondary, colors.accent];

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{
        flex: 1, display: isVertical ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: isVertical ? 0 : 0, padding: '8px 24px 20px',
      }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: isVertical ? 'row' : 'row', alignItems: 'center', flexDirection: isVertical ? 'row' : 'column', flex: isVertical ? undefined : 1 }}>
            {/* Step card */}
            <div style={{
              background: `${stepColors[i % stepColors.length]}15`,
              borderLeft: isVertical ? `4px solid ${stepColors[i % stepColors.length]}` : 'none',
              borderTop: isVertical ? 'none' : `4px solid ${stepColors[i % stepColors.length]}`,
              borderRadius: 8, padding: isVertical ? '12px 16px' : '12px 14px',
              width: isVertical ? '80%' : 'auto',
              marginBottom: isVertical ? 8 : 0,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: stepColors[i % stepColors.length],
                color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, marginBottom: 6,
              }}>
                {i + 1}
              </div>
              <EditableText
                value={step}
                onChange={() => {}}
                as="div"
                style={{ fontSize: 12, color: colors.textDark, lineHeight: 1.4 }}
              />
            </div>
            {/* Arrow */}
            {i < steps.length - 1 && (
              <div style={{
                color: colors.textLight, fontSize: 18, padding: isVertical ? '0 0 0 12' : '4px 0',
                flexShrink: 0,
              }}>
                {isVertical ? '↓' : '→'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: TIMELINE
// ──────────────────────────────────────────────

function TimelineSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  const items = content.bullets.slice(0, Math.min(content.bullets.length, 6));
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px 20px' }}>
        {/* Timeline line */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
          {/* Horizontal line */}
          <div style={{ position: 'absolute', top: '50%', left: 20, right: 20, height: 2, background: `${colors.primary}30`, zIndex: 0 }} />
          {/* Points */}
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: i === 0 ? colors.primary : colors.secondary,
                border: `3px solid ${colors.white}`, boxShadow: `0 0 0 2px ${i === 0 ? colors.primary : colors.secondary}`,
                marginBottom: 8,
              }} />
              <EditableText
                value={item}
                onChange={() => {}}
                as="div"
                style={{ fontSize: 10, color: colors.textDark, textAlign: 'center', lineHeight: 1.3, maxWidth: 100 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: TABLE (Comparison)
// ──────────────────────────────────────────────

function TableSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  const rows = content.bullets.slice(0, 6).map(b => {
    const parts = b.split(/[：:]/, 1);
    return { label: parts[0] || '', value: parts[1] || b };
  });

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{ flex: 1, padding: '8px 48px 20px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', background: colors.primary, color: colors.white, textAlign: 'left', fontWeight: 600, borderRadius: '6px 0 0 0', fontSize: 12 }}>维度</th>
              <th style={{ padding: '8px 12px', background: colors.primary, color: colors.white, textAlign: 'left', fontWeight: 600, borderRadius: '0 6px 0 0', fontSize: 12 }}>描述</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? colors.white : colors.bg }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: colors.textDark, borderBottom: `1px solid ${colors.bg}`, fontSize: 12 }}>{r.label}</td>
                <td style={{ padding: '8px 12px', color: colors.textDark, borderBottom: `1px solid ${colors.bg}`, fontSize: 12 }}>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: DATA_VIZ (CSS chart approximation)
// ──────────────────────────────────────────────

function DataVizSlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  // Simple bar chart using CSS
  const bars = content.bullets.slice(0, 6).map((b, i) => {
    const parts = b.split(/[：:]/, 1);
    return { label: parts[0] || `项目${i + 1}`, value: 100 - i * 15 + Math.floor(Math.random() * 20) };
  });
  const maxVal = Math.max(...bars.map(b => b.value), 1);

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 20, padding: '16px 48px 24px' }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            {/* Bar */}
            <div style={{
              width: '80%', height: `${(bar.value / maxVal) * 100}%`,
              background: i === bars.length - 1 ? colors.primary : `${colors.primary}40`,
              borderRadius: '4px 4px 0 0', minHeight: 20,
            }} />
            {/* Label */}
            <div style={{ fontSize: 10, color: colors.textLight, marginTop: 6, textAlign: 'center', lineHeight: 1.2 }}>
              {bar.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Layout: HIERARCHY (Pyramid)
// ──────────────────────────────────────────────

function HierarchySlide({ content, colors, editable, onTitleChange }: {
  content: SlideContent; colors: ThemeColors;
  editable?: boolean; onTitleChange?: (v: string) => void;
}) {
  const levels = content.bullets.slice(0, 5);
  const totalLevels = levels.length || 1;

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, background: colors.white, display: 'flex', flexDirection: 'column' }}>
      <SlideHeader content={content} colors={colors} editable={editable} onTitleChange={onTitleChange} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '8px 60px 20px' }}>
        {levels.map((level, i) => {
          // Pyramid: widest at bottom
          const widthPercent = 40 + (i / totalLevels) * 55;
          const opacity = 0.3 + (i / totalLevels) * 0.7;
          return (
            <div key={i} style={{
              width: `${widthPercent}%`, padding: '10px 16px',
              background: `${colors.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
              borderRadius: 6, textAlign: 'center',
            }}>
              <EditableText
                value={level}
                onChange={() => {}}
                as="div"
                style={{ fontSize: 12, color: i === totalLevels - 1 ? colors.white : colors.textDark, fontWeight: 600, lineHeight: 1.3 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Router + Export
// ──────────────────────────────────────────────

export default function SlideContentRenderer({
  slideData,
  layoutId,
  theme,
  scale,
  customScale,
  editable = false,
  onSlideChange,
}: SlideContentRendererProps) {
  const colors = getThemeColors(theme);
  const content = mapSlideToContent(slideData);
  const category = getLayoutCategory(layoutId);
  const scaleValue = customScale ?? SCALE_VALUES[scale];

  // Outer container — clips to scaled dimensions
  const outerW = Math.round(SLIDE_W * scaleValue);
  const outerH = Math.round(SLIDE_H * scaleValue);

  // Edit handlers
  const handleTitleChange = useCallback((v: string) => {
    if (onSlideChange) onSlideChange({ ...slideData, title: v });
  }, [slideData, onSlideChange]);

  const handleStorylineChange = useCallback((v: string) => {
    if (onSlideChange) onSlideChange({ ...slideData, storyline: v });
  }, [slideData, onSlideChange]);

  const handleArgumentsChange = useCallback((args: string[]) => {
    if (onSlideChange) {
      // Separate arguments from evidence: we only edit arguments here
      onSlideChange({ ...slideData, arguments: args });
    }
  }, [slideData, onSlideChange]);

  const handleBulletsChange = useCallback((bullets: string[]) => {
    // Map all bullets back to arguments (simplified editing)
    if (onSlideChange) {
      const evidenceCount = slideData.evidence?.length || 0;
      onSlideChange({
        ...slideData,
        arguments: bullets.slice(0, bullets.length - evidenceCount),
        evidence: bullets.slice(bullets.length - evidenceCount),
      });
    }
  }, [slideData, onSlideChange]);

  const isEditable = editable && scale === 'full';
  const layoutProps = {
    content,
    colors,
    editable: isEditable,
    onTitleChange: isEditable ? handleTitleChange : undefined,
    onBulletsChange: isEditable ? handleBulletsChange : undefined,
    layoutId,
  };

  // Route to layout component (mirrors backend LayoutRenderer.render())
  let slideContent: React.ReactNode;
  switch (category) {
    case 'TITLE':
      slideContent = <TitleSlide {...layoutProps} onTitleChange={isEditable ? handleTitleChange : undefined} />;
      break;
    case 'SECTION':
      slideContent = <SectionSlide {...layoutProps} onTitleChange={isEditable ? handleTitleChange : undefined} />;
      break;
    case 'KEY_INSIGHT':
      slideContent = <KeyInsightSlide {...layoutProps} onTitleChange={isEditable ? handleTitleChange : undefined} />;
      break;
    case 'BULLET':
      slideContent = <BulletSlide {...layoutProps} />;
      break;
    case 'PARALLEL':
      slideContent = <ParallelSlide {...layoutProps} />;
      break;
    case 'MATRIX':
      slideContent = <MatrixSlide {...layoutProps} />;
      break;
    case 'PROCESS':
      slideContent = <ProcessSlide {...layoutProps} />;
      break;
    case 'TIMELINE':
      slideContent = <TimelineSlide {...layoutProps} />;
      break;
    case 'TABLE':
      slideContent = <TableSlide {...layoutProps} />;
      break;
    case 'DATA_VIZ':
      slideContent = <DataVizSlide {...layoutProps} />;
      break;
    case 'HIERARCHY':
      slideContent = <HierarchySlide {...layoutProps} />;
      break;
    default:
      slideContent = <BulletSlide {...layoutProps} />;
  }

  return (
    <div
      style={{ width: outerW, height: outerH, overflow: 'hidden', position: 'relative' }}
      className="slide-content-renderer"
    >
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scaleValue})`,
          transformOrigin: 'top left',
        }}
      >
        {slideContent}
      </div>
    </div>
  );
}
