# Canvas Mindmap Build - 问题分析与技术解决方案

## 问题描述

分别连线到两个浮动 node 上，连线到第一个浮动 node，红框没消失之前，连接第二个浮动 node 时，线要连两次，因为第一次线要消失，第二次连线才能保留线。

## 问题分析

### 问题根源：并发文件保存冲突

当快速连接第二个浮动节点时，两个保存操作同时发生：

1. Obsidian 正在保存**第二个新边**到文件
2. 同时，我们的插件正在尝试**清除第一个节点的浮动状态**，也在修改并保存文件

### 完整的问题时间线

```
1. 用户连接第二个边
   ↓
2. Obsidian 开始保存第二个边 → canvas.requestSave()
   ↓
3. handleCanvasFileModified 被触发（检测到文件变更）
   ↓
4. handleNewEdge 被调用
   ↓
5. executeClearFloating 被调用
   ↓
6. clearFloatingCanvasData 被调用 → 也修改 canvas 内存数据 → 也调用 canvas.requestSave()
   ↓
7. **冲突！**两个保存操作同时发生！
   ↓
8. 结果：第二个边被覆盖了！
```

### 导致问题的多层原因

**第一层问题**：立即持久化
- 来自 handleCanvasFileModified 时，立即持久化到文件

**第二层问题**：调用 requestSave
- 即使不持久化到文件，仍然调用 canvas.requestSave()

**第三层问题（核心问题）**：修改 canvas node.data
- 即使不调用 requestSave()，修改了 canvas 内存中的 node.data 也可能触发 Obsidian 的自动保存机制！

## 完整解决方案

### 解决方案概述

采用**延迟持久化 + 完全隔离**策略：

1. **立即处理**（不碰文件）：
   - 更新内存缓存
   - 清除视觉样式
   - **完全不修改 canvas 内存数据**
   - **完全不调用 canvas.requestSave()**

2. **延迟持久化**（等 Obsidian 保存完）：
   - 2秒后执行持久化
   - Obsidian 早就保存完新边了
   - 一起持久化多个节点的清除操作

3. **安全保障**：
   - cleanup 时立即执行待持久化操作
   - 保证数据不会丢失

### 代码实现关键点

#### 1. handleNewEdge 方法

```typescript
// 关键：来自 handleCanvasFileModified 时，不进行持久化操作
if (persistToFile) {
    log(`[FloatingNode] 关键：来自 handleCanvasFileModified，跳过文件持久化，避免并发保存冲突`);
    shouldPersistToFile = false;
}
```

#### 2. executeClearFloating 方法

```typescript
if (persistToFile) {
    // 持久化时的逻辑
} else {
    // 关键修复：不持久化时，不修改 canvas 内存中的 node.data，完全不与 Obsidian 的保存操作冲突
    log(`[FloatingNode] 不持久化时，跳过修改 canvas 内存中的 node.data`);
    this.clearFloatingCanvasData(nodesToClear, false, 0, false);
}
```

#### 3. clearFloatingCanvasData 方法

```typescript
// 新增 modifyCanvasData 参数
private clearFloatingCanvasData(
    nodeIds: string[], 
    requestSave: boolean = true, 
    delay: number = 0, 
    modifyCanvasData: boolean = true
): void {
    if (!this.canvas) return;
    if (modifyCanvasData) {
        // 只有在需要时才修改 canvas 内存数据
        for (const id of nodeIds) {
            const node = this.getNodeFromCanvas(id);
            if (node?.data) {
                delete node.data.isFloating;
                delete node.data.originalParent;
                delete node.data.floatingTimestamp;
                delete node.data.isSubtreeNode;
            }
        }
    }
    // ...
}
```

#### 4. scheduleDelayedPersist 方法

```typescript
private scheduleDelayedPersist(nodeId: string): void {
    this.pendingPersistNodeIds.add(nodeId);
    
    // 清除之前的 timeout，重置计时器
    if (this.delayedPersistTimeout) {
        clearTimeout(this.delayedPersistTimeout);
    }
    
    // 延迟 2 秒后执行持久化
    this.delayedPersistTimeout = window.setTimeout(async () => {
        const nodesToPersist = Array.from(this.pendingPersistNodeIds);
        this.pendingPersistNodeIds.clear();
        this.delayedPersistTimeout = null;
        
        for (const id of nodesToPersist) {
            await this.persistClearFloatingState(id, false);
            // 延迟持久化时，也同时更新 canvas 内存中的 node.data
            this.clearFloatingCanvasData([id], false, 0, true);
        }
    }, 2000);
}
```

#### 5. cleanup 方法

```typescript
async cleanup(): Promise<void> {
    // 立即执行待持久化的操作
    if (this.pendingPersistNodeIds.size > 0) {
        if (this.delayedPersistTimeout) {
            clearTimeout(this.delayedPersistTimeout);
            this.delayedPersistTimeout = null;
        }
        
        const nodesToPersist = Array.from(this.pendingPersistNodeIds);
        this.pendingPersistNodeIds.clear();
        
        for (const id of nodesToPersist) {
            await this.persistClearFloatingState(id, false);
        }
    }
    
    this.currentCanvasFilePath = null;
}
```

## 技术要点总结

### 1. 防止重复处理
- `processedEdgeIds` Set：防止同一个边被重复处理
- 3秒后自动清理缓存

### 2. 防止冲突的核心原则
- **完全隔离**：当 Obsidian 在保存文件时，我们**完全不碰**任何与文件保存相关的操作
- **只碰内存**：只更新内存缓存和样式，不修改 canvas 内存数据
- **延迟处理**：等 Obsidian 保存完后，再进行持久化操作

### 3. 安全保障
- cleanup 时立即执行待持久化操作
- 防止数据丢失

## 测试验证

### 测试场景 1：快速连接两个节点
1. 确保有两个浮动节点
2. 快速连接第一个节点
3. 在红框消失前（2秒内）快速连接第二个节点
4. 验证：两个边都应该保留，不需要连接第二次

### 测试场景 2：延迟连接两个节点
1. 确保有两个浮动节点
2. 连接第一个节点
3. 等待超过 2 秒
4. 连接第二个节点
5. 验证：两个边都应该保留

### 测试场景 3：退出前持久化
1. 连接一个浮动节点
2. 在 2 秒内关闭 Canvas 或退出 Obsidian
3. 重新打开
4. 验证：浮动状态标记应该已经被清除

## 相关文件

- `/src/canvas/services/floating-node-service.ts` - 主要修复文件
- `/src/canvas/canvas-manager.ts` - 相关修改
- `/src/canvas/canvas-event-manager.ts` - 相关修改

## 经验总结

1. **并发冲突是隐蔽的**：不要假设 Obsidian 的保存操作和我们的操作会按顺序执行
2. **完全隔离是最安全的**：当检测到可能的冲突时，完全放弃相关操作，延后处理
3. **用户体验重要，数据安全更重要**：宁愿延迟一点，也不能丢失用户数据
4. **完整的 log 是调试的关键**：没有详细的 log，很难找到这样隐蔽的问题
