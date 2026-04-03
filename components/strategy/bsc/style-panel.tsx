'use client'

import { X } from 'lucide-react'
import { ShapeIcon, type ShapeType } from './shape-renderer'

const FILL_COLORS = [
  '#ffffff',
  '#fef3c7',
  '#fde68a',
  '#fed7aa',
  '#feca57',
  '#e9d5ff',
  '#dbeafe',
  '#d1fae5',
  '#e2e8f0',
  '#fce7f3',
  '#ccfbf1',
  '#f0fdf4',
]

const BORDER_COLORS = [
  '#334155',
  '#b45309',
  '#d97706',
  '#ea580c',
  '#dc2626',
  '#9333ea',
  '#2563eb',
  '#059669',
  '#64748b',
  '#db2777',
  '#0d9488',
  '#16a34a',
]

const SHAPES: ShapeType[] = ['capsule', 'rectangle', 'chevron', 'triangle', 'diamond']
const SHAPE_LABELS: Record<ShapeType, string> = {
  capsule: '胶囊',
  rectangle: '矩形',
  chevron: '燕尾',
  triangle: '三角',
  diamond: '菱形',
}

interface StylePanelProps {
  selectedId: string | null
  fillColor: string
  borderColor: string
  shape: ShapeType
  onFillChange: (color: string) => void
  onBorderChange: (color: string) => void
  onShapeChange: (shape: ShapeType) => void
  onClose: () => void
}

export function StylePanel({
  selectedId,
  fillColor,
  borderColor,
  shape,
  onFillChange,
  onBorderChange,
  onShapeChange,
  onClose,
}: StylePanelProps) {
  if (!selectedId) return null

  return (
    <div className="absolute right-4 top-4 z-50 w-56 rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground">{'样式面板'}</span>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Shape Picker */}
      <div className="border-b border-border px-3 py-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{'形状'}</p>
        <div className="flex items-center gap-1.5">
          {SHAPES.map((s) => (
            <button
              key={s}
              title={SHAPE_LABELS[s]}
              onClick={() => onShapeChange(s)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                shape === s
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <ShapeIcon shape={s} size={24} />
            </button>
          ))}
        </div>
      </div>

      {/* Fill Color */}
      <div className="border-b border-border px-3 py-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{'填充色'}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {FILL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onFillChange(c)}
              className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                fillColor === c
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'border-foreground/15'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Fill color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Border Color */}
      <div className="px-3 py-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{'边框色'}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {BORDER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onBorderChange(c)}
              className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                borderColor === c
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'border-foreground/15'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Border color ${c}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
