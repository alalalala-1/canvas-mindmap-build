# Canvas Mindmap Build - 技术说明书

## 1. 浮动节点功能

### 核心概念
- **浮动节点**: 没有入边（没有父节点）的节点，可以有出边（子节点）
- **原父节点**: `originalParent`，记录断开前连接的父节点 ID
- **虚拟边**: 不显示连线，但参与布局计算的父子关系
- **状态来源**: `metadata.floatingNodes`、`node.data`、内存缓存

### 技术实现要点

#### 1.1 服务结构与初始化
- **入口**: `FloatingNodeService.initialize(canvasFilePath, canvas)`
- **动作**: 缓存 `canvas` → 设置 `currentCanvasFilePath` → `stateManager.initializeCache` → `reapplyAllFloatingStyles` → `startEdgeDetection`
- **依赖**: `FloatingNodeStateManager`（状态）、`FloatingNodeStyleManager`（样式）、`EdgeChangeDetector`（边变化检测）

#### 1.2 状态存储与字段
- **metadata**: `canvasData.metadata.floatingNodes[nodeId] = { isFloating, originalParent }`
- **node.data**: `isFloating`、`originalParent`、`floatingTimestamp`
- **内存缓存**: `FloatingNodeStateManager.updateMemoryCache(canvasFilePath, nodeId, data | null)`
- **写入方法**: `markNodeAsFloating(nodeId, originalParentId, canvasFilePath?, subtreeIds = [])`
- **关键约束**: 只标记根节点；`subtreeIds` 仅做传递与日志，不参与状态写入

#### 1.3 浮动节点生成（删边触发）
- **入口**: `EdgeDeletionService.deleteEdge`
- **步骤**:
  - 原子删除边
  - 检查目标节点是否还有其他入边
  - 若无入边：`FloatingNodeService.markNodeAsFloating(childId, parentId, canvasFilePath, subtreeIds)`

#### 1.4 新连线清理与一致性
- **触发**: `CanvasEventManager` 监听 `canvas:edge-create`
- **核心方法**: `FloatingNodeService.handleNewEdge(edge)`
  - 立即清除目标节点红框
  - 只查询内存缓存 `isNodeFloatingFromCache`，避免读取旧文件造成竞态
  - 若目标节点仍标记浮动 → 仅清除内存缓存与 Canvas 内存节点的 `data` 字段
  - 源节点为浮动时仅保持红框，不主动清除
 - **竞态处理经验**:
  - `edge-create` 早于文件落盘，不能在该阶段触发 `requestSave`，否则会覆盖新边导致"连线消失"
  - 样式重放判断入边时优先使用 `fileData.edges`（当文件边数更多时），避免内存边滞后造成红框延迟消失
  - **快速连线处理**: 在 `handleNewEdge` 开始时验证边是否存在于 Canvas，若不存在则等待 100ms 后再处理，防止第二条连线消失

#### 1.5 全量验证与样式重放
- **方法**: `FloatingNodeService.reapplyAllFloatingStyles(canvas)`
- **策略**:
  - 过滤当前 Canvas 中存在的节点
  - 校验入边，区分 `validFloatingNodes / connectedFloatingNodes / invalidFloatingNodes`
  - 对有入边的节点异步清理浮动状态
  - 对不存在的节点清理历史记录
 - 布局后由 `LayoutManager.reapplyFloatingNodeStyles` 再次触发样式重放

#### 1.6 视觉样式实现
- **方法**: `FloatingNodeStyleManager.applyFloatingStyle(nodeId)`
  - class: `cmb-floating-node`
  - inline: `border: 4px solid #ff4444`、`border-radius: 8px`、`box-shadow`、`outline`
  - 强制重绘：读取 `offsetHeight`
  - 找不到 DOM 时 300ms/1000ms 重试
- **清除**: `clearFloatingStyle(nodeId)` 移除 class 与内联样式，失败时 300ms 重试

#### 1.7 边变化检测（轮询）
- **方法**: `EdgeChangeDetector.startDetection(canvas, onNewEdges, { interval: 500, maxChecks: 0 })`
- **去重**: `processedEdgeIds` 防止重复处理
- **ID 生成**: `fromId -> toId` 或 `edge.id`

#### 1.8 并发处理机制
- **标志位**: `isClearingFloating` 防止同时执行多个清除操作
- **队列**: `pendingClearNodes` 存储等待处理的节点
- **等待**: `waitForClearComplete()` 返回 Promise，由 `clearCompleteResolver` 通知完成
- **流程**:
  1. 第二个请求检测到 `isClearingFloating = true`
  2. 将节点加入 `pendingClearNodes` 队列
  3. 调用 `await waitForClearComplete()` 等待
  4. 第一个请求完成后触发 `finally` 块，调用 `clearCompleteResolver()` 通知等待者
  5. 然后处理队列中的待清除节点

### 踩坑记录
1. **不要在布局时过滤浮动节点** - 会导致布局错乱
2. **不要整体平移所有节点** - 会破坏相对位置
3. **边端点格式多样** - 需要统一使用 `getNodeIdFromEdgeEndpoint`
4. **浮动节点定义** - 没有入边（没有父节点）的节点，可以有出边

---

## 2. 节点创建与 fromLink

### 核心概念
- **fromLink**: 记录选中文本在源文件中的起止位置，用于点击节点跳转
- **构建历史**: `canvasMindmapBuildHistory` 用于推断父节点

### 技术实现要点

#### 2.1 添加节点流程
- **入口**: `NodeCreationService.addNodeToCanvas(content, sourceFile)`
- **路径选择**: 优先使用设置 `canvasFilePath`，否则尝试当前打开的 Canvas
- **原子写入**: `CanvasFileService.modifyCanvasDataAtomic`
- **位置计算**: `NodePositionCalculator.calculatePosition(newNode, parentNode, canvasData)`
- **历史记录**: `canvasData.canvasMindmapBuildHistory.push(newNodeId)`
- **父子连线**: `fromSide: "right"`, `toSide: "left"`
- **父节点折叠**: 若父节点已折叠，给新节点写入 `unknownData.collapsedHide = true`

#### 2.2 节点类型与尺寸
- **公式节点**: `enableFormulaDetection && $$...$$ && length > 4`
  - `width = formulaNodeWidth || 600`
  - `height = formulaNodeHeight || 200`
- **图片节点**: `![[...]]` 或 `![...](...)`
  - `type = "file"`, `file = imagePath`
  - `width = imageNodeWidth || 400`
  - `height = imageNodeHeight || 300`
- **文本节点**:
  - `width = textNodeWidth || 250`
  - `height = nodeManager.calculateTextNodeHeight(content)`，无 nodeManager 时回退为 `100`

#### 2.3 fromLink 写入与跳转
- **写入**: `addFromLink(node, sourceFile)` 把 `{ file, from, to }` 写入节点
  - 文本节点：追加 `<!-- fromLink:... -->`
  - 非文本节点：写入 `node.color = "fromLink:..."`
- **跳转**: `CanvasEventManager.handleFromLinkClick`
  - 仅解析文本节点中的 `<!-- fromLink:... -->`
  - 打开目标文件并选中 `from -> to`（延迟 100ms）

#### 2.4 父节点推断策略
1. `plugin.lastClickedNodeId`
2. 当前选中节点（canvas.selection）
3. 构建历史中的最后节点
4. 最近一个含 fromLink 的节点
5. 无入边的根节点

#### 2.5 创建后处理
- 清除折叠缓存
- 触发 `checkAndAddCollapseButtons`
- 300ms 延迟调用 `adjustNodeHeightAfterRender`

---

## 3. 节点高度自动调整

### 核心概念
- **公式节点**: 内容以 `$$` 开头/结尾，使用固定高度
- **文本节点**: 以 DOM 实测优先，无法测量时使用计算估算
- **上限控制**: `textNodeMaxHeight` 限制最大高度

### 技术实现要点

#### 3.1 单节点调整入口
- **方法**: `CanvasNodeManager.adjustNodeHeightAfterRender(nodeId)`
- **策略**: `CanvasFileService.modifyCanvasDataAtomic` 原子写入
- **公式处理**:
  - `enableFormulaDetection && node.text.trim().startsWith('$$') && endsWith('$$')`
  - `height = formulaNodeHeight || 80`
  - `width = formulaNodeWidth || 400`
- **文本处理**:
  - `calculateTextNodeHeight(node.text, nodeEl)`
  - `height = min(calculatedHeight, textNodeMaxHeight || 800)`

#### 3.2 DOM 测量优先级
- **方法**: `calculateTextNodeHeight(content, nodeEl?)`
- **优先级**:
  1. `measureActualContentHeight`（有 DOM）
  2. `calculateTextNodeHeightComputed`（无 DOM）

#### 3.3 DOM 实测细节
- **`.markdown-preview-sizer`**: 读取 `minHeight`，返回 `minHeight + 24`
- **`<p>` 高度**: `getBoundingClientRect` + `lineHeight` + padding + 20
- **`scrollHeight`**: sizer / content 的滚动高度 + padding
- **兜底**: `nodeEl.clientWidth` 参与计算估算

#### 3.4 计算估算参数
- **内容宽度**: `nodeWidth - 40`
- **字体**: `fontSize = 14`
- **行高**: `lineHeight = 26`
- **中文宽度**: `1.15 * fontSize`
- **英文宽度**: `0.6 * fontSize`
- **空行**: 计作 `0.5` 行
- **安全边距**: `44`
- **最小高度**: `60`

#### 3.5 批量调整
- **方法**: `adjustAllTextNodeHeights`
- **流程**:
  - 先构建 `nodeDomMap`
  - 遍历所有文本节点计算高度
  - 对变化节点原子写入并返回调整数量
  - 同步内存节点高度与 DOM 渲染

#### 3.6 新建节点自动调整
- **时机**: 节点创建后延迟 `300ms`
- **调用链**: `NodeCreationService.postNodeCreation` → `canvasManager.adjustNodeHeightAfterRender`

### 踩坑记录
1. **DOM 元素可能不存在** - 需要回退到计算估算
2. **公式节点检测有两套逻辑** - 创建时简化判定，布局时使用正则

---

## 4. 折叠展开与可见性

### 核心概念
- **折叠状态**: 存储在文件 metadata 中，`metadata.collapseState[nodeId]`
- **子节点隐藏**: 通过设置 `display: 'none'` 隐藏 DOM 元素
- **边隐藏**: 同时隐藏与子节点相关的边

### 技术实现要点

#### 4.1 折叠状态存储
```typescript
// 存储在 canvas 文件 metadata 中
if (!canvasData.metadata) canvasData.metadata = {};
if (!canvasData.metadata.collapseState) canvasData.metadata.collapseState = {};
canvasData.metadata.collapseState[nodeId] = true; // 折叠
delete canvasData.metadata.collapseState[nodeId]; // 展开
```

#### 4.2 子节点识别
- **直接子节点**: 从 edges 中查找 `fromNode === parentId` 的边
- **所有后代**: 递归调用 `addAllDescendantsToSet`
- **浮动子节点**: 额外检查 `metadata.floatingNodes`
- **边端点解析**: 使用统一的 `getNodeIdFromEdgeEndpoint` 函数

#### 4.3 自动布局
- **折叠时**: 重新布局可见节点（排除被折叠的子树）
- **展开时**: 恢复子节点位置，可选择重新布局
- **位置保持**: 使用 `originalArrangeLayout` 保持相对位置

#### 4.4 折叠按钮渲染与清理
- **入口**: `CanvasUIManager.checkAndAddCollapseButtons`
- **DOM 映射**: 遍历 `.canvas-node` 并设置 `data-node-id`
- **按钮条件**: 有子节点则添加按钮，无子节点则移除按钮并调用 `markExpanded`
- **刷新时机**: 新增/删除边、节点创建/删除、Canvas 变化、MutationObserver 监听新增节点

### 踩坑记录
1. **必须清除缓存** - 操作后调用 `collapseStateManager.clearCache()`
2. **浮动节点也要处理** - 折叠时要隐藏浮动子节点
3. **边也要隐藏** - 不只是节点，相关的边也要隐藏
4. **不要使用缓存的 getChildNodes** - 边内容变化时返回错误结果

---

## 5. 思维导图布局算法

### 核心概念
- **树形布局**: 从左到右，父节点在左，子节点在右
- **垂直居中**: 子节点围绕父节点垂直居中对齐
- **层级计算**: 根据边的关系计算节点层级

### 技术实现要点

#### 5.1 布局流程
1. **构建图结构**: 从 nodes 和 edges 构建布局图
2. **识别根节点**: 没有父节点的节点（排除浮动节点）
3. **计算子树高度**: 递归计算每个节点的子树总高度
4. **应用绝对位置**: 递归设置每个节点的 x、y 坐标
5. **计算层级 X**: 根据层级计算每层的 X 坐标
6. **布局后高度校正**: 调用 `adjustAllTextNodeHeights`，若返回值大于 0 则二次布局（不再触发高度调整）
7. **位置写回**: arrange 只写回 x、y，避免覆盖真实高度导致中心偏移

#### 5.2 子树高度计算
```typescript
function calculateSubtreeHeight(nodeId: string): number {
    const node = layoutNodes.get(nodeId);
    if (!node) return 0;

    if (node.children.length === 0) {
        node._subtreeHeight = node.height;
        return node.height;
    }

    let childrenTotalHeight = 0;
    for (const childId of node.children) {
        childrenTotalHeight += calculateSubtreeHeight(childId);
    }
    childrenTotalHeight += Math.max(0, node.children.length - 1) * verticalSpacing;

    node._subtreeHeight = Math.max(node.height, childrenTotalHeight);
    return node._subtreeHeight;
}
```

#### 5.3 位置计算
```typescript
// 子节点垂直居中
const idealChildrenStartY = node.y + (node.height / 2) - (childrenTotalHeight / 2);
// 确保不跑到父节点上方
const childrenStartY = Math.max(node.y, idealChildrenStartY);
```

#### 5.4 浮动节点处理
- **不参与根节点识别** - 浮动节点有父节点（原父节点）
- **作为正常子节点布局** - 添加到 children 列表，统一处理
- **不显示连线** - 没有真实的边，只有虚拟边

### 踩坑记录
1. **不要过滤浮动子节点** - 会导致布局错乱
2. **不要整体平移** - 会破坏相对位置
3. **必须处理所有子节点** - 包括浮动节点
4. **X 坐标基于层级** - 不是基于父节点位置

---

## 6. Canvas 事件处理

### 核心概念
- **MutationObserver**: 监听 DOM 变化，自动添加折叠按钮
- **事件委托**: 使用 Obsidian 的事件系统监听 Canvas 事件
- **防抖节流**: 避免频繁操作导致的性能问题

### 技术实现要点

#### 6.1 MutationObserver 使用
```typescript
this.mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
                if (node instanceof HTMLElement) {
                    if (node.classList.contains('canvas-node')) {
                        // 处理新增的节点
                    }
                }
            }
        }
    }
});
```

#### 6.2 Canvas 事件监听
```typescript
this.app.workspace.on('canvas:edge-create', (edge: any) => {
    // 新连线：处理浮动状态与折叠按钮
});

this.app.workspace.on('canvas:edge-delete', (edge: any) => {
    // 删除连线：刷新折叠按钮
});

this.app.workspace.on('canvas:node-create', (node: any) => {
    // 新节点：调整高度
});

this.app.workspace.on('canvas:node-delete', (node: any) => {
    // 删除节点：清理浮动标记
});

this.app.workspace.on('canvas:change', () => {
    // Canvas 变化：刷新折叠按钮
});
```

#### 6.3 防抖处理
```typescript
private clickDebounceMap = new Map<string, number>();

private isDebounced(nodeId: string): boolean {
    const lastClick = this.clickDebounceMap.get(nodeId);
    const now = Date.now();
    if (lastClick && now - lastClick < 300) {
        return true;
    }
    this.clickDebounceMap.set(nodeId, now);
    return false;
}
```

### 踩坑记录
1. **getActiveViewOfType 参数必须是类** - 不能传字符串
2. **MutationObserver 要设置 subtree: true** - 否则监听不到子元素变化
3. **事件监听要在 initialize 中设置** - 确保插件加载完成后设置

---

## 7. 文件操作最佳实践

### 核心概念
- **原子操作**: 读取 -> 修改 -> 写入，确保数据一致性
- **错误处理**: 所有文件操作都要 try-catch
- **缓存策略**: 适当缓存，避免频繁读取

### 技术实现要点

#### 7.1 安全读取
```typescript
const canvasContent = await this.app.vault.read(canvasFile);
let canvasData: any;
try {
    canvasData = JSON.parse(canvasContent);
} catch (parseError) {
    new Notice('Canvas文件格式错误');
    return;
}
```

#### 7.2 安全写入
```typescript
await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
```

#### 7.3 数据更新模式 (原子操作)
```typescript
await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
    // 修改 data
    data.nodes.push(newNode);
    data.edges.push(newEdge);
    return true; // 返回 true 表示数据已更改，需要保存
});
```

### 踩坑记录
1. **必须验证文件存在** - 使用 `instanceof TFile` 检查
2. **JSON 解析要 try-catch** - 防止格式错误导致崩溃
3. **修改后要 requestSave** - 触发 Obsidian 保存机制
4. **优先使用内存数据** - 避免读取可能被覆盖的文件

---

## 8. 调试技巧

### 日志系统
- **单一出口**: `log(...)` 统一输出格式
- **条件输出**: 根据 `settings.enableDebugLogging` 控制
- **输出规范**: 关键日志保持单行，避免大数组与多行内容

### 常用调试代码
```typescript
// 查看所有节点
console.log('Nodes:', Array.from(canvas.nodes.values()));

// 查看所有边
console.log('Edges:', Array.from(canvas.edges.values()));

// 查看选中元素
console.log('Selection:', canvas.selection);

// 查看浮动节点
console.log('Floating nodes:', this.floatingNodeManager.getFloatingNodes());
```

### 性能分析
```typescript
const endTimer = logTime('functionName');
// ... 代码 ...
endTimer();
```

---

## 9. 删除流程（节点与连线）

### 核心概念
- **节点删除**: 提供单节点删除与级联删除两种策略
- **连线删除**: 删除边后检查入边并触发浮动节点标记
- **原子写入**: 所有删除操作通过 `modifyCanvasDataAtomic` 持久化

### 技术实现要点

#### 9.1 节点删除入口与弹窗
- **入口**: `CanvasEventManager.executeDeleteOperation`
- **对话框**: `DeleteConfirmationModal` 返回 `cancel/single/cascade`
- **子节点判断**: `CollapseStateManager.getChildNodes(nodeId, edges)`
- **执行链路**: `handleSingleDelete` / `handleCascadeDelete`

#### 9.2 单节点删除（子节点上移）
```typescript
await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
    data.nodes = data.nodes.filter((n) => n.id !== node.id);
    data.edges = data.edges.filter((e) => {
        const fromId = getEdgeFromNodeId(e);
        const toId = getEdgeToNodeId(e);
        return fromId !== node.id && toId !== node.id;
    });
    data.edges.push(...newEdges);
    return true;
});
```
- **新连线**: `fromSide: "right"`, `toSide: "left"`
- **父节点获取**: `findParentNode` 根据 `edges` 反向查找
- **刷新**: `clearCache` → `checkAndAddCollapseButtons` → `canvas.reload/requestUpdate`

#### 9.3 级联删除（删除子树）
- **收集子树**: 递归 `CollapseStateManager.getChildNodes`
- **删除策略**: 过滤 `nodes` 与 `edges` 中包含 `nodesToDelete` 的项
- **提示**: `Notice` 显示删除数量

#### 9.4 连线删除与浮动节点标记
- **入口**: `EdgeDeletionService.deleteSelectedEdge`
- **边定位**: `canvas.selectedEdge / canvas.selectedEdges / lineGroupEl`
- **删除逻辑**: 过滤 `fromNode/toNode` 匹配的边
- **浮动判定**: 若 `childNodeId` 无其他入边 → `markNodeAsFloating`
- **子树收集**: 构建 `childrenMap` 递归收集 `subtreeIds`

---

## 10. UI 按钮与交互处理

### 核心概念
- **折叠按钮**: 只对有子节点的节点渲染
- **点击拦截**: 捕获删除按钮、折叠按钮与 fromLink
- **DOM 监听**: MutationObserver 监听新增节点

### 技术实现要点

#### 10.1 折叠按钮渲染与更新
- **入口**: `CanvasUIManager.checkAndAddCollapseButtons`
- **DOM 映射**: `document.querySelectorAll('.canvas-node')` → `data-node-id`
- **子节点判断**: `edges.some(fromId === nodeId)`
- **状态更新**: `collapsed/expanded` class 与 `title`

#### 10.2 按钮样式参数
- **触摸检测**: `matchMedia('(pointer: coarse)')`
- **尺寸**: `btnWidth = 24 (触摸) / 20 (鼠标)`，`btnHeight = nodeHeight * 1.3`
- **位置**: `right = -btnWidth`，`top = 0`

#### 10.3 点击拦截与防抖
- **删除按钮识别**: `data-type="trash"` / `.clickable-icon` / svg / aria-label
- **折叠按钮**: 300ms 防抖，调用 `toggleNodeCollapse`
- **fromLink**: 解析 `<!-- fromLink:... -->` 并选区跳转

#### 10.4 DOM 变化监听
```typescript
this.mutationObserver.observe(canvasWrapper, { childList: true, subtree: true });
```
- **触发**: `canvas-wrapper / canvas-node-container / canvas`
- **动作**: 新增 `.canvas-node` 后触发 `checkAndAddCollapseButtons`

---

## 11. 布局数据流与可见性

### 核心概念
- **可见节点**: 排除折叠子树的节点集合
- **数据合并**: 内存节点与文件节点合并，保证文本内容正确
- **浮动验证**: 有入边则清理浮动标记

### 技术实现要点

#### 11.1 可见性计算
- **入口**: `VisibilityService.getVisibleNodeIds`
- **折叠集合**: `CollapseStateManager.getAllCollapsedNodes`
- **后代扩展**: `addAllDescendantsToSet`
- **输出**: 可见节点 `Set`

#### 11.2 布局数据获取
- **入口**: `LayoutDataProvider.getLayoutData(canvas)`
- **来源**: `canvas.nodes / canvas.edges` 与文件数据
- **合并**: `visibleNodes.set(id, { ...node, ...(fileNode || {}) })`
- **输出**: `visibleNodes / edges / originalEdges / canvasData / canvasFilePath`

---

## 12. 设置与生命周期

### 核心概念
- **加载顺序**: `loadSettings` → `updateLoggerConfig` → `canvasManager.initialize`
- **设置验证**: 仅接受合法类型与范围
- **版本迁移**: `migrateSettings` 保证新字段默认值

### 技术实现要点

#### 12.1 插件生命周期
- **入口**: `main.ts onload`
- **命令注册**: `add-to-canvas-mindmap` / `arrange-canvas-mindmap-layout` / `delete-selected-edge` / `adjust-all-text-node-heights`
- **卸载**: `canvasManager.unload()`

#### 12.2 设置面板
- **入口**: `CanvasMindmapBuildSettingTab.display`
- **写入策略**: `onChange` → `saveSettings`
- **文本宽度**: `parseInt(value) || 300`

#### 12.3 验证与迁移
- **验证**: `validateSettings` 过滤非数值与非法颜色
- **迁移**: `migrateFrom100To110` 添加 `collapseButtonColor`
- **版本**: `CURRENT_SETTINGS_VERSION = "1.2.0"`

---

## 13. 常见错误及解决方案

### 13.1 "Right-hand side of 'instanceof' is not an object"
**原因**: `getActiveViewOfType` 传入了字符串而不是类
**解决**: 使用 `getActiveViewOfType(ItemView)` 而不是 `getActiveViewOfType('canvas')`

### 13.2 "Cannot read property 'xxx' of undefined"
**原因**: 访问了未初始化的对象属性
**解决**: 使用可选链操作符 `?.` 或提前检查

### 13.3 布局错乱
**原因**: 浮动节点处理不当，过滤或特殊处理导致
**解决**: 浮动节点作为正常子节点处理，不特殊对待

### 13.4 折叠展开不生效
**原因**: 缓存未清除或浮动节点未处理
**解决**: 调用 `clearCache()`，检查浮动子节点

### 13.5 节点高度不自动调整
**原因**: CanvasManager 未正确注入或 DOM 元素不存在
**解决**: 确保注入实例，做好 DOM 不存在时的回退

### 13.6 浮动节点连接到新父节点后无法折叠
**原因**: 
- 边端点解析不一致
- getChildNodes 缓存导致错误结果
- 浮动状态清除不及时
**解决**:
- 统一使用 getNodeIdFromEdgeEndpoint 解析边
- 移除 getChildNodes 缓存
- 立即清除内存中的浮动标记

---

## 14. 重构注意事项

### 保持兼容性的原则
1. **metadata 双写**: 新旧格式同时写入，读取时优先新格式
2. **函数签名不变**: 公开 API 的签名保持不变
3. **默认值处理**: 确保新代码能处理旧数据

### 测试清单
- [ ] 浮动节点创建和清除
- [ ] 折叠展开功能
- [ ] 新建节点自动调整高度
- [ ] 布局算法（arrange）
- [ ] 边删除和创建
- [ ] 关闭重启后数据持久化
- [ ] 浮动节点连接到新父节点后的折叠展开

### 性能基准
- [ ] 布局 100 个节点 < 100ms
- [ ] DOM 操作不导致明显卡顿
- [ ] 文件读取次数最小化

---

## 15. 关键代码片段

### 15.1 安全获取 Canvas 文件路径
```typescript
getCurrentCanvasFilePath(): string | undefined {
    // 方法1: activeLeaf
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf?.view?.getViewType() === 'canvas') {
        const canvas = activeLeaf.view.canvas;
        if (canvas?.file?.path) return canvas.file.path;
        if (activeLeaf.view.file?.path) return activeLeaf.view.file.path;
    }
    
    // 方法2: getActiveViewOfType
    const activeView = this.app.workspace.getActiveViewOfType(ItemView);
    if (activeView?.getViewType() === 'canvas') {
        const canvas = (activeView as any).canvas;
        if (canvas?.file?.path) return canvas.file.path;
        if ((activeView as any).file?.path) return (activeView as any).file.path;
    }
    
    // 方法3: getLeavesOfType
    const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
    for (const leaf of canvasLeaves) {
        if (leaf.view?.getViewType() === 'canvas') {
            const canvas = (leaf.view as any).canvas;
            if (canvas?.file?.path) return canvas.file.path;
            if ((leaf.view as any).file?.path) return (leaf.view as any).file.path;
        }
    }
    
    return undefined;
}
```

### 15.2 从边获取节点 ID
```typescript
getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
    if (endpoint.node?.id) return endpoint.node.id;
    return null;
}
```

### 15.3 防抖函数
```typescript
private debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: number | null = null;
    return (...args: Parameters<T>) => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}
```

---

*最后更新: 2026-02-11*
*版本: 1.2.0*
