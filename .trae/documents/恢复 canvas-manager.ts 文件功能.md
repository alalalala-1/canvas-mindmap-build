## 恢复计划

基于 backup 文件夹中的旧版本代码，我将恢复 `canvas-manager.ts` 文件的完整功能：

### 1. 文件结构恢复
- 将 `main.ts` 中的功能拆分到 `canvas-manager.ts`
- 保持重构后的架构（使用 CollapseStateManager, LayoutManager 等）

### 2. 核心功能恢复
1. **折叠/展开节点** - 修复孙节点闪现问题
2. **删除节点** - 支持单个删除和级联删除
3. **删除边** - 支持删除选中的边
4. **自动布局** - arrangeCanvas 和 autoArrangeAfterToggle
5. **添加节点到 Canvas** - addNodeToCanvas
6. **折叠按钮管理** - 检查、添加、更新按钮
7. **折叠状态持久化** - 保存到 Canvas 文件

### 3. 关键修复
- **展开节点逻辑**：修改 `expandNode` 方法，根据子节点的折叠状态决定是否显示孙节点，避免闪现问题
- **按钮高度**：使用百分比高度或 ResizeObserver 确保按钮与节点同高
- **孤立节点处理**：删除边后将孤立节点及其子节点移动到父节点下方

### 4. 依赖文件检查
需要确保以下文件存在且功能完整：
- `src/canvas/layout-manager.ts` - 布局管理
- `src/canvas/layout.ts` - 布局算法
- `src/state/collapse-state.ts` - 折叠状态管理
- `src/ui/delete-modal.ts` - 删除确认对话框

请确认此计划后，我将开始执行恢复工作。