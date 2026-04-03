'use client'

import { useEffect, useState, useCallback } from 'react'

interface Connection {
  id: string
  fromId: string
  toId: string
}

interface NodeData {
  id: string
  label: string
  x: number
  y: number
}

interface ArrowLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface ArrowOverlayProps {
  connections: Connection[]
  pendingFrom: string | null
  mousePos: { x: number; y: number } | null
  containerRef: React.RefObject<HTMLDivElement | null>
  nodes: NodeData[]
}

export function ArrowOverlay({
  connections,
  pendingFrom,
  mousePos,
  containerRef,
  nodes,
}: ArrowOverlayProps) {
  const [arrows, setArrows] = useState<ArrowLine[]>([])
  const [pendingArrow, setPendingArrow] = useState<ArrowLine | null>(null)

  // 获取节点边缘中点
  const getNodeEdge = useCallback(
    (nodeId: string, direction: 'top' | 'bottom') => {
      const container = containerRef.current
      if (!container) return null
      const el = container.querySelector(`[data-capsule-id="${nodeId}"]`) as HTMLElement | null
      if (!el) return null
      const elRect = el.getBoundingClientRect()
      const cRect = container.getBoundingClientRect()
      return {
        x: elRect.left + elRect.width / 2 - cRect.left + (container.scrollLeft || 0),
        y: direction === 'bottom'
          ? elRect.bottom - cRect.top + (container.scrollTop || 0)
          : elRect.top - cRect.top + (container.scrollTop || 0),
      }
    },
    [containerRef]
  )

  const getNodeCenter = useCallback(
    (nodeId: string) => {
      const container = containerRef.current
      if (!container) return null
      const el = container.querySelector(`[data-capsule-id="${nodeId}"]`) as HTMLElement | null
      if (!el) return null
      const elRect = el.getBoundingClientRect()
      const cRect = container.getBoundingClientRect()
      return {
        x: elRect.left + elRect.width / 2 - cRect.left + (container.scrollLeft || 0),
        y: elRect.top + elRect.height / 2 - cRect.top + (container.scrollTop || 0),
      }
    },
    [containerRef]
  )

  // RAF 循环: 每帧重新计算箭头坐标
  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // 已确认的连线
    const newArrows: ArrowLine[] = []
    for (const conn of connections) {
      const fromCenter = getNodeCenter(conn.fromId)
      const toCenter = getNodeCenter(conn.toId)
      if (!fromCenter || !toCenter) continue
      const goingDown = fromCenter.y < toCenter.y
      const from = getNodeEdge(conn.fromId, goingDown ? 'bottom' : 'top')
      const to = getNodeEdge(conn.toId, goingDown ? 'top' : 'bottom')
      if (!from || !to) continue
      newArrows.push({ id: conn.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y })
    }
    setArrows(newArrows)

    // 正在拖拽的虚线
    if (pendingFrom && mousePos) {
      const from = getNodeEdge(pendingFrom, 'bottom')
      if (from) {
        const cRect = container.getBoundingClientRect()
        setPendingArrow({
          id: 'pending',
          x1: from.x,
          y1: from.y,
          x2: mousePos.x - cRect.left,
          y2: mousePos.y - cRect.top,
        })
      }
    } else {
      setPendingArrow(null)
    }
  }, [connections, pendingFrom, mousePos, containerRef, getNodeEdge, getNodeCenter])

  useEffect(() => {
    let rafId: number
    const loop = () => {
      recalculate()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [recalculate])

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <defs>
        {/* 箭头标记 */}
        <marker
          id="demo-arrowhead"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 5" fill="#475569" />
        </marker>
        <marker
          id="demo-arrowhead-pending"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 5" fill="#2563eb" fillOpacity={0.5} />
        </marker>
      </defs>

      {/* 已确认的连线: 实线 + 贝塞尔曲线 + 箭头 */}
      {arrows.map((a) => {
        const midY = (a.y1 + a.y2) / 2
        const d = `M ${a.x1} ${a.y1} C ${a.x1} ${midY}, ${a.x2} ${midY}, ${a.x2} ${a.y2}`
        return (
          <path
            key={a.id}
            d={d}
            fill="none"
            stroke="#475569"
            strokeWidth={2}
            markerEnd="url(#demo-arrowhead)"
          />
        )
      })}

      {/* 虚线: 从起点到鼠标当前位置 */}
      {pendingArrow && (
        <path
          d={`M ${pendingArrow.x1} ${pendingArrow.y1} C ${pendingArrow.x1} ${
            (pendingArrow.y1 + pendingArrow.y2) / 2
          }, ${pendingArrow.x2} ${
            (pendingArrow.y1 + pendingArrow.y2) / 2
          }, ${pendingArrow.x2} ${pendingArrow.y2}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeOpacity={0.6}
          markerEnd="url(#demo-arrowhead-pending)"
        />
      )}
    </svg>
  )
}
