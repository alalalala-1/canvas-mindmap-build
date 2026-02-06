# Canvas Mindmap Build - 技术实现经验总结

## 1. 浮动节点功能

### 核心概念
- **浮动节点**: 删除边后，原父子关系断开的节点树
- **虚拟边**: 不显示连线，但参与布局计算的父子关系
- **原父节点**: 浮动节点断开前连接的父节点

### 技术实现要点

#### 1.1 浮动节点识别
```typescript
// 从两个来源读取浮动节点信息
// 1. metadata.floatingNodes（向后兼容）
// 2. node.data.isFloating（主要方式）

// 关键代码逻辑
if (canvasData?.metadata?.floatingNodes) {
    for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
        // 兼容旧格式（boolean）和新格式（object）
        if (typeof info === 'boolean' && info === true) {
            floatingNodes.add(nodeId);
        } else if (typeof info === 'object' && info !== null) {
            if (nodeInfo.isFloating) {
                floatingNodes.add(nodeId);
                if (nodeInfo.originalParent) {
                    originalParents.set(nodeId, nodeInfo.originalParent);
                }
            }
        }
    }
}
```

#### 1.2 持久化存储
- **metadata 方式**: `canvasData.metadata.floatingNodes[nodeId]`
- **node.data 方式**: `node.data.isFloating`（推荐，更可靠）
- **双写策略**: 同时写入两个位置，读取时优先使用 node.data

#### 1.3 布局处理
- **关键原则**: 浮动节点作为正常子节点参与布局，不做特殊处理
- **虚拟边创建**: 将浮动节点添加到原父节点的 `children` 列表中
- **布局算法**: 所有子节点（包括浮动）统一处理，不区分类型

#### 1.4 折叠展开支持
- **问题**: `addAllDescendantsToSet` 只从 edges 中查找子节点
- **解决**: 额外检查浮动节点，将原父节点为当前节点的浮动子节点添加到集合

#### 1.5 清除浮动状态
- **时机**: 检测到新边连接到浮动节点时（通过 `edge-add` 或 `canvas:edge-created` 事件）
- **立即清除**: 立即更新内存中的 `node.data.isFloating = false`，并调用 `canvas.requestSave()`
- **视觉响应**: 立即调用 `styleManager.clearFloatingStyle` 移除红框
- **验证机制**: 在布局计算（arrange）时同步验证，若发现节点已有入边则自动强制清除浮动状态

#### 1.6 视觉样式管理 (FloatingNodeStyleManager)
- **挑战**: Obsidian 的 Canvas 采用虚拟列表和重绘机制，普通 DOM 操作添加的样式类极易丢失。
- **对策**:
  - **MutationObserver**: 实时监听 Canvas 容器，一旦节点 DOM 重新进入视图，立即重新补上样式类。
  - **延迟重试**: 应用样式时若 DOM 尚未生成，启动 300ms/1000ms 阶梯式重试。
  - **内联兜底**: 除了样式类，额外注入内联样式并使用 `!important`，防止被主题样式覆盖。
  - **强制重绘**: 通过访问 `offsetHeight` 触发浏览器重排，确保视觉变更立即可见。

### 踩坑记录
1. **不要在布局时过滤浮动节点** - 会导致布局错乱
2. **不要整体平移所有节点** - 会破坏相对位置
3. **必须传递 canvasData 参数** - 否则折叠展开时无法识别浮动节点
4. **getActiveViewOfType 参数必须是类** - 不能传字符串 'canvas'
5. **边端点格式多样** - 需要统一使用 getNodeIdFromEdgeEndpoint 解析
6. **getChildNodes 不要使用缓存** - 边内容变化但数量相同时会返回错误结果
7. **浮动节点定义** - 没有入边（没有父节点）的节点，可以有出边（子节点）

---

## 2. 节点高度自动调整

### 核心概念
- **公式节点**: 内容以 $$ 开头和结尾，使用固定高度
- **文本节点**: 根据内容长度动态计算高度
- **DOM 测量**: 优先使用实际渲染的 DOM 元素测量高度

### 技术实现要点

#### 2.1 高度计算策略
```typescript
// 优先级：DOM 测量 > 计算估算
if (nodeEl) {
    const measuredHeight = this.measureActualContentHeight(nodeEl, text);
    if (measuredHeight > 0) return measuredHeight;
}
return this.calculateTextNodeHeightComputed(text, width);
```

#### 2.2 DOM 测量方法
- **sizer min-height**: 检查 `.markdown-preview-sizer` 的 minHeight 样式
- **段落高度**: 测量 `<p>` 元素的 bounding rect
- **scrollHeight**: 使用元素的 scrollHeight 属性
- **padding 补偿**: 加上上下 padding 和额外边距

#### 2.3 计算估算方法
- **中文字符**: 每个字符宽度 1.15 × 字体大小
- **英文字符**: 每个字符宽度 0.6 × 字体大小
- **行高**: 26px（固定）
- **边距**: 44px（上下 padding + 额外边距）

#### 2.4 新建节点自动调整
- **时机**: 节点创建后延迟 200ms
- **依赖注入**: CanvasManager 注入到 CanvasNodeManager
- **调用链**: `addNodeToCanvas` -> `canvasManager.adjustNodeHeightAfterRender`

### 踩坑记录
1. **必须注入 CanvasManager 实例** - 不能通过 canvasView.plugin 获取
2. **DOM 元素可能不存在** - 需要做好回退到计算方式的准备
3. **公式检测正则要考虑 fromLink 注释** - `$$...$$<!-- fromLink:... -->`

---

## 3. 折叠展开功能

### 核心概念
- **折叠状态**: 存储在文件 metadata 中，`metadata.collapseState[nodeId]`
- **子节点隐藏**: 通过设置 `display: 'none'` 隐藏 DOM 元素
- **边隐藏**: 同时隐藏与子节点相关的边

### 技术实现要点

#### 3.1 折叠状态存储
```typescript
// 存储在 canvas 文件 metadata 中
if (!canvasData.metadata) canvasData.metadata = {};
if (!canvasData.metadata.collapseState) canvasData.metadata.collapseState = {};
canvasData.metadata.collapseState[nodeId] = true; // 折叠
delete canvasData.metadata.collapseState[nodeId]; // 展开
```

#### 3.2 子节点识别
- **直接子节点**: 从 edges 中查找 `fromNode === parentId` 的边
- **所有后代**: 递归调用 `addAllDescendantsToSet`
- **浮动子节点**: 额外检查 `metadata.floatingNodes`
- **边端点解析**: 使用统一的 `getNodeIdFromEdgeEndpoint` 函数

#### 3.3 自动布局
- **折叠时**: 重新布局可见节点（排除被折叠的子树）
- **展开时**: 恢复子节点位置，可选择重新布局
- **位置保持**: 使用 `originalArrangeLayout` 保持相对位置

### 踩坑记录
1. **必须清除缓存** - 操作后调用 `collapseStateManager.clearCache()`
2. **浮动节点也要处理** - 折叠时要隐藏浮动子节点
3. **边也要隐藏** - 不只是节点，相关的边也要隐藏
4. **不要使用缓存的 getChildNodes** - 边内容变化时返回错误结果

---

## 4. 思维导图布局算法

### 核心概念
- **树形布局**: 从左到右，父节点在左，子节点在右
- **垂直居中**: 子节点围绕父节点垂直居中对齐
- **层级计算**: 根据边的关系计算节点层级

### 技术实现要点

#### 4.1 布局流程
1. **构建图结构**: 从 nodes 和 edges 构建布局图
2. **识别根节点**: 没有父节点的节点（排除浮动节点）
3. **计算子树高度**: 递归计算每个节点的子树总高度
4. **应用绝对位置**: 递归设置每个节点的 x、y 坐标
5. **计算层级 X**: 根据层级计算每层的 X 坐标

#### 4.2 子树高度计算
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

#### 4.3 位置计算
```typescript
// 子节点垂直居中
const idealChildrenStartY = node.y + (node.height / 2) - (childrenTotalHeight / 2);
// 确保不跑到父节点上方
const childrenStartY = Math.max(node.y, idealChildrenStartY);
```

#### 4.4 浮动节点处理
- **不参与根节点识别** - 浮动节点有父节点（原父节点）
- **作为正常子节点布局** - 添加到 children 列表，统一处理
- **不显示连线** - 没有真实的边，只有虚拟边

### 踩坑记录
1. **不要过滤浮动子节点** - 会导致布局错乱
2. **不要整体平移** - 会破坏相对位置
3. **必须处理所有子节点** - 包括浮动节点
4. **X 坐标基于层级** - 不是基于父节点位置

---

## 5. Canvas 事件处理

### 核心概念
- **MutationObserver**: 监听 DOM 变化，自动添加折叠按钮
- **事件委托**: 使用 Obsidian 的事件系统监听 Canvas 事件
- **防抖节流**: 避免频繁操作导致的性能问题

### 技术实现要点

#### 5.1 MutationObserver 使用
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

#### 5.2 Canvas 事件监听
```typescript
// 监听边创建事件
this.app.workspace.on('canvas:edge-created', (canvas: any, edge: any) => {
    // 处理新边
});
```

#### 5.3 防抖处理
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

## 6. 文件操作最佳实践

### 核心概念
- **原子操作**: 读取 -> 修改 -> 写入，确保数据一致性
- **错误处理**: 所有文件操作都要 try-catch
- **缓存策略**: 适当缓存，避免频繁读取

### 技术实现要点

#### 6.1 安全读取
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

#### 6.2 安全写入
```typescript
await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
```

#### 6.3 数据更新模式 (原子操作)
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

## 7. 调试技巧

### 日志系统
- **分级日志**: debug、info、warn、error
- **条件输出**: 根据 settings.enableDebugLogging 控制
- **性能计时**: 使用 `logTime` 函数测量函数执行时间

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

## 8. 常见错误及解决方案

### 8.1 "Right-hand side of 'instanceof' is not an object"
**原因**: `getActiveViewOfType` 传入了字符串而不是类
**解决**: 使用 `getActiveViewOfType(ItemView)` 而不是 `getActiveViewOfType('canvas')`

### 8.2 "Cannot read property 'xxx' of undefined"
**原因**: 访问了未初始化的对象属性
**解决**: 使用可选链操作符 `?.` 或提前检查

### 8.3 布局错乱
**原因**: 浮动节点处理不当，过滤或特殊处理导致
**解决**: 浮动节点作为正常子节点处理，不特殊对待

### 8.4 折叠展开不生效
**原因**: 缓存未清除或浮动节点未处理
**解决**: 调用 `clearCache()`，检查浮动子节点

### 8.5 节点高度不自动调整
**原因**: CanvasManager 未正确注入或 DOM 元素不存在
**解决**: 确保注入实例，做好 DOM 不存在时的回退

### 8.6 浮动节点连接到新父节点后无法折叠
**原因**: 
- 边端点解析不一致
- getChildNodes 缓存导致错误结果
- 浮动状态清除不及时
**解决**:
- 统一使用 getNodeIdFromEdgeEndpoint 解析边
- 移除 getChildNodes 缓存
- 立即清除内存中的浮动标记

---

## 9. 重构注意事项

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

## 10. 关键代码片段

### 10.1 安全获取 Canvas 文件路径
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

### 10.2 从边获取节点 ID
```typescript
getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
    if (endpoint.node?.id) return endpoint.node.id;
    return null;
}
```

### 10.3 防抖函数
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

*最后更新: 2026-02-06*
*版本: 1.2.0*
