# 修复进度追踪

## 任务概述
修复 Obsidian Canvas 插件中"放大后错连恢复正常"的问题，指向渲染几何/刷新时机问题。

## 执行阶段 - 全部完成 ✅

### 阶段A：可判责日志
- [x] A1. 边几何一致性日志 - `logEdgeGeometryDiagnostics` 
- [x] A2. 监听器防重日志 - workspaceEventsRegistered, setupTokenCounter

### 阶段B：防重复事件注册
- [x] B1. 让工作区事件只注册一次 - 幂等化 registerCanvasWorkspaceEvents

### 阶段C：修"布局后边未重算几何"
- [x] C1. 布局完成后双阶段刷新边 - 双轮 edge.render() + 在 performArrange 中调用
- [x] C2. 修 moveAndResize 尺寸来源链 - 防 0 宽高

### 阶段D：修"边同步只增不改"
- [x] D1. mergeMemoryEdgesIntoFileData 改为 upsert - 支持更新已有边的端点

### 阶段E：并发与时序收口
- [x] E1. 给 performArrange 加互斥锁 - isArranging + pendingArrange

---

## 修改的文件

1. **src/canvas/layout-manager.ts**
   - 添加 `logEdgeGeometryDiagnostics()` 方法 - 边几何一致性诊断
   - 添加 `getSafeNodeSize()` 方法 - 安全的尺寸获取防 0 宽高
   - 添加 `refreshEdgeGeometry()` 方法 - 双阶段边刷新
   - 修改 `updateNodePositions()` - 使用安全尺寸
   - 修改 `mergeMemoryEdgesIntoFileData()` - 支持 upsert 更新
   - 修改 `performArrange()` - 添加互斥锁 + 调用边刷新

2. **src/canvas/canvas-event-manager.ts**
   - 添加防重日志字段：workspaceEventsRegistered, workspaceEventsPath, setupTokenCounter, isSettingUp, lastSetupPath, setupCallCount
   - 修改 `setupCanvasEventListeners()` - 幂等化防止重复注册

---

## 修复历史
- 2025-03-02: 完成所有5个阶段的修复
