'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Link2Off, Trash2, RotateCcw, Download, Lock } from 'lucide-react'
import { SwimLane } from './SwimLane'
import { ArrowOverlay } from './arrow-overlay'
import { StylePanel } from './style-panel'
import { type CapsuleData } from './CapsuleNode'
import type { ShapeType } from './shape-renderer'
import type { Step3Data, MatrixData } from '@/types/strategy'
import { useStore } from '@/lib/store'

let capsuleIdCounter = 0
const DEFAULT_FILL = 'hsl(215, 80%, 97%)'
const DEFAULT_BORDER = 'hsl(215, 60%, 75%)'
const LANE_PAD_X = 20
const LANE_PAD_Y = 20

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

interface LaneData {
  id: string
  title: string
  colorClass: string
  height: number
  capsules: CapsuleData[]
}

interface BSCBoardProps {
  initialCapsules?: CapsuleData[]
  step3Data?: Step3Data  // 新增：Step 3数据，用于Excel导出
  onSave?: (lanes: LaneData[], connections: Connection[]) => void
}

const makeInitialLanes = (initialCapsules: CapsuleData[] = []): LaneData[] => {
  // Distribute capsules into lanes
  const financialCapsules = initialCapsules.filter(c => c.id.includes('financial'));
  const customerCapsules = initialCapsules.filter(c => c.id.includes('customer'));
  const processCapsules = initialCapsules.filter(c => c.id.includes('process'));
  const learningCapsules = initialCapsules.filter(c => c.id.includes('learning'));

  return [
    {
      id: 'lane_1',
      title: '财务层面',
      colorClass: 'bg-red-50',
      height: 200,
      capsules: financialCapsules.length > 0 ? financialCapsules : []
    },
    {
      id: 'lane_2',
      title: '客户层面',
      colorClass: 'bg-blue-50',
      height: 200,
      capsules: customerCapsules.length > 0 ? customerCapsules : []
    },
    {
      id: 'lane_3',
      title: '内部流程',
      colorClass: 'bg-green-50',
      height: 200,
      capsules: processCapsules.length > 0 ? processCapsules : []
    },
    {
      id: 'lane_4',
      title: '学习成长',
      colorClass: 'bg-purple-50',
      height: 200,
      capsules: learningCapsules.length > 0 ? learningCapsules : []
    }
  ];
}

const laneColors: Record<string, string> = {
  'bg-red-50': 'bg-red-50',
  'bg-blue-50': 'bg-blue-50',
  'bg-green-50': 'bg-green-50',
  'bg-purple-50': 'bg-purple-50'
}

export function BSCBoard({ initialCapsules, step3Data, onSave }: BSCBoardProps) {
  const [lanes, setLanes] = useState<LaneData[]>(() => makeInitialLanes(initialCapsules || []));
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectMode, setConnectMode] = useState(false)
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [isLocked, setIsLocked] = useState(false)  // 新增：锁定状态

  const selectedCapsule = selectedCapsuleId
    ? lanes.flatMap((l) => l.capsules).find((c) => c.id === selectedCapsuleId)
    : null

  const handleAddCapsule = useCallback((laneId: string) => {
    capsuleIdCounter++
    const newCapsule: CapsuleData = {
      id: `cap_${capsuleIdCounter}`,
      text: '新目标',
      x: LANE_PAD_X + Math.random() * 300,
      y: LANE_PAD_Y + Math.random() * 60,
      shape: 'capsule' as ShapeType,
      fillColor: DEFAULT_FILL,
      borderColor: DEFAULT_BORDER,
    }
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id === laneId
          ? { ...lane, capsules: [...lane.capsules, newCapsule] }
          : lane
      )
    )
  }, [])

  const handleDeleteCapsule = useCallback(
    (laneId: string, capsuleId: string) => {
      setLanes((prev) =>
        prev.map((lane) =>
          lane.id === laneId
            ? { ...lane, capsules: lane.capsules.filter((c) => c.id !== capsuleId) }
            : lane
        )
      )
      setConnections((prev) =>
        prev.filter((c) => c.fromId !== capsuleId && c.toId !== capsuleId)
      )
      if (selectedCapsuleId === capsuleId) setSelectedCapsuleId(null)
    },
    [selectedCapsuleId]
  )

  const handleTextChange = useCallback(
    (_laneId: string, capsuleId: string, text: string) => {
      setLanes((prev) =>
        prev.map((lane) => ({
          ...lane,
          capsules: lane.capsules.map((c) =>
            c.id === capsuleId ? { ...c, text } : c
          )
        }))
      )
    },
    []
  )

  const handlePositionChange = useCallback(
    (_laneId: string, capsuleId: string, x: number, y: number) => {
      setLanes((prev) =>
        prev.map((lane) => ({
          ...lane,
          capsules: lane.capsules.map((c) =>
            c.id === capsuleId ? { ...c, x, y } : c
          )
        }))
      )
    },
    []
  )

  const handleSelectCapsule = useCallback((capsuleId: string) => {
    if (!connectMode) {
      setSelectedCapsuleId((prev) => (prev === capsuleId ? null : capsuleId))
    }
  }, [connectMode])

  const handleLaneHeightChange = useCallback((laneId: string, newHeight: number) => {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id === laneId
          ? { ...lane, height: newHeight }
          : lane
      )
    )
  }, [])

  // 核心连线逻辑：从 connection-demo.tsx 移植
  const onNodeClick = useCallback((nodeId: string) => {
    if (!connectMode) return

    // 还没选起点 → 设置起点
    if (!pendingFrom) {
      setPendingFrom(nodeId)
      return
    }

    // 点了同一个节点 → 取消
    if (pendingFrom === nodeId) {
      setPendingFrom(null)
      setMousePos(null)
      return
    }

    // 已有起点，点击了不同节点 → 创建连线
    const alreadyExists = connections.some(
      (c) =>
        (c.fromId === pendingFrom && c.toId === nodeId) ||
        (c.fromId === nodeId && c.toId === pendingFrom)
    )
    if (!alreadyExists) {
      setConnections((prev) => [
        ...prev,
        {
          id: `conn_${Date.now()}`,
          fromId: pendingFrom,
          toId: nodeId,
        },
      ])
    }

    // 重置，准备下一条连线
    setPendingFrom(null)
    setMousePos(null)
  }, [connectMode, pendingFrom, connections])

  const handleClearConnections = useCallback(() => {
    setConnections([])
    setPendingFrom(null)
    setMousePos(null)
  }, [])

  const handleReset = useCallback(() => {
    setLanes(makeInitialLanes([]))
    setConnections([])
    setSelectedCapsuleId(null)
    setPendingFrom(null)
    setMousePos(null)
  }, [])

  const handleFillChange = useCallback((fillColor: string) => {
    if (!selectedCapsuleId) return
    setLanes((prev) =>
      prev.map((lane) => ({
        ...lane,
        capsules: lane.capsules.map((c) =>
          c.id === selectedCapsuleId ? { ...c, fillColor } : c
        )
      }))
    )
  }, [selectedCapsuleId])

  const handleBorderChange = useCallback((borderColor: string) => {
    if (!selectedCapsuleId) return
    setLanes((prev) =>
      prev.map((lane) => ({
        ...lane,
        capsules: lane.capsules.map((c) =>
          c.id === selectedCapsuleId ? { ...c, borderColor } : c
        )
      }))
    )
  }, [selectedCapsuleId])

  const handleShapeChange = useCallback((shape: ShapeType) => {
    if (!selectedCapsuleId) return
    setLanes((prev) =>
      prev.map((lane) => ({
        ...lane,
        capsules: lane.capsules.map((c) =>
          c.id === selectedCapsuleId ? { ...c, shape } : c
        )
      }))
    )
  }, [selectedCapsuleId])

  // Handle capsule double click - trigger AI analysis
  const handleCapsuleDoubleClick = useCallback((capsuleId: string, text: string, x: number, y: number) => {
    console.log('Capsule double clicked:', capsuleId, text)
    // Trigger AI assistant to analyze this capsule
    const event = new CustomEvent('capsule-double-click', {
      detail: { capsuleId, text, x, y }
    })
    window.dispatchEvent(event)
  }, [])

  const handleExportExcel = useCallback(() => {
    // 动态导入 xlsx
    import('xlsx').then((XLSX: any) => {
      const workbook = XLSX.utils.book_new();

      // ========== Sheet 1: 三力三平台行动表（主要表格）==========
      if (!step3Data?.matrixData) {
        alert('Step 3 数据不完整，无法导出三力三平台行动表。请先完成 Step 3。')
        return
      }

      const matrix = step3Data.matrixData
      const customerCapsules = lanes.find(l => l.id === 'lane_2')?.capsules || []
      const processCapsules = [
        ...(lanes.find(l => l.id === 'lane_3')?.capsules || []),
        ...(lanes.find(l => l.id === 'lane_4')?.capsules || [])
      ]

      // 生成三力三平台数据行
      const actionPlanRows: any[] = []

      // 遍历 Step 3 矩阵的每个值
      let seqNumber = 1
      Object.entries(matrix.values || {}).forEach(([key, value]) => {
        const [clientId, productId] = key.split('_')
        const clientName = matrix.oldClients[parseInt(clientId)] || matrix.newClients[parseInt(clientId)] || `客户${clientId}`
        const productName = matrix.oldProducts[parseInt(productId)] || matrix.newProducts[parseInt(productId)] || `产品${productId}`

        // 提取 BSC 数据
        const salesForce = customerCapsules.map(c => c.text).join('、') || ''
        const productForce = customerCapsules.map(c => c.text).join('、') || ''
        const deliveryForce = customerCapsules.map(c => c.text).join('、') || ''

        const hr = processCapsules.filter(c => c.text.includes('人力') || c.text.includes('HR')).map(c => c.text).join('、') || ''
        const financeAssets = processCapsules.filter(c => c.text.includes('财务') || c.text.includes('资金')).map(c => c.text).join('、') || ''
        const digitalProcess = processCapsules.filter(c => c.text.includes('数字') || c.text.includes('流程') || c.text.includes('IT')).map(c => c.text).join('、') || ''

        actionPlanRows.push({
          '序号': seqNumber++,
          '客户群': clientName,
          '产品': productName,
          '营收目标': value,
          '销售力': salesForce,
          '产品力': productForce,
          '交付力': deliveryForce,
          '人力（三平台）': hr,
          '财务&资产（三平台）': financeAssets,
          '数字化&流程（三平台）': digitalProcess
        })
      })

      const actionPlanWorksheet = XLSX.utils.json_to_sheet(actionPlanRows)
      XLSX.utils.book_append_sheet(workbook, actionPlanWorksheet, '三力三平台行动表')

      // ========== Sheet 2: BSC 数据（参考）==========
      const bscData = [
        ['维度', '卡片ID', '内容', 'X坐标', 'Y坐标', '形状', '填充色', '边框色'],
        ...lanes.flatMap(lane =>
          lane.capsules.map(capsule => [
            lane.title,
            capsule.id,
            capsule.text,
            capsule.x,
            capsule.y,
            capsule.shape,
            capsule.fillColor,
            capsule.borderColor
          ])
        ),
        ...connections.map(conn => {
          const fromCapsule = lanes.flatMap(l => l.capsules).find(c => c.id === conn.fromId)
          const toCapsule = lanes.flatMap(l => l.capsules).find(c => c.id === conn.toId)
          return [
            '连接关系',
            conn.id,
            `${fromCapsule?.text || 'N/A'} → ${toCapsule?.text || 'N/A'}`,
            '',
            '',
            '',
            '',
            '',
            ''
          ]
        })
      ]
      const bscWorksheet = XLSX.utils.aoa_to_sheet(bscData)
      XLSX.utils.book_append_sheet(workbook, bscWorksheet, 'BSC数据参考')

      // 生成文件并下载
      XLSX.writeFile(workbook, `三力三平台行动表_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }, [lanes, connections, step3Data])

  const handleBoardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-capsule-id]')) {
      setSelectedCapsuleId(null)
    }
  }, [])

  // 鼠标移动 → 更新虚线终点
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!pendingFrom || !connectMode) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({
      x: e.clientX - rect.left + (containerRef.current?.scrollLeft || 0),
      y: e.clientY - rect.top + (containerRef.current?.scrollTop || 0)
    })
  }, [pendingFrom, connectMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingFrom(null)
        setMousePos(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 转换 capsules 为 NodeData 供 ArrowOverlay 使用
  const nodes: NodeData[] = lanes.flatMap((lane) =>
    lane.capsules.map((capsule) => ({
      id: capsule.id,
      label: capsule.text,
      x: capsule.x,
      y: capsule.y,
    }))
  )

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Toolbar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <h1 className="text-lg font-bold text-foreground">
          {'BSC 平衡计分卡'}
        </h1>
        <div className="mx-2 h-6 w-px bg-border" />
        <button
          onClick={() => {
            setConnectMode(!connectMode)
            setPendingFrom(null)
            setMousePos(null)
          }}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            connectMode
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary text-secondary-foreground hover:bg-muted'
          }`}
        >
          <Link2Off className="h-4 w-4" />
          <span>{connectMode ? '连线模式 (开启)' : '连线模式 (关闭)'}</span>
        </button>

        <button
          onClick={handleClearConnections}
          className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
          <span>{'清除连线'}</span>
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{'重置'}</span>
        </button>

        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isLocked
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-secondary text-secondary-foreground hover:bg-muted'
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>{isLocked ? '已锁定 BSC' : '锁定并确认 BSC'}</span>
        </button>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-2 text-sm font-medium text-white transition-colors ml-auto"
        >
          <Download className="h-4 w-4" />
          <span>{'导出战略行动计划 (Excel)'}</span>
        </button>

        <p className="ml-2 text-xs text-muted-foreground">
          {isLocked
            ? '已锁定：数据已确认，可导出三力三平台行动表'
            : connectMode && pendingFrom
            ? `已选起点 [${pendingFrom}]，请点击目标节点完成连线，按 Escape 取消`
            : '拖拽移动 | 双击编辑 | 点击选中改样式 | 拖拽泳道底边调高度'}
        </p>
      </header>

      {/* Board */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto p-6"
        onClick={handleBoardClick}
        onMouseMove={handleMouseMove}
      >
        <div className="relative flex flex-col gap-4">
          {lanes.map((lane) => (
            <div key={lane.id} className={`${laneColors[lane.colorClass] || lane.colorClass}`}>
              <SwimLane
                id={lane.id}
                title={lane.title}
                colorClass={lane.colorClass}
                laneHeight={lane.height}
                onLaneHeightChange={handleLaneHeightChange}
                capsules={lane.capsules}
                onAddCapsule={handleAddCapsule}
                onDeleteCapsule={handleDeleteCapsule}
                onTextChange={handleTextChange}
                onPositionChange={handlePositionChange}
                onSelectCapsule={handleSelectCapsule}
                onCapsuleDoubleClick={handleCapsuleDoubleClick}
                selectedCapsuleId={selectedCapsuleId}
                isConnecting={connectMode}
                connectSourceId={pendingFrom}
                onNodeClick={onNodeClick}
              />
            </div>
          ))}
        </div>

        {/* SVG Arrow Overlay - 覆盖在所有泳道之上 */}
        <ArrowOverlay
          connections={connections}
          pendingFrom={pendingFrom}
          mousePos={mousePos}
          containerRef={containerRef}
          nodes={nodes}
        />

        {/* Style Panel */}
        <StylePanel
          selectedId={selectedCapsuleId}
          fillColor={selectedCapsule?.fillColor ?? DEFAULT_FILL}
          borderColor={selectedCapsule?.borderColor ?? DEFAULT_BORDER}
          shape={selectedCapsule?.shape ?? 'capsule'}
          onFillChange={handleFillChange}
          onBorderChange={handleBorderChange}
          onShapeChange={handleShapeChange}
          onClose={() => setSelectedCapsuleId(null)}
        />
      </div>
    </div>
  )
}

export type { CapsuleData }
