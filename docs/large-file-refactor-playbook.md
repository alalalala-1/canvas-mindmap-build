# Large File Refactor Protocol (LFRP)

## 概述

本文档定义了在 VSCode + Cline + GPT/Claude 环境下，对 **1000 行以上代码文件** 进行安全、稳定修改的标准协议。

### 核心问题

在处理大型代码文件（尤其是 1000~5000 行）时，常见以下问题：
- **整文件 patch 失败**：Cline 的 `replace_in_file` 工具在处理大块替换时容易超时、卡死或无法应用；
- **上下文不够唯一**：大文件中存在大量相似结构（重复函数、相似分支），导致 SEARCH 块无法精确匹配；
- **会话中断**：长时间无响应触发 summarize_task，导致修改中断；
- **死循环重试**：patch 失败后重复尝试同样的大块修改，而不切换策略。

### 核心原则

**LFRP 的核心是"分块定位 + 局部修改 + 脚本兜底 + 小步验证"，而非"整文件读写"。**

---

## 一、文件大小决策阈值

### < 400 行
- 正常使用 `replace_in_file` 进行小 patch；
- 可以进行函数级别的整段替换。

### 400~1200 行
- **按函数/类方法级别 patch**；
- 避免整文件重写；
- 每次 SEARCH/REPLACE 块控制在 20~120 行；
- 如果同一文件需要多处修改，拆成多个独立 patch。

### 1200~2500 行
- **只做局部定点修改**；
- 先用 `search_files`、`list_code_definition_names` 定位目标区域；
- 每次 patch 控制在 1 个函数 / 1 个 block；
- **禁止整文件 read → 整文件 write**；
- 同类机械修改（批量重命名、批量插入字段）交给 **Node/Python 脚本**。

### > 2500 行 或 重复结构多
- **停止直接大 patch**；
- 必须使用 **block marker + 脚本替换** 或 **先拆文件再修改**；
- 如果文件已经带 marker（例如 `// >>> BLOCK:xxx:START`），使用 `scripts/large-file/replace-block.mjs`；
- 如果没有 marker，优先考虑"拆文件重构"，再做功能修改。

---

## 二、标准修改流程

### 步骤 1：盘点文件结构
- 使用 `list_code_definition_names` 获取文件中的类、函数、方法列表；
- 使用 `search_files` 搜索关键模式；
- 识别可拆离的模块、重复结构、核心逻辑。

### 步骤 2：定义 Edit Units
将修改任务拆解为多个独立的 **Edit Unit**，每个 unit：
- 只涉及 1 个函数 / 1 个 class method / 1 个 block；
- 改动行数控制在 20~120 行；
- 有明确的前后边界；
- 可以独立验证。

### 步骤 3：分步执行
- 每次只执行 1 个 Edit Unit；
- 执行后立即验证（tsc、eslint、测试）；
- 通过后再进行下一个 unit；
- 如果某个 unit 的 patch 失败，**立即切换到脚本方案**，不要重复尝试。

### 步骤 4：脚本兜底
当遇到以下情况时，必须切换到脚本替换：
- 第一次 patch 失败；
- 文件超过 2500 行；
- 需要批量修改多处相似代码；
- 重复结构导致 SEARCH 块无法唯一匹配。

使用 `scripts/large-file/replace-block.mjs`：
```bash
node scripts/large-file/replace-block.mjs \
  --file src/canvas/canvas-event-manager.ts \
  --block native-insert-core \
  --content ./temp/new-block-content.ts
```

### 步骤 5：小步验证
每完成一个 Edit Unit，立即执行：
```bash
npm run build      # 确保编译通过
npm run lint       # 确保代码规范
npm run test       # 确保测试通过
```

如果验证失败，立即回滚该 unit，调整策略后重试。

---

## 三、针对本仓库超大文件的具体建议

### 当前超大文件清单
| 文件 | 行数 | 建议策略 |
|------|------|---------|
| `src/canvas/canvas-event-manager.ts` | ~3157 | 优先拆分：抽离 native insert、edge selection、viewport change 等子模块 |
| `src/canvas/services/edge-geometry-service.ts` | ~2649 | 可保留，但修改时必须用 block 级 patch |
| `src/canvas/layout-manager.ts` | ~2420 | 可保留，但修改时必须用 block 级 patch |

### 对 `canvas-event-manager.ts` 的拆分建议
这是最大的文件（3157 行），建议分步拆分：

**Phase 1: 无行为变化重构**
- 抽离 `native-insert-*` 相关方法 → `src/canvas/event-manager/native-insert-engine.ts`
- 抽离 `edge-selection-*` 相关方法 → `src/canvas/event-manager/edge-selection-engine.ts`
- 抽离 `viewport-*` 相关方法 → `src/canvas/event-manager/viewport-engine.ts`

**Phase 2: 接口稳定化**
- 为抽离的模块定义清晰接口；
- 原 `CanvasEventManager` 通过组合调用子引擎。

**Phase 3: 功能修改**
- 在各子模块内进行功能增强；
- 每个子模块文件控制在 300~800 行。

---

## 四、失败处理与死循环避免

### 识别死循环信号
如果出现以下情况，说明陷入死循环：
- 同一个 patch 失败 2 次以上；
- summarize_task 被触发；
- 工具调用超时或无响应。

### 立即切换策略
**不要重复失败的 patch**，立即执行以下之一：
1. **拆小 Edit Unit**：将原本 200 行的 SEARCH/REPLACE 拆成 3 个 50 行的独立 patch；
2. **切换脚本方案**：使用 `scripts/large-file/replace-block.mjs`；
3. **先拆文件**：如果文件结构混乱，先做无行为变化重构，拆成多个小文件；
4. **暂停并咨询**：向用户说明当前困境，请求调整策略。

---

## 五、Block Marker 规范

为了支持脚本精确替换，建议在大文件中使用以下 marker 格式：

```typescript
// >>> BLOCK:native-insert-core:START
export class NativeInsertEngine {
  // ... implementation
}
// <<< BLOCK:native-insert-core:END
```

Marker 规则：
- 必须成对出现（START/END）；
- block-name 必须唯一；
- 不要嵌套；
- 建议在拆分前先加 marker，拆分后再移除。

---

## 六、提示词模板

### 模板 A：最短引用
```
按 LFRP 策略处理这个大文件。
```

### 模板 B：新任务完整模板
```
请遵循本仓库 AGENTS.md 中的 LFRP（Large File Refactor Protocol）。
先阅读 docs/large-file-refactor-playbook.md。
目标文件：<文件路径>
任务目标：<你要改什么>
要求：
1. 禁止整文件重写；
2. 先识别 block / function 级 edit units；
3. 分步修改，每步都说明影响范围；
4. 如 patch 失败，直接切 scripts/large-file/replace-block.mjs；
5. 修改后执行最小必要验证。
```

### 模板 C：针对拆分重构
```
按 LFRP 先为 `src/canvas/canvas-event-manager.ts` 制定拆分计划：
1. 识别可抽离模块；
2. 列出 edit units；
3. 先做无行为变化重构；
4. 再分步提交功能修改。
```

---

## 七、验证清单

每次大文件修改后，必须通过以下验证：
- [ ] TypeScript 编译通过（`npm run build`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] 单元测试通过（`npm run test`）
- [ ] Git diff 确认只改了预期区域
- [ ] 功能手动验证（如需要）

---

## 八、工具清单

### 脚本工具
- `scripts/large-file/generate-fixture.mjs`：生成 3000 行测试夹具
- `scripts/large-file/list-blocks.mjs`：列出文件中的所有 block
- `scripts/large-file/replace-block.mjs`：精确替换指定 block

### 命令快捷方式
```bash
npm run large-edit:generate    # 生成测试夹具
npm run large-edit:list -- --file <path>  # 列出 blocks
npm run large-edit:test        # 运行策略验证测试
```

---

## 九、经验总结

### ✅ 推荐做法
- 先定位，不整文件读写；
- 先小 patch，失败立即切脚本；
- 重复结构用 marker/block 替换；
- 每完成一小段就验证；
- 必要时先做"拆文件/抽模块"重构，再做功能修改。

### ❌ 避免做法
- 不要一次性读取 3000 行文件再全量输出；
- 不要在 patch 失败后重复尝试同样的大块修改；
- 不要在没有验证的情况下连续做多个 edit unit；
- 不要忽略编译/测试错误继续修改；
- 不要在重复结构中使用不够唯一的 SEARCH 块。

---

## 十、后续改进方向

1. **自动 block marker 插入**：为现有大文件自动添加 marker；
2. **拆分建议生成器**：根据文件依赖分析自动建议拆分方案；
3. **Edit unit 粒度优化**：根据历史成功率动态调整每次修改的行数范围；
4. **失败模式库**：记录常见 patch 失败模式，提前避免。

---

**版本**: 1.0.0  
**更新时间**: 2026-03-14  
**维护者**: AI Assistant (Cline)
