# LFRP 快速开始指南

## 什么是 LFRP

**LFRP (Large File Refactor Protocol)** 是一套专门为 VSCode + Cline + GPT/Claude 环境设计的大文件（1000+ 行）安全编辑协议。

它解决的核心问题：
- ✅ 避免整文件 patch 超时/卡死
- ✅ 防止重复代码导致 SEARCH 块定位失败
- ✅ 提供脚本兜底方案，避免死循环重试
- ✅ 支持小步验证，降低风险

---

## 快速参考：什么时候用 LFRP

### 立即启用 LFRP 的场景

1. **文件超过 1000 行**（尤其是 2500+ 行）
2. **第一次 `replace_in_file` patch 失败**
3. **你明确说"按 LFRP 执行"**

### 当前仓库的超大文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `src/canvas/canvas-event-manager.ts` | ~3157 | 优先拆分成子模块 |
| `src/canvas/services/edge-geometry-service.ts` | ~2649 | 可保留，但改时用 block patch |
| `src/canvas/layout-manager.ts` | ~2420 | 可保留，但改时用 block patch |

---

## 如何在后续对话中使用 LFRP

### 方式 1：最短触发（推荐）

```
按 LFRP 策略处理这个大文件。
```

### 方式 2：完整指令（新任务）

```
请遵循本仓库 AGENTS.md 中的 LFRP（Large File Refactor Protocol）。
先阅读 docs/large-file-refactor-playbook.md。
目标文件：src/canvas/canvas-event-manager.ts
任务目标：抽离 native insert 相关逻辑
要求：
1. 禁止整文件重写；
2. 先识别 block / function 级 edit units；
3. 分步修改，每步都说明影响范围；
4. 如 patch 失败，直接切 scripts/large-file/replace-block.mjs；
5. 修改后执行最小必要验证。
```

### 方式 3：针对拆分重构

```
按 LFRP 先为 `src/canvas/canvas-event-manager.ts` 制定拆分计划：
1. 识别可抽离模块；
2. 列出 edit units；
3. 先做无行为变化重构；
4. 再分步提交功能修改。
```

---

## 可用工具与命令

### 生成测试夹具
```bash
npm run large-edit:generate
# 或
node scripts/large-file/generate-fixture.mjs --output <path> --sections <N>
```

### 列出文件中的 blocks
```bash
npm run large-edit:list -- --file src/dev/large-file-edit-fixture.ts
# 或
node scripts/large-file/list-blocks.mjs --file <path>
```

### 替换指定 block（脚本兜底方案）
```bash
# Dry run（预览）
node scripts/large-file/replace-block.mjs \
  --file <path> \
  --block <name> \
  --content "<new content>" \
  --dry-run

# 实际替换
node scripts/large-file/replace-block.mjs \
  --file <path> \
  --block <name> \
  --content-file <content-path>
```

### 运行 LFRP 验证测试
```bash
npm run large-edit:test
```

---

## Block Marker 规范

当需要为大文件添加精确替换支持时，使用以下格式：

```typescript
// >>> BLOCK:block-name:START
// ... your code here
// <<< BLOCK:block-name:END
```

**规则**：
- START/END 必须成对出现
- block-name 必须唯一
- 不要嵌套 blocks
- 建议拆分前先加 marker，拆分后移除

---

## 决策阈值速查表

| 文件大小 | 策略 |
|---------|------|
| < 400 行 | 正常 patch，可整段替换函数 |
| 400~1200 行 | 按函数/方法级 patch，每次 20~120 行 |
| 1200~2500 行 | 只做局部定点修改，禁止整文件读写 |
| > 2500 行 | 停止大 patch，改用 block/script 或先拆文件 |

---

## 失败处理流程

### 识别死循环信号
- ✋ 同一个 patch 失败 2 次以上
- ✋ summarize_task 被触发
- ✋ 工具调用超时或无响应

### 立即执行的替代方案
1. **拆小 Edit Unit**：200 行 → 3 个 50 行
2. **切换脚本方案**：使用 `replace-block.mjs`
3. **先拆文件**：无行为变化重构，拆成多个小文件
4. **暂停并咨询**：向用户说明困境

---

## 实际案例：如何改 3000 行文件

假设你要修改 `src/canvas/canvas-event-manager.ts` 中的某个方法：

### ❌ 错误做法
```
1. read_file 整个 3000 行文件
2. 一次性输出包含修改的整文件
3. patch 失败后重复尝试同样的大块修改
```

### ✅ 正确做法（LFRP）
```
1. list_code_definition_names 定位目标方法
2. 只 read 该方法所在的 100 行上下文
3. 生成 20~80 行的 SEARCH/REPLACE block
4. 如失败，改用 replace-block.mjs（需先加 marker）
5. 验证：npm run build && npm run test
```

---

## 测试与验证

### 已验证的工具链
- ✅ 生成 5020 行测试夹具
- ✅ 列出全部 53 个 blocks
- ✅ 精确替换指定 block（含 dry-run）
- ✅ 自动创建备份
- ✅ Block 完整性检查
- ✅ 所有 13 个测试通过

### 测试覆盖
- ✅ Fixture 生成与大小验证
- ✅ Block marker 完整性
- ✅ list-blocks.mjs 功能与错误处理
- ✅ replace-block.mjs dry-run 与实际替换
- ✅ 备份机制
- ✅ 非法参数处理
- ✅ 文档集成验证

---

## 关键文档

- **完整协议**：`docs/large-file-refactor-playbook.md`
- **仓库约定**：`AGENTS.md` → "Large file refactoring" section
- **测试夹具**：`src/dev/large-file-edit-fixture.ts` (5020 行)
- **验证测试**：`src/__tests__/large-file-edit-strategy.test.ts`

---

## 后续改进方向

1. **自动 marker 插入**：为现有大文件自动添加 block markers
2. **拆分建议生成器**：根据依赖分析自动建议拆分方案
3. **粒度自适应**：根据历史成功率动态调整 edit unit 大小
4. **失败模式库**：记录常见失败模式，提前规避

---

## 常见问题

### Q: 什么时候必须用 LFRP？
**A**: 文件 > 1000 行，或第一次 patch 失败时。

### Q: LFRP 会增加工作量吗？
**A**: 短期内需要多一步定位，但能避免几小时的卡死重试，总体更高效。

### Q: 可以直接用 replace-block.mjs 吗？
**A**: 可以，但文件需要先加 block markers。建议先尝试小 patch，失败后再用脚本。

### Q: 如何为现有大文件加 markers？
**A**: 手工或脚本为函数/类/section 加 `>>> BLOCK:xxx:START` 和 `<<< BLOCK:xxx:END`。

### Q: 测试夹具可以删除吗？
**A**: 不建议。它是验证 LFRP 工具链的基准，占用空间不大（~300KB）。

---

**版本**: 1.0.0  
**更新**: 2026-03-14  
**状态**: ✅ 所有工具已验证，可直接投入使用
