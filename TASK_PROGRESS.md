# 任务进度追踪

## Phase 1：升级判责日志 ✅ 已完成

### 1.1 EdgeGeom V2 - 增强边缘几何诊断 ✅
- [x] 在 layout-manager.ts 中增强 logEdgeGeometryDiagnostics
- [x] 添加 sampleCount 统计
- [x] 添加端点可见性分桶 (dom-dom/dom-virtual/virtual-virtual)
- [x] 添加锚点偏移校准 (rawErr vs adjErr，扣除7px side offset)
- [x] 添加 before/after 对比指标 (improvedEdges/worseEdges/unchangedEdges)

### 1.2 EdgeRefresh V2 - 几何变更检测 ✅
- [x] 在 refreshEdgeGeometry 中添加 bezier 变化检测
- [x] 添加 pass1/pass2 变化统计 (bezierChangedPass1/bezierChangedPass2)

### 1.3 VirtualizationSummary V2 - 虚拟化摘要 ✅
- [x] 在 layout-data-provider.ts 中添加 zoomRaw 和 zoomScale (从 transform matrix 解析)
- [x] 添加 domZeroRate (百分比)
- [x] 修复 trusted 统计计数不一致问题 (trustedHeightUsedCount/signatureMatchedCount)

---

## 经验/教训沉淀

1. **日志已足够排除数据层，但不足以直接定罪几何层** - 需要更细粒度的诊断
2. **7px恒定误差是强信号** - 应先修诊断模型，区分"真错连"vs"固定样式偏移"
3. **domZero 84.6%下任何几何结论都必须按可见性分桶看** - 不能混算

---

## 新的日志输出示例

### EdgeGeomV2
```
[Layout] EdgeGeomV2(before): edges=122, sample=20, zoom=0.40, mismatch=20(adj=3), maxFromErr=7.0, maxToErr=7.0, avgFromErr=7.0, avgToErr=7.0, adjAvgFromErr=0.0, adjAvgToErr=0.0, buckets=domDom0/domVir3/virVir17, delta=improve0/worse0/unchanged0, ctx=arrange-xxx
```

### EdgeRefreshV2
```
[Layout] EdgeRefreshV2(pass1): rendered=122/122, bezierChanged=0/122, skipped=0
[Layout] EdgeRefreshV2(pass2): rendered=122/122, bezierChanged=0/122, skipped=0
```

### VirtualizationSummaryV2
```
[LayoutData] VirtualizationSummaryV2: zoomRaw=0.40, zoomScale=0.40, domZero=104/123(84.6%), viewport=1200x800, file=4-Canvas.canvas
```
