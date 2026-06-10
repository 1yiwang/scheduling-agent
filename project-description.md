# Scheduling Agent · 项目架构与进度（Project Description）

> 这是项目的**参考级架构文档**，沉淀「现在是怎么搭的」。
> 头脑风暴/产品决策过程见 `BRAINSTORM.md`；agent 自进化方法论见 `learning agent.md`。
> 最后更新：2026-06-10。

---

## 0. 一句话定位

一个**主动管理日程的 scheduling agent**：不只是日历，而是会主动发现「关于时间你还没想到该做的事」（截止日预警、见缝插针、冲突提示），提出建议、由人确认（propose-only），并从用户行为里学习偏好。核心目标是**零学习成本**——用户一看就会用，背后的事 agent 已经做好。

当前形态：单文件前端原型 `index.html`（HTML+CSS+原生 JS，无框架），数据可持久化到 Supabase / localStorage。

---

## 1. 部署架构

| 维度 | 设计 |
|---|---|
| 托管 | Vercel，单项目 deploy，按 hostname 锁定模式 |
| Demo 站 | `calendar-demo.yiwang.dev` · 固定"今天"= 2026-06-06，演示用假数据 |
| 个人站 | `calendar.yiwang.dev` · 真实当前日期，连 Supabase 存个人数据 |
| 后端 | Supabase：`app_state` 表，每用户一行 JSONB blob（全量应用状态）+ RLS；认证支持 Magic Link 与 Google OAuth，管理员按邮箱 gate |
| 主题 | 永远浅色系列，跟随系统亮/暗（不再做应用内开关）|

**日期抽象**（关键，区分 demo/个人）：
- `appNow()` — "今天"的来源（demo 固定 / 个人真实）。所有日期判断都走它。
- `currentSimNow()` — 时间线上 "Now" 标记的当前时刻。

---

## 2. 数据模型

所有数据是**内存中的 JS 对象**，通过 `saveAppData()` 序列化持久化。

| 存储 | 内容 | 备注 |
|---|---|---|
| `eventsDB` | 已排日历事件：`eventsDB['2026-6'][6] = [event,...]` | 月 key **不补零**（`年-月`），日 key 为数字 |
| `runtimeEvents` | 运行时新建/接受的事件镜像（按 id）| `findEventById` 先查它 |
| `pendingTasksDB` / `owedRepliesDB` / `pendingMeetingsDB` | 三类待办任务（backlog）| 经 `getInboxItems()` 归一 |
| `completionDB` / `completedInboxIds` | 事件完成状态 / 已完成任务 uid | |
| `prefStore` / `durationStore` / `interactionLog` | 学习状态 | localStorage（`schedulingAgentLearning.v1`）+ **Phase 1 起随云端 blob 同步**|
| `friendNotes` / `displayNameOverride` | 好友备注 / 显示名 | localStorage + 随云端 blob 同步 |

- `getInboxItems()`：把三类 backlog 归一成 `{id, source, title, est, kind, involves, deadline, importance, urgency, done}`，按 `inboxSortScore`（截止日近 × 重要度高）排序。
- `TASK_DBS = { pendingTask, owedReply, pendingMeeting }`：source → 对应数组的取值器，编辑/删除任务统一走它。
- `findEventById(id)` → `{event, monthKey, dayKey, idx}`（或 runtime-only）。

### 事件对象关键字段
`id, type/t, title, time, startTime('HH:MM'), endTime, duration, participants, transitMode, transitWorkable, context, agentNote, followUp*` …
新增：**`sourceTaskId: 'source:id'`** —— 把日历事件回指到它来源的 backlog 任务（打通"任务↔日历"，供 deadline 检测判断"是否已排块"）。

---

## 2.5 ⭐ 持久化架构（后端数据存储规划）

设计原则：调度+学习 agent 本质是**事件溯源（event-sourced）**——每个有意义的动作（建/完成/改期、接受/忽略建议、覆盖冲突）都是带时间戳的事件。当前状态可由事件流推导，但为性能保留快照。路线：**先 A（扩展 blob）后 C（规范化多表）**。

### 现状（A · Phase 1，已实现）
- 单条 Supabase 行 `app_state(user_id, data jsonb, updated_at)`，RLS 限定只读写本人行（故 anon key 可安全前端硬编码）。
- `cloudSaveNow()` 写入 **`snapshotCloud()`** —— 在 `snapshotDBs()`（事件/任务/完成）基础上，**并入全部会丢的数据**：
  - `learning: {prefStore, durationStore, interactionLog}`
  - `friendNotes`、`displayNameOverride`
  - `schemaVersion: 2`（供 Phase C 迁移识别）
- 顶层仍保留 `eventsDB` 等键 → **向后兼容**旧行（`cloudLoad` 以 `remote.eventsDB` 为入口）。
- 写时机：防抖 800ms（`cloudSave`）；`saveLearningState` / `editFriendNote` / `setDisplayName` 均触发 `cloudSave`，确保学习/好友/名字真正落后端、跨设备一致。
- 已知限制：**后写覆盖先写**（多端/多标签页）；blob 整体重写，`interactionLog` 会随时间膨胀——这两点正是 Phase C 要解决的。

### Phase C 第一刀（已实现）：学习数据双写到规范化表
```sql
pref_store(user_id, dimension, key, alpha, beta, confidence, sample_count, last_updated)
interaction_log(id, user_id, ts, action, context, top3, chosen_idx, candidate_id, kind, source, involves, features, label)
duration_observations(id, user_id, kind, person, observed_minutes, ts)
```
- `supabase-schema.sql` 现在创建三张真实学习表并启用 RLS：用户只能读写自己的行。
- 前端保持 **双写**：
  - `recordInteraction(...)`：写本地 `interactionLog` + `app_state` blob，同时 best-effort `insert interaction_log`。
  - `recordSignal(...)`：更新本地 `prefStore` + blob，同时 best-effort `upsert pref_store`。
  - `recordObservedDuration(...)`：更新本地 `durationStore` + blob，同时 best-effort `insert duration_observations`。
- 失败策略：学习表写入失败不阻塞 UI，blob 仍是兼容快照；这样线上表还没建好时 app 不会崩。
- 迁移策略：登录拉取 blob 后，`backfillLearningToCloud()` 调用纯函数 `buildBackfillRows()` 把旧 `app_state.data.learning`（interactionLog / prefStore / durationStore）一次性写入三张规范化表。`pref_store` 用 upsert 天然幂等；append-only 的 `interaction_log` / `duration_observations` 靠 blob 内 `learningBackfilledAt` 标记只回填一次。`durationStore` 只存聚合（totalMin/count），按 `count` 展开成均值行以保证趋势聚合不失真。
- 线上验证（2026-06-10）：用户在 `calendar.yiwang.dev` 触发新增/完成/规划后，Supabase 已能看到 `pendingTask`、`social` 等 `source/kind` 行，证明 Phase C 学习表双写链路已打通。

### Phase C 第二刀（未来）：拆核心业务实体
```sql
profile(user_id pk, display_name, prefs jsonb, updated_at)
events(id pk, user_id, date, start, end, type, kind, title, who, location, note, source_task_id, status, ...)
tasks(id pk, user_id, title, kind, mins, due, who, status, created_at, ...)
friends(id pk, user_id, name, note, share_scope, ...)
```
- `interaction_log` **追加式、永不覆盖** → ① 任意时间窗算准分析（真实"本周 vs 上周"）；② 学习即对它的聚合（`prefStore` 是派生缓存）；③ 未来 ML 训练数据。
- `pref_store` 是当前 Beta 偏好的可查询聚合表；`duration_observations` 保存原始时长观测，避免只存 running average 后丢失训练样本。
- 迁移：读旧 `app_state.data`（`schemaVersion`）→ 拆出核心实体写入业务表；`app_state` 保留一段时间作为回滚快照。
- 配套：`updated_at`/版本号防多端覆盖；`interactions` 保留策略（封顶/归档旧记录为聚合）。
- 当前策略：学习数据已先拆表；核心业务实体等产品自用稳定后再拆，避免过早迁移 events/tasks。

### 分析页数据来源（与上面对齐）
- Week 视图（`renderAnalyticsPage` + `computeWeekStats`）**从真实 `eventsDB`/`completionDB` 计算**当周（Mon–Sun）的时间分布、完成率、通勤效率。
- **Learning Trends 卡**（`loadLearningAnalytics` + `aggregateLearningTrends` + `renderLearningTrendsCard`）：live 模式从 Supabase `interaction_log` / `duration_observations` 拉最近 14 天，聚合本周 vs 上周建议接受率、最常见 `kind/source`、平均观测时长；无云数据时回退本地 `interactionLog`。

---

## 3. 三大视图 + 数据同步

| 视图 | 内容 | 渲染函数 |
|---|---|---|
| 首页 Home | Good morning 卡 + **Agent suggestions 面板** + 今日时间线 | `renderTodayPage()` |
| 日历 Calendar | 月历（含 due 黄点）+ 点开某天详情（可编辑事件卡 + Due this day）| `renderCal()` / `renderDayDetailContent()` |
| 任务 Tasks（Inbox）| 全部 backlog，勾选完成、编辑、计划 | `renderInbox()` / `inboxRowHtml()` |

**同步枢纽 `syncAllViews()`**：任何改数据的操作末尾都调它 → 重渲染首页/日历/某天详情/Inbox/Analytics + `saveAppData()`。**一处改、处处同步**是硬性要求。

> 历史 bug：部分 inbox 处理函数只调 `renderInbox()`、漏刷新某天详情，导致"日历里 due 任务点计划按钮没反应"。现已统一为 `syncAllViews()`。

---

## 4. ⭐ Agent Loop 设计（核心）

把系统从"被动日历 + 零散建议"升级为"主动 agent"。

### 4.1 循环

```
触发（打开 app / 任何数据改动后）
  → runAgentLoop()
      → 遍历 MOVE_DETECTORS（每个 detector 是纯函数，返回 Move[]）
      → 过滤已 dismiss 的
      → 按 severity 排序（critical > high > normal）
  → renderBriefingGroups()  渲染进首页 Agent suggestions 面板
  → 用户：确认 / 改 / 忽略
  → （确认即写库 + syncAllViews + recordSignal 学习）
```

- **注册表 `MOVE_DETECTORS = [detectDeadlineRisk]`** —— 加新主动能力 = push 一个 detector，不动其他代码。**这是壁垒。**
- **propose-only**：loop 只生产 Move 对象，从不自己写库；执行永远走 `proposedActions` 指向的确认函数。安全。

### 4.2 统一 Move 数据结构

```javascript
{
  id: 'move-deadline-pendingTask-p1',
  type: 'deadline_risk',
  severity: 'critical',          // critical | high | normal → 排序 + 左边框颜色
  daysUntil: 1,                  // 分组：≤0 → "Due today"，>0 → "Coming up"
  title: 'SLTA newsletter',
  dueShort: 'due 1d',            // 紧凑标签（overdue / '' / due Nd）
  subject: { source:'pendingTask', id:'p1' },  // 回指真实任务，供学习/执行
  mins: 120,                     // 时长（自定义 picker 用）
  dueISO: '2026-06-08',          // 默认日期（自定义 picker 用）
  proposedActions: [             // 一键执行项，走已有确认函数
    { label:'today 1 PM', fn:'scheduleTaskToSlot', payload:{...} },
    ...最多 4 个最佳空档（每天一个，最早优先）
  ]
}
```

### 4.3 已实现的 detector：Deadline-risk（`detectDeadlineRisk`）

1. 取 `getInboxItems()` 里有 deadline、未完成、**且未排块**（`eventScheduledForTask` 查 `sourceTaskId`）的任务。
2. `daysUntil = daysFromToday(deadlineISO)`；超过 `AGENT_HORIZON_DAYS`(=9，可调) 不打扰。
3. severity：≤1d→critical，≤2d→high，其余→normal。
4. `proposeSlotsForTask()` 在 [今天..截止日] 找空档 → 填 `proposedActions`。

### 4.4 简报 UI（`renderBriefingGroups`）

- 嵌在首页 **Agent suggestions** 面板内（与面板内 `.tp-candidate` 行风格一致），分 **Due today / Coming up** 两组。
- 折叠态：任务名（占满，省略号）+ **首选时间**药丸 + `×` 忽略。
- 点行**展开**：显示其余推荐时间 + 一个 **`+`**（自定义日期时间 picker，`confirmMoveCustomSlot`）。即使 agent 没找到空档（No slot），也能展开手动排——不留死胡同。
- `runMoveAction()` 重算 loop 再分发（payload 始终对应当前状态）；`dismissMove()` 记入 `dismissedMoveIds`。

### 4.5 触发时机（现状 vs 未来）

- 现状（阶段 1）：**打开即跑** + **任何数据改动后**（`syncAllViews` 顺手重跑）。propose-only 下已够"主动"。
- 未来（阶段 2+）：外部日历 webhook、截止日临近 push、状态转换（刚结束会议）、定时健康检查、周审计——"即使用户不在，agent 也替他看着"。

---

## 5. ⭐ 调度引擎（Loop 与手动共用的地基）

一套"找空档 + 排进去"逻辑，被 **Agent Loop、Inbox 计划按钮、Find New Time** 全部复用——这是统一性的关键。

| 函数 | 职责 |
|---|---|
| `getFreeWindowsForDate(y,m,d,minMin)` | **任意一天**的空档 = 工作日(08:00–20:00) − 当天事件；今天还会跳过已过去时段。`getPlanWindows()`（仅今天）的泛化版 |
| `proposeSlotsForTask(it, maxN)` | 今天→截止日（无截止则→horizon）逐天取一个最佳空档，最早优先，返回 `{year,month,day,startMin,mins,label,dayLabel}[]` |
| `taskEstMinutes(it)` | 任务所需分钟（解析 `~2h` 等，下限 15）|
| `scheduleTaskToSlot(source,id,y,m,d,startMin,mins)` | **底层写入器**：把 backlog 任务变成日历事件，写 `sourceTaskId`，从 backlog 移除，写 normalized `interactionLog` + `recordSignal` 学习，`syncAllViews` |
| `agentDayLabel(date)` | 标签：今天→`today`，否则→`Jun 11`（月日）|

---

## 6. ⭐ 事件卡片 / 时间建议逻辑

### 6.1 事件卡片（`renderEventCard`）

- `{compact, editable, showEdit, isPast}` 选项。首页时间线 / 某天详情都用它。
- 可直接编辑的米色卡：类型(meeting/social/call/more 自定义)、时间、who、地点、note。
- 展开状态由 `expandedEventId` 控制；第一次点开、再点收起。
- 任务型事件（deep/busy/online）卡片底部有 **Find New Time** 改期入口 + 只读 agent note。

### 6.2 Find New Time / 改期（`rescheduleEvent` → `pickRescheduleSlot` → `moveEventToSlot`）

按"把事件当临时任务、让 agent 给真实建议"设计：
1. `rescheduleEvent`：用事件实际时长跑 `proposeSlotsForTask(...,3)`，固定渲染 **3 行**：
   - 第 1 行 = agent 最佳推荐（固定日期标签 + 可编辑 `type=time`）。
   - 第 2/3 行 = **可编辑日期 `type=date` + 可编辑时间**（默认填次选，没有则填今天+1/+2）。
2. `pickRescheduleSlot`：读 date/time（手填优先，回退建议）→ **冲突校验**（见 §7）→ `moveEventToSlot`。
3. `moveEventToSlot`：更新 time/startTime/endTime/duration，跨天则旧那天移除、加进新那天，`runtimeEvents` 同步，`syncAllViews`。
4. 确认前清 `expandedEventId` → 卡片**自动收起、融入时间线**。

> 旧版是写死假时段 + 只弹 toast（不真移动），已废弃。

### 6.3 其他排期入口（都收敛到调度引擎）

- **Inbox 计划按钮**（`toggleInboxPlan` → `renderInboxPlanChoices` → `planTaskToSlot`）：列出 `proposeSlotsForTask` 的跨天空档，选中即 `scheduleTaskToSlot`，**不跳页**。
- **某天详情 Due this day**：复用 `inboxRowHtml`，同一套计划按钮逻辑（可排进 6.6→截止日任意空档）。
- **简报自定义 `+`**（`confirmMoveCustomSlot`）：date+time picker → 冲突校验 → `scheduleTaskToSlot`。

---

## 7. ⭐ Feedback / Learning Loop（冲突检测 + 学习）

> 起因：手填时间会排到"不可工作"时段（如 walk 期间开会）。这正是 agent 该提醒并学习的地方。

### 7.1 检测（`detectSlotConflict`）

确认排期时校验 `[start, start+mins)` 与当天事件：
- 重叠普通事件 → `overlap`（双重预订）。
- 重叠 transit 且**有效可工作度 < 2**（walk/drive/flight=0、bus/tram=1）→ `transit_nonworkable`。
- 重叠**可工作**通勤（train=3、car-ride=2）→ **不算冲突**（这是 Commute-fill 想要的）。
- 有冲突 → inline 红字警告 + "再点一次覆盖"，不硬拦。

### 7.2 记录（什么数据进哪里）

- 事件本身 → `saveAppData()` → Supabase/localStorage。
- 所有高价值用户选择 → `recordInteraction(...)` 写入 normalized `interactionLog`（字段稳定：`ts/action/type/context/top3/chosenIdx/candidateId/kind/source/involves/features/label`）。
- 覆盖冲突时 → `recordSignal('transit_work', mode, true)`（Beta 分布存 `prefStore`）+ `recordInteraction({ action:'conflict_override', ... })`。
- Desk Plan / Agent Loop 接受排期 → `recordPlanAcceptance(...)`，保留 `sourceTaskId`、`kind` 和 analytics `type`，避免 deadline-risk 重复建议，也为 Phase C 的 `interaction_log` 提供干净样本。
- Phase 1：学习信号已随 `snapshotCloud()` 上 Supabase blob；Phase C：拆到 `interaction_log` / `pref_store` / `duration_observations`。

### 7.3 学习如何在 Loop 里生效

`effectiveTransitScore(mode) = 基础分 + 学习增量`：
- 用户对某 mode 反复覆盖（`sampleCount≥2 且 置信度>0.66`）→ +2 → 有效可工作度提升 → 以后排进去不再报冲突。
- 这是 **Tier-1 参数自调** 的真实样例：agent 从行为学会改判断，而非写死规则。

### 7.4 其他已有学习信号

- `recordSignal('candidate_kind' | 'candidate_source' | 'person', …)`：接受某类/某来源/某人相关任务时累积偏好（`prefScore` 影响候选排序；source fallback 已统一为 `pendingTask`）。
- `durationStore`：按 `kind::person` 学真实时长，逐步替代用户的固定估计（`predictDurationMinutes`）。

> 三层自进化方法论（Tier-1 参数自调 / Tier-2 模式发现 / Tier-3 结构学习）详见 `learning agent.md`。

---

## 8. 现状与缺口（Roadmap）

**已实现**
- ✅ Agent Loop 骨架 + Deadline-risk detector + 首页简报（一键排 / 自定义日期时间）
- ✅ 跨天调度引擎，Loop 与所有手动入口统一复用
- ✅ Find New Time 真实改期（3 个建议，2/3 可编辑日期时间，确认后融入时间线）
- ✅ 冲突检测（双重预订 / 不可工作通勤）+ 覆盖 + Tier-1 学习
- ✅ 三视图数据同步 + 持久化；`sourceTaskId` 打通任务↔日历
- ✅ **持久化 Phase 1**：学习/好友/名字随云端 blob 同步（跨设备不丢）；分析页 Week 视图改用真实数据（见 §2.5）
- ✅ **Phase C 第一刀**：学习数据双写到 `interaction_log` / `pref_store` / `duration_observations`，线上 Supabase 已验证有 `pendingTask/social` 等行（见 §2.5）
- ✅ **Analytics 真实趋势**：Week 视图新增 Learning Trends 卡，从 normalized 学习表聚合本周 vs 上周接受率与时长（见 §2.5 分析页）
- ✅ **旧 blob 学习数据回填**：登录后一次性把 `app_state.data.learning` 历史迁移进三张学习表，靠 `learningBackfilledAt` 标记保证幂等（见 §2.5）
- ✅ **Conflict 主动巡检**：`detectExistingConflicts()` 进入 `MOVE_DETECTORS`，扫描已存在的重叠事件并在简报提供一键 `moveEventToSlot` 修复

**下一步（建议顺序）**
1. 更多 detector：Prep（会前准备）、Follow-up（会后跟进）、Cleanup（未标记完成）、Rebalance（今天过载）。
2. **Phase C 剩余表**：把 `events` / `tasks` / `profile` 从 blob 继续拆到规范化表。
3. 阶段 2：接真实日历（Google / MS Graph 只读），从假数据 → 真实生活。
4. 语音输入（deferred）。

---

## 9. 关键函数索引（快速参考，均在 `index.html`）

| 领域 | 函数 |
|---|---|
| 日期 | `appNow` `currentSimNow` `deadlineToISO` `isoFromYMD` `daysFromToday` `agentDayLabel` |
| Agent Loop | `runAgentLoop` `MOVE_DETECTORS` `detectDeadlineRisk` `renderBriefingGroups` `runMoveAction` `dismissMove` `confirmMoveCustomSlot` |
| 调度引擎 | `getFreeWindowsForDate` `proposeSlotsForTask` `taskEstMinutes` `scheduleTaskToSlot` `eventScheduledForTask` |
| 事件卡 / 改期 | `renderEventCard` `rescheduleEvent` `pickRescheduleSlot` `moveEventToSlot` `expandedEventId` |
| Inbox 计划 | `getInboxItems` `inboxRowHtml` `toggleInboxPlan` `renderInboxPlanChoices` `planTaskToSlot` |
| 冲突 / 学习 | `detectSlotConflict` `effectiveTransitScore` `getWorkability` `recordConflictOverride` `recordSignal` `predictDurationMinutes` |
| 同步 / 持久化 | `syncAllViews` `saveAppData` `saveLearningState` `findEventById` |
