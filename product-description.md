# Scheduling Agent —— 一个会主动管理日程的 AI Agent

> 面向作品集 / CV 的项目总览。技术架构细节见 `project-description.md`，产品决策过程见 `BRAINSTORM.md`，自进化方法论见 `learning agent.md`。
> 最后更新：2026-06-17（Plan vs Actual Track A #1 已落地）。

---

## 一句话定位

**一个主动管理日程的 scheduling agent —— "日历界的 Cursor"。**

它不是又一个日历皮肤，而是一个会主动发现「关于时间，你还没想到该做的事」的 AI Agent：截止日预警、见缝插针、冲突消解、会前准备、过载重排……它**主动提出建议，由人一键确认（propose-only），并从每一次确认/拒绝里学习你的偏好，越用越聪明。**

核心标准：**学习成本 = 0。** 用户不配置、不学新概念，AI 在背后把规划做完，用户只做「确认 / 否决」这一个动作。

---

## 我想解决的问题

普通日历只回答「你有什么安排」，但真正消耗高管/创始人精力的是那些**日历不会主动提醒的事**：

- 周一截止的报告，今天还没排时间做。
- 下午三场会背靠背，结束后只有 15 分钟赶火车。
- 周二、周四各有一个苏黎世的会，本可以合并到同一天省下 5 小时通勤。
- 某个深度工作块连续第三个，注意力其实已经废了。

真人助理会替你想到这些。我想做的，就是一个**有这种「主动性」的 AI Agent**——每次你打开它，它就替你扫一遍日程，发现问题、给出可执行的方案，而不是等你来查。

**产品缘起**：在一次 networking 活动上，一位创始人说想要一个能主动管理时间的日历——聪明到知道火车通勤能塞低优先级会议、而航班不行。这个项目就是从那场对话长出来的。

---

## 核心设计哲学：把 LLM 踢出大脑

这是整个项目最关键、也最反直觉的架构决策：

> **LLM 听话和说话，确定性引擎做决定，Agent 框架管节奏和授权。**

| 器官 | 职责 | 谁来做 |
|---|---|---|
| 感知 | 读日历、算空档、发现问题 | **确定性代码** |
| 决策 | 候选池 → 门控 → 适配 → 排序 → Top N | **确定性代码（大脑）** |
| 表达 | 写人话、给对方写消息草稿 | LLM（嘴） |
| 行动 | 排进日历、发消息 | 确定性 + 授权策略 |
| 记忆 | 记接受/拒绝、更新偏好 | 确定性 |

**为什么这样设计？** 因为 LLM 对时间的推理极不可靠——它会自信地把两个会排进同一时段。把它当大脑的产品（如通用 agent）强但不可靠，永远在跟幻觉赛跑。我反过来：**用代码当大脑保证可靠，LLM 只在边缘做解析和表达。** 护城河不在 LLM（人人都有），而在「确定性引擎 + 越用越准的数据飞轮」。

---

## ⭐ 核心架构：Agent Loop（主动循环）

把系统从「被动日历 + 零散建议」升级为「主动 Agent」的中心对象。

```
触发（打开 app / 任何数据改动后）          ← 阶段 1；阶段 2 才加 webhook / 定时 / push
  → runAgentLoop()
      → 遍历 MOVE_DETECTORS（每个 detector 是纯函数，返回 Move[]）
      → 策展层：mergeMoves → curate（规则版即时渲染，LLM 版后台异步）→ applyCuration
      → 安全护栏：critical 必显置顶、非法排序回退
  → 渲染进首页 Agent Suggestions 简报
  → 用户：确认 / 改 / 忽略
  → 确认即写库 + 全视图同步 + 记录学习信号 → 下一轮
```

### 成熟度判断（写简历时要诚实）

| 维度 | 现状 | 说明 |
|---|---|---|
| 是不是 Agent？ | ✅ 是 | 已有感知→决策→行动→记忆的闭环，只是自主性还不完整 |
| 是不是「主动」Agent？ | ⚠️ 半成品 | **主动发现**做到了；**自主触发**还没做到（用户不在时不会自己跑） |
| 学习飞轮闭环了吗？ | ⚠️ 管道有了，效果未闭环 | Tier-1 在记数据，但偏好权重仍被硬编码规则淹没，学到的几乎不改变排序 |
| 对外怎么称呼？ | ✅ 可以说 proactive agent | 「主动」= 不等用户问、主动发现问题；不要说「后台默默运行」 |

**一句话阶段定位**：已完成 **阶段 1 · 点火**（Agent Loop + 6 detector + propose-only + 学习埋点）；正在向 **阶段 2 · 接地**（真实日历 + 自主触发）和 **学习飞轮可度量** 推进。

两个让它可持续扩展、且安全的关键设计：

1. **Detector 注册表模式**：加一个新的主动能力 = 写一个纯函数 push 进 `MOVE_DETECTORS` 数组，**不动 Loop、不动 UI、不动渲染**。这是开放-封闭原则的教科书级实现，也是产品的扩展性壁垒。
2. **Propose-only（只提议，不自动执行）**：Loop 只生产统一的 `Move` 对象，执行永远走用户确认的函数，Loop 自己从不写库。**安全优先，先赢信任。**

### 统一的 Move 数据结构

所有「主动发现的东西」归一成同一个对象，UI 只认这一种：

```javascript
{
  id, type, severity,            // critical | high | normal → 排序 + 颜色
  title, dueShort,
  subject: { source, id },       // 回指真实任务/事件，供学习与执行
  proposedActions: [             // 一键执行项，走已有确认函数
    { label:'today 1 PM', fn:'scheduleTaskToSlot', payload:{...} },
    ...
  ]
}
```

---

## ⭐ 已实现的「感知能力」：6 个 Detector

每个 detector 是 Agent 的一种「看见」能力：

| Detector | 主动检测什么 | 状态 |
|---|---|---|
| **Deadline-risk** 截止日预警 | 快到期但还没排块的任务 | ✅ |
| **Conflict** 冲突消解 | 双重预订 / 排进不可工作时段（如步行途中开会） | ✅ |
| **Follow-up** 会后跟进 | due today / 逾期的待跟进事项 | ✅ |
| **Cleanup** 收尾 | 过去事件未标记完成状态 | ✅ |
| **Prep** 会前准备 | 重要会议前无准备块 → 一键创建 prep block | ✅ |
| **Rebalance** 过载重排 | 某天 work 时长 >8h → 挑最短深度块挪到空闲日 | ✅ |

> 路线图上还有 Energy Guard（精力守护）、Context Switch Cost（切换成本）、Travel Optimize（出行合并）、Pre-mortem（事前验尸）等——加一个 = push 一个纯函数。

---

## ⭐ 学习飞轮：三层自进化架构

产品的护城河叙事：**越用越聪明。**

| 层级 | 做什么 | 自主权 | 状态 |
|---|---|---|---|
| **Tier 1** 参数自调 | 每次交互用 Beta 分布更新偏好；反复覆盖某类冲突 → 自动调整判断 | 全自动 | ✅ 已落地 |
| **Tier 2** 模式发现 | 扫描历史日志发现新模式（如「午饭时间总被拒」）→ 置信度门控 | 高置信自动 / 中置信询问 | 🔜 设计完成 |
| **Tier 3** 结构学习 | LLM 离线分析日志，发现新维度 → 人拍板上线 | 人 + LLM 离线 | 🔜 远期 |

**真实样例（Tier 1）**：用户在「步行途中」反复坚持排会议 → Agent 从行为学到「你确实在这种通勤里工作」→ 提升该模态的可工作度 → 以后不再报冲突。**这是 Agent 从行为学会改判断，而非写死规则。**

**Plan vs Actual（Track A #1 · ✅ 已落地）**：agent 排期打 `planMeta`；完成/改期/过期后 reconcile 写入 `planActualLog` 并双写 `interaction_log(plan_actual)`。

**Beta 学习增强（Track A #2 · ✅ 已落地）**：接受排期 = 弱正反馈；按时完成 = 强正反馈（含 `schedule_hour`/`schedule_dow`）；dismiss 卡片不计负反馈；偏好权重提升后排序可被学习结果翻转。

**当前学习债务（下一步）**：Track A 学习飞轮已闭环；下一步 **P1 泛化 getPlanWindows** 或接真实日历。

---

## ⭐ 数据架构：为「跨用户 ML」铺路

设计原则：调度 + 学习 Agent 本质是**事件溯源（event-sourced）**——每个有意义的动作都是带时间戳的事件。

- **Phase 1（已实现）**：单条 Supabase JSONB blob，跨设备同步学习/偏好不丢。
- **Phase C 第一刀（已实现 + 线上验证）**：学习数据**双写**到三张规范化表 `pref_store` / `interaction_log` / `duration_observations`，并启用行级安全（RLS）。历史 blob 数据一次性幂等回填。
- **为什么重要**：append-only 的 `interaction_log` 是未来 ML 训练的干净样本。真正的 ML 护城河 = **跨用户池化模型 + 瑞士/EU 数据驻留**，而非单用户的数据饥饿模型。

---

## 技术栈与工程形态

| 维度 | 选型 |
|---|---|
| 前端 | 单文件原型 `index.html`（HTML + CSS + 原生 JS，无框架） |
| 后端 | Supabase（Postgres + Auth + RLS） |
| 认证 | Magic Link + Google OAuth 双通道 |
| 部署 | Vercel，单项目按 hostname 锁定模式（demo 站 / 个人站，数据物理隔离） |
| LLM 集成 | BYO-key 代理（serverless），用于简报策展的 rank-only，失败回退确定性规则 |
| 测试 | 纯函数 detector + 持久化逻辑可单测 |

**演示与真用双轨**：`calendar-demo.yiwang.dev`（固定演示数据，不登录不落库）与 `calendar.yiwang.dev`（真实个人数据，连 Supabase），同一份代码、按域名锁死模式。

---

## 当前进度（Roadmap）

### ✅ 已实现（截至 2026-06-17）

**Agent 核心**
- Agent Loop 骨架 + **6 个 detector** + 首页主动简报（一键排 / 自定义时间 / 忽略）
- 跨天调度引擎（`proposeSlotsForTask` / `getFreeWindowsForDate`），Loop 与 Inbox 计划、Find New Time 统一复用
- `sourceTaskId` 打通任务↔日历，避免重复 deadline-risk 建议
- Find New Time 真实改期（3 个建议槽，后两个可手填日期时间）
- 冲突检测（双重预订 / 不可工作通勤）+ 覆盖警告 + Tier-1 学习
- 简报策展层 Phase A（确定性 `curateMovesRules` + `applyCuration` 安全护栏 + “More” 折叠区）
- 简报策展层 Phase B（Settings BYO-key LLM rank-only，经 `api/llm.js` serverless 代理，失败回退规则版）

**数据与学习**
- 学习数据债务 #2/#3/#4/#6/#7/#11 已修复（接受路径写 normalized `interactionLog`、保留 kind/type 等）
- Stage A 特征埋点（`features` + `label`，只记不用，为 ML 铺路）
- 时长滑动平均（`predictDurationMinutes` 按 person/kind 替代固定估时）
- 持久化 Phase 1（Supabase JSONB blob，学习/好友/名字跨设备同步）
- Phase C 第一刀：学习三表双写（`interaction_log` / `pref_store` / `duration_observations`）+ RLS + 历史 blob 幂等回填，**线上已验证**
- Analytics：Week 视图真实数据 + Learning Trends 卡（本周 vs 上周接受率、时长、top kind/source）
- **Plan vs Actual（Track A #1）**：agent 排期 `planMeta` → reconcile → `planActualLog` + `interaction_log(plan_actual)`；21 项自动化测试覆盖

**产品与工程**
- 三视图（首页 / 日历 / 任务）`syncAllViews()` 一处改处处同步
- 双域名部署：`calendar-demo.yiwang.dev`（演示）/ `calendar.yiwang.dev`（个人真用）
- Magic Link + Google OAuth；作品集页 [yiwang.dev/ai.html](https://www.yiwang.dev/ai.html) 已上架

### ⚠️ 已知缺口（写简历时可作「下一步」素材）

- **自主触发**：只在打开 app / 改数据时跑 loop，无 webhook、无定时 push
- **学习效果未闭环**：~~Beta 权重弱 / dismiss=reject / 无回测~~ ✅ Track A 已全部落地；待 P1 扩展视野
- **`getPlanWindows` 部分路径仍只看今天**（Agent Loop 已能跨天，Time Planning Board 尚未完全泛化）
- Tier 2 模式发现、离线回测——已设计，未实现
- 未接真实日历（Google / MS Graph）；单文件 `index.html` 已近 8000 行

### 🔜 下一步（2026-06-10 晚确认 · 当前仍生效）

**核心判断：停止再加 detector，先把学习飞轮闭环 + 让它可度量。**

| 轨道 | 优先级 | 内容 |
|---|---|---|
| **A · 学习飞轮** | 🔴 最高 | ① ~~Plan vs Actual~~ ✅ ② ~~Beta 增强~~ ✅ ③ ~~离线回测~~ ✅ |
| **B · 视野扩展** | 🟡 中 | 泛化 `getPlanWindows(date)`：今天助手 → 周管家 |
| **C · 工程健康** | 🟢 按需 | 单文件拆分（下次加 detector 时顺手做） |

**阶段 2（质变）**：接真实日历 + webhook/定时触发 → 用户不在时 agent 也在替你看。

**现在明确不做**：再加新 detector、Phase C 剩余表拆 events/tasks、ML 预测层、Travel Optimize / Pre-mortem（等真实日历数据）。

---

## 优先级任务总览（2026-06-17 · 当前生效）

> **Binding constraint**：不是「看得不够多」，而是「学得不够准、改完无法验证」。6 个 detector + LLM 策展已够；下一步先闭环学习飞轮。

### 🔴 P0 — 护城河：学习飞轮闭环 + 可度量

| # | 任务 | 为什么 | 预估 | 施工计划 |
|---|---|---|---|---|
| **1** | ~~**Plan vs Actual 追踪**~~ | ✅ 已落地（2026-06-17） | — | [`docs/superpowers/plans/2026-06-17-plan-vs-actual.md`](docs/superpowers/plans/2026-06-17-plan-vs-actual.md) |
| **2** | ~~**Beta 学习增强**~~ | ✅ 已落地（2026-06-17） | — | [`docs/superpowers/plans/2026-06-17-beta-learning-enhancement.md`](docs/superpowers/plans/2026-06-17-beta-learning-enhancement.md) |
| **3** | ~~**离线回测脚手架**~~ | ✅ 已落地（2026-06-17） | — | [`docs/superpowers/plans/2026-06-17-offline-backtest.md`](docs/superpowers/plans/2026-06-17-offline-backtest.md) |

### 🟡 P1 — 质变：从今天助手 → 周管家 / 真主动

| # | 任务 | 为什么 | 预估 |
|---|---|---|---|
| **4** | **泛化 `getPlanWindows(date)`** | Time Planning Board 仍只看今天；Agent Loop 已能跨天 | 1–2h |
| **5** | **阶段 2：真实日历只读** | mock → 真实生活；Travel/Pre-mortem 才有数据 | 数天 |
| **6** | **自主触发** | webhook / 定时 / push；用户不在也在替你看 | 依赖 #5 |

### 🟢 P2 — 体验增强（有价值，非当前最急）

| # | 任务 | 说明 | 预估 |
|---|---|---|---|
| **7** | **语音输入** | Whisper STT → serverless 代理 → LLM 解析 → 可编辑草稿 → 确认入库。**deferred**，但符合「零描述」北极星 | 1–2 天 |
| **8** | **用户偏好档案** | Settings → Preferences，解决冷启动 | 半天 |
| **9** | **「Agent 眼中的你」面板** | 透明展示已学偏好 + 纠正入口 | 半天 |
| **10** | **Tier 2 模式发现** | 自动发现「午饭时间总被拒」等模式 | 4–6h |

### ⚪ P3 — 明确暂缓

| 任务 | 状态 |
|---|---|
| 新 detector（Energy Guard / Context Switch 等） | ❌ 感知够了 |
| Phase C 剩余表（events/tasks/profile） | ❌ 此刻无收益 |
| ML 预测层 | ❌ 数据量不够 |
| 单文件拆分（~8000 行） | 🟢 下次加 detector 时顺手做 |

### 推荐执行顺序

```
P0: ① Plan vs Actual ✅ → ② Beta 增强 ✅ → ③ 离线回测 ✅
P1: ④ 泛化 getPlanWindows → ⑤ 真实日历 → ⑥ 自主触发
P2: ⑦ 语音输入（可自用插队）→ ⑧⑨ 偏好透明化 → ⑩ Tier 2
```

**语音输入排 P2 首位**：设计已定（Whisper + serverless + 草稿卡），但边际价值低于 Plan vs Actual——语音能加事件，却不能让 agent 排得更准。若自用减负可插队到 P0 与 P1 之间。

---

## 简历 / 作品集摘抄参考

> 下面可直接改写进英文 CV 或 [yiwang.dev/ai.html](https://www.yiwang.dev/ai.html)。注意：**proactive** 可用，避免写 “runs in the background”。

**英文 elevator pitch（~3 句）**
- A proactive scheduling agent that scans your calendar and surfaces what a normal calendar never warns you about—deadlines with no time blocked, back-to-back meetings, overloaded days.
- For each issue it drafts a one-tap fix (propose-only); every accept or pass feeds a learning pipeline backed by Supabase.
- Architecture: deterministic engine as the brain, LLM at the edge (rank-only curation), 6 pluggable detectors on an Agent Loop.

**中文一句话（简历项目描述）**
- 主动管理日程的 scheduling agent：6 个 detector 主动发现问题，一键确认排期，确定性引擎决策 + Supabase 学习飞轮，已上线 demo 与个人版。

**技术关键词（可贴 Skills 行）**
- Agent Loop · Detector registry · Propose-only · Event-sourced learning · Supabase Postgres + RLS · Vercel serverless · Beta preference learning · Vanilla JS

**可写的量化/事实点**
- 6 proactive detectors · ~8000-line single-file prototype · 3 normalized learning tables · **Plan vs Actual gap logging** · 2 live subdomains · BYO-key LLM curation with deterministic fallback

---

## 这个项目展示了什么

- **AI Agent 架构能力**：感知 → 决策 → 表达 → 行动 → 记忆的五器官循环，清晰的分层与职责边界。
- **务实的工程判断**：在「LLM 做大脑 vs 确定性引擎做大脑」「全自动 vs propose-only」「先做 UI vs 先做智能」每个岔路口选了更难但更对的路。
- **可度量的产品思维**：明确把「学习飞轮闭环 + 可验证」作为核心约束，而非盲目堆功能。
- **端到端落地**：从前端原型、Supabase 持久化、RLS 安全、双域名部署，到 BYO-key LLM 代理，是一个真正跑起来、能展示也能自用的完整 AI 产品。

> **把 LLM 当大脑的产品，永远在跟幻觉赛跑。把确定性引擎当大脑的产品，每一次交互都在加固壁垒——而壁垒不在 LLM，在数据飞轮。**
