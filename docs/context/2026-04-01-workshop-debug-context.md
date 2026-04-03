# 画布调试上下文记录

> 记录日期: 2026-04-01
> 问题模块: CoCreateCanvas (智能共创套件画布)

---

## 一、用户原始反馈

### 第一轮 (上下文压缩前)
> "修改内容后，退出编辑状态，还是回到原来的内容（编辑无效）"

> "光标在非节点区域我觉得不应该是手掌而是光标箭头，当拖动时变成拳头，光标箭头可以选择多个节点和连线，可以将被选中的一起拖动、删除"

> "删除这个功能为什么还要加个删除图标（实际上也无效），直接用delete或退格键就可以删除"

### 第二轮 (当前)
> "还是不行，暂停修复。现在连画布都不能拖动了。"
> "好像什么都没有改善（编辑、删除、多选、拖动），甚至比原来更差了：现在连画布都不能拖动了。。。"

---

## 二、已尝试的修复方案及效果

### 修复 1: 乐观本地更新 (SmartNode)
**思路**: SmartNode 使用 `useReactFlow().setNodes()` 立即更新 ReactFlow 内部 store，API 调用 fire-and-forget。

**代码变更**:
- SmartNode.tsx: `save()` 函数改为同步调用 `setNodes` + 异步 `onSyncUpdate`
- 移除 `data.onUpdate` 回调 (会触发 loadSession)
- 改为 `data.onSyncUpdate` (fire-and-forget, 不触发 reload)

**效果**: 单次编辑后不立即回滚，但后续操作 (创建节点等) 触发 `loadSession` 时仍会回滚。

### 修复 2: 页面层不调用 loadSession
**思路**: `handleUpdateNode` 不再调用 `loadSession()`，避免覆盖 ReactFlow store。

**代码变更**:
- `[id]/page.tsx`: `handleUpdateNode` 只调用 API，不 reload

**效果**: 同修复 1，结构性操作仍会触发 reload。

### 修复 3: panOnDrag 限制
**思路**: `panOnDrag={[1]}` 限制为中键拖动，左键用于选择。

**效果**: **导致画布完全不能拖动** — 大多数用户没有中键，造成严重体验退化。这是用户反馈"比原来更差"的直接原因。

### 修复 4: CSS 光标覆盖
**思路**: 用 `!important` 覆盖 ReactFlow 默认的 grab 光标。

**效果**: 光标在非节点区域显示箭头，但拖动时因 panOnDrag=[1] 无效。

### 修复 5: 移除删除图标
**思路**: 从 SmartNode 中移除 Trash2 图标按钮。

**效果**: UI 清理，不影响功能。

### 修复 6: Merge 策略 (最新，未验证)
**思路**: 布局 effect 中 `setNodes(positioned)` 改为 merge 策略 — 只更新位置，保留现有节点数据。

```typescript
setNodes((currentNodes) => {
  if (currentNodes.length === 0) return positioned;
  // 只更新位置，保留 data (包括乐观编辑的 label)
  const updated = currentNodes
    .filter(n => positionedIds.has(n.id))
    .map(n => {
      const p = positionedMap.get(n.id);
      return p ? { ...n, position: p.position } : n;
    });
  // 添加新节点
  for (const p of positioned) {
    if (!currentIds.has(p.id)) updated.push(p);
  }
  return updated;
});
```

**效果**: 用户反馈"还是不行"后暂停，**未实际验证**。

### 修复 7: Ref 模式避免闭包过时 (最新，未验证)
**思路**: 用 `actionRefs.current` + `selectedNodeIdRef.current` 代替直接闭包引用。

**效果**: 与修复 6 同时实现，未实际验证。

### 修复 8: 多选多删 (最新，未验证)
**思路**: `selectionOnDrag={true}` + `selectionKeyCode="Shift"`，Delete 键读取 ReactFlow 选择状态。

**效果**: 与修复 6 同时实现，未实际验证。

---

## 三、ReactFlow 核心技术洞察

### 3.1 ReactFlow 状态管理模型

ReactFlow 内部使用 Zustand store。当父组件传递新的 `nodes` prop 时，ReactFlow 通过 `shallow` 比较替换内部 store。`NodeWrapper` 使用 `memo()` + `shallow` 比较。

关键点:
- `useNodesState(initialNodes)` 初始化时将 initialNodes 写入 Zustand store
- 之后 `onNodesChange` 处理拖拽/选择/删除等交互
- `setNodes()` 直接替换 store 中的节点

### 3.2 编辑回滚的根因分析

```
用户编辑节点 "A" → "B"
  → SmartNode.save() → setNodes(label: "B")  ✅ ReactFlow store 更新
  → onSyncUpdate({name: "B"}) → API 调用 (fire-and-forget)

用户按 Enter 创建同级节点
  → createSiblingNode → onAddNode + onReloadSession
  → loadSession() → setSession(apiData)
  → session 变化 → initialNodes useMemo 重算
  → allNodes useMemo 重算
  → 布局 effect 触发 → setNodes(positioned)
  → positioned 来自 session.nodes (API 数据)
  → 如果 API 尚未处理更新 → label 还是 "A" → 回滚! ❌
```

### 3.3 ReactFlow 光标 CSS 类

| 类名 | 默认行为 | 说明 |
|------|---------|------|
| `.react-flow__pane.draggable` | `cursor: grab` | 画布可拖动 |
| `.react-flow__pane.dragging` | `cursor: grabbing` | 画布拖动中 |
| `.react-flow__node.selectable` | `cursor: pointer` | 节点可选中 |
| `.react-flow__node.draggable` | `cursor: grab` | 节点可拖动 |

必须用 `!important` 覆盖。

### 3.4 panOnDrag 行为

| 值 | 行为 |
|----|------|
| `true` (默认) | 左键拖动画布 |
| `false` | 禁止拖动 |
| `[0]` | 左键拖动 |
| `[1]` | **仅中键拖动** (导致用户无法操作) |
| `[2]` | 仅右键拖动 |

### 3.5 selectionOnDrag 行为

| 配置 | 行为 |
|------|------|
| `panOnDrag=true, selectionOnDrag=false` | 左键拖动=平移, Shift+拖动=框选 |
| `panOnDrag=true, selectionOnDrag=true` | Shift+拖动=框选, 普通拖动=平移 |
| `panOnDrag=false, selectionOnDrag=true` | 左键拖动=框选, 无平移 |

### 3.6 键盘事件处理

ReactFlow 全局键盘监听在 `document` 上 (bubble phase)。
`isInputDOMNode()` guard 跳过 input/textarea 中的按键。
需要在 **CAPTURE phase** 注册自定义处理器以优先拦截。

---

## 四、待验证的假设

1. **Merge 策略是否真的解决了编辑回滚?**
   - 理论上: 保留现有 data，只更新 position
   - 风险: `data.label` 的 useEffect 同步可能仍会干扰

2. **onSyncUpdate 的 API 调用是否真的成功?**
   - 未添加 console.error 日志
   - 可能存在网络错误被静默吞掉

3. **useEffect(() => { setEditValue(data.label); }, [data.label]) 是否干扰?**
   - 当 merge 保留现有 data 时，data.label 不变 → effect 不触发
   - 但如果 merge 创建了新的 node 对象 (即使 data 引用相同)...?

4. **是否应该完全禁用 ELK 布局在数据编辑时的重算?**
   - 当前: session 任何变化都触发全量重布局
   - 可能的改进: 只在节点增删时重布局

---

## 五、建议的下一步调试方向

### 方向 A: 添加诊断日志
在 SmartNode.save() 和 onSyncUpdate 中添加 console.log，确认:
1. setNodes 是否真的被调用
2. API 调用是否成功
3. loadSession 是否在不该触发的时候触发

### 方向 B: 完全脱离 session 驱动
当前架构: `session.nodes` → `initialNodes` → `allNodes` → `setNodes`
替代方案: `session.nodes` 只用于初始化，后续操作完全通过 `useReactFlow().setNodes` 管理

### 方向 C: 使用 ReactFlow 的 onNodesChange 处理所有状态
不在 useMemo 中从 session 派生节点，而是:
1. 初始加载时 setNodes(session.nodes)
2. 之后所有变更通过 onNodesChange 处理
3. 只在结构性操作后同步 session (单向: ReactFlow → API → session (仅用于持久化))

### 方向 D: 参考 ReactFlow 官方示例
研究 ReactFlow 官方 editable-nodes 和 controlled-flowing 示例，理解官方推荐的模式。

---

## 六、环境信息

- **ReactFlow 版本**: latest (从 npm 安装)
- **Next.js**: 16.1.7 (Turbopack)
- **elkjs**: elkjs/lib/elk.bundled.js
- **浏览器**: 用户未指定 (假设 Chrome)
- **部署方式**: Vercel (前端) + Docker (后端)
