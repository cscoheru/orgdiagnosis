'use client'

import { useCallback, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { CapsuleNode, type CapsuleData } from './CapsuleNode'
import type { ShapeType } from './shape-renderer'

interface SwimLaneProps {
  id: string
  title: string
  colorClass: string
  laneHeight: number
  onLaneHeightChange: (laneId: string, newHeight: number) => void
  capsules: CapsuleData[]
  onAddCapsule: (laneId: string) => void
  onDeleteCapsule: (laneId: string, capsuleId: string) => void
  onTextChange: (laneId: string, capsuleId: string, text: string) => void
  onPositionChange: (laneId: string, capsuleId: string, x: number, y: number) => void
  onSelectCapsule: (capsuleId: string) => void
  onCapsuleDoubleClick: (capsuleId: string, text: string, x: number, y: number) => void
  selectedCapsuleId: string | null
  isConnecting: boolean
  connectSourceId: string | null
  onNodeClick: (nodeId: string) => void
}

export function SwimLane({
  id,
  title,
  colorClass,
  laneHeight,
  onLaneHeightChange,
  capsules,
  onAddCapsule,
  onDeleteCapsule,
  onTextChange,
  onPositionChange,
  onSelectCapsule,
  onCapsuleDoubleClick,
  selectedCapsuleId,
  isConnecting,
  connectSourceId,
  onNodeClick,
}: SwimLaneProps) {
  const resizing = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizing.current = true
      startY.current = e.clientY
      startH.current = laneHeight
    },
    [id, laneHeight, onLaneHeightChange]
  )

  const handleMove = (ev: MouseEvent) => {
    if (!resizing.current) return
    const delta = ev.clientY - startY.current
    const newH = Math.max(100, startH.current + delta)
    onLaneHeightChange(id, newH)
  }

  const handleUp = () => {
    resizing.current = false
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
  }

  // Set up event listeners for resize
  useEffect(() => {
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [id, laneHeight, onLaneHeightChange])

  return (
    <div
      data-lane-id={id}
      className={`relative flex ${colorClass} rounded-lg border border-border/50`}
    >
      {/* Lane Label */}
      <div className="flex w-[120px] shrink-0 items-center justify-center border-r border-foreground/15 px-2">
        <h3 className="text-center text-base font-bold text-foreground leading-tight">
          {title}
        </h3>
      </div>

      {/* Lane Content */}
      <div className="relative flex-1" style={{ height: laneHeight }}>
        {capsules.map((capsule) => (
          <CapsuleNode
            key={capsule.id}
            id={capsule.id}
            text={capsule.text}
            x={capsule.x}
            y={capsule.y}
            shape={capsule.shape}
            fillColor={capsule.fillColor}
            borderColor={capsule.borderColor}
            isSelected={selectedCapsuleId === capsule.id}
            onTextChange={(capId, newText) => onTextChange(id, capId, newText)}
            onDelete={(capId) => onDeleteCapsule(id, capId)}
            onPositionChange={(capId, nx, ny) => onPositionChange(id, capId, nx, ny)}
            onSelect={onSelectCapsule}
            onDoubleClick={onCapsuleDoubleClick}
            isConnecting={isConnecting}
            onClick={() => onNodeClick(capsule.id)}
          />
        ))}

        {/* Add Button */}
        <button
          onClick={() => onAddCapsule(id)}
          className="absolute right-3 bottom-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-foreground/25 text-foreground/40 transition-all hover:border-primary hover:text-primary hover:bg-card/50 z-20"
          aria-label={`Add node to ${title}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Resize Handle at bottom */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 left-[120px] right-0 h-2 cursor-ns-resize group/resize z-30"
      >
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-transparent group-hover/resize:bg-primary/40 transition-colors" />
      </div>
    </div>
  )
}
