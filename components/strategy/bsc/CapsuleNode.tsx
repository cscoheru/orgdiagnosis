'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { ShapeRenderer, type ShapeType } from './shape-renderer'

export interface CapsuleData {
  id: string
  text: string
  x: number
  y: number
  shape: ShapeType
  fillColor: string
  borderColor: string
}

interface CapsuleNodeProps {
  id: string
  text: string
  x: number
  y: number
  shape: ShapeType
  fillColor: string
  borderColor: string
  isSelected: boolean
  onTextChange: (id: string, text: string) => void
  onDelete: (id: string) => void
  onPositionChange: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  onDoubleClick?: (id: string, text: string, x: number, y: number) => void
  isConnecting: boolean
  onClick: (id: string) => void
}

export function CapsuleNode({
  id,
  text,
  x,
  y,
  shape,
  fillColor,
  borderColor,
  isSelected,
  onTextChange,
  onDelete,
  onPositionChange,
  onSelect,
  onDoubleClick,
  isConnecting,
  onClick,
}: CapsuleNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(text)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hasDragged = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [nodeSize, setNodeSize] = useState({ width: 130, height: 42 })
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditText(text)
  }, [text])

  // Measure text to size of shape
  useEffect(() => {
    const el = nodeRef.current
    if (!el) return
    const textEl = el.querySelector('[data-text-content]') as HTMLElement
    if (textEl) {
      const w = Math.max(90, textEl.scrollWidth + 40)
      const h = Math.max(42, textEl.scrollHeight + 18)
      setNodeSize({ width: w, height: h })
    }
  }, [text, isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (editText.trim()) {
      onTextChange(id, editText.trim())
    } else {
      setEditText(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleBlur()
    }
    if (e.key === 'Escape') {
      setEditText(text)
      setIsEditing(false)
    }
  }

  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick(id, text, x, y)
    }
    if (!isConnecting) {
      setIsEditing(true)
    }
  }, [id, text, x, y, onDoubleClick, isConnecting])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing || isConnecting) return
      e.preventDefault()
      e.stopPropagation()
      dragging.current = true
      hasDragged.current = false

      const parentEl = nodeRef.current?.parentElement
      if (!parentEl) return
      const parentRect = parentEl.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - parentRect.left - x,
        y: e.clientY - parentRect.top - y,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !parentEl) return
        hasDragged.current = true
        const pr = parentEl.getBoundingClientRect()
        const newX = Math.max(0, ev.clientX - pr.left - dragOffset.current.x)
        const newY = Math.max(0, ev.clientY - pr.top - dragOffset.current.y)
        onPositionChange(id, newX, newY)
      }

      const handleMouseUp = () => {
        dragging.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [isEditing, isConnecting, id, x, y, onPositionChange]
  )

  const handleClick = () => {
    if (isConnecting) {
      onClick(id)
    } else if (!hasDragged.current) {
      onSelect(id)
    }
  }

  const w = shape === 'diamond' ? nodeSize.width + 30 : shape === 'triangle' ? nodeSize.width + 20 : nodeSize.width
  const h = shape === 'diamond' ? nodeSize.height + 16 : shape === 'triangle' ? nodeSize.height + 10 : nodeSize.height

  return (
    <div
      ref={nodeRef}
      data-capsule-id={id}
      style={{ left: x, top: y, width: w, height: 'auto', minHeight: '50px' }}
      className={`group absolute flex items-center justify-center select-none z-10 ${
        isConnecting
          ? isSelected
            ? 'cursor-pointer'
            : 'cursor-pointer'
          : 'cursor-grab active:cursor-grabbing'
      }`}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Shape background */}
      <ShapeRenderer
        shape={shape}
        width={w}
        height={h}
        fillColor={fillColor}
        borderColor={isSelected ? 'hsl(215, 60%, 45%)' : isSelected && isConnecting ? 'hsl(215, 60%, 45%)' : borderColor}
      />

      {/* Selection ring for connect mode */}
      {isConnecting && isSelected && (
        <div className="absolute inset-[-4px] rounded-full ring-2 ring-primary ring-offset-1 pointer-events-none" />
      )}
      {/* Selection indicator for style editing */}
      {isSelected && !isConnecting && (
        <div className="absolute inset-[-3px] rounded-lg border-2 border-primary border-dashed pointer-events-none" />
      )}

      {/* Text content */}
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="relative z-10 min-w-[60px] max-w-[180px] bg-transparent text-center text-sm font-medium text-foreground outline-none resize-none leading-tight"
          rows={1}
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = target.scrollHeight + 'px'
          }}
        />
      ) : (
        <span
          data-text-content
          className="relative z-10 text-sm font-medium text-foreground whitespace-pre-wrap word-break-break-word max-w-[180px] px-4"
        >
          {text}
        </span>
      )}

      {/* Delete button */}
      {!isConnecting && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(id)
          }}
          className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors z-20"
          aria-label="Delete node"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
