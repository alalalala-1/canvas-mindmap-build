# Canvas Mindmap Build

> **中文**：为 Obsidian Canvas 打造的思维导图插件，从 Markdown 选区快速生成结构化画布。  
> **English**: An Obsidian Canvas mindmap plugin that turns Markdown selections into structured canvas nodes.

---

## ✨ Features / 功能亮点

- 📝 **Add nodes from Markdown / 从 Markdown 添加节点**  
  Convert selected text, images, or formulas into Canvas nodes in one command.
- 🔗 **Jump back to source / 跳转回源文件**  
  Click a node to navigate back to the source note/selection.
- 📐 **Collapse & expand subtrees / 子树折叠展开**  
  Keep large maps readable and preserve collapse state.
- 🎨 **Auto layout / 自动布局**  
  Organize nodes into a clean tree layout.
- 🎯 **Floating node handling / 浮动节点管理**  
  Nodes can enter/leave floating state after edge changes.
- 📏 **Adaptive text node height / 文本节点高度自适应**  
  Height is adjusted based on rendered content.

---

## 🚀 Quick Start / 快速上手

### 1) Set target Canvas / 配置目标 Canvas
- **CN**：打开 *Settings → Canvas Mindmap Build*，填写目标 Canvas 文件路径（相对 Vault 根目录）。
- **EN**: Open *Settings → Canvas Mindmap Build* and set the target Canvas file path (relative to your vault root).

### 2) Add nodes / 添加节点
1. Select content in a Markdown note.
2. Open Command Palette (`Ctrl/Cmd + P`).
3. Run **Add to canvas mindmap**.

### 3) Arrange layout / 整理布局
- Run **Arrange canvas mindmap layout** to automatically organize node positions.

### 4) Collapse nodes / 折叠节点
- Parent nodes with children show a collapse button on the right side.

---

## ⚙️ Main Settings / 主要设置

| Setting | Description | Default |
|---|---|---|
| Target Canvas File | Target canvas file path | — |
| Enable Text Auto Size | Adaptive text node height | ✅ |
| Text Node Width | Text node width | 400 |
| Horizontal Spacing | Parent-child horizontal spacing | 200 |
| Vertical Spacing | Sibling vertical spacing | 40 |
| Collapse Button Color | Collapse button color | `#e74c3c` |
| Enable Formula Detection | Formula node detection | ✅ |
| Enable Debug Logging | Debug logs | ❌ |

---

## 📋 Commands / 命令列表

| Command | Description |
|---|---|
| Add to canvas mindmap | Add selected text/image/formula as canvas node |
| Arrange canvas mindmap layout | Auto arrange canvas node layout |
| Repair node fromLinks | Repair source link references for nodes |

---

## 📦 Installation / 安装

### Manual install / 手动安装
Copy `main.js`, `manifest.json`, and `styles.css` to:

```text
<Vault>/.obsidian/plugins/canvas-mindmap-build/
```

Then enable it in **Settings → Community plugins**.

### Compatibility / 平台兼容性

| Platform | Status |
|---|---|
| macOS | ✅ Tested |
| Android | ✅ Tested |
| iOS | ⚠️ Not tested yet |
| Windows | ⚠️ Not tested yet |
| Linux | ⚠️ Not tested yet |

- Requires Obsidian `v0.15.0+`
- `isDesktopOnly: false` (mobile supported)

---

## 📝 Changelog / 更新日志

### v2.0.0
- 底层 bug 修复完成：滚动条、布局、链接、框高、分屏、横屏、竖屏等核心场景修复。
- Core bugfix release: improved scrolling, layout, links, node height, split-screen, landscape, and portrait behavior.

### v1.3.0
- Refactored architecture: split services and simplified layout pipeline.

### v1.2.0
- Added floating node state management and edge/node deletion confirmations.

### v1.1.0
- Added adaptive text node height and improved post-collapse layout behavior.

### v1.0.0
- Initial release.
