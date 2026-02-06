## 问题分析

日志显示 "重新应用 20 个浮动节点的样式"，这是旧的日志消息格式。问题出在 `layout-manager.ts` 第 838 行调用了 `reapplyAllFloatingStyles()` 但没有传入 `canvas` 参数。

## 修复计划

### 1. 修复 layout-manager.ts
- 修改 `reapplyFloatingNodeStyles` 方法
- 传入 `canvas` 参数给 `reapplyAllFloatingStyles`

### 2. 重新编译
- 运行 `npm run build` 重新编译插件

## 修改内容

**文件**: `src/canvas/layout-manager.ts`
**位置**: 第 838 行

**当前代码**:
```typescript
await this.floatingNodeService.reapplyAllFloatingStyles();
```

**修改后**:
```typescript
await this.floatingNodeService.reapplyAllFloatingStyles(canvas);
```

这样所有调用 `reapplyAllFloatingStyles` 的地方都会传入 `canvas` 参数，确保只应用当前 Canvas 中存在的节点样式。