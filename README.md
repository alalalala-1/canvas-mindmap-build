# Canvas Mindmap Build for Obsidian

一个 Obsidian 插件，用于在 Canvas 画布中构建和管理思维导图。

## 功能特性

### 📝 添加节点到 Canvas
- 在 Markdown 编辑器中选中文字或图片
- 运行命令 `Add to Canvas Mindmap`
- 自动将选中的内容作为节点添加到 Canvas

### 🔗 从链接跳转
- 点击 Canvas 节点可跳转到源文件
- 自动记录节点与源文件的链接关系
- 支持文本节点和图片节点的链接跳转

### 📐 节点折叠/展开
- 自动为有子节点的父节点添加折叠按钮
- 点击按钮可折叠/展开子节点
- 支持多级节点的递归折叠/展开
- **新增**：折叠/展开时自动重新布局可见节点，保持合理的间距

### 🗑️ 节点删除确认
- **新增**：删除节点时弹出确认对话框
- 提供三种删除选项：
  - **取消**：不执行删除操作
  - **单个**：删除当前节点，子节点自动连接到父节点
  - **级联**：删除当前节点及其所有子节点

## 使用方法

### 1. 配置目标 Canvas 文件
1. 打开 Obsidian 设置
2. 进入插件设置 → Canvas Mindmap
3. 设置目标 Canvas 文件路径（相对于保险库根目录）

### 2. 添加节点
1. 在 Markdown 文件中选中文字或图片
2. 使用命令面板（Ctrl/Cmd + P）运行 `Add to Canvas Mindmap`
3. 新节点将自动添加到 Canvas 中

### 3. 折叠/展开节点
- 节点右侧会自动显示折叠按钮（红色）
- 点击按钮可展开/折叠子节点
- 按钮状态：红色实心=已折叠，红色边框=已展开

## 设置选项

| 设置项 | 说明 | 默认值 |
|-------|------|-------|
| Target Canvas File | 目标 Canvas 文件路径 | - |
| Text Node Width | 文本节点宽度 | 300 |
| Text Node Max Height | 文本节点最大高度 | 400 |
| Image Node Width | 图片节点宽度 | 400 |
| Image Node Height | 图片节点高度 | 400 |
| Horizontal Spacing | 水平间距（父子节点） | 200 |
| Vertical Spacing | 垂直间距（兄弟节点） | 40 |

## 安装

### 手动安装
1. 将 `main.js`、`manifest.json`、`styles.css` 复制到 `<保险库>/.obsidian/plugins/canvas-mindmap-build/`
2. 在 Obsidian 设置中启用插件

### 社区插件
通过 Obsidian 设置 → 社区插件 → 浏览搜索 "Canvas Mindmap"

## 系统要求

- Obsidian v0.15.0+
- 支持 macOS、iOS、Android

## 技术说明

- 使用 TypeScript 开发
- 无外部运行时依赖
- 纯本地操作，不收集任何数据

## 更新日志

### v1.0.0
- 初始版本
- 添加节点到 Canvas 功能
- 节点折叠/展开功能
- 从链接跳转功能