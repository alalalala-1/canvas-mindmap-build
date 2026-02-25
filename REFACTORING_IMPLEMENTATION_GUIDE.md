# Canvas Mindmap Build - 重构实施指南（详细版）

> 配套文件: REFACTORING_PLAN.md（高层概述）
> 本文件: 逐步骤、逐文件的详细实施指南
> 目标读者: 中等水平程序员可独立完成所有修改

---

## 执行前总原则（必须先读）

为确保“中等水平程序员也能 100% 正确执行”，所有步骤统一按以下门禁执行：

1. **每次只改一个小点**（不要跨 3-4 个文件一次性大改）
2. 每个小点完成后立即执行：
   - `npm run build`
   - `npm test`（若本次修改可能影响现有测试）
3. 通过后再做最小手测（至少覆盖：布局、折叠、删边、高度调整）
4. 通过后再进入下一小步

推荐命令模板：

```bash
# 每步修改后都执行
npm run build && npm test
```

> 说明：本指南后续所有“删除/拆分/迁移”步骤均以“先验证引用、再修改、再验证”为前提。

---

## 阶段零：清理死代码（~40分钟）

<!-- 步骤 0.1 ~ 0.7 详细说明将在下方逐步填充 -->

### 步骤 0.1: 删除死代码文件

**操作目标**: 删除 3 个“候选死代码”文件，但必须先通过门禁验证。

#### 0.1.a 删除前引用核查（必须）

```bash
grep -rn "canvas-data-extractor" src/ --include="*.ts"
grep -rn "function-tracer" src/ --include="*.ts"
grep -rn "safeJsonParse" src/ --include="*.ts"
```

预期：仅命中被删文件自身（或 0 命中）。如果被业务代码引用，**暂停删除**。

#### 0.1.b 删除前基线校验（必须）

```bash
npm run build
npm test
```

确保当前主干本身是可构建、可测试状态，避免把旧问题误判成删除引入的问题。

#### 0.1.c 执行删除

```bash
rm src/utils/canvas-data-extractor.ts
rm src/utils/function-tracer.ts
rm src/utils/json-utils.ts
```

#### 0.1.d 删除后二次验证（必须）

```bash
npm run build
npm test
grep -rn "canvas-data-extractor\|function-tracer\|safeJsonParse" src/ --include="*.ts"
```

如果任何校验失败，优先回滚本步并定位真实依赖，再决定是否保留文件。

---

### 步骤 0.2: 统一 NodeTypeService 公式检测

**文件**: `src/canvas/services/node-type-service.ts`

**问题**: `isFormula()` 和 `isFormulaContent()` 逻辑不一致。`isFormula()` 不支持 `<!-- fromLink:... -->` 后缀。

**修改方案**: 让 `isFormula()` 委托给 `isFormulaContent()`，保持统一。

**修改前**:
```typescript
isFormula(content: string): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return this.settings.enableFormulaDetection &&
        trimmed.startsWith('$$') &&
        trimmed.endsWith('$$') &&
        trimmed.length > 4;
}
```

**修改后**:
```typescript
isFormula(content: string): boolean {
    if (!content) return false;
    if (!this.settings.enableFormulaDetection) return false;
    return isFormulaContent(content);
}
```

**注意**: `isFormulaContent` 已经在文件顶部通过 `import { isFormulaContent, isImageContent } from '../../utils/canvas-utils';` 引入了，无需新增 import。

---

### 步骤 0.3: 移除 NodeDeletionService 重复方法

**文件**: `src/canvas/services/node-deletion-service.ts`

**问题**: `executeDeleteOperation()` 方法与 `CanvasEventManager.executeDeleteOperation()` 重复。

**验证是否被引用**: 在项目中搜索 `nodeDeletionService.executeDeleteOperation` 或 `NodeDeletionService.*executeDelete`：

```bash
grep -rn "executeDeleteOperation" src/ --include="*.ts" | grep -v "node-deletion-service.ts"
```

如果只在 `canvas-event-manager.ts` 中出现（且那里是自己的 `executeDeleteOperation`），则说明 `NodeDeletionService.executeDeleteOperation` 确实没有外部调用。

**修改**: 删除 `node-deletion-service.ts` 中的 `executeDeleteOperation` 方法（约 15 行），同时删除该方法引用的 `import { DeleteConfirmationModal }` 如果只有这个方法在用它。

删除以下代码块：
```typescript
async executeDeleteOperation(selectedNode: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
    log(`[UI] 删除节点: ${selectedNode.id}`);
    const edges = this.getEdgesFromCanvas(canvas);
    const nodeId = selectedNode.id!;
    const hasChildren = this.collapseStateManager.getChildNodes(nodeId, edges).length > 0;

    const modal = new DeleteConfirmationModal(this.app, hasChildren);
    modal.open();
    const result = await modal.waitForResult();

    if (result.action === 'cancel') return;

    if (result.action === 'confirm' || result.action === 'single') {
        await this.handleSingleDelete(selectedNode, canvas);
    } else if (result.action === 'cascade') {
        await this.handleCascadeDelete(selectedNode, canvas);
    }
}
```

然后检查 `import { DeleteConfirmationModal }` 是否还有别处使用，若无则一并删除该 import 行。

---

### 步骤 0.4: 修复 obsidian-extensions.d.ts 导入路径

**文件**: `src/types/obsidian-extensions.d.ts`

**修改前**:
```typescript
import { CanvasNodeLike, CanvasEdgeLike } from './canvas/types';
```

**修改后**:
```typescript
import { CanvasNodeLike, CanvasEdgeLike } from '../canvas/types';
```

**说明**: 该文件位于 `src/types/` 目录下，引用的 `types.ts` 位于 `src/canvas/types.ts`，所以相对路径应该是 `../canvas/types` 而不是 `./canvas/types`。

---

### 步骤 0.5: 验证编译

```bash
npm run build
```

应该零错误。如果有错误：
1. 检查是否有其他文件 import 了被删除的死代码文件
2. 检查 `obsidian-extensions.d.ts` 路径修改是否正确
3. 检查 `NodeTypeService.isFormula()` 修改后的行为是否正确

---

## 阶段一：核心重构（~4-5小时）

### 步骤 1.1: 提取统一签名函数

**目标**: 将“多处”重复的签名计算函数统一到 `src/utils/height-utils.ts`（以当前代码搜索结果为准，不写死数量）。

**第零步：先定位所有重复实现（必须）**

```bash
grep -rn "generateTextSignature\|buildTextSignature\|generateContentSignature" src/ --include="*.ts"
```

先记录命中的函数和文件，再开始迁移，避免漏改。

**第一步: 创建 `src/utils/height-utils.ts`**

新建文件，写入以下内容：

```typescript
/**
 * 生成文本内容签名（用于检测内容是否变化）
 * @param content 文本内容
 * @param width 节点宽度
 * @returns 签名字符串，格式: "长度:哈希:宽度"
 */
export function generateTextSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}
```

**第二步: 修改 `src/canvas/canvas-node-manager.ts`**

(a) 在文件顶部添加 import:
```typescript
import { generateTextSignature } from '../utils/height-utils';
```

(b) 在 `adjustAllTextNodeHeights()` 方法中，删除局部函数定义：
```typescript
// 删除这段代码（约第160-166行）
const getTextSignature = (content: string, width: number): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
};
```

(c) 将该方法中所有 `getTextSignature(` 调用替换为 `generateTextSignature(`。
使用搜索替换: `getTextSignature(` → `generateTextSignature(`

(d) 删除类底部的私有方法 `generateTextSignature`:
```typescript
// 删除这段代码
private generateTextSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}
```

(e) 将 `measureAndPersistTrustedHeight()` 中的 `this.generateTextSignature(` 替换为 `generateTextSignature(`。

**第三步: 修改 `src/canvas/services/layout-data-provider.ts`**

(a) 在文件顶部添加 import:
```typescript
import { generateTextSignature } from '../../utils/height-utils';
```

(b) 删除类中的私有方法 `buildTextSignature`:
```typescript
// 删除这段代码
private buildTextSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}
```

(c) 将所有 `this.buildTextSignature(` 替换为 `generateTextSignature(`。

**第四步: 修改 `src/canvas/services/node-height-service.ts`**

(a) 在文件顶部添加 import:
```typescript
import { generateTextSignature } from '../../utils/height-utils';
```

(b) 删除类中的私有方法 `generateContentSignature`:
```typescript
// 删除这段代码
private generateContentSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}
```

(c) 将所有 `this.generateContentSignature(` 替换为 `generateTextSignature(`。

**验证**: `npm run build` 通过。

---

### 步骤 1.2: 修复 CanvasFileService 重复实例化

**目标**: 消除 `CanvasEventManager` 和 `FloatingNodeService` 中重复创建的 `CanvasFileService` 实例。

**第一步: 修改 `src/canvas/canvas-event-manager.ts`**

(a) 修改构造函数签名，增加 `canvasFileService` 参数:

**修改前**:
```typescript
constructor(
    plugin: Plugin,
    app: App,
    settings: CanvasMindmapBuildSettings,
    collapseStateManager: CollapseStateManager,
    canvasManager: CanvasManager
) {
    this.plugin = plugin;
    this.app = app;
    this.settings = settings;
    this.collapseStateManager = collapseStateManager;
    this.canvasManager = canvasManager;
    this.floatingNodeService = canvasManager.getFloatingNodeService();
    this.canvasFileService = new CanvasFileService(app, settings); // ← 删除此行
}
```

**修改后**:
```typescript
constructor(
    plugin: Plugin,
    app: App,
    settings: CanvasMindmapBuildSettings,
    collapseStateManager: CollapseStateManager,
    canvasManager: CanvasManager,
    canvasFileService: CanvasFileService  // ← 新增参数
) {
    this.plugin = plugin;
    this.app = app;
    this.settings = settings;
    this.collapseStateManager = collapseStateManager;
    this.canvasManager = canvasManager;
    this.floatingNodeService = canvasManager.getFloatingNodeService();
    this.canvasFileService = canvasFileService;  // ← 使用注入的实例
}
```

(b) 确认无需修改 import（`CanvasFileService` 已有 import）。

**第二步: 修改 `src/canvas/canvas-manager.ts`**

修改 `CanvasEventManager` 的构造调用，传入 `this.canvasFileService`:

**修改前**:
```typescript
this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this);
```

**修改后**:
```typescript
this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this, this.canvasFileService);
```

**第三步（可选）: 修改 `src/canvas/services/floating-node-service.ts`**

同样可以将 `FloatingNodeService` 的构造函数改为接收外部注入的 `CanvasFileService`：

**修改前**:
```typescript
constructor(app: App, settings: CanvasMindmapBuildSettings) {
    this.canvasFileService = new CanvasFileService(app, settings);
    // ...
}
```

**修改后**:
```typescript
constructor(app: App, settings: CanvasMindmapBuildSettings, canvasFileService?: CanvasFileService) {
    this.canvasFileService = canvasFileService || new CanvasFileService(app, settings);
    // ...
}
```

然后在 `canvas-manager.ts` 中传入实例:
```typescript
this.floatingNodeService = new FloatingNodeService(app, settings, this.canvasFileService);
```

**验证**: `npm run build` 通过。

---

### 步骤 1.3: 清理未使用的严格类型定义

**目标**: 移除 `types.ts` 中未使用的严格类型和 `canvas-utils.ts` 中的冗余局部类型。

**第一步: 确认哪些严格类型仍被引用**

```bash
grep -rn "import.*{ Canvas " src/ --include="*.ts"
grep -rn "import.*CanvasNode[^L]" src/ --include="*.ts"
grep -rn "import.*CanvasEdge[^L]" src/ --include="*.ts"
grep -rn "import.*CanvasView[^L]" src/ --include="*.ts"
```

预期结果：仅 `dom-utils.ts` 和 `canvas-data-extractor.ts`（已删除）引用了 `Canvas` 类型。

**第二步: 修改 `src/utils/dom-utils.ts`**

将 `Canvas` 引用改为 `CanvasLike`：

**修改前**:
```typescript
import { Canvas } from '../canvas/types';

export function getNodeIdFromElement(el: Element, canvas: Canvas): string | null {
    // ...
    const nodes = Array.from(canvas.nodes.values());
```

**修改后**:
```typescript
import { CanvasLike, CanvasNodeLike } from '../canvas/types';

export function getNodeIdFromElement(el: Element, canvas: CanvasLike): string | null {
    // ...
    // 需要兼容 Map 和 Object 两种存储方式
    const nodeEntries = canvas.nodes instanceof Map
        ? Array.from(canvas.nodes.values())
        : typeof canvas.nodes === 'object'
            ? Object.values(canvas.nodes as Record<string, CanvasNodeLike>)
            : [];
    const nodes = nodeEntries;
```

同时修改循环中的类型：用 `node.id` 代替 `node.id` （保持不变），但需确保 `node.nodeEl` 的类型兼容。

**第三步: 从 `src/canvas/types.ts` 中删除未使用的严格类型**

删除以下接口定义（约 40 行）：

```typescript
// 删除以下所有代码：
export interface CanvasNode { ... }
export interface CanvasEdge { ... }
export interface Canvas { ... }
export interface CanvasView { ... }
```

保留所有 `*Like` 类型、`HeightMeta`、`FloatingNodeMetadata`、布局相关类型等。

**第四步: 清理 `canvas-utils.ts` 中的冗余局部类型**

在 `src/utils/canvas-utils.ts` 文件顶部，有以下局部类型定义：

```typescript
type CanvasDataNode = { ... };
type CanvasDataEdge = { ... };
type CanvasData = { ... };
type CanvasViewLike = ItemView & { ... };
```

检查这些类型是否只在本文件内使用。如果与 `types.ts` 中的定义功能相同，可以改为从 `types.ts` 导入。但由于 `canvas-utils.ts` 中的 `CanvasData` 类型带有 `metadata.collapseState` 等字段，需要仔细比对。

**保守方案**: 暂不删除局部类型（它们是文件内部使用的，不影响外部），仅在后续拆分 `canvas-utils.ts` 时再处理。

**验证**: `npm run build` 通过。

---

### 步骤 1.4: 拆分 canvas-utils.ts

**重要说明**: 这是最大的一步。核心思路是将函数移到新文件，但在 `canvas-utils.ts` 中保留重导出，确保所有现有 import 不受影响。

**总体策略**:
1. **分两阶段执行**（不要一次拆完）
   - 阶段A：先拆低耦合模块（`content-type-utils.ts`、`canvas-view-utils.ts`）
   - 阶段B：再拆高耦合模块（`node/edge/data/ui`）
2. 每迁移一个模块都执行 `npm run build && npm test`
3. 在 `canvas-utils.ts` 中添加 `export { ... } from './xxx'` 重导出
4. 原文件中的函数定义在“确认无重复导出/无循环依赖”后再删除

**由于此步骤涉及大量代码移动，建议逐个模块进行，每移动一个模块就编译验证一次。**

以下是每个新模块的具体操作：

#### 1.4a: 创建 `src/utils/content-type-utils.ts`（最简单，先做）

**新建文件** `src/utils/content-type-utils.ts`，内容：

```typescript
import { CanvasNodeLike } from '../canvas/types';

type NodeLikeForCheck = CanvasNodeLike | null | undefined;

export function isFormulaContent(content: string): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(trimmed);
}

export function isImageContent(content: string): boolean {
    if (!content) return false;
    const imageRegex = /!?\[\[.*?\]\]|!?\[.*?\]\(.*?\)/;
    return imageRegex.test(content);
}

export function isTextNode(node: NodeLikeForCheck): boolean {
    if (!node) return true;
    return !node.type || node.type === 'text';
}

export function isFileNode(node: NodeLikeForCheck): boolean {
    return node?.type === 'file';
}
```

> 关键修订：这里不能再使用 `CanvasNode` 严格类型，否则会与“后续删除严格类型定义”的步骤冲突。

**然后在 `canvas-utils.ts` 中**:
1. 删除 `isFormulaContent`、`isImageContent`、`isTextNode`、`isFileNode` 的函数定义
2. 在文件顶部添加重导出：
```typescript
export { isFormulaContent, isImageContent, isTextNode, isFileNode } from './content-type-utils';
```

**验证**: `npm run build`

#### 1.4b: 创建 `src/utils/canvas-view-utils.ts`

将 `getCanvasView()`、`getActiveCanvasView()`、`getCurrentCanvasFilePath()` 以及它们依赖的辅助函数 `isCanvasView()` 移动到新文件。

**注意**: 新文件需要包含 `isCanvasView` 辅助函数和 `CanvasViewLike` 局部类型。

在 `canvas-utils.ts` 中添加重导出：
```typescript
export { getCanvasView, getActiveCanvasView, getCurrentCanvasFilePath } from './canvas-view-utils';
```

#### 1.4c ~ 1.4f: 类似地创建其他模块

**每个模块的操作模式相同**:
1. 创建新文件
2. 从 `canvas-utils.ts` 移动函数定义（注意带上所需的 import 和局部类型）
3. 在 `canvas-utils.ts` 添加 `export { ... } from './新文件';`
4. 删除 `canvas-utils.ts` 中已移走的函数
5. `npm run build` 验证

**建议的拆分顺序**（从简单到复杂）:
1. `content-type-utils.ts` — 4 个纯函数，无外部依赖
2. `canvas-view-utils.ts` — 3 个函数 + 1 个辅助
3. `edge-utils.ts` — 8 个函数，依赖 `CanvasEdgeLike` 类型
4. `node-utils.ts` — 11 个函数，依赖 `CanvasLike`、`CanvasNodeLike` 类型
5. `ui-utils.ts` — 8 个函数，依赖 `CanvasLike`、DOM 操作
6. `canvas-data-utils.ts` — 15 个函数，最复杂
7. 将 `estimateTextNodeHeight`、`clearHeightCache` 移入已创建的 `height-utils.ts`

**关键注意事项**:
- 如果新模块中的函数依赖 `canvas-utils.ts` 中其他函数，需要从对应的新模块 import，而不是从 `canvas-utils.ts` import（避免循环依赖）
- 如 `collectAllDescendants` 依赖 `getChildNodeIds` 和 `parseFloatingNodeInfo`，它们应在同一个文件中
- `debounce` 和 `throttle` 可以放入一个 `timing-utils.ts` 或留在 `canvas-utils.ts` 中
- 每拆完一个模块，建议额外执行一次循环依赖检查：

```bash
grep -rn "from '../../utils/canvas-utils'\|from '../utils/canvas-utils'\|from './canvas-utils'" src/ --include="*.ts"
```

若新模块之间出现互相 import，优先合并到同一模块或下沉公共函数，避免形成环。

**最终的 `canvas-utils.ts` 应只包含重导出**：

```typescript
// ============================================================================
// 重导出入口 — 保持向后兼容
// 新代码请直接从子模块 import
// ============================================================================
export { isFormulaContent, isImageContent, isTextNode, isFileNode } from './content-type-utils';
export { getCanvasView, getActiveCanvasView, getCurrentCanvasFilePath } from './canvas-view-utils';
export { getNodeIdFromEdgeEndpoint, getEdgeFromNodeId, getEdgeToNodeId, /* 等 */ } from './edge-utils';
export { getNodesFromCanvas, getEdgesFromCanvas, getNodeFromCanvas, /* 等 */ } from './node-utils';
export { findZoomToFitButton, tryZoomToSelection, findDeleteButton, /* 等 */ } from './ui-utils';
export { readCanvasData, writeCanvasData, parseFloatingNodeInfo, /* 等 */ } from './canvas-data-utils';
export { estimateTextNodeHeight, clearHeightCache } from './height-utils';
export { debounce, throttle } from './timing-utils';  // 或保留在本文件
```

---

### 步骤 1.5: 验证编译和功能

```bash
npm run build
```

如果编译通过，在 Obsidian 中测试以下核心功能：
1. 打开一个 Canvas 文件
2. 运行 "Arrange canvas mindmap layout" 命令
3. 折叠/展开一个节点
4. 删除一条边（验证浮动节点红框正常）
5. 给浮动节点连线（验证红框消失）
6. 运行 "Adjust all text node heights" 命令
7. 从 Markdown 选中文本，运行 "Add to canvas mindmap" 命令

---

## 阶段二：优化代码质量（~4-6小时）

### 步骤 2.1: 精简日志工具

**文件**: `src/utils/logger.ts`

**目标**: 提取 `log()` 和 `logCritical()` 中重复的消息序列化逻辑。

**修改方案**: 在两个函数之前添加一个私有的 `formatMessages` 函数。

**在 `log` 函数之前添加**:
```typescript
/**
 * 格式化日志消息数组为字符串
 */
function formatMessages(messages: unknown[]): string {
    return messages.map(msg => {
        if (msg === null) return 'null';
        if (msg === undefined) return 'undefined';
        if (typeof msg === 'object') {
            try {
                if (msg instanceof Error) {
                    return `${msg.name}: ${msg.message}\n${msg.stack}`;
                }
                return JSON.stringify(msg);
            } catch {
                return '[Complex Object]';
            }
        }
        if (typeof msg === 'string') return msg;
        if (typeof msg === 'number') return String(msg);
        if (typeof msg === 'boolean') return String(msg);
        if (typeof msg === 'bigint') return msg.toString();
        if (typeof msg === 'symbol') return msg.toString();
        if (typeof msg === 'function') return '[Function]';
        return '[Unknown]';
    }).join(' ');
}
```

**然后简化 `log` 函数**:

**修改前** (~20行):
```typescript
export function log(...messages: unknown[]): void {
    if (!isLoggingEnabled) return;
    const seq = ++logSequence;
    const delta = Date.now() - logStartTime;
    const body = messages.map(msg => {
        // ... 20行序列化逻辑
    }).join(' ');
    console.debug(`[${seq}|${delta}ms] ${body}`);
}
```

**修改后** (4行):
```typescript
export function log(...messages: unknown[]): void {
    if (!isLoggingEnabled) return;
    const seq = ++logSequence;
    const delta = Date.now() - logStartTime;
    console.debug(`[${seq}|${delta}ms] ${formatMessages(messages)}`);
}
```

**同样简化 `logCritical` 函数**:

**修改后** (4行):
```typescript
export function logCritical(...messages: unknown[]): void {
    const seq = ++logSequence;
    const delta = Date.now() - logStartTime;
    console.warn(`[${seq}|${delta}ms] ${formatMessages(messages)}`);
}
```

**验证**: `npm run build` 通过。

---

### 步骤 2.2: 拆分 adjustAllTextNodeHeights

**文件**: `src/canvas/canvas-node-manager.ts`

**目标**: 将 ~200 行的 `adjustAllTextNodeHeights()` 拆成多个子方法。

**第一步: 定义统计上下文类型**

在 `canvas-node-manager.ts` 文件内（类定义之前或 import 之后），添加：

```typescript
/** 高度调整的统计上下文 */
interface HeightAdjustmentStats {
    adjustedCount: number;
    increasedCount: number;
    decreasedCount: number;
    cappedCount: number;
    formulaCount: number;
    maxIncrease: number;
    maxDecrease: number;
    missingDomCount: number;
    sourceDomCount: number;
    sourceRenderedCount: number;
    sourceEstimateCount: number;
    sourceZeroDomCount: number;
    sourceFileTrustedCount: number;
    sourceSamples: string[];
}

function createEmptyStats(): HeightAdjustmentStats {
    return {
        adjustedCount: 0, increasedCount: 0, decreasedCount: 0,
        cappedCount: 0, formulaCount: 0, maxIncrease: 0, maxDecrease: 0,
        missingDomCount: 0, sourceDomCount: 0, sourceRenderedCount: 0,
        sourceEstimateCount: 0, sourceZeroDomCount: 0, sourceFileTrustedCount: 0,
        sourceSamples: []
    };
}
```

**第二步: 提取 Canvas DOM 映射构建方法**

在类中添加私有方法：

```typescript
/** 构建节点 ID → DOM 节点的映射 */
private buildNodeDomMap(): Map<string, CanvasNodeLike> {
    const nodeDomMap = new Map<string, CanvasNodeLike>();
    const canvasView = getCanvasView(this.app);
    const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
    if (canvas?.nodes && canvas.nodes instanceof Map) {
        for (const [id, nodeData] of canvas.nodes) {
            if (nodeData?.nodeEl) {
                nodeDomMap.set(id, nodeData);
            }
        }
    }
    return nodeDomMap;
}
```

**第三步: 提取 Canvas 刷新方法**

```typescript
/** 刷新 Canvas 边和视图 */
private refreshCanvasAfterHeightAdjust(): void {
    const canvasView = getCanvasView(this.app);
    if (!canvasView) return;
    const canvas = (canvasView as CanvasViewLike).canvas;
    if (!canvas) return;

    // 重绘所有边
    if (canvas.edges) {
        const edgesArray = canvas.edges instanceof Map
            ? Array.from(canvas.edges.values())
            : Array.isArray(canvas.edges) ? canvas.edges : [];
        for (const edge of edgesArray) {
            if (typeof (edge as any).render === 'function') {
                (edge as any).render();
            }
        }
    }
    if (typeof canvas.requestSave === 'function') canvas.requestSave();
    if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
}
```

**第四步: 提取统计日志方法**

```typescript
/** 输出高度调整统计日志 */
private logHeightAdjustStats(stats: HeightAdjustmentStats): void {
    if (stats.adjustedCount > 0) {
        new Notice(`已调整 ${stats.adjustedCount} 个节点高度`);
        log(`[Node] 批量调整完成: ${stats.adjustedCount}`);
    } else {
        log(`[Node] 批量调整完成: 无需更新节点高度`);
    }
    log(`[Node] 批量调整统计: 增加=${stats.increasedCount}, 减少=${stats.decreasedCount}, maxIncrease=${stats.maxIncrease.toFixed(1)}, maxDecrease=${stats.maxDecrease.toFixed(1)}, capped=${stats.cappedCount}, formula=${stats.formulaCount}`);
    log(`[Node] 高度来源统计: dom=${stats.sourceDomCount}, rendered=${stats.sourceRenderedCount}, file-trusted=${stats.sourceFileTrustedCount}, estimate=${stats.sourceEstimateCount}, zeroDom=${stats.sourceZeroDomCount}, sample=${stats.sourceSamples.join('|')}`);
}
```

**第五步: 简化主方法**

将 `adjustAllTextNodeHeights()` 的主体改为调用这些子方法。主方法大致结构：

```typescript
async adjustAllTextNodeHeights(): Promise<number> {
    try {
        const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
        if (!canvasFilePath) return 0;

        log(`[Node] 开始批量调整高度: ${canvasFilePath}`);
        const stats = createEmptyStats();
        const textDimensions = this.nodeTypeService.getTextDimensions();
        const maxHeight = textDimensions.maxHeight;
        const formulaDimensions = this.nodeTypeService.getFormulaDimensions();
        const nodeDomMap = this.buildNodeDomMap();

        await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, async (canvasData) => {
            if (!canvasData.nodes) return false;
            let changed = false;
            
            for (const node of canvasData.nodes) {
                // ... 每个节点的处理逻辑（保持不变，但使用 stats 对象统计）
            }
            return changed;
        });

        this.refreshCanvasAfterHeightAdjust();
        this.logHeightAdjustStats(stats);
        return stats.adjustedCount;
    } catch (err) {
        log(`[Node] 批量调整失败:`, err);
        return 0;
    }
}
```

**注意**: 不需要修改核心的节点处理逻辑，只需要将辅助功能（DOM映射构建、Canvas刷新、日志输出）提取为独立方法。

**验证**: `npm run build` 通过，然后在 Obsidian 中运行 "Adjust all text node heights" 命令验证功能正常。

---

### 步骤 2.3: 精简 layout-data-provider.ts

**文件**: `src/canvas/services/layout-data-provider.ts`

**目标**: 在不改变行为的前提下，先降低复杂度，再考虑行数目标。

> 修订说明：第一轮不要强制追求“450→250行”，优先保证功能与日志语义不回归。

**这是风险最高的一步，建议在 git 分支上进行。**

```bash
git checkout -b refactor/layout-data-provider
```

**第一步: 创建 `src/canvas/services/layout-diagnostics.ts`**

```typescript
import { log } from '../../utils/logger';

/**
 * 布局诊断统计器
 * 收集布局过程中的各项统计数据，仅在 debug 模式下输出
 */
export class LayoutDiagnostics {
    private counters = new Map<string, number>();
    private samples = new Map<string, string[]>();
    private maxSamples: number;

    constructor(maxSamples: number = 5) {
        this.maxSamples = maxSamples;
    }

    increment(key: string, amount: number = 1): void {
        this.counters.set(key, (this.counters.get(key) || 0) + amount);
    }

    get(key: string): number {
        return this.counters.get(key) || 0;
    }

    addSample(key: string, value: string): void {
        if (!this.samples.has(key)) {
            this.samples.set(key, []);
        }
        const arr = this.samples.get(key)!;
        if (arr.length < this.maxSamples) {
            arr.push(value);
        }
    }

    getSamples(key: string): string[] {
        return this.samples.get(key) || [];
    }

    /** 输出所有收集的统计数据 */
    logSummary(visibleCount: number): void {
        // 高度统计
        log(`[LayoutData] 高度来源 file=${this.get('dataFromFile')}, memory=${this.get('dataFromMemory')}, missing=${this.get('dataMissing')}, trusted=${this.get('trustedUsed')}, sigMatch=${this.get('sigMatched')}`);
        
        if (this.get('trustedUsed') > 0) {
            log(`[LayoutData] trustedHeight样例: ${this.getSamples('trusted').join('|')}`);
        }
        if (this.get('domDiff') > 0) {
            log(`[LayoutData] DOM高度差异 count=${this.get('domDiff')}, sample=${this.getSamples('domDiff').join('|')}`);
        }
        if (this.get('domZero') > 0) {
            log(`[LayoutData] DOM零高度节点: ${this.get('domZero')}/${visibleCount}`);
        }
        if (this.get('domHidden') > 0) {
            log(`[LayoutData] DOM隐藏 sample=${this.getSamples('domHidden').join('|')}`);
        }
        if (this.get('domMissing') > 0) {
            log(`[LayoutData] DOM缺失 sample=${this.getSamples('domMissing').join('|')}`);
        }
    }
}
```

**第二步: 提取高度 reconcile 逻辑为独立方法**

在 `LayoutDataProvider` 类中添加:

```typescript
/**
 * 协调 DOM 高度和文件高度之间的冲突
 * @returns 最终决定使用的高度
 */
private reconcileHeight(
    nodeId: string,
    domHeight: number,
    fileHeight: number,
    dataHeight: number,
    mergedNode: CanvasNodeLike,
    diag: LayoutDiagnostics
): number {
    // 将 measureVisibleNodes 中的 DOM vs File reconcile 逻辑移到这里
    // 保持原有的三方对比逻辑不变
    // ...
}
```

**第三步: 简化 `measureVisibleNodes` 闭包**

将 `getLayoutData()` 中的 `measureVisibleNodes()` 闭包改为使用 `LayoutDiagnostics` 对象，替代所有 30+ 个局部变量。

**修改模式**:
- 将 `let domHeightAppliedCount = 0;` → `diag.increment('domApplied');`
- 将 `if (domHeightDiffSamples.length < 5) { domHeightDiffSamples.push(...) }` → `diag.addSample('domDiff', ...);`
- 将最后的 `log(...)` 日志输出 → `diag.logSummary(visibleCount);`

**注意**: 这一步改动量大，建议分多个小步骤进行：
1. 先在 `measureVisibleNodes` 顶部创建 `const diag = new LayoutDiagnostics();`
2. 逐个替换统计变量为 `diag` 调用
3. 每替换 5-10 个变量就编译验证一次
4. 最后替换日志输出部分

**验证**: 
```bash
npm run build
```
在 Obsidian 中运行布局命令，开启 Debug 日志，确认统计输出与之前一致。

---

## 附录：常见问题排查

### Q: 编译报 "Module not found" 错误
**A**: 检查新文件的路径是否正确。注意 `src/canvas/services/` 下的文件引用 `utils` 目录时，路径是 `../../utils/xxx`。

### Q: 编译报 "Circular dependency" 警告
**A**: 确保新创建的工具模块之间没有互相 import。如果两个函数互相依赖，它们应该放在同一个文件中。

### Q: 运行时功能异常但编译通过
**A**: 最常见的原因是函数重导出时遗漏了某个 export。在 `canvas-utils.ts` 的重导出列表中检查是否包含了所有函数。

### Q: 重构后单元测试失败
**A**: 检查 `src/__tests__/canvas-utils.test.ts` 和 `src/__tests__/canvas-utils-tools.test.ts` 中的 import 路径。由于保留了重导出入口，理论上测试不需要修改。

---

*最后更新: 2026-02-25*
