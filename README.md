# Canvas Mindmap Build

> **为 Obsidian Canvas 打造的思维导图插件**
> 从 Markdown 笔记选取内容生成节点，支持折叠、布局整理与浮动节点管理。

---

## ✨ 功能亮点

- 📝 **从 Markdown 添加节点** — 选中文字、图片或公式，一键添加到 Canvas 思维导图
- 🔗 **跳转回源文件** — 点击节点可跳转到对应 Markdown 选区
- 📐 **节点折叠/展开** — 折叠子树，保持画布整洁；折叠状态自动保存
- 🎨 **自动布局** — 树形布局，自动整理节点位置
- 🎯 **浮动节点管理** — 删除连线后节点变为浮动状态（红框标识），重新连线后自动恢复
- 📏 **高度自适应** — 文本节点高度根据内容长度自动调整

---

## 🚀 快速上手

### 1. 配置目标 Canvas

打开 **设置 → Canvas Mindmap** → 填写目标 Canvas 文件路径（相对于 Vault 根目录）。

### 2. 添加节点

1. 在任意 Markdown 文件中选中内容
2. 打开命令面板（`Ctrl/Cmd + P`）
3. 执行 **Add to Canvas Mindmap**

### 3. 整理布局

执行命令 **Arrange Canvas Mindmap Layout**，自动整理画布节点位置。

### 4. 折叠节点

有子节点的父节点右侧会显示折叠按钮，点击即可折叠/展开子树。

---

## ⚙️ 主要设置

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| Target Canvas File | 目标 Canvas 文件路径 | — |
| Enable Text Auto Size | 文本节点高度自适应 | ✅ |
| Text Node Width | 文本节点宽度 | 400 |
| Horizontal Spacing | 父子节点水平间距 | 200 |
| Vertical Spacing | 兄弟节点垂直间距 | 40 |
| Collapse Button Color | 折叠按钮颜色 | #e74c3c |
| Enable Formula Detection | 自动识别公式节点 | ✅ |
| Enable Debug Logging | 调试日志 | ❌ |

---

## 📋 命令列表

| 命令 | 说明 |
|------|------|
| Add to Canvas Mindmap | 将选中内容添加为节点 |
| Arrange Canvas Mindmap Layout | 自动整理布局 |
| Delete Selected Edge | 删除选中的连线 |
| Adjust All Text Node Heights | 批量调整文本节点高度 |

---

## 📦 安装

### 手动安装
将 `main.js`、`manifest.json`、`styles.css` 复制到：
```
<Vault>/.obsidian/plugins/canvas-mindmap-build/
```
在 Obsidian **设置 → 社区插件** 中启用。

### 系统要求
- Obsidian v0.15.0+
- 支持桌面端与移动端

---

## 📝 更新日志

### v1.3.0
- 重构架构：拆分 CollapseToggleService、EdgeGeometryService，layout-manager 精简 51%
- 删除冗余工具文件，代码结构更清晰

### v1.2.0
- 新增浮动节点管理（红框标识、状态持久化、自动恢复）
- 新增边/节点删除确认对话框
- 优化布局算法，修复多个边几何问题

### v1.1.0
- 新增节点删除确认（支持仅删除/级联删除）
- 新增文本节点高度自适应
- 优化折叠/展开后的自动布局

### v1.0.0
- 初始版本：添加节点、折叠展开、跳转源文件
