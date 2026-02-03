## 清理计划

### 1. 删除 zoom-handler.ts 文件
- 删除 `/Users/apple/Develop/canvas-mindmap-build/src/canvas/zoom-handler.ts`

### 2. 移除 canvas-manager.ts 中的 zoom 相关代码
- 移除 `import { ZoomToFitHandler } from './zoom-handler'`
- 移除 `private zoomToFitHandler: ZoomToFitHandler | null = null`
- 移除 `this.zoomToFitHandler = new ZoomToFitHandler(canvas, this.collapseStateManager)`
- 移除 unload 中的 zoom handler 清理代码
- 移除 `import { logCanvasAPI } from '../utils/canvas-api-explorer'`

### 3. 删除 canvas-api-explorer.ts 文件
- 删除 `/Users/apple/Develop/canvas-mindmap-build/src/utils/canvas-api-explorer.ts`

### 4. 简化日志输出（可选）
- 可以进一步简化 logger.ts 中的日志格式

### 5. 构建测试
- 运行 npm run build 确保没有错误
- 测试其他功能（折叠、删除、添加节点等）

请确认后我将开始执行清理。