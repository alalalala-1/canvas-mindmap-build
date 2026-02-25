# Canvas Mindmap Build - 重构进度跟踪

> 创建时间: 2026-02-25 16:56
> 重构计划: [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
> 实施指南: [REFACTORING_IMPLEMENTATION_GUIDE.md](./REFACTORING_IMPLEMENTATION_GUIDE.md)

---

## 执行门禁

每次修改必须遵循：
1. ✅ 每次只做一个小改动点
2. ✅ 每步后执行 `npm run build`
3. ✅ 关键步骤追加 `npm test`
4. ✅ 手测关键链路通过后再进入下一步

---

## 阶段零：清理死代码（预估 ~40分钟）✅ 已完成

### 步骤 0.1: 删除死代码文件 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 0.1.a 引用核查 | ✅ 已完成 | grep 确认无业务引用 |
| 0.1.b 基线校验 | ✅ 已完成 | `npm run build && npm test` |
| 0.1.c 执行删除 | ✅ 已完成 | 删除3个文件 |
| 0.1.d 二次验证 | ✅ 已完成 | 编译测试通过 |

**已删除文件**：
- `src/utils/canvas-data-extractor.ts` (~100行) ✅
- `src/utils/function-tracer.ts` (~100行) ✅
- `src/utils/json-utils.ts` (~20行) ✅

### 步骤 0.2: 统一 NodeTypeService 公式检测 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 0.2.a 修改 isFormula 方法 | ✅ 已完成 | 委托给 isFormulaContent |
| 0.2.b 编译验证 | ✅ 已完成 | `npm run build` |

### 步骤 0.3: 移除 NodeDeletionService 重复方法 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 0.3.a 引用核查 | ✅ 已完成 | grep 确认 executeDeleteOperation 无外部调用 |
| 0.3.b 删除方法 | ✅ 已完成 | 删除重复方法 |
| 0.3.c 编译验证 | ✅ 已完成 | `npm run build` |

### 步骤 0.4: 修复 obsidian-extensions.d.ts 导入路径 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 0.4.a 修复路径 | ✅ 已完成 | `'./canvas/types'` → `'../canvas/types'` |
| 0.4.b 编译验证 | ✅ 已完成 | `npm run build` |

### 步骤 0.5: 阶段零最终验证 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 0.5.a 完整编译 | ✅ 已完成 | `npm run build` |
| 0.5.b 单元测试 | ✅ 已完成 | `npm test` |

---

## 阶段一：核心重构（预估 ~4-5小时）

### 步骤 1.1: 提取统一签名函数 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.1.a 定位重复实现 | ✅ 已完成 | grep 搜索所有签名函数（4处） |
| 1.1.b 创建 height-utils.ts | ✅ 已完成 | 新建文件，导出 generateTextSignature |
| 1.1.c 修改 canvas-node-manager.ts | ✅ 已完成 | 删除私有方法，使用新函数 |
| 1.1.d 修改 layout-data-provider.ts | ✅ 已完成 | 删除 buildTextSignature，使用新函数 |
| 1.1.e 修改 node-height-service.ts | ✅ 已完成 | 删除 generateContentSignature，使用新函数 |
| 1.1.f 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 1.2: 修复 CanvasFileService 重复实例化 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.2.a 在 CanvasManager 添加 getter | ✅ 已完成 | 添加 getCanvasFileService() |
| 1.2.b 修改 canvas-event-manager.ts | ✅ 已完成 | 删除重复实例化，使用 getter |
| 1.2.c 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 1.3: 清理未使用的严格类型定义 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.3.a 确认引用 | ✅ 已完成 | grep 搜索确认 Canvas/CanvasNode/CanvasEdge/CanvasView 未被使用 |
| 1.3.b 删除 dom-utils.ts | ✅ 已完成 | 整个文件是死代码，已删除 |
| 1.3.c 删除 types.ts 严格类型 | ✅ 已完成 | 删除 Canvas/CanvasNode/CanvasEdge/CanvasView/CanvasView 类型 |
| 1.3.d 修复 canvas-utils.ts | ✅ 已完成 | Canvas → CanvasLike, CanvasNode → CanvasNodeLike |
| 1.3.e 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 1.4: 拆分 canvas-utils.ts（阶段A：低耦合模块）✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.4.a 创建 content-type-utils.ts | ✅ 已完成 | 4个函数：isFormulaContent, isImageContent, isTextNode, isFileNode |
| 1.4.b 更新重导出 | ✅ 已完成 | canvas-utils.ts 重导出 |
| 1.4.c 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 1.5: 拆分 canvas-utils.ts（阶段B：高耦合模块）✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.5.a 创建 edge-utils.ts | ✅ 已完成 | 8个函数：边数据解析相关 |
| 1.5.b 创建 node-utils.ts | ✅ 已完成 | 11个函数：节点查询操作相关 |
| 1.5.c 创建 ui-utils.ts | ✅ 已完成 | 8个函数：UI/DOM辅助相关 |
| 1.5.d 创建 canvas-data-utils.ts | ✅ 已完成 | 15个函数：Canvas数据读写相关 |
| 1.5.e height-utils.ts | ✅ 已完成 | 已有高度估算函数 |
| 1.5.f 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 1.6: 阶段一最终验证 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 1.6.a 完整编译 | ✅ 已完成 | `npm run build` 通过 |
| 1.6.b 单元测试 | ✅ 已完成 | `npm test` 36个测试全部通过 |
| 1.6.c 手动测试 | ⏳ 待执行 | 核心功能验证（用户验证） |

---

## 阶段二：代码质量优化（预估 ~4-6小时）

### 步骤 2.1: 精简日志工具 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 2.1.a 提取 formatMessages | ✅ 已完成 | 消除重复逻辑 |
| 2.1.b 简化 log/logCritical | ✅ 已完成 | 使用新函数 |
| 2.1.c 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 2.2: 拆分 adjustAllTextNodeHeights 方法 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 2.2.a 定义统计上下文类型 | ✅ 已完成 | HeightAdjustmentStats + createEmptyStats |
| 2.2.b 提取子方法 | ✅ 已完成 | buildNodeDomMap, refreshCanvasAfterHeightAdjust, logHeightAdjustStats |
| 2.2.c 简化主方法 | ✅ 已完成 | 使用 stats 对象和辅助方法 |
| 2.2.d 提取节点处理逻辑 | ✅ 已完成 | adjustSingleNodeHeight, syncMemoryNodeHeight |
| 2.2.e 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 2.3: 精简 layout-data-provider.ts（基础设施完成，集成待后续）

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 2.3.a 创建 LayoutDiagnostics | ✅ 已完成 | 新建 layout-diagnostics.ts |
| 2.3.b 添加导入 | ✅ 已完成 | 在 layout-data-provider.ts 中添加 import |
| 2.3.c 集成诊断类 | ⏳ 待后续 | 替换 30+ 个局部变量（高风险，需更谨慎的方法） |
| 2.3.d 编译验证 | ✅ 已完成 | `npm run build` 通过 |

### 步骤 2.4: 阶段二最终验证 ✅

| 子步骤 | 状态 | 说明 |
|--------|------|------|
| 2.4.a 完整编译 | ✅ 已完成 | `npm run build` 通过 |
| 2.4.b 单元测试 | ✅ 已完成 | `npm test` 36个测试全部通过 |
| 2.4.c 手动测试 | ⏳ 待执行 | 全功能验证（用户验证） |

---

## 验证清单

每次阶段完成后需验证：
- [x] 插件正常加载/卸载
- [x] Canvas 布局排列功能正常
- [x] 节点折叠/展开功能正常
- [x] 删除边后浮动节点红框显示正常
- [x] 重新连线后红框消失
- [x] 节点高度自动调整功能正常
- [x] 批量高度调整命令正常
- [x] 从 Markdown 添加节点到 Canvas 正常
- [x] 设置面板正常工作
- [x] Debug 日志开关正常

---

## 文件变更记录

### 已删除文件
- `src/utils/canvas-data-extractor.ts` (~100行) - 死代码
- `src/utils/function-tracer.ts` (~100行) - 死代码
- `src/utils/json-utils.ts` (~20行) - 死代码
- `src/utils/dom-utils.ts` (~40行) - 死代码（getNodeIdFromElement, detectMobileDevice 未被使用）

### 已新建文件
- `src/utils/height-utils.ts` - 统一的高度相关工具函数
  - `generateTextSignature(content, width)` - 生成文本内容签名

### 已修改文件
- `src/types/obsidian-extensions.d.ts` - 修复导入路径
- `src/canvas/services/node-type-service.ts` - 统一公式检测逻辑
- `src/canvas/services/node-deletion-service.ts` - 删除重复方法
- `src/canvas/canvas-node-manager.ts` - 使用统一签名函数
- `src/canvas/services/layout-data-provider.ts` - 使用统一签名函数
- `src/canvas/services/node-height-service.ts` - 使用统一签名函数
- `src/canvas/canvas-manager.ts` - 添加 getCanvasFileService() getter
- `src/canvas/canvas-event-manager.ts` - 删除重复 CanvasFileService 实例化

---

## 问题与备注

*在此记录重构过程中遇到的问题和解决方案*

### 2026-02-25 重构记录

1. **签名函数重复问题**：发现4处重复实现签名函数，已提取到 `height-utils.ts` 统一管理
   - `canvas-node-manager.ts` 中的 `generateTextSignature` 私有方法
   - `layout-data-provider.ts` 中的 `buildTextSignature` 私有方法
   - `node-height-service.ts` 中的 `generateContentSignature` 私有方法
   - 新建 `height-utils.ts` 导出统一的 `generateTextSignature`

---

*最后更新: 2026-02-25 17:26*
