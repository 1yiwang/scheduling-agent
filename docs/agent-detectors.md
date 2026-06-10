# Agent Loop Detector 速查表

这份文档记录 Agent Loop 里**已实现的全部 detector**，用统一格式编目，方便后续新增 detector 时对照、查阅、追加。

代码位置：`index.html`（搜索函数名即可定位）。
配套测试：`tests/<name>-detector.test.js`。

---

## 0. 总览与共享地基

### 运行流程

```
触发（打开 app / 任何数据改动后）
  → runAgentLoop()                       // detectors → 过滤 dismiss → 按 severity 排序
  → mergeMoves()                         // 合并“同一事件被多个 detector 报”的卡
  → curate(merged, buildAgentContext())  // 策展：排序 + 折叠（rules / 未来 LLM）
  → applyCuration()                      // 套用决策 + 强制安全护栏
  → 简报渲染（Due today / Coming up；折叠项在 “More” 里）
```

详见下文「§8 策展层（Layer 1）」。

### 设计原则

- **注册即生效**：加新能力 = 写一个 detector 函数 + push 进 `MOVE_DETECTORS`，不动其他代码。
- **propose-only**：detector 只生产 `Move` 对象，从不直接写库。执行永远走 `proposedActions[].fn` 指向的确认函数，经 `runMoveAction()` 派发。
- **安静优先**：找不到安全动作（无可移动事件、无空档、无更轻的目标日）就**不产出 move**，避免唠叨。
- **可跳过**：每个 move 都能用 `×`（`dismissMove`）跳过，本次会话内不再出现。

### 共享常量 / 工具

| 名称 | 作用 |
|---|---|
| `AGENT_HORIZON_DAYS = 9` | 大多数 detector 的扫描窗口（从今天起 9 天） |
| `OVERLOAD_MINUTES = 8*60` | Rebalance 判定过载的阈值 |
| `getFreeWindowsForDate(y,m,d,minMin,excludeId)` | 找某天的空档；`excludeId` 可临时忽略某事件 |
| `getDayEvents(y,m,d)` | 取某天全部事件 |
| `eventScheduledForTask(source,id)` | 任务是否已排块（查 `sourceTaskId`） |
| `eventIsPastForAgent(y,m,d,ev)` | 事件相对 `appNow()` 是否已过去 |
| `isoDaysFromToday(iso)` / `daysFromToday(iso)` | 距今天数 |
| `runMoveAction(moveId, actionIdx)` | 派发已选动作；执行前重算 move，保证 payload 反映当前状态 |
| `dismissMove(id)` | 本会话跳过某 move |

### Move 对象结构（所有 detector 统一产出）

| 字段 | 含义 |
|---|---|
| `id` | 全局唯一，含来源 + 关键实体 id（用于 dismiss 去重） |
| `type` | detector 类型标识（见下表各节） |
| `severity` | `critical` / `high` / `normal`，决定排序与配色 |
| `daysUntil` | 距今天数，决定进 Due today（≤0）还是 Coming up（>0） |
| `title` | 简报里显示的主文案 |
| `dueShort` | 右侧小标签（如 `due 2d` / `overdue` / `8.5h booked`） |
| `subject` | 关联实体（`eventId` / `source+id` 等），供动作与测试断言 |
| `mins` | 涉及时长（手动选时段的默认时长） |
| `dueISO` | 默认日期（手动选时段用） |
| `proposedActions[]` | `{ label, fn, payload }`，第 0 个为最推荐；其余为展开后的备选 |

### `runMoveAction` 支持的动作 `fn`

`scheduleTaskToSlot` · `moveEventToSlot` · `markFollowUpDone` · `markComplete` · `createPrepBlock`

### 当前注册表

```js
const MOVE_DETECTORS = [
  detectExistingConflicts,  // critical
  detectFollowUpsDue,       // high / normal
  detectCleanupNeeded,      // normal
  detectPrepNeeded,         // high / normal
  detectOverloadRebalance,  // normal
  detectDeadlineRisk,       // critical / high / normal
];
```

---

## 1. Deadline-risk — `detectDeadlineRisk`

| 项 | 内容 |
|---|---|
| **type** | `deadline_risk` |
| **解决的问题** | 有 deadline 但还没排进日程的任务，临近时可能被忘掉 |
| **触发条件** | `getInboxItems()` 里：有 deadline、未完成、**且未排块**（`eventScheduledForTask`）；`daysUntil ≤ AGENT_HORIZON_DAYS` |
| **severity** | `≤1d` critical / `≤2d` high / 其余 normal |
| **动作** | `proposeSlotsForTask(it,4)` → `scheduleTaskToSlot`（每天最早可用空档，首个最推荐） |
| **安静策略** | 已排块或 deadline 太远（>9d）不产出 |
| **测试** | `tests/*`（最早的 loop 骨架测试） |

---

## 2. Existing-conflict — `detectExistingConflicts`

| 项 | 内容 |
|---|---|
| **type** | `existing_conflict` |
| **解决的问题** | 日程里已经存在的时间重叠 |
| **触发条件** | 扫描 horizon 内每天，按开始时间排序后两两检测重叠（`aS < bE && aE > bS`），同一对去重 |
| **选谁移动** | `chooseMovableConflictEvent(a,b)`：先选**较短**的；时长相同选**开始更晚**的。另一个为 `fixed` |
| **severity** | `critical` |
| **动作** | `getFreeWindowsForDate(..., excludeId=movable)` 取前 4 个空档 → `moveEventToSlot` |
| **subject** | `{ eventId: movable, conflictWithId: fixed }` |
| **测试** | `tests/conflict-detector.test.js` |

---

## 3. Overdue follow-up — `detectFollowUpsDue`

| 项 | 内容 |
|---|---|
| **type** | `follow_up_due` |
| **解决的问题** | 会后待办（follow-up）到期/逾期还没处理 |
| **触发条件** | 事件 `followUpNeeded && followUpStatus==='pending' && followUpBy`，且 `daysUntil ≤ 0`（今天到期或已逾期） |
| **severity** | 逾期 high / 今天到期 normal |
| **动作** | `markFollowUpDone(eventId)`（一键 Done，把状态置 `done`） |
| **title** | 优先用 `followUpNote`，否则 `Follow up: <事件名>` |
| **测试** | `tests/followup-detector.test.js`（断言收窄到 `type==='follow_up_due'`，避免与 cleanup 耦合） |

---

## 4. Cleanup — `detectCleanupNeeded`

| 项 | 内容 |
|---|---|
| **type** | `cleanup_unmarked` |
| **解决的问题** | 已经过去的重要事件没标记完成状态，数据缺口影响学习/分析 |
| **触发条件** | `type ∈ {deep,busy,online}`、`getCompletion(ev) === null`（未标记）、`eventIsPastForAgent` 为真 |
| **severity** | `normal` |
| **动作** | `markComplete(eventId, true)`（Done）/ `markComplete(eventId, false)`（Not done） |
| **测试** | `tests/cleanup-detector.test.js` |

---

## 5. Prep — `detectPrepNeeded`

| 项 | 内容 |
|---|---|
| **type** | `prep_needed` |
| **解决的问题** | 重要会议前没有准备时间 |
| **触发条件** | horizon 内、`type ∈ {busy,online}`、有 participants 或 context（按事件属性判定，**非标签**）、尚无 prep（`eventHasPrep` 查 `prepForEventId`）、会前有可用 30m 空窗（`prepSlotBeforeEvent`） |
| **severity** | `≤1d` high / 其余 normal |
| **动作** | `createPrepBlock(eventId,...)`：在会前空窗建一个标了 `prepForEventId` 的 `deep` block |
| **安静策略** | 已有 prep、无 participants/context、或会前无空窗都不产出 |
| **测试** | `tests/prep-detector.test.js` |

---

## 6. Overload rebalance — `detectOverloadRebalance`

| 项 | 内容 |
|---|---|
| **type** | `overload_rebalance` |
| **解决的问题** | 某天 work 时长过载，建议把焦点块挪到更轻的一天 |
| **触发条件** | horizon 内某天 `dayWorkMinutes > OVERLOAD_MINUTES`（8h；统计 deep/busy/online） |
| **选谁移动** | `pickRebalanceEvent`：只挑 **deep** focus block，取最短（同长取更早）。**不动带 participants 的会议** |
| **目标日** | 另一天，加上该块后不超过 8h，且有可用空档；最多给 3 个备选 |
| **severity** | `normal` |
| **动作** | `moveEventToSlot` 到目标日空档 |
| **dueShort** | `<X>h booked`（当天总时长） |
| **安静策略** | 无可移动 deep 块、或无更轻目标日则不产出 |
| **测试** | `tests/rebalance-detector.test.js` |

---

## 8. 策展层（Layer 1）

坐在 detector 之上的视图层，只做「挑选、排序、合并、折叠」，**永不改动作 payload**。

| 函数 | 职责 |
|---|---|
| `mergeMoves(moves)` | 合并 `subject.eventId` 相同的多个 move：取最高 severity / 最紧迫 daysUntil，union 动作（去重），记 `mergedFrom`。无 eventId 的（如 deadline-risk）原样透传 |
| `buildAgentContext()` | 紧凑画像卡（**统计量而非流水账**）：今天负载、近两天是否有带人会议、按类型的 dismiss 计数、`prefStore` 的 Beta 均值偏好 |
| `curate(moves, ctx)` | 调度器：demo/回退用 `curateMovesRules`，个人版（Phase B）用 `curateMovesLLM` |
| `curateMovesRules(moves, ctx)` | 确定性策展：按 severity → 习惯性 dismiss 降权 → 紧迫度排序；可见上限 `CURATION_VISIBLE_CAP=5`，其余折叠；critical 永不折叠。返回 `{ order, folded }` |
| `applyCuration(moves, decision)` | **安全核心（纯函数）**：套用 `{order,folded}` → `{visible,folded}`，强制护栏：critical 必可见且置顶、未知 id 忽略、缺失 move 补回、critical 永不被折叠、非法决策回退默认序 |
| `currentMoves()` | UI/动作共享的规范列表 = `mergeMoves(runAgentLoop())`。`runMoveAction`/`confirmMoveCustomSlot`/`dismissMove` 都走它，保证动作索引与合并 dismiss 一致 |

**决策对象契约**（rules 与未来 LLM 输出同形）：`{ order: [moveId...], folded: [moveId...] }`，只含 id，不含任何动作 payload——这是 LLM 无法越权排程的结构性保证。

测试：`tests/merge-moves.test.js` · `tests/apply-curation.test.js`（护栏，最关键）· `tests/agent-context.test.js` · `tests/curate-rules.test.js`。

> 完整设计与 Phase B（Settings + BYO-key LLM）见 `docs/superpowers/plans/2026-06-10-agent-curation-layer.md`。

---

## 7. 如何新增一个 detector（清单）

1. 写纯函数 `detectXxx()`，遍历数据，产出符合上表结构的 `Move[]`；找不到安全动作就返回空。
2. 若引入新动作 `fn`，在 `runMoveAction()` 里加一条派发分支，并实现对应的确认函数（直接写库 + 保存）。
3. push 进 `MOVE_DETECTORS`。
4. 写 `tests/<name>-detector.test.js`：覆盖「该出现」「不该出现（安静）」「执行动作后状态正确」三类断言；注意只断言自己的 `type`，避免与其他 detector 耦合。
5. 跑全量测试 + lint，更新本文档与 `project-description.md` §8 进度。

### 待办候选（尚未实现）

- **Energy Guard**：背靠背 deep work 之间缺缓冲。
- **Context Switch Cost**：频繁 deep ↔ meeting 切换的代价。
