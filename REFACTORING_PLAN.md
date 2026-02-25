# Canvas Mindmap Build - 重构规划方案

> 创建日期: 2026-02-25
> 状态: 待实施
> 原则: **不恶化现有功能，适度重构，解决真实痛点**
> 详细实施指南: **[REFACTORING_IMPLEMENTATION_GUIDE.md](./REFACTORING_IMPLEMENTATION_GUIDE.md)**（包含逐步骤代码修改说明）

> 执行门禁（修订版新增）:
> 1) 每次只做一个小改动点；2) 每步后执行 `npm run build`；3) 关键步骤追加 `npm test`；
> 4) 手测关键链路（布局/折叠/删边/高度调整）通过后再进入下一步。

---

## 一、项目现状评估

### 1.1 整体架构

项目已完成了较好的初步模块化拆分，从最初的单一 `canvas-manager.ts` 拆分为：
- `CanvasManager` (协调层)
- `CanvasEventManager` (事件管理)
- `CanvasNodeManager` (节点管理)
- `CanvasUIManager` (UI管理)
- `LayoutManager` (布局管理)
- 以及多个底层 Service（`CanvasFileService`、`FloatingNodeService`、`NodeHeightService` 等）

**总体评价**: 架构方向正确，模块拆分基本合理。当前的问题集中在**工具层代码膨胀**、**重复代码**和**过度诊断日志**三方面。

### 1.2 代码量统计

| 文件 | 行数 | 状态 |
|------|------|------|
| `canvas-utils.ts` | ~600 | ⚠️ 过大，职责过多 |
| `layout-data-provider.ts` | ~450 | ⚠️ 诊断代码过多 |
| `canvas-node-manager.ts` | ~400 | ⚠️ 单方法过大 |
| `canvas-event-manager.ts` | ~420 | ✅ 可接受 |
| `layout-manager.ts` | ~500 | ✅ 可接受 |
| `canvas-manager.ts` | ~180 | ✅ 较精简 |
| `floating-node-service.ts` | ~480 | ✅ 可接受 |
| `layout.ts` | ~400 | ✅ 纯算法 |
| 其他文件 | 各<200 | ✅ 合理 |

---

## 二、发现的核心问题

### 问题1: `canvas-utils.ts` 已成为"上帝工具文件"

**严重程度**: 🔴 高

该文件包含 ~600 行代码，混合了至少 8 类不同职责：
1. Canvas 视图获取 (`getCanvasView`, `getActiveCanvasView`, `getCurrentCanvasFilePath`)
2. 边数据解析 (`getNodeIdFromEdgeEndpoint`, `getEdgeFromNodeId`, `getEdgeToNodeId`, `extractEdgeNodeIds`, `buildEdgeIdSet`, `detectNewEdges`)
3. 节点查询 (`getNodesFromCanvas`, `getEdgesFromCanvas`, `getNodeFromCanvas`, `getSelectedNodeFromCanvas`)
4. 浮动节点操作 (`isFloatingNode`, `getFloatingNodeOriginalParent`, `setNodeFloatingState`, `parseFloatingNodeInfo`)
5. 折叠状态操作 (`isNodeCollapsed`, `setNodeCollapseState`)
6. 布局辅助 (`identifyRootNodes`, `findParentNode`, `findChildNodes`, `collectAllDescendants`)
7. DOM 操作辅助 (`getNodeDomElement`, `isNodeVisible`, `setNodeVisibility`)
8. 高度估算 (`estimateTextNodeHeight`, `clearHeightCache`)
9. 通用工具 (`debounce`, `throttle`, `generateRandomId`)
10. 类型检测 (`isFormulaContent`, `isImageContent`, `isTextNode`, `isFileNode`)
11. Canvas 文件读写 (`readCanvasData`, `writeCanvasData`)

**影响**: 
- 新增功能时不知道放在哪里
- 多个模块依赖此文件，但只用了其中一小部分
- 函数间耦合增加，难以单元测试

---

### 问题2: 签名计算函数被重复实现（多处）

**严重程度**: 🟡 中

以下三处代码实现了几乎相同的 `textSignature` 生成逻辑：

```
// canvas-node-manager.ts (adjustAllTextNodeHeights 内部)
const getTextSignature = (content: string, width: number): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
};

// canvas-node-manager.ts (generateTextSignature 私有方法)
private generateTextSignature(content: string, width: number): string { ... 同上 }

// layout-data-provider.ts
private buildTextSignature(content: string, width: number): string { ... 同上 }

// node-height-service.ts
private generateContentSignature(content: string, width: number): string { ... 同上 }
```

**影响**: 如果需要修改签名算法，必须同步修改 3-4 处代码。

---

### 问题3: `CanvasFileService` 被重复实例化

**严重程度**: 🟡 中

`CanvasEventManager` 构造函数中通过 `new CanvasFileService(app, settings)` 创建了一个新实例，而 `CanvasManager` 已经创建了一个实例。这意味着：
- 两个实例各自独立，无法共享状态
- 内存浪费（虽然轻微）
- 如果 `CanvasFileService` 后续增加状态管理（如锁），会出现一致性问题

```typescript
// canvas-event-manager.ts 构造函数中
this.canvasFileService = new CanvasFileService(app, settings); // ← 不应重新 new
```

类似地，`FloatingNodeService` 构造函数也 `new` 了自己的 `CanvasFileService`。

---

### 问题4: `layout-data-provider.ts` 诊断代码过度膨胀

**严重程度**: 🟡 中

`getLayoutData()` 方法中有 **30+ 个统计变量** 和大量日志输出，用于调试高度计算的来源和准确性。虽然这些在开发阶段非常有价值，但：
- 实际业务逻辑被淹没在诊断代码中
- 方法长度达到 ~350 行，远超合理范围
- 即使禁用了 debug logging，这些统计变量的分配和赋值仍然在每次调用中执行

---

### 问题5: `adjustAllTextNodeHeights()` 方法过于庞大

**严重程度**: 🟡 中

`canvas-node-manager.ts` 中的 `adjustAllTextNodeHeights()` 方法约 200 行，承担了：
- 节点遍历
- 公式节点检测和特殊处理
- DOM 节点映射构建
- 高度计算和统计
- 内存节点同步
- 边重绘
- Canvas 刷新
- 统计日志输出

---

### 问题6: 类型定义冗余

**严重程度**: 🟢 低

`types.ts` 中定义了两套类型：
- "严格类型": `Canvas`, `CanvasNode`, `CanvasEdge` — 几乎未被使用
- "宽松类型": `CanvasLike`, `CanvasNodeLike`, `CanvasEdgeLike` — 实际使用的类型

同时 `canvas-utils.ts` 中也定义了局部类型 `CanvasData`, `CanvasDataNode`, `CanvasDataEdge`，和 `types.ts` 中的定义有重叠。

---

### 问题7: `CanvasManager` 透传方法较多

**严重程度**: 🟢 低

`CanvasManager` 中约 10 个方法是纯粹的一行转发：

```typescript
async arrangeCanvas() {
    await this.layoutManager.arrangeCanvas();
}
async addNodeToCanvas(content: string, sourceFile: TFile | null) {
    await this.nodeManager.addNodeToCanvas(content, sourceFile);
}
// ... 更多类似的透传
```

作为 Facade 模式这是可以接受的，但当透传比率过高时，说明这一层可能过度设计。

---

### 问题8: 日志函数重复逻辑

**严重程度**: 🟢 低

`logger.ts` 中 `log()` 和 `logCritical()` 的消息序列化逻辑完全相同（24行重复代码），仅输出方式不同（`console.debug` vs `console.warn`）。

---

### 问题9: 三个文件是“候选死代码”（需门禁验证）🔴

**严重程度**: 🔴 高（应立即清理）

经搜索验证，以下三个文件在 `src/**/*.ts` 中**未发现直接引用**，但删除前仍需通过构建/测试门禁确认：

| 死代码文件 | 行数 | 说明 |
|-----------|------|------|
| `src/utils/canvas-data-extractor.ts` | ~100 | 与 `canvas-utils.ts` 功能重叠，且使用了过时的"严格类型"(`Canvas`, `CanvasNode`, `CanvasEdge`) |
| `src/utils/function-tracer.ts` | ~100 | 核心方法 `traceEnter()` 和 `traceExit()` 已被注释为 `return;`，完全禁用 |
| `src/utils/json-utils.ts` | ~20 | `safeJsonParse()` 未被任何地方调用 |

**影响**: 增加代码库认知负担，维护时可能产生误导。

**修订要求**: 仅在以下条件都满足时删除：
- grep 无业务引用
- `npm run build` 通过
- `npm test` 通过

---

### 问题10: `NodeTypeService` 公式检测逻辑不一致

**严重程度**: 🟡 中

`NodeTypeService` 中有两个公式检测方法，逻辑不同：
- `isFormula()`: 简单判断 `startsWith('$$') && endsWith('$$') && length > 4`
- `isFormulaContent()`: 委托给 `canvas-utils.ts`，使用正则 `/^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/`

后者更严格（支持 `fromLink` 注释后缀），前者不支持。这可能导致同一内容在不同场景下被不同方法判定为"是/否公式"。

---

### 问题11: `NodeDeletionService.executeDeleteOperation` 与 `CanvasEventManager` 重复

**严重程度**: 🟢 低

`NodeDeletionService` 中有一个 `executeDeleteOperation()` 方法，与 `CanvasEventManager` 中的几乎相同（都是打开确认框，然后调用 single/cascade delete）。`CanvasEventManager` 是实际调用者，`NodeDeletionService.executeDeleteOperation` 似乎**没有被外部调用**。

---

### 问题12: `obsidian-extensions.d.ts` 类型导入路径错误

**严重程度**: 🟡 中

该文件的 import 路径为 `import { CanvasNodeLike, CanvasEdgeLike } from './canvas/types'`，但文件位于 `src/types/` 目录下，正确路径应为 `'../canvas/types'`。虽然 TypeScript 编译可能由于 d.ts 文件的特殊处理而没报错，但这是一个潜在的隐患。

---

## 三、重构方案

### 第一优先级：高影响、低风险

#### 重构1: 拆分 `canvas-utils.ts`

**目标**: 将 ~600 行的工具文件按职责拆分为多个模块，但采用**两阶段渐进拆分**，避免一次性大改。

**修订策略（强制）**:
1. **阶段A（低耦合优先）**: 先拆 `content-type-utils.ts`、`canvas-view-utils.ts`
2. **阶段B（高耦合后拆）**: 再拆 `edge/node/data/ui/height`
3. 每迁移一个模块都执行：`npm run build && npm test`
4. 如出现循环依赖，优先合并模块或下沉公共函数，不强行继续拆分

**新文件结构**:

```
src/utils/
├── canvas-view-utils.ts      # Canvas视图获取相关 (~50行)
│   ├── getCanvasView()
│   ├── getActiveCanvasView()
│   └── getCurrentCanvasFilePath()
│
├── edge-utils.ts              # 边数据解析相关 (~80行)
│   ├── getNodeIdFromEdgeEndpoint()
│   ├── getEdgeFromNodeId()
│   ├── getEdgeToNodeId()
│   ├── extractEdgeNodeIds()
│   ├── getEdgeId()
│   ├── buildEdgeIdSet()
│   ├── detectNewEdges()
│   └── getSelectedEdge()
│
├── node-utils.ts              # 节点查询/操作相关 (~120行)
│   ├── getNodeFromCanvas()
│   ├── getNodesFromCanvas()
│   ├── getEdgesFromCanvas()
│   ├── getEdgesFromCanvasOrFileData()
│   ├── getSelectedNodeFromCanvas()
│   ├── getCanvasNodeByElement()
│   ├── hasChildNodes()
│   ├── reloadCanvas()
│   ├── withTemporaryCanvasSelection()
│   ├── isRecord()
│   └── generateRandomId()
│
├── height-utils.ts            # 高度估算相关 (~150行)
│   ├── estimateTextNodeHeight()
│   ├── clearHeightCache()
│   └── generateTextSignature()  ← 统一签名函数
│
├── content-type-utils.ts      # 内容类型检测 (~30行)
│   ├── isFormulaContent()
│   ├── isImageContent()
│   ├── isTextNode()
│   └── isFileNode()
│
├── canvas-data-utils.ts       # Canvas数据读写操作 (~120行)
│   ├── readCanvasData()
│   ├── writeCanvasData()
│   ├── getNodeFromCanvasData()
│   ├── getChildNodeIds()
│   ├── getParentNodeId()
│   ├── identifyRootNodes()
│   ├── findParentNode()
│   ├── findChildNodes()
│   ├── collectAllDescendants()
│   ├── isFloatingNode()
│   ├── getFloatingNodeOriginalParent()
│   ├── setNodeFloatingState()
│   ├── parseFloatingNodeInfo()
│   ├── isNodeCollapsed()
│   └── setNodeCollapseState()
│
├── ui-utils.ts                # UI/DOM辅助函数 (~60行)
│   ├── findZoomToFitButton()
│   ├── tryZoomToSelection()
│   ├── findDeleteButton()
│   ├── findCanvasNodeElementFromTarget()
│   ├── parseFromLink()
│   ├── getNodeDomElement()
│   ├── isNodeVisible()
│   └── setNodeVisibility()
│
├── canvas-utils.ts            # 保留为重导出入口文件 (~20行)
│   └── 重导出所有上述模块的公开函数（向后兼容）
│
├── dom-utils.ts               # (已有，不变)
├── error-handler.ts           # (已有，不变)
├── logger.ts                  # (已有，微调)
└── json-utils.ts / function-tracer.ts  # 阶段零门禁通过后可删除
```

**向后兼容**: 保留 `canvas-utils.ts` 作为重导出文件，现有的 import 语句无需修改。后续可逐步将各模块的 import 迁移到新文件。

**实施步骤**:
1. 创建新的工具模块文件
2. 将函数移动到对应模块
3. 在 `canvas-utils.ts` 中添加重导出
4. 验证编译通过
5. （可选）逐步迁移各处的 import

---

#### 重构2: 提取统一的签名计算函数

**目标**: 消除“多处”重复的签名实现（以搜索结果为准，不写死数量）

**方案**: 在 `height-utils.ts`（或单独的 `signature-utils.ts`）中统一定义：

```typescript
// src/utils/height-utils.ts
export function generateTextSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}
```

**需要修改的文件**:
- `canvas-node-manager.ts`: 删除 `getTextSignature` 局部函数和 `generateTextSignature` 私有方法，改为 import
- `layout-data-provider.ts`: 删除 `buildTextSignature` 私有方法，改为 import
- `node-height-service.ts`: 删除 `generateContentSignature` 私有方法，改为 import

---

#### 重构3: 修复 CanvasFileService 重复实例化

**目标**: 确保全局只有一个 `CanvasFileService` 实例

**方案**: 先在 `CanvasManager` 构造函数中通过参数注入到 `CanvasEventManager`；`FloatingNodeService` 注入放到第二批。

**需要修改的文件（第一批）**:
- `canvas-event-manager.ts`: 构造函数增加 `canvasFileService` 参数，删除内部 `new` 语句
- `canvas-manager.ts`: 将已有的 `canvasFileService` 实例传给 `CanvasEventManager`

**需要修改的文件（第二批，可选）**:
- `floating-node-service.ts`: 接收外部注入的 `CanvasFileService`（建议在第一批稳定后再做）

---

#### 重构4: 清理未使用的严格类型定义

**目标**: 移除死代码，减少维护负担

**方案（修订顺序）**:
1. 先改 `dom-utils.ts`：`Canvas` → `CanvasLike`，并兼容 `Map/Object`
2. 再做全仓搜索确认无严格类型引用
3. 最后删除 `types.ts` 中未被使用的严格类型
4. `canvas-utils.ts` 局部类型先保守处理，不强制第一轮删除

---

### 第二优先级：中影响、中风险

#### 重构5: 精简 `layout-data-provider.ts` 的诊断代码

**目标（修订）**: 第一轮先降低复杂度并维持行为一致，再考虑行数目标。

**方案**: 

1. **提取诊断统计器为独立类**:
```typescript
// src/canvas/services/layout-diagnostics.ts
export class LayoutDiagnostics {
    private counters = new Map<string, number>();
    private samples = new Map<string, string[]>();
    
    increment(key: string): void { ... }
    addSample(key: string, value: string, maxSamples: number = 5): void { ... }
    logSummary(): void { ... }  // 仅在 enableDebugLogging 时输出
}
```

2. **将高度 reconcile 逻辑提取为独立方法**:
```typescript
private reconcileNodeHeight(
    mergedNode: CanvasNodeLike,
    domHeight: number,
    fileHeight: number,
    diagnostics: LayoutDiagnostics
): number { ... }
```

3. **核心 `getLayoutData()` 先保留现有语义**，逐步提取，避免“一步压缩到目标行数”引入行为回归。

---

#### 重构6: 拆分 `adjustAllTextNodeHeights()` 方法

**目标**: 将 ~200 行的方法拆为职责清晰的子方法

**方案**:

```typescript
// canvas-node-manager.ts

async adjustAllTextNodeHeights(): Promise<number> {
    const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
    if (!canvasFilePath) return 0;
    
    const context = this.buildAdjustmentContext();    // 构建DOM映射等上下文
    const adjustedCount = await this.adjustNodeHeightsInFile(canvasFilePath, context);
    this.syncCanvasAfterAdjustment();                 // 重绘边、刷新Canvas
    this.logAdjustmentSummary(context);              // 统计日志
    
    return adjustedCount;
}

private buildAdjustmentContext(): AdjustmentContext { ... }
private async adjustNodeHeightsInFile(path: string, ctx: AdjustmentContext): Promise<number> { ... }
private calculateSingleNodeHeight(node: CanvasNodeLike, ctx: AdjustmentContext): number { ... }
private syncCanvasAfterAdjustment(): void { ... }
private logAdjustmentSummary(ctx: AdjustmentContext): void { ... }
```

---

#### 重构7: 精简日志工具

**目标**: 消除 `log()` 和 `logCritical()` 中的重复序列化逻辑

**方案**:

```typescript
// logger.ts
function formatMessages(messages: unknown[]): string {
    return messages.map(msg => {
        if (msg === null) return 'null';
        if (msg === undefined) return 'undefined';
        if (typeof msg === 'object') {
            try {
                if (msg instanceof Error) return `${msg.name}: ${msg.message}\n${msg.stack}`;
                return JSON.stringify(msg);
            } catch { return '[Complex Object]'; }
        }
        return String(msg);
    }).join(' ');
}

export function log(...messages: unknown[]): void {
    if (!isLoggingEnabled) return;
    const seq = ++logSequence;
    const delta = Date.now() - logStartTime;
    console.debug(`[${seq}|${delta}ms] ${formatMessages(messages)}`);
}

export function logCritical(...messages: unknown[]): void {
    const seq = ++logSequence;
    const delta = Date.now() - logStartTime;
    console.warn(`[${seq}|${delta}ms] ${formatMessages(messages)}`);
}
```

---

### 第三优先级：低影响、持续改进

#### 重构8: 简化 CanvasManager 透传

**现状**: CanvasManager 中约 10 个方法是纯一行转发。

**方案**: **暂不大改**。Facade 模式本身是合理的设计，只需标注明确的注释。如果后续需要，可以考虑将某些子服务通过 getter 暴露：

```typescript
// 仅当外部确实需要直接访问时
get layoutService(): LayoutManager { return this.layoutManager; }
```

**评估**: 当前的透传量（10个方法）在可接受范围内，过早移除 Facade 层反而会增加外部代码的耦合。**建议保持现状**，仅在方法数继续增长时重新评估。

---

#### 重构9: 统一防抖/节流使用

**现状**: `canvas-utils.ts` 中定义了 `debounce()` 和 `throttle()` 工具函数，但多处代码使用了手动的 `setTimeout` + `clearTimeout` 实现防抖。

**方案**: **限定范围改进**，仅在新增代码时使用工具函数，不强制修改现有可用的手动实现（避免引入不必要的功能回归风险）。

---

## 四、实施计划

### 阶段零（立即执行：清理死代码）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 0.1 | 候选死代码引用核查（grep） | 5分钟 | 低 |
| 0.2 | 基线校验（build + test） | 5分钟 | 低 |
| 0.3 | 删除候选死代码文件（满足门禁后） | 5分钟 | 低 |
| 0.4 | 统一 `NodeTypeService` 中的公式检测逻辑 | 15分钟 | 极低 |
| 0.5 | 移除 `NodeDeletionService.executeDeleteOperation` 重复方法（如确认未使用） | 10分钟 | 低 |
| 0.6 | 修复 `obsidian-extensions.d.ts` 导入路径 | 5分钟 | 极低 |
| 0.7 | 验证编译与测试通过 | 10分钟 | - |

**总计**: ~55分钟

### 阶段一（第一优先级）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 1.1 | 拆分 `canvas-utils.ts`（阶段A：低耦合模块） | 1-1.5小时 | 低 |
| 1.2 | 拆分 `canvas-utils.ts`（阶段B：高耦合模块） | 1.5-2.5小时 | 中 |
| 1.3 | 提取统一签名函数 | 30分钟 | 极低 |
| 1.4 | 修复 CanvasFileService 重复实例化（第一批） | 30分钟 | 低 |
| 1.5 | 清理未使用的严格类型（按修订顺序） | 30分钟 | 低 |
| 1.6 | 验证编译、测试和功能 | 30分钟 | - |

**总计**: ~4.5-6小时

### 阶段二（第二优先级）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 2.1 | 提取 LayoutDiagnostics 类 | 1-2小时 | 中 |
| 2.2 | 精简 layout-data-provider.ts | 1-2小时 | 中 |
| 2.3 | 拆分 adjustAllTextNodeHeights() | 1-2小时 | 中 |
| 2.4 | 精简日志工具 | 20分钟 | 极低 |
| 2.5 | 验证编译和功能 | 30分钟 | - |

**总计**: ~4-6小时

### 阶段三（第三优先级）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 3.1 | 评估 CanvasManager 透传简化 | 30分钟 | - |
| 3.2 | 标注防抖/节流改进点 | 30分钟 | - |

**总计**: ~1小时

---

## 五、不建议做的事情（避免过度重构）

1. **❌ 不引入依赖注入框架** — 当前的手动构造函数注入已经足够
2. **❌ 不引入 RxJS 或其他响应式库** — 当前的事件系统工作良好
3. **❌ 不重写布局算法** — `layout.ts` 的纯函数式设计已经很好
4. **❌ 不合并 FloatingNodeService 相关的三个子服务** — 它们的职责拆分（State/Style/Detection）是合理的
5. **❌ 不重构 CanvasEventManager** — 虽然 420 行偏长，但其职责内聚、逻辑清晰
6. **❌ 不引入全局状态管理** — CollapseStateManager 的简单 Map 实现是够用的
7. **❌ 不修改现有的 SSOT 高度管理策略** — 这是经过多次迭代验证的设计决策

---

## 六、重构验证清单

每次重构完成后，需验证以下功能：

- [ ] 插件正常加载/卸载
- [ ] Canvas 布局排列功能正常
- [ ] 节点折叠/展开功能正常
- [ ] 删除边后浮动节点红框显示正常
- [ ] 重新连线后红框消失
- [ ] 节点高度自动调整功能正常
- [ ] 批量高度调整命令正常
- [ ] 从 Markdown 添加节点到 Canvas 正常
- [ ] 设置面板正常工作
- [ ] Debug 日志开关正常

---

## 七、文件变更汇总

### 删除文件（阶段零：死代码清理）
- `src/utils/canvas-data-extractor.ts` — 候选删除（满足门禁后执行）
- `src/utils/function-tracer.ts` — 候选删除（满足门禁后执行）
- `src/utils/json-utils.ts` — 候选删除（满足门禁后执行）

### 新建文件（阶段一、二）
- `src/utils/canvas-view-utils.ts`
- `src/utils/edge-utils.ts`
- `src/utils/node-utils.ts`
- `src/utils/height-utils.ts`
- `src/utils/content-type-utils.ts`
- `src/utils/canvas-data-utils.ts`
- `src/utils/ui-utils.ts`
- `src/canvas/services/layout-diagnostics.ts` (第二阶段)

### 修改文件
- `src/utils/canvas-utils.ts` — 改为重导出入口
- `src/utils/logger.ts` — 提取公共格式化
- `src/utils/dom-utils.ts` — 类型引用更新（`Canvas` → `CanvasLike`）
- `src/canvas/canvas-event-manager.ts` — 注入 CanvasFileService
- `src/canvas/canvas-manager.ts` — 传递 CanvasFileService 实例
- `src/canvas/canvas-node-manager.ts` — 移除重复签名函数，拆分大方法
- `src/canvas/services/layout-data-provider.ts` — 提取诊断逻辑
- `src/canvas/services/floating-node-service.ts` — 注入 CanvasFileService（第二批可选）
- `src/canvas/services/node-height-service.ts` — 移除重复签名函数
- `src/canvas/services/node-type-service.ts` — 统一公式检测逻辑
- `src/canvas/services/node-deletion-service.ts` — 移除重复的 executeDeleteOperation
- `src/canvas/types.ts` — 清理未使用的严格类型（`Canvas`, `CanvasNode`, `CanvasEdge`, `CanvasView`）
- `src/types/obsidian-extensions.d.ts` — 修复 import 路径

### 不修改文件
- `src/main.ts` — 入口文件保持不变
- `src/canvas/layout.ts` — 纯算法文件保持不变
- `src/canvas/canvas-ui-manager.ts` — 保持不变
- `src/canvas/services/edge-deletion-service.ts` — 保持不变
- `src/canvas/services/edge-change-detector.ts` — 保持不变
- `src/canvas/services/floating-node-state-manager.ts` — 保持不变
- `src/canvas/services/floating-node-style-manager.ts` — 保持不变
- `src/canvas/services/canvas-file-service.ts` — 保持不变
- `src/canvas/services/visibility-service.ts` — 保持不变
- `src/canvas/services/node-creation-service.ts` — 保持不变
- `src/canvas/utils/node-position-calculator.ts` — 保持不变
- `src/state/collapse-state.ts` — 保持不变
- `src/settings/*` — 保持不变
- `src/ui/*` — 保持不变
- `src/__mocks__/*` — 保持不变
- `src/__tests__/*` — 保持不变
- `styles.css` — 保持不变

---

*最后更新: 2026-02-25*
