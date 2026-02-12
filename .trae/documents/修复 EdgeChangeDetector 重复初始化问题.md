## 问题分析

日志显示同一条边被检测多次，且 `lastEdgeIds` 被重置：

```
- [EdgeChangeDetector] 上次边数量: 4, 当前边数量: 5 
...
- [EdgeChangeDetector] 上次边数量: 4, 当前边数量: 5 
```

## 根本原因

`initialize` 方法的跳过条件有问题：

```typescript
if (this.currentCanvasFilePath === canvasFilePath && this.edgeDetector['edgeChangeInterval']) {
```

这个条件要求 `edgeChangeInterval` 存在才会跳过。如果检测器被停止了（`edgeChangeInterval` 为 null），即使 `currentCanvasFilePath` 相同，也会重新初始化，导致 `startDetection` 被调用，`lastEdgeIds` 被重置。

## 修复方案

修改 `initialize` 方法的跳过条件，只检查 `currentCanvasFilePath`：

```typescript
if (this.currentCanvasFilePath === canvasFilePath) {
    info(`[FloatingNodeService] 已经在 ${canvasFilePath} 上初始化，跳过`);
    return;
}
```

这样可以确保同一个 Canvas 不会被初始化多次。

## 修改文件

**文件**: `src/canvas/services/floating-node-service.ts`
**位置**: 第 35 行

**当前代码**:

```typescript
if (this.currentCanvasFilePath === canvasFilePath && this.edgeDetector['edgeChangeInterval']) {
```

**修改后**:

```typescript
if (this.currentCanvasFilePath === canvasFilePath) {
```

