# Scheduling Agent · 头脑风暴记录

> 活文档。决策定了就往「已确认」里搬，开放问题留在「待确认」。

## 进度快照（2026-06-09）

**已上线（可展示 + 可真用）**
- **部署**：Vercel + `yiwang.dev`。一个项目挂两个子域名，模式按 hostname 锁死：
  - `calendar-demo.yiwang.dev` → demo，精编样例，永远浅色，不登录、不落库。
  - `calendar.yiwang.dev` → personal，真实数据，magic-link 登录。
- **持久化**：personal 模式接 **Supabase**（`app_state` 一行 JSON/用户 + RLS），手动新建/编辑/删除/完成实时入库；localStorage 作离线缓存。建表 + Site URL 已配置完成 ✅。
- **认证**：Google OAuth + 邮箱 magic-link 双通道（登录框 Google 按钮 + 「or」+ 邮箱）。登录态按浏览器/设备（换设备需重新点链接/登录）。邮箱已明确提示：必须在目标浏览器打开原始邮件链接，避免邮箱 App 预览页吃掉 session。Google 需后台一次性配置：Google Cloud OAuth client（JS origin `calendar.yiwang.dev`、redirect 指向 Supabase `/auth/v1/callback`）+ Supabase Providers→Google 填 client id/secret。
- **管理员**：按邮箱识别（`yi.wang.max@gmail.com`），只有管理员看到 Reset/Clear/模式；URL/key/admin 全在代码里，用户永不可见。
- **日期**：统一 `appNow()` —— personal 用真实当天，demo 钉死 6/6。问候/时间线「现在」线/日历今日高亮/日报/分析全部跟随。
- **UI**：去掉假状态栏；齿轮并入头像（W）单一入口；首页时间线删除重复大日期，只保留更精致的 `TODAY` 标题，`Now` 指示器回到短红线样式；Agent Suggestions 改为单行任务、`+/-` 操作、左侧优先级色边，且可不选择直接 Confirm；日历选中态改为更小的日期圆形，默认强高亮今天，点选其他日期后强高亮转移、今天保留淡色；日期详情关闭按钮加 X；主题强制浅色（同 CV 站）。
- **日历某天详情**：升级为与首页一致的米色可编辑卡片（`+` 新增事件、reschedule/agent 提示）；设了 due 的 backlog 任务在到期当天显示红色圆点 + 「Due this day」可编辑小节；移除旧底部 Add 按钮。
- **学习地基**：Stage A 特征埋点 + 时长滑动平均（统计，非 ML）。

**下一步**
- 语音输入（Whisper 云 STT + serverless 代理 + LLM 解析 → 可编辑草稿 → 确认入库）。
- 登录态跨设备记住的体验优化。

## 北极星（已确认）
专用、嵌入、零描述、一键接受/拒绝的调度 agent —— **"日历界的 Cursor"**。
- 少问，多提案：需求从上下文推出来，不让用户打字描述。
- 可靠靠确定性引擎；被用上靠主动触发；验证成本靠 diff 式接受/拒绝。
- 不做通用 agent（Hermes/OpenClaw 已卷死，且通用 agent 天生闲置）。

## 第一刀 · 楔子（已确认）
**通勤可用时间** —— 通勤途中有时能塞会议/电话/任务，有时不能，agent 智能识别并主动提案。
- 已有 MVP：通勤卡 workability 徽章 + "把轻任务塞进可用通勤"建议卡（确定性，0 LLM）。

## 已确认的决策

### 通勤可用性怎么判定
- 默认按交通方式推断（火车=能/开车=不能），**但以「学习」为主**：你上次在这趟车开了会，下次默认能。即 推断打底 + 学习覆盖，偏向学习。

### 往可用通勤里能塞什么（全都要，按通勤质量分级）
- 电话/语音会、单人任务（回邮件/读文档/录语音）、思考决策类、**视频会（仅限高质量通勤如火车桌座）**。
- 含义：workability 画像要**门控建议类型**——火车=视频/电话/笔记/思考都行；公交/电车=音频/电话/思考；走路/开车=只思考或不排。

### 涉及别人的会议 → 交互流程
1. agent **先给用户排**：针对某段可用通勤，给出 **3 个建议做的事**（tab 形式）。
2. 用户选其一。
3. 若选的事**涉及对方**，再**发消息给对方确认**。

### 触发形态
- 早上 briefing 统一提「今天有 N 段可用通勤」。
- 捕获时（要约会/任务卡住）就地提「塞进明早火车」。

### 可靠性
- v1 **先不管**通勤晚点/信号差，假设通勤可靠。

### 单人 vs 团队
- **先单人**：让创始人自己通勤时多干活。团队协商留后。

### 候选池（3 个建议从哪来）
全都要：待办任务、你欠的电话/回复、待约会议（有人想约你没定时间）、agent 自判此刻最该推的事。

### 排序逻辑
**综合**：适配为硬门槛（时长匹配 + 通勤模态匹配，火车才推视频），门槛内按重要紧急排。

### 确认消息怎么发
agent 生成草稿；**默认每次用户授权才发**；可选授权给 agent 自动发 → 这就是 **autonomy 滑块**的第一个落点。
- 对方非用户：发普通消息/邮件（先做）。
- 对方是用户：未来两个 agent 直接协商（加分项）。

---

## 下一步 MVP 定义（通勤助手 v2 · 楔子）
把现有单条「通勤建议卡」升级为完整楔子：

1. **输入**：今日通勤事件 + workability 画像（推断打底，学习覆盖）。
2. **候选池**：待办任务 / 欠的电话回复 / 待约会议 / agent 自判。
3. **匹配**：每段可用通勤窗口 → 模态门控（火车=视频+电话+笔记+思考；公交电车=音频+电话+思考；走路开车=思考或不排）→ 时长适配为硬门槛 → 门槛内按重要紧急排 → 取 Top 3。
4. **呈现**：3 个 tab 建议卡。触发点：早 briefing 汇总 + 捕获时就地提示。
5. **选择后**：
   - 单人事项 → 直接排进该通勤卡。
   - 涉及对方 → 生成确认消息草稿 → 默认逐次授权发送（可设自动）。
6. **学习**：接受/拒绝 + 选了哪个 → 更新该路线/模态默认可用性与偏好（v1 内存模拟）。
7. **不做**：通勤可靠性（晚点信号差）、团队双向协商（留后）。

---

## Agent 如何构建（架构定调）
核心判断：**这里的 agent 故意把 LLM 踢出大脑。**

一句话：**LLM 听话和说话，引擎做决定，框架管节奏和授权。**

五器官循环（感知→决策→表达→行动→记忆），只有两处碰 LLM：
| 器官 | 干什么 | 谁来做 |
|---|---|---|
| 感知 | 读日历/算通勤窗口；解析乱输入 | 确定性 / LLM(耳) |
| 决策 | 候选池→模态门控→适配→排序→Top3 | **纯确定性·大脑** |
| 表达 | 写人话/写给对方的草稿 | LLM(嘴) |
| 行动 | 排进通勤、发消息 | 确定性 + autonomy 滑块 |
| 记忆 | 记接受/拒绝、更新偏好 | 确定性 |

- **大脑 = 确定性引擎 + 记忆**（你的 IP，别人 fork 不走）。
- **LLM = 边缘**（耳朵+嘴），可换、便宜、小模型够，绝不让它自由决定排什么。
- **agent = 编排循环 + 授权策略**，不替你做调度决定。

与 Hermes 的本质区别：Hermes 让 LLM 当大脑→强但不可靠要调教；本产品用代码当大脑、LLM 在边缘→可靠、零描述、敢放权。这是能赢它的点。

实现两步：
- v1（现 prototype）：全 JS + mock + LLM 先假装，先打磨决策引擎逻辑 + UX。
- v2：决策引擎=TS（皇冠）；LLM=function-calling 只在解析+表达两点调用；日历=Google/MS Graph；记忆=按路线/模态/人存；授权=滑块；外壳=App/PWA 或包成 Hermes skill 蹭分发。

---

## 工作流设计（已敲定）· 节点 + 三层自我改进

本质：**一个复杂 workflow——固定节点骨架，在特定节点挂三层反馈 loop，越用越准。**

### 节点图
```
N1 感知机会 → N2 拉候选池 → N3 匹配排序 → N4 呈现 → N5 用户决策 → N6 执行 → N7 记录学习
[确定性]      [确定性]      [确定性·大脑]  [LLM嘴]   [人]         [确定性+滑块] [确定性·埋点]
   ▲                                                                              │
   │         ┌─── Tier 1: 全自动参数自调 ─── 每次交互都在学 ─────────────────────┤
   │         ├─── Tier 2: 模式发现+置信度门控 ── ≥90%自动/60-90%询问 ──────────┤
   │         └─── Tier 3: 结构性学习 ── 人+LLM离线 → 上线新维度 → 归入Tier1/2 ◄┘
   └────── 闭环：每次确认/拒绝/修/无视都在喂信号 ─────────────────────────────────┘
```
> 详细三层架构见 `[[learning agent.md]]` 第三章。这里只放工作流层面的落点。

### 各节点定义
| 节点 | 输入 → 输出 | 谁做 |
|---|---|---|
| **N1 感知** | 扫今日通勤事件 → 「可用通勤窗口」列表（模态+时长+workability） | 确定性 |
| **N2 候选池** | 待办 / 欠的电话回复 / 待约会议 / agent自判 → 候选清单（类型、时长、重要紧急、是否涉他人） | 确定性 |
| **N3 匹配排序·大脑** | 每个窗口：模态门控 → 时长适配(硬门槛) → 重要紧急排序 + **Tier 1 偏好权重** → **Top3** | 确定性 + Tier 1 参数自调 |
| **N4 呈现** | Top3 → 「3 tab 建议卡」+ 文案 | LLM嘴(MVP模板) |
| **N5 决策** | 用户选一个 / 忽略 / 手动修改 | 人 → **Tier 1/2 信号源** |
| **N6 执行** | 单人事→排进通勤卡；涉他人→生成草稿→授权发送(滑块) | 确定性+滑块 |
| **N7 记录学习** | 记一条事件日志 + **Tier 1 调参数** + **Tier 2 定期扫日志发现新模式** | 确定性·埋点 + 统计分析引擎 |

### 三个反馈 loop（对应三层架构）

| Loop | 对应 Tier | 频率 | 自主权 | 做什么 |
|------|:--:|------|------|--------|
| **Loop1** | Tier 1 | 每次交互 | ✅ 全自动 | 使用统一偏好 schema + 简化 Beta 置信度；选了的类型/人提高后验，拒了则降低，**不再裸+1/-1**。选完显示微提示："已记住 · 下次优先这类" |
| **Loop2** | Tier 1+2 | 路线级 | ✅ 自动/⚠️ 询问 | Tier 1：同一路线同一模态连续接受 N 次 → 置信度达标 → 自动覆盖 workability。Tier 2：发现新模式（如"午饭时间总被拒"）→ ≥90%自动保护 / 60-90%询问 |
| **Loop3** | Tier 3 | 离线·月/季 | ❌ 人拍板 | N7 日志 → LLM 离线分析 → 发现新维度（如"人→偏好地点"）→ 人决定加不加 → 上线 → 归入 Tier 1/2 自动运转 |

### 确认信号（全结构化，零 LLM 在线成本）
| 信号 | 喂给 | 含义 |
|------|:--:|------|
| ✅ 选了第 N 个 | Tier 1 | 排序偏好 |
| ❌ 拒绝全部 | Tier 2 | 候选池/门控可能有问题 |
| ✏️ 手动改时长 | Tier 1 | 时长估算不准 |
| ✏️ 手动加 buffer | Tier 2 | buffer 规则可能缺新维度 |
| 👻 直接无视 | Tier 2 | 触发时机/优先级不对 |
| 🔁 改后自己改回来 | Tier 1 | 撤销该条自动调整 |

---

## 今日 MVP 施工计划（已拍板 · 待执行）

> 目标：今天之内做出能用的最小版本。三项拍板见下。

### 拍板的三个决策
1. **范围 = core**：N1–N7 全闭环 + Loop1。Loop2 / on-capture 触发 / analytics 面板**今天先不做**（留 backlog）。
2. **学习可见 = 是**：用户选完给微提示，如「已记住 · 下次优先这类」，且**下次 Top3 顺序真的变**（Loop1 当场可见）。
3. **草稿发送 = C（复制 + 模拟已发送）**：涉他人时生成草稿 → 「复制」按钮 + 点一下变「已发送」状态。

### 触发点
今天只做**早 briefing 触发**（Today 页汇总「今天有 N 段可用通勤」），on-capture 留后。

### 施工清单（基于现有 index.html 单文件 + mock）
1. **N2 数据**：扩 mock，加 `owedReplies`、`pendingMeetings`；复用 `pendingTasksDB`。每条候选含：`title, estMinutes, kind(solo/call/video/think), importance, urgency, involves(人或null)`。
2. **N3 引擎**：把现有 `findCommuteScheduleSuggestion` 升级为返回 **Top3**——模态门控（按 `getWorkability`）+ 时长硬门槛 + 重要紧急排序 + Loop1 偏好权重加成。
3. **N4 卡片**：现有单条建议卡 → **3 tab 建议卡**（每 tab 一个候选，含理由）。
4. **N5/N6 决策执行**：
   - 单人事 → 排进通勤卡（复用 `confirmCommuteSchedule` 思路）。
   - 涉他人 → 展开草稿框 + 「复制」 + 「标记已发送」。
5. **N7 埋点+Tier 1**：全局 `interactionLog[]` 记 `{context(window/route/kind), top3, chosenIdx/dismissed, explicitReject, involves, draftGenerated, draftSent, ts}`；`prefStore` 使用统一偏好 schema 的简化版：`{dimension, key, alpha, beta, confidence, sampleCount, lastUpdated}`。接受 → `alpha+1`，拒绝 → `beta+1`，用简化 Beta 置信度回喂排序；选完显示「已记住」微提示。Tier 2 模式发现引擎本次 MVP 不做（存 backlog）。
6. **Stage 0 持久化**：隔离 `prefStore` 接口（`loadState/saveState`），用 `localStorage` 实现；`prefStore` + `interactionLog` 每次更新后落盘，启动时读回 → **刷新/重开不丢学习**。为 Stage 1 后端铺路（之后只换实现）。
7. **验证**：本地打开，跑通「早 briefing 看到可用通勤 → 3 tab → 选一个 → 单人排进/他人出草稿 → 再次进入顺序已变 → **刷新页面学习仍在**」。

### 今天不做（backlog）
- Loop2 路线学习、on-capture 触发、analytics 小面板
- 通勤可靠性、团队双向协商
- **Tier 2 模式发现引擎**（统计扫描 + 置信度门控，下次迭代第一项）
- **Tier 3 结构性学习**（LLM 离线分析日志 → 建议新维度，远期）
- **时间衰减 + 延迟奖励**（偏好会遗忘；接受后最终取消/改期也要反向学习）
- **Agent 眼中的你** 偏好库页面（用户可查看/纠正 agent 学到的偏好）
- **安全信封 + trial 状态**（学习不能覆盖不重复预订、未授权不发消息等不变量；新规则先软运行可回滚）
- **N3 LLM 增强排序**（混合引擎，确定性硬门槛 + LLM 软排序 + 安全检查兜底）
- **N3 ML 预测层**（独立 Beta → 多特征联合预测，见 §ML 预测层）
- **用户偏好档案**（显式声明式偏好，解决冷启动，见下 §用户偏好档案）
- **自然语言自定义规则**（用户用口语加规则 → agent 理解 → 结构化，见下 §自然语言自定义规则）
- **Stage A 训练数据采集**（`interactionLog` 加完整特征向量 + label，只记不用，为 ML 铺路）

---

## 决策引擎 + LLM 混合方案（待确认）

> 现有架构：LLM 只在边缘（耳朵+嘴），决策引擎 100% 确定性。是否让 LLM 参与 N3 排序？

### 结论：可以，但要分层

N3 内部拆三步：硬门槛永远是确定性代码，LLM 只在软排序环节增强。

### N3 混合引擎设计

| 步骤 | 做什么 | 谁做 | 可靠性 |
|------|--------|------|:--:|
| **Step 1 · 硬门槛** | 时间冲突检测、模态门控、时长适配 | 确定性（不改） | ✅ 零容错 |
| **Step 2 · 基础排序** | 重要紧急矩阵 + Tier 1 偏好权重 → 初步 Top 3 | 确定性（不改） | ✅ 零容错 |
| **Step 3 · LLM 增强** | 候选 Top 3 + 今日上下文 + 用户习惯 → 考虑隐藏关联（相邻会主题延续、人物关系、昨日未完成任务）→ 调整排序 | **LLM（新增·可选）** | ⚠️ 需要 Step 4 兜底 |
| **Step 4 · 安全检查** | LLM 的建议真的满足硬门槛吗？时长、模态、时间都验证 | 确定性（兜底） | ✅ 验证不通过 → 回退 Step 2 |

### 关键保险
- LLM 输出的是**排序建议**，不是最终决定
- Step 4 确定性验证不通过 → **直接回退**到 Step 2 的纯确定性排序
- 用户看到的仍然是"确认/拒绝"，最终决定权在人
- 延迟增加 1-2 秒，成本 ~$0.002/次

### 何时加
- **MVP 阶段：不加。** 先用纯确定性验证整个闭环。
- **有用户反馈"建议不够聪明"后：加 Step 3+4**

---

## 用户偏好档案（借鉴 CLAUDE.md，解决冷启动）

> 视频核心 insight：2 分钟设置胜过 2 小时调教。Tier 1 从零学习需要数据积累——新用户第一天 agent 是"瞎的"。

### 方案
产品新增 **Settings → Preferences** 页面，用户主动声明：
- ⏰ **时段偏好**：早上 9 点前不排会 / 周四晚社交 / 周五下午不排深度工作
- 🚂 **通勤能力**：火车=可视频 / 公交=只能电话+音频 / 走路=只思考
- ⏸️ **默认 buffer**：客户会 15min / 普通会 5min / 线上会 2min
- 📍 **常用出发点**：家(Fribourg) / 办公室(Zürich Oerlikon)
- 🤝 **关键人时长**：和 Alex 的会通常 20min

### 与 Tier 1 学习的关系
- 初始值从偏好档案来 → 解决冷启动
- Tier 1 行为数据微调 → 覆盖"你以为自己这样但实际那样"的差距
- 用户在偏好页面可以看到"你声明的不排周五下午，但实际你接受了几次→已自动调整"

---

## 自然语言自定义规则

> 借鉴视频的 Workflow Markdown 模式。目前 agent 的所有规则只能你（开发者）改代码。

### 方案
用户用自然语言输入："不要在午饭时间 12:00-13:00 排任何事情"

Agent 流程：
1. LLM 理解意图 → 映射到已知参数结构（时段黑名单）
2. 创建规则 → 归入 Tier 1 → 下次 N3 硬门槛自动检查
3. 返回确认："已记住：工作日 12-13 不排会"

如果 LLM 无法映射到已知参数结构（如"和 UZH 的人见面约在大学附近"）→ 归入 Tier 3 发现队列 → 等待人为新维度创建结构。

**LLM 在这里是低频、用户主动触发、结果可验证的**——符合"LLM 在边缘"原则。

---

## "Agent 眼中的你" 面板

> 借鉴视频的自动记忆概念。用户应该能看到 agent 学了什么，并且能纠正。

### 方案
在 Settings 中新增一个透明面板，展示：
- 已学的偏好 + 置信度 + 数据来源
- `🚂 Fribourg→Zürich 火车：视频可用 (置信度 94% · 7/7 次接受)`
- `⏰ 早上 9 点前：不排会 (置信度 89% · 12/14 次拒绝)`
- 每条旁边有 ✏️ 纠正按钮 → 用户可以手动覆盖："其实可以排，但只限紧急的事"

**价值：** 信任来自透明。用户看到 agent 的逻辑，就更愿意放手。这也是 autonomy 滑块的前提——用户知道 agent 在做什么，才敢给它更多自主权。

---

## ML 预测层（借鉴 Pictet RM 项目 · ML + LLM 分工模式）

> 灵感来源：Pictet Asset Management 的 Relationship Manager 优先级工具——ML 预测流失风险+增销倾向 → SHAP 解释 → LLM 生成 talking points。Solo 项目，EPFL Machine Learning in Finance 课程，唯一一个单人打赢十组的。

### 现实定位（先想清楚再写代码）
- **当前阶段不建模型。** 绑死我们的不是算法，是**数据量 + 产品验证**。一个用户一天只产生 5–15 个调度决策；30 维特征要训得动需要 300–600 条起步、理想上千，单用户要攒几个月且分布会漂。先把产品做到能展示、好用。
- **真正的 ML 护城河 = 跨用户池化模型 + 瑞士/EU 数据驻留**，不是「每个用户把 Beta 升级成 XGBoost」（单用户天生数据饥饿）。Pictet 的本质也是跨客户横截面。等有了多用户数据，训一个群体先验 + 个人特征微调，才是 ML 发光的地方。
- **预测优先级重排**：先做**预测 2（实际时长）**，因为它标签清晰、直接喂硬门槛、且**起步用统计就够、根本不用 ML**。预测 1（接受概率）数据饥饿，维持 Beta，等跨用户数据再升级。
- **现在已落地（cheap 两件事）**：
  - Stage A 埋点：`interactionLog` 每条记录完整特征向量 `features` + `label`（accept=1/reject=0），只记不用，为将来训练铺路。`buildFeatureVector(candidate, ctx)` 已实现。
  - 时长滑动平均：`predictDurationMinutes(candidate)` 用 `(person 优先, 否则 kind)` 的运行均值替代固定 `estMinutes`，喂给硬门槛；编辑事件改时长时 `recordObservedDuration` 自动学习。接口与未来 ML 模型一致，内部可无缝替换。

### 为什么 Scheduling Agent 需要 ML，而不只是 LLM

当前 Tier 1 用 Beta(alpha, beta) 按维度独立计算偏好。这能工作，但有一个结构性问题：

**Beta 假设每个维度独立影响结果。** 实际上，用户在"周五下午 + 火车 + 视频会 + 和 Alex"这个组合下是否接受，不是四个独立概率的简单叠加。维度之间存在非线性交互。

这就是 Pictet 项目用 ML 而不是规则引擎的原因——同样的道理：

| | Pictet RM 工具 | Scheduling Agent |
|---|---|---|
| **预测目标** | 客户流失概率 / 增销倾向 | 用户接受建议的概率 / 事件实际时长 / 被改期概率 |
| **输入矩阵** | 客户 × 特征（AUM/交易/产品/联系频率） | 建议 × 特征（时段/模态/类型/人/历史） |
| **为什么不用规则** | "上次联系>30天+AUM跌>10%+单产品"的交互效应规则写不完 | "周五下午+火车+和Alex+视频会"的组合有几千种 |
| **LLM 做什么** | 把 SHAP 值翻译成 talking points | 把建议理由翻译成自然语言卡片（已做） |
| **ML 做什么** | 输出校准后的概率 + 特征贡献 | 输出校准后的概率 + 特征贡献 |

### 三个 ML 预测目标

#### 预测 1：接受概率 P(accept | context, suggestion)

**这是 Pictet "churn risk" 的直接对应。**

当前做法：每个维度独立 Beta → 取均值作为排序加成。问题：维度之间没有交互。

ML 做法：
```
输入特征向量（~30 维）：
  时间上下文：星期几、时段（早/午/晚）、是否周一早/周五晚
  通勤上下文：路线 ID、模态（火车/公交/开车/走路）、窗口时长
  建议属性：类型（电话/视频/任务/思考）、预估时长、是否涉他人、对方 ID
  历史统计：该路线接受率、该模态接受率、该类型接受率、该人接受率
  近期行为：过去 7 天接受/拒绝数、当前 busyness（今日已有几场会）

输出：P(accept) ∈ [0, 1]，每个特征对预测的贡献（SHAP）
```

效果：agent 不再问"你一般喜欢在火车上开会吗"，而是知道"周五下午的火车上，如果会议涉及 Alex 且时长 ≤20min，你基本都会接受"。

#### 预测 2：实际时长 P(actual_duration | event_features)

**这是 Pictet 项目没有、但 Scheduling Agent 独有的预测需求。**

当前做法：每个候选有固定 `estMinutes`。问题：用户估算不准确。"和 Alex 的定期 sync"写的是 30min，实际平均 18min。

ML 做法：
```
输入：事件类型、参与者、周几、时段、是否通勤中、历史同类事件的实际时长

输出：预测时长 + 置信区间
  - "这个会你预估 30min，但历史数据看通常 18-25min → 建议排 20min"
  - N3 有了准确的时长预测，才能精确匹配通勤窗口
```

这是硬门槛（时长适配）的前提——如果时长估不准，整个排序都是错的。

#### 预测 3：改期风险 P(reschedule | event)

**这是 Pictet "churn risk" 的远期对应——预测事件是否"会流失"。**

当前做法：无。事件排进去就不管了。

ML 做法：
```
输入：事件属性 + 排入时间 + 参与者历史改期率 + 该时段的历史稳定性
输出：P(未来 24h 内被改期)

如果 P > 0.7 → agent 主动提示："这个会 3 次有 2 次被改期了，要不这次排短一点？"
```

这个预测比较远期，今天不用做。

### 特征工程：ML 模型"看到"什么

以预测 1（接受概率）为例，每次 N3 排序时，对每个候选生成一行特征向量：

```
候选 ID: call_alex_friday_train
────────────────────────────────────
时间维度：
  day_of_week = 5 (周五)
  hour_of_day = 17
  is_morning = 0
  is_lunch = 0
  is_evening = 1
  is_friday_afternoon = 1

通勤维度：
  route_id = "fribourg_zurich_ic1"
  route_mode = "train"
  window_duration_min = 55
  workability_video = 0.9 (当前 Tier 1 学到的)
  workability_call = 0.95

建议维度：
  kind = "call"
  est_minutes = 20
  involves_other = 1
  person_id = "alex_mueller"
  source = "owed_reply"
  importance = 4
  urgency = 3

历史维度（从 prefStore + interactionLog 提取）：
  route_accept_rate = 0.85
  mode_accept_rate = 0.78
  kind_accept_rate = 0.82
  person_accept_rate = 0.91
  recent_7d_accepts = 12
  recent_7d_rejects = 3
  today_event_count = 5

→ ML 输出：P(accept) = 0.87
   贡献分解：person_accept_rate 贡献最大（+0.22），其次是 is_friday_afternoon（-0.08）
```

**关键：所有这些特征目前已经在系统里。** `prefStore` 存偏好，`interactionLog` 存历史，`eventsDB` 存事件属性。ML 不是新增数据采集——是把已有数据从"独立 Beta 加权"升级为"联合预测"。

### ML + LLM 的分界线（Scheduling Agent 版）

完全复用 Pictet 项目的分工逻辑：

```
N3 匹配排序（大脑）
   │
   ├── Step 1 · 硬门槛 ──────────── 确定性（不改）
   │   时间冲突、模态门控、时长适配
   │
   ├── Step 2 · ML 预测 ─────────── ML（新增）
   │   输入：候选 × 30+ 特征向量
   │   输出：P(accept)、特征贡献
   │
   ├── Step 3 · 排序 + 选 Top 3 ─── 确定性（不改）
   │   综合 ML 概率 + 重要紧急 → 排序
   │
   └── Step 4 · 安全检查 ─────────── 确定性（不改）
       验证时长、模态、时间 → 不通过则回退

N4 呈现（嘴）
   │
   └── LLM（不改）
       把 Top 3 + SHAP 贡献翻译成卡片文案
       "你通常在这个时段接受和 Alex 的通话——上次聊是 5 天前"
```

**ML 在这里是"增强型 Step 2"，不是替代。** 硬门槛不动，安全兜底不动，LLM 的表达角色不动。ML 只做一件事：**把 Beta 加权升级为多特征联合预测。**

### 实现路径

| 阶段 | 做什么 | 技术 | 触发条件 |
|------|--------|------|---------|
| **现在** | Tier 1：独立 Beta 加权 | 纯 JS 统计 | 已有 |
| **现在 ✅** | 预测 2 时长：`(person/kind)` 运行均值替代固定估时，喂硬门槛 | 纯 JS 统计（非 ML） | **已落地** |
| **Stage A ✅** | 采集训练数据：每次交互记完整特征向量 `features` + `label` | `interactionLog` 加字段 | **已落地（只记不用）** |
| **Stage B** | 离线训练：积累 200+ 条交互后，Python 训练轻量模型（XGBoost / Logistic Regression） | Python scikit-learn | 交互量达标 |
| **Stage C** | 在线推理：模型 → ONNX → 浏览器端推理（不依赖后端） | ONNX.js | Stage B 完成 |
| **Stage D** | 持续学习：新交互 → 定期重训练 → 更新 ONNX 模型 | 同 B→C 循环 | 周期性 |

**Stage A 是关键——现在就要开始记，否则永远没有训练数据。** 改动极小：在 `interactionLog.push()` 时多记几个字段。

### 现阶段不做（明确边界）

- ❌ **不用 ML 做硬门槛**：时间冲突、模态门控永远是确定性代码
- ❌ **不用深度学习**：数据量不够，XGBoost 或 Logistic Regression 足够
- ❌ **不替代 LLM 表达**：ML 输出概率和特征贡献，LLM 仍负责写人话
- ❌ **不做在线训练**：模型离线训好 → 浏览器加载静态 ONNX → 只推理不更新
- ❌ **不做改期风险预测**（预测 3）：等预测 1+2 稳定后再考虑

### 和现有 Tier 1 的关系

ML 不是替代 Tier 1——是 Tier 1 的升级版：

```
Tier 1（现在）：Beta(alpha, beta) 每维度独立 → 简单平均 → 排序加成
Tier 1（Stage C）：30 维特征 × XGBoost → 联合预测 P(accept) → 排序加成
```

**同一个位置，同一个接口。** N3 引擎调 `predictAcceptance(candidate, context)` 返回一个概率。现在这个函数内部是 Beta 均值，未来是 ONNX 模型——**调用方代码不变。**

---

## 持久化 + 日历整合架构（从 prototype 到真产品）

### 立场：我们不是日历，是日历之上的一层
Google / Outlook 永远是**事件的真相源**。我们 **同步进来 → 加智能（偏好/建议/通勤调度）→ 把用户批准的改动写回去**。
即"日历界的 Cursor"——不替代文件，只编辑文件。好处：我们不拥有事件，只标注 + 提议修改，**大幅降低同步复杂度**。

### 目标架构
```
Google Calendar ─┐
Outlook / Graph ─┼─→ [同步适配器 CalendarProvider] ──┐ 归一化事件
(未来其他平台) ──┘                                    ▼
                                          ┌────────────────────┐
                                          │   后端 API + 数据库  │
                                          │  · OAuth tokens(加密)│
                                          │  · 事件缓存+同步状态 │
                                          │  · prefStore(学到的脑)│ ← "训练结果"
                                          │  · 交互日志/用户档案  │
                                          └─────────┬──────────┘
                                                    ▼
                                   前端（index.html → 之后 PWA）
                                   决策引擎 + 建议 UI
```

### 1. 持久化（让"训练结果"保留）
| 阶段 | 做什么 | 何时 |
|---|---|---|
| **Stage 0 · localStorage** | `prefStore`+`interactionLog`+运行时改动存浏览器，刷新不丢。~10 行 `saveState/loadState` | **今天 MVP 就做** |
| **Stage 1 · 真后端** | 小 API + DB，跨设备/团队、安全存 OAuth token | 多设备/团队时 |

**关键**：隔离 `prefStore` 接口（`load/save/update`）。Stage 0 用 localStorage 实现，Stage 1 换 API → **引擎代码不改**。今天就把这个接口隔离出来。

后端选型（Stage 1）：Supabase/Firebase（最快，自带 Auth+DB）vs 自建 Node+Postgres（可控、可自托管）。瑞士团队：**自托管 / 数据驻留 EU·CH 是隐私护城河**。

### 2. 日历整合（Google + Outlook，双向）
- **Google Calendar API**（OAuth2 `calendar.events`）：读/增/改/删 + `syncToken` 增量 + webhook 推送。
- **Microsoft Graph API**（`Calendars.ReadWrite`）：`/me/events` + delta query + subscriptions webhook。
- 都是 OAuth2 → **必须后端安全存 refresh token**（纯 static html 做不了，需 Stage 1）。
- **抽象层**：`CalendarProvider` 接口（`listEvents/createEvent/updateEvent/deleteEvent/subscribeChanges`），Google/Microsoft 各一实现，引擎只消费归一化事件。**未来加平台 = 加 provider，引擎不动。**

**双向同步分三步**（别一上来做全量双向）：
| 步 | 范围 | 难度 |
|---|---|---|
| a. 只读导入 | 拉日历 → 显示 | 易 |
| b. 写回已批准动作 | 接受建议时只改那一条 | 中 |
| c. 持续全量双向 | id 映射 + 增量 token + 冲突解决 + 幂等 | 难·留后 |

### 该持久化的数据
1. **prefStore（学到的脑）** ← 每用户一份，必须存。
2. **交互日志** ← 喂 Tier 2/3，append-only。
3. **事件缓存 + 同步状态**（syncToken、外部 id↔内部 id 映射）。
4. **OAuth tokens**（加密）。
5. **用户偏好档案**（CLAUDE.md 式声明）。

### 已落地 ✅：模式按域名锁死（Demo vs Personal，不是开关）
> 决策修正：**不要设置里切换模式**——「能切」本身就让人困惑。要么 demo 要么真实版本，URL 一眼区分。
- 启动时 `detectAppMode()` 按 hostname 判定，**用户无法切换**：
  - `calendar-demo.yiwang.dev` → **demo**：加载 `DEMO_SEED`，任何改动**不落盘**，可「Reset sample data」。
  - `calendar.yiwang.dev` → **personal**：真实数据，持久化。
  - `?mode=demo|live` → 本地/preview 调试用的覆盖参数。
- 启动时捕获代码里的精编数据为 `DEMO_SEED`（pristine 克隆）。
- 落盘的 DB：`eventsDB / runtimeEvents / pendingTasksDB / owedRepliesDB / pendingMeetingsDB / completionDB / completedInboxIds`。
- 写入钩子：`saveAppData()` 接在 `syncAllViews()` + 各 mutation 点（capture 提交、accept 建议、删除、编辑、完成），`appMode!=='live'` 时静默跳过。
- 持久化接口 `snapshotDBs / loadDBsFrom / saveAppData / applyAppMode`：**localStorage 只是过渡，下一步换 Supabase 不动引擎**。
- 入口：导航栏齿轮 → Settings 浮层，显示当前 Mode 徽章（只读）+ 对应操作（personal: Clear my data / demo: Reset sample）。
- 测试：`tests/persistence.test.js`。

### 部署（Vercel + yiwang.dev）
- 一个 Vercel 项目，从 GitHub 仓库导入，纯静态零构建（`vercel.json` 仅 cleanUrls；`.vercelignore` 排除 tests/.md）。
- **同一项目挂两个子域名**（不是部署两次）：`calendar.yiwang.dev`（真实）+ `calendar-demo.yiwang.dev`（展示）。`git push` 一次两边同更。
- yiwang.dev 的 DNS 在 Vercel → 子域名几乎自动打通。
- 模式由 hostname 锁定，所以两个子域名天然是两个固定版本，且 origin 不同 → 数据物理隔离。

### 后端：Supabase（真实版本的持久化，待做）
> localStorage 是单设备过渡；真要用必须有后端。选 Supabase（Postgres + Auth + RLS，EU 数据驻留可选，契合「瑞士/EU 数据驻留」护城河叙事）。
- **只 personal 模式用后端**；demo 永远本地 seed，不碰后端。
- 适配层替换 `saveAppData/applyAppMode` 内部实现：load 时从 Supabase 拉，mutation 时 upsert；localStorage 作离线缓存/兜底。接口不变。
- 表（每行带 `user_id`，RLS 隔离）：`events`、`tasks`、`completions`、`prefs`(prefStore)、`interaction_log`(Stage A 特征)、`durations`(时长统计)。
- Auth：Supabase magic-link（先单人，结构天然支持未来多用户 + 跨用户池化 ML）。
- 前端只需 Supabase URL + anon key（public-safe，配 RLS）。URL/key/admin email 全写死在代码里，**用户永远看不到、也不用填**；管理员按邮箱识别（`ADMIN_EMAILS`），只有管理员能看到 Reset/Clear/模式 等管理控制。
- 已知行为（非 bug）：magic-link 登录态是**按浏览器/设备**的——换台电脑/换浏览器要重新点一次邮件链接登录，登录后数据同步。待办：登录态跨设备记住（持久 session 已默认开，但首次每端仍需点链接）。

### 语音输入路线（待做）
> 决定：STT 用 **云端 Whisper**；key 走 **serverless 代理**（产品给别人用，绝不前端裸 key）。代理与 Supabase 同在 Vercel。
- 流水线：按住说话 → ① 录音传代理 → ② Whisper 转写 → ③ LLM function-calling 解析为结构化事件（**注入当前真实日期**才能解「明天下午三点」）→ ④ **可编辑草稿卡** → ⑤ 确认才写日历（→ Supabase）→ ⑥ 纠正进 `interaction_log`，越用越准。
- 「识别/写入出错」对策：**绝不自动写**，永远先给可编辑草稿；置信度低 → 高亮追问一句而非猜。
- 现有 `startCapture` 多步向导（模拟、写死日期）将被这条真流水线替换。

---

## 北极星：学习成本 = 0（设计标准）

> 一句话定位：**Asana 给你一套工具，让你自己组织时间；我们直接把组织好的时间交给你。**
> 用户不配置、不学概念，AI 在背后把规划做完，用户只做「确认 / 否决」这一个动作。

### 向 Asana 学什么 / 避什么
**借鉴（do）**
- **一条任务 = 一个对象，多视图投影**：List / Board / Calendar / Timeline 共享同一份数据，改一处处处同步 →（我们已实现：`removeTaskEverywhere` + `syncAllViews`，单一真相）。
- **行内完成**：左侧圆圈，一点即完成、划线、下沉，零确认零弹窗。
- **My Tasks 统一收件箱**：一个「属于我的、待处理」入口，而非让用户去各处翻。

**避开（don't）——正是 Asana「乱」的来源**
- **功能过载**：Projects / Portfolios / Goals / Workflows / Rules / Custom Fields…新用户面对几十个概念，不知从何下手。
- **配置即工作**：把「规划」外包给用户（自己建字段、配规则、设依赖）。我们要反过来——规划由 AI 完成。
- **空状态是死路**：空 board 只说「add task」，不告诉下一步。

### 5 条可执行 UI 铁律（每一处都要满足）
1. **每屏只有一个主动作**——用户一眼看到「现在该点哪」（Inbox 圆圈、窗口 Confirm）。
2. **不引入要学的新名词**——只用日常词：今天、任务、通勤、确认；杜绝 project/field/workflow。
3. **默认即最优**——AI 给的排期默认就是答案，多数时候只需点一下接受。
4. **空状态是引导不是死路**——没任务时说「都安排好了」，并指向下一步。
5. **后台消化复杂度**——时区、通勤可工作性、冲突检测全在背后算好，前台只给结论。

### LLM 用在哪 / 不用在哪
- **用 LLM**：理解模糊自然语言输入、润色对外消息表达、Tier 3 结构化学习。
- **不用 LLM（确定性规则即可）**：Inbox 排序（截止日 + 优先级）、冲突检测、通勤可工作性、时间预算计算。**能用规则就不用模型**——更快、可解释、零成本。

### Inbox 任务视图规格（已实现）
- 全部任务可见；**完成 = 勾选 → 变淡 + 删除线 → 下沉到底部**（保留，可再次点取消完成）。
- **删除是独立动作**：每行最右小删除按钮 → 内联「Delete?」确认 → 才真正移除。
- 完成的任务从 Agent 候选池剔除（不再被建议排期），但仍留在 Inbox 底部。
- 排序确定性：未完成在上（按 `inboxSortScore` = 截止日×100 + 重要度×10 + 紧急度），已完成沉底。

---

## 数据同步与编辑模式（Sync & Edit Patterns）

> 2026-06-09 阶段性总结。核心原则：**一处改动，处处同步**。

### 1. 同步中枢 `syncAllViews()`

所有数据改动（`editEventField` / `editInboxField` / 完成切换 / 新增 / 删除）统一调用 `syncAllViews()`，它重渲染所有受影响视图并 `saveAppData()` 持久化：

```
用户改动 → syncAllViews()
  ├─ renderTodayPage()        首页
  ├─ renderCal()              日历格子
  ├─ refreshDayDetail()       已打开的某天详情（需 selectedDay + 面板 .show）
  ├─ renderInbox()            任务视图（需 calView === 'tasks'）
  ├─ renderAnalyticsPage()    分析页（若 active）
  └─ saveAppData()            Supabase / localStorage
```

### 2. 三个数据源

| 数据源 | 内容 | 读取方 |
|--------|------|--------|
| `eventsDB[year-month][day]` | 有具体时间段的日程事件 | 日历格子圆点、首页时间线、某天详情 |
| `pendingTasksDB` / `owedRepliesDB` / `pendingMeetingsDB` | backlog 任务，有 `deadline` 无时间段 | 任务视图、Agent 候选池 |
| `completionDB` / `completedInboxIds` | 完成状态 | 所有视图共享 |

首页打勾完成事件 ↔ 任务视图打勾完成，互相同步（都读 `completionDB` / `completedInboxIds`）。

### 3. 两套「米色卡片」新增/编辑模式（本质相同）

**首页事件**（`index.html`）
- **新增**：`TODAY` 标题行右侧 `+` → `addTodayEvent()`（写 `eventsDB[today]`，设 `expandedEventId`，聚焦 `.e-title-input`）
- **渲染**：`renderEventCard(e, {editable:true})` → 米色 `renderEventEditor`
- **字段**：Type / Time（start–end）/ Who / Location / Note；task-like 类型含 reschedule + agent 只读提示
- **编辑**：`editEventField` / `editEventCustomKind`（自定义类型 oninput 不 re-render，防失焦）
- **展开态**：`expandedEventId` + `toggleTodayEventExpand`（点开/收起，勾选保存）

**任务视图（Inbox）**
- **新增**：`* open` 右侧 `+` → `addInboxTask()`（写 `pendingTasksDB`，设 `expandedInboxId`，聚焦 `.inbox-title-input`）
- **渲染**：`renderInboxDetail` 米色编辑器
- **字段**：Type / Who / Duration / Due（`deadlineToISO` ↔ `isoToDeadline` 转换）
- **编辑**：`editInboxField` / `editInboxCustomKind`
- **展开态**：`expandedInboxId` + `toggleInboxExpand`

两者差异仅在数据源（events vs tasks）与字段（事件有 start/end，任务有 due），交互语言与组件完全对齐——日历某天详情应对齐此模式。

### 4. 日历某天详情（已升级）

- **事件**：`openDay` / `refreshDayDetail` 使用 `renderEventCard(e, {compact:true, editable:true})`，与首页同款米色编辑器
- **新增**：`dd-header` 日期右侧 `+` → `addEventToDay()`（写 `selectedDay` 对应日期）
- **Due 联动**：设了 `deadline` 的 backlog 任务在到期当天日历格子显示黄色 due 圆点（`.cal-dot.due` = `#e0a83e`，与其他事件圆点同尺寸）；某天详情底部「Due this day」小节复用 `inboxRowHtml` + `renderInboxDetail` 可就地编辑
- **已移除**：底部「Add Event to This Day」按钮与 `quickAddToDay()`（语音输入未来直接写入当天，不再需要此入口）

### 5. Agent Suggestions 的范围（重要边界）

- `getPlanWindows()` 目前**只算今天**：用 `todayMonthKey()` + `getTodayDate()` 取今天的 desk free slots（被今天 events 切碎）+ 今天可用通勤窗口。
- 给任务设 due ≠ 把任务安排进那天的空闲时间；due 只驱动日历黄点 + 「Due this day」清单。规划入口（任务右侧日历图标 / Agent Suggestions）问的始终是「能否塞进今天剩余窗口」。
- 候选池 `buildCandidatePool()` 来自 `pendingTasksDB` / `owedRepliesDB` / `pendingMeetingsDB`，已完成项剔除。新增任务会进候选池，但只有满足「今天某窗口剩余时间足够 + 类型适配 + 窗口未被 confirm/dismiss」才会出现。
- 确认窗口的落地：desk window → 真生成事件写进 `eventsDB[today]`；commute window → 写进该通勤事件的 `commuteTasks`。两者都 `syncAllViews()` 持久化。
- **未来**：若要「按 due 那天找空闲、跨天见缝插针」，需把 `getPlanWindows()` 泛化为接受任意日期，而非钉死今天。

### 6. 后端存储形态

- Supabase 表 `app_state`：**一个用户一行**，`data` 为 JSONB 快照（`snapshotDBs()`），含 `eventsDB` / `runtimeEvents` / `pendingTasksDB` / `owedRepliesDB` / `pendingMeetingsDB` / `completionDB` / `completedInboxIds`。
- 任何视图的改动 → `saveAppData()` → localStorage 缓存 + `cloudSave()`（800ms 防抖）→ `app_state.upsert`。所以数据确实入库，但不是「每个 event 一行」，而是整份 JSON。
- 这是 MVP 的合理取舍（实现快、同步简单）。未来做多设备冲突 / 团队协作 / 分析报表时，再拆为结构化表（`events` / `tasks` / `suggestions` / `learning_events`）。

---

## Agent Loop · 从「被动日历」到「主动 agent」的核心架构（2026-06-09 定锚）

> 这是把产品从"带建议挂件的日历"升级为"真正主动管理日程的 agent"的中心架构决策。
> 方向已定：**阶段 1 优先**（纯前端可做）；自主权取向：**主动发现 + 主动提议，但永远人来点确认**（propose-only，先赢信任）。

### 一、残酷诊断：现在它还不是 agent

证据在代码里：
1. **只在用户点的时候动**：全是 render-on-interaction（`syncAllViews()` 被动重绘），没有任何东西在用户不看时替他思考。
2. **大脑只看今天**：`getPlanWindows()` 钉死 `todayMonthKey()` + `getTodayDate()`，连"周一截止的任务还没排"都不会主动提。
3. **喂的是假数据**：`pendingTasksDB` / `todayFreeSlots` 是 demo seed，没接真实日历。

差的不是 UI，是缺一个中心对象：**Agent Loop（主动循环）**。

### 二、缺失的中心对象：Agent Loop

文档里的 N1→N7 节点图，现在是"用户走一遍"，不是"agent 自己跑一遍"。真正的分水岭：

```
runAgentLoop(horizon=7d)
  → snapshotState()         events + tasks + deadlines + completions
  → MOVE_DETECTORS 注册表    跑一遍所有 detector
  → Move[] 汇总
  → safetyFilter()          不重复预订 / 不碰睡眠 / 不自动发消息
  → rankMoves()             severity + 学到的权重
  → renderBriefing(moves)   一组可操作卡片
  → 用户: 确认/拒绝/改 → 记录信号 → 学习 → 下一轮
```

**关键反转**：Daily Briefing 不再是页面底部的被动信息卡，而是**这个循环的产出物**——agent 主动跑完一圈后递给你的结论。

### 三、护城河能力清单：Proactive Move Taxonomy

日历只告诉你"你有什么"；agent 主动告诉你"关于时间，有哪些你还没想到该做的事"。这些就是 Moves。当前只实现了 1.5 个：

| Move 类型 | 主动检测什么 | 现状 |
|---|---|---|
| **Gap-fill** 见缝插针 | 空块 + 适配任务 | ✅ 跨天（`proposeSlotsForTask`，今天→horizon 每天一个最佳空档）|
| **Commute-fill** 通勤塞事 | 可用通勤 + 轻任务 | ⚠️ 只限今天（可工作通勤=不算冲突，见下）|
| **Deadline-risk** 截止日预警 | 快到期但没排块的任务 | ✅ 已实现（`detectDeadlineRisk` → 首页 Agent suggestions 简报，一键排/自定义日期时间）|
| **Conflict** 冲突消解 | 双重预订 / 排进不可工作时段（如 walk）| ⚠️ 调度即校验已实现（`detectSlotConflict`，warn+覆盖+学习）；**主动巡检尚无**（不会自己发现已存在的重叠）|
| **Prep** 会前准备 | 重要会前无准备块 | ❌ 无 |
| **Follow-up** 会后跟进 | 会后欠的消息/笔记 | ❌ 无 |
| **Cleanup** 收尾 | 过去事件未标记完成 | ⚠️ 统计有但不主动催 |
| **Rebalance** 重排 | 今天过载 → 建议挪 | ❌ 无 |
| **Energy Guard** 精力守护 | 3 个 deep work 背靠背无缓冲 → 建议插入 break 或交换时段 | ❌ 无 |
| **Context Switch Cost** 切换成本 | deep→meeting→deep→meeting 频繁切换 → 建议聚合同类任务 | ❌ 无 |
| **Travel Optimize** 出行合并 | 两天各有一个 Zürich 的会 → 建议合并到同一天节省往返 | ❌ 无 |
| **Week Ahead** 周全局优化 | 不只优化今天——"周四太重，周三可以承接部分" | ❌ 无（大脑只看今天） |
| **Pre-mortem** 事前验尸 | 接受安排前跑一遍"如果出事会是什么"——"4pm 的会可能让你赶不上 5pm 火车" | ❌ 无 |

加新能力 = 往 `MOVE_DETECTORS` 注册表 push 一个纯函数，不动其他代码。**这个可扩展性就是壁垒**。

#### 新增 Move 详解

**Energy Guard（精力守护）：** 时间管理 ≠ 精力管理。高管的瓶颈通常是认知精力，不是日历空格。检测规则：连续 ≥3 个 `deep_work` 类型事件之间无 ≥15min buffer → 生成 warning move → 建议在中间插入 break 或将其中一个 deep 换成轻任务。

**Context Switch Cost（切换成本）：** 每次 deep→meeting→deep 切换的隐性成本约 20min（注意力重建）。Agent 统计一天的切换次数，如果 ≥4 次 → 建议重新排序："把两个 deep work 并在一起，把两个 meeting 并在一起，少两次切换 = 省 ~40min。"

**Travel Optimize（出行合并）：** 瑞士高管的核心场景——家住 Fribourg、办公室在 Zürich，往返 2.5h+。如果周二和周四各有一个 Zürich 的会，agent 应该主动建议合并到同一天。需要跨天扫描 + 知道事件地点。

**Week Ahead（周全局优化）：** 当前所有优化是单天局部最优 ≠ 周全局最优。"周四已经 7 场会了，周三只有 2 场——把周四的某个 deadline 任务提前到周三下午做"。

**Pre-mortem（事前验尸）：** 真人助理会在你接受安排前想到你会后悔的事。Agent 在用户确认前跑一个快速检查：这个时间+地点+交通+前后事件的组合，历史上是否出现过问题（迟到/改期/取消）→ 有风险则提示。

### 四、统一的 Move 数据结构

所有主动发现的东西归一成同一对象，UI 只认这一种：

```javascript
{
  id: 'move-deadline-p1',
  type: 'deadline_risk',                 // 对应上表
  severity: 'critical',                  // critical | high | normal → 排序+颜色
  date: '2026-6-8',                      // 关乎哪一天
  title: 'SLTA newsletter 周一截止 · 还没排时间',
  reason: '预计需 2h，距截止仅 2 天，目前 0 个已排块',
  subject: { source:'pendingTask', id:'p1' },   // 指向真实任务，供学习/执行
  proposedActions: [                     // 一键执行项，每个都走【已有】确认函数
    { label:'排进周日 9:00–11:00', fn:'scheduleTaskToSlot', payload:{...} },
    { label:'忽略',                fn:'dismissMove',        payload:{...} }
  ]
}
```

**propose-only 在此结构里是天然的**：loop 只生产 Move 对象，执行永远走 `proposedActions` 指向的、已写好的确认函数（如 `confirmDeskPlanWindow`）。loop 自己从不写库 → 安全。

### 五、最痛的 Move：Deadline-risk（暴露一个必须修的数据洞）

检测逻辑（纯确定性）：
1. 取 `getInboxItems()` 里有 deadline、未完成的任务。
2. 判断"是否已排块" ← **数据洞**：`confirmDeskPlanWindow` 生成的事件 id 是 `plan-...` 但**不回指任务**，agent 无法知道任务已排过。
   → **必须补**：事件加 `sourceTaskId` 字段，排块时写回。这是把"任务"和"日历"真正打通的最后一环。
3. 算 `daysUntilDue` 与所需小时数，没排块且时间紧 → 生成 critical/high move。
4. 调用**泛化后的 `getFreeWindows(任意日期)`** 在 [今天 .. 截止日] 找空档 → 填进 `proposedActions`。

这同时回答了"为什么设了 due 也排不进去"——因为引擎只看今天；泛化 `getPlanWindows()` 接受任意日期后即可跨天找空档。

### 五-b、调度即校验：Conflict 检测 + 学习（2026-06-10 实现）

**起因**：Find New Time / 自定义日期时间允许手填任意时间，会排到"不可工作"的时段——例如 walk（步行）期间，是不能开会的。这正是 agent 该"记住并提醒"的地方。

**三层落地：**

1. **检测（建议/提示）** — `detectSlotConflict(year,month,day,start,end,excludeId)`：
   - 与任意已排事件重叠 → `overlap`（双重预订）。
   - 与 transit 事件重叠，且该交通方式**有效可工作度 < 2**（walk/drive/flight=0、bus/tram=1）→ `transit_nonworkable`。
   - 与**可工作**通勤（train=3、car-ride=2）重叠 → **不算冲突**（这正是 Commute-fill 想要的）。
   - 所有手动排期入口（reschedule 三行、briefing 自定义 `+`）确认时校验：有冲突先 inline 警告（红字 + "再点一次覆盖"），不直接写。

2. **数据记录** — 用户坚持覆盖时：
   - `recordSignal('transit_work', mode, true)` → 写入 `prefStore`（Beta 分布 alpha/beta），`saveLearningState()` 持久化到 localStorage。
   - `interactionLog.push({type:'conflict_override', kind, mode, at})` → 留痕，供未来分析/可视化。
   - 注：事件本身已通过 `saveAppData()` 进 Supabase/localStorage；学习信号目前仅 localStorage（阶段 2 应一并上后端）。

3. **学习（loop 里生效）** — `effectiveTransitScore(mode) = 基础分 + 学习增量`：
   - 若用户对某 mode 反复覆盖（`sampleCount≥2 且 置信度>0.66`）→ +2 → 该 mode 的有效可工作度提升 → 以后排进去不再报冲突。
   - 这是 **Tier-1 参数自调** 的真实样例：agent 从"你确实在 bus 上工作"这一行为，学会调整自己的 workability 判断，而不是写死规则。

**下一步（未做）**：把 Conflict 升级为**主动巡检** move——加 `detectConflicts()` 进 `MOVE_DETECTORS`，扫描已存在的重叠（不只在排期那一刻），在 briefing 主动暴露，并用 `moveEventToSlot` 给出"挪走其中一个"的一键动作。

### 六、触发时机（propose-only 下很简单）

| 触发点 | 现状 | 改造 |
|---|---|---|
| 打开 app / 当天首次渲染 | 无 | 跑一次 loop → 晨间 briefing |
| 任何数据改动后 | `syncAllViews()` 已在跑 | 顺手重跑 loop（增量）|
| 定时 / 推送 | 无 | 阶段 2 接后端再说 |

不需要后台进程——"打开即跑"在 propose-only 下已足够像"主动"。

#### 触发时机的更完整思考（2026-06-10 补充）

"打开即跑"是对的起点，但如果 agent 只在用户打开时主动，仍然是"被动主动"。真正的主动 agent 应该在以下时机触发：

| 触发时机 | 场景 | 实现阶段 |
|---------|------|:--:|
| **App 打开** | 用户打开应用 → 晨间 briefing | 阶段 1 |
| **数据变更后** | 新增事件/完成任务/编辑 → 增量重跑 loop | 阶段 1 |
| **外部日历变更** | Google/Outlook 有新事件 → webhook 触发 loop | 阶段 2 |
| **截止日临近** | 某任务 deadline 还剩 24h 但未排块 → 时间驱动 push | 阶段 2 |
| **对方回复协商** | Agent B 回复了协商请求 → 事件驱动通知 | 阶段 2 |
| **状态转换** | 用户刚结束一个会议、下一段空闲刚开始 → 主动推"这 45min 可以做 X" | 阶段 2 |
| **定时健康检查** | 每天下午 5pm → 检查明天安排是否合理 → 有问题主动提示 | 阶段 2 |
| **周审计** | 每周日晚 → 跑 Time Audit → 生成周报 | 阶段 3 |

**关键认知：** 阶段 1 只做"打开即跑"是为了快速闭环验证。但产品终极形态是 **"即使用户不在，agent 也在替他看着"**。阶段 2 接入真实日历 + webhook 推送后，大部分触发无需用户打开 app。

### 七、宏观排序（从"假主动"到"真主动"）

```
阶段1 点火   Agent Loop 抽象 + getPlanWindows 泛化到任意日期 + sourceTaskId + Deadline-risk move   ← 纯前端，当前唯一该做
阶段2 接地   接真实日历 (Google/MS Graph 只读)，从假数据 → 真实生活
阶段3 信任   autonomy 滑块 + trial 状态，从"每次确认" → "高置信自动"
阶段4 飞轮   把三层学习真正接到 Loop 上（见 learning agent.md）
```

阶段 1 是地基，其余三阶段都依赖它。**当前聚焦：阶段 1，且只 propose 不 auto-execute。**

### 八、Plan vs Actual 追踪（"规划了什么" vs "实际发生了什么"）

> 2026-06-10 新增。现有学习信号全部来自"用户在 UI 上的操作"（接受/拒绝/改了时长）。但真正的金矿是"agent 的规划"和"现实"之间的差距。

#### 为什么重要

现在所有学习信号都是**显式的**——用户点了什么按钮。但还有一个巨大的**隐式信号源**没有被利用：

```
Agent 规划：今天下午 13:00-15:00 做 SLTA newsletter（deep work）
现实：    事件被标记为"未完成"，或者被手动挪到了第二天
→ 差距被记录
→ agent 学习："你倾向于高估下午的产能"或者"周五下午做创作类任务不行"
```

这不是 Tier 1 的"改了时长"——是更高一层的模式：**agent 对用户能力的建模是错的。**

#### Plan vs Actual 数据结构

每次事件结束后（或当天结束时），记录一条对比：

```javascript
{
  eventId: 'evt-xxx',
  planned: {
    date: '2026-6-10',
    startTime: '13:00',
    endTime: '15:00',
    kind: 'deep_work',
    title: 'SLTA newsletter'
  },
  actual: {
    completed: false,
    completedDate: null,        // 实际哪天完成的
    actualDuration: null,       // 实际花了多久
    wasRescheduled: true,       // 被挪过
    wasInterrupted: false,      // 被中途打断
    userNote: null              // 用户手动备注的原因
  },
  gap: {
    type: 'not_completed',      // completed_on_time | completed_late | not_completed | rescheduled | interrupted
    severity: 'medium'          // low | medium | high（未完成的高优先级任务 = high）
  }
}
```

#### 从 Plan vs Actual 中可以学到的模式

| 发现 | 检测规则 | Agent 行为变化 |
|------|---------|--------------|
| "下午 3 点后排的 deep work 80% 未完成" | 按时段×类型分组，统计完成率 | 下午只排 meeting/轻任务；deep work 只排早上 |
| "你给 creative 类任务估时平均偏短 40%" | 按类型分组，planned vs actual 比值 | 自动将 creative 类任务估时 ×1.4 |
| "周五排的任务完成率 40%（周一 85%）" | 按星期几分组 | 周五少排高优先级任务，提前到周四 |
| "涉及 Alex 的会平均超时 50%" | 按参与者分组 | 给 Alex 的会自动加长预估 + 加 buffer |

**这个追踪器是 Tier 2 模式发现的最强信号源——超越了"用户点了什么"，进入"用户实际做了什么"。**

### 九、Schedule Health Score（日程健康分）

> 2026-06-10 新增。不只是被动回应冲突——而是主动告诉用户今天/本周的安排有多健康。

#### 评分维度（0-100）

| 维度 | 权重 | 计算方式 |
|------|:--:|------|
| **碎片度** | 25% | 事件之间的空闲块数量和质量——≥3 个空闲块且都 <30min = 碎片化严重 |
| **深度工作保护** | 25% | 是否有 ≥90min 的未被会议打断的连续块——没有 = 扣分 |
| **过度调度** | 20% | back-to-back 会议 ≥3 场无缓冲 → 扣分；≥5 场 → 严重扣分 |
| **通勤利用率** | 15% | 可用通勤时段被合理利用的比例 |
| **缓冲充足度** | 15% | 线下会议之间的交通+buffer 是否足够——任何一段不够 = 扣分 |

#### 呈现方式

```
Today · June 10
━━━━━━━━━━━━━━━━━━━━━━  72/100

✅ 早上有 2.5h 连续深度工作块
⚠️ 下午 3 场会议背靠背无缓冲
⚠️ 17:00 的会结束后只有 15min 赶火车
💡 建议：把 14:00 的 sync 挪到明天早上，下午就有缓冲了
```

**用户价值：** agent 不只是"你有冲突了我提醒你"——而是"你的日子还没开始，我已经能告诉你今天的安排哪里有问题"。

### 十、"Agent 眼中的你"实时版

> 2026-06-10 补充。文档中已有的设计是 Settings 里的静态面板——但真正的信任来自于 agent 在每次交互时展示的推理，而不只是一个设置页面。

#### 两种形态

**形态 A · 交互时的推理提示（实时，每次建议附带）：**

不只是"已记住 · 下次优先这类"，而是具体到当前决策：

> "上次你在周五下午火车上和 Alex 的通话都接受了（3/3）→ 推荐这个时段"
> "你最近两次下午的 deep work 都没完成 → 改到早上排"

用户的感受：**agent 不是在"学我的偏好"——它在"理解我的行为模式并调整策略"。** 这个感受差异是信任的分水岭。

**形态 B · 偏好仪表盘（定期查看，Settings 中）：**

即已有设计中的 `Agent 眼中的你` 面板。但补充一点：每条偏好旁边不仅显示"置信度 + 数据来源"，还显示 **"这条偏好最近一次被验证/推翻是什么时候"**：

```
🚂 Fribourg→Zürich 火车：视频可用
   置信度 94% · 7/7 次接受
   最近验证：6月8日（接受了和 Alex 的视频会）
   如果这不对 → [纠正]

⏰ 下午 3 点后不排深度工作
   置信度 82% · 最近 5 次排了 4 次没完成
   最近验证：6月9日（SLTA newsletter 没完成）
   如果这不对 → [纠正]
```

**关键设计原则：** agent 不但要透明它学到了什么，还要透明它**为什么**相信这个——以及**最近一次的证据是什么**。这样用户纠正时也有具体上下文。

### 十一、Time Audit（每周时间审计）

> 2026-06-10 新增。高管对真人助理的真实期望——不只是排时间，而是帮他们省时间。

#### 周报内容

```
本周时间审计 · June 8–14
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 时间分配
  会议     12h  ████████████████  48%  目标 35%  ⚠️ 超标
  深度工作  5h   ██████           20%  目标 35%  ❌ 不足
  通勤     4h   █████            16%
  社交     3h   ███              12%
  缓冲     1h   █                4%

🔍 值得关注的
  • "NEUR.ON Weekly Sync" 平均 42min（写了 30min）→ 建议更新预估
  • 3 场会只有 2 人参加、无议程 → 可能可以用邮件替代
  • 周二那趟 Zürich 往返 2.5h——本周唯一一次通勤没利用（可塞任务/电话）

💡 下周建议
  • 把 2 场非核心周会改成异步更新
  • 保护周三和周五早上为深度工作时间
  • 尝试把 Zürich 的会合并到同一天
```

#### 技术路径

- 阶段 1（纯前端）：基于 `eventsDB` + `completionDB` + `interactionLog` 统计 → 文本模板生成
- 阶段 2（后端）：接入真实日历数据 → LLM 生成洞察 → 更精准
- 阶段 3（主动推送）：每周日晚自动推送周报 → 用户周一早上看到

### 十二、外部邀请自动协商（未来的"日历之上智能层"最强体现）

> 2026-06-10 新增。目前 Coordinate 页是 mock——用户手动发起协商。但真正的 agent 应该在外部有人发来日历邀请时就介入。

#### 流程

```
外部人通过 Outlook 发来会议邀请
        │
        ▼
Google/Outlook API 同步到本平台
        │
        ▼
Agent Loop 检测到新事件（来源=外部，状态=待确认）
        │
        ▼
Agent 分析：
  • 时段合适吗？（检查冲突 + buffer + 通勤）
  • 和现有偏好匹配吗？（"周五下午不排会"）
  • 历史上这类邀请接受率如何？
        │
        ▼
结果：
  ✅ 无冲突 → 通知用户确认 → 一键接受（写回 Outlook）
  ⚠️ 有冲突 → 生成 2-3 个反建议时段 → 询问用户 → Agent 自动回复对方
  ❌ 严重冲突或不符合偏好 → 标红提醒 → 用户决策
```

**关键：用户继续用 Outlook/Google Calendar 收发邀请。Agent 在背后做决策准备——这是"日历之上的智能层"定位的最强体现。**

### 十三、Meet · 如何"加好友（的 agent）"（未来设计，尚未实现）

> 2026-06-10 记录。目前 Meet 页的 Calendar Friends 是写死的三个人（Lukas / Marie / Thomas），备注可编辑并持久化，但还不能真正"添加"一个新好友。这里先把加好友的设计想清楚，留作后续实现。

#### 本质：加的不是"联系人"，是"对方的调度 agent"

普通日历加联系人 = 存一个邮箱。我们要做的是**建立两个 agent 之间的连接**：连接成功后，双方 agent 能交换"空闲/忙碌 + 偏好约束"，从而自动算出共同可行时段，人只需最后确认。所以"加好友"的产物是一条 **agent-to-agent 信任通道**，而不只是一行通讯录。

#### 三种加好友路径（按落地难度排序）

1. **邀请链接（最先做，单边即可用）**
   - 用户点"Add friend"→ 生成一条带 token 的链接，通过任意渠道发给对方。
   - 对方打开 → 若已是本产品用户，直接建立双向连接；若不是，进入一个轻量页面授权"只共享 free/busy"（无需注册即可参与一次协商，类似现在的 Temporary link，但可升级为长期好友）。
   - 数据：本地存 `friends[]`，每条含 `{id, name, note, connectionType:'link', shareScope:'freebusy', status:'pending|active'}`。

2. **双方都是用户（最顺滑）**
   - 通过邮箱/用户名搜索 → 发送好友请求 → 对方在自己的 app 里 accept。
   - 建立后默认 `shareScope:'freebusy'`，可手动升级为共享更多（如事件标题、偏好）。

3. **从外部日历自动浮现（最智能，依赖阶段 2 接入真实日历）**
   - 当 Google/Outlook 同步进来的事件里反复出现某个参会人，Agent Loop 产出一个 Move："你和 Anna 这个月一起开了 4 次会，要把她加为 Calendar Friend 吗？" → 一键加好友。

#### 权限与隐私分层（共享范围 shareScope）

- `freebusy`：只知道对方哪些时段忙，不知道在干嘛（默认，最小授权）。
- `titles`：可看事件标题（更易协商，但更敏感）。
- `prefs`：可看对方调度偏好约束（如"周五不排会"），让 agent 协商更聪明。
- 每个好友独立设置；任何时候可降级/解除连接。

#### 加好友后，协商如何变"真"

当前 `showCoord` 用的是写死的 `coordSuggestions`。加好友连接建立后应替换为：
1. 双方 agent 各自算出未来 N 天的 free windows（复用 `getFreeWindowsForDate`）。
2. 求交集 → 套用各自偏好约束过滤 → 各自的通勤/buffer 校验（复用 `detectSlotConflict`）。
3. 按质量排序产出 3 个共同时段 → 双方人确认 → 写回各自日历。
4. 涉及"代发消息给对方"时，遵循既定原则：**agent 生成草稿，人授权才发**（也可由用户预先授权给 agent 自动确认）。

#### MVP 落地建议

先做路径 1（邀请链接）的**前端骨架 + 本地 friends 持久化**：让"Add friend"按钮、好友列表的增删、备注、shareScope 选择都可用（mock 连接状态）。真正的 agent-to-agent 通道等阶段 2 接了后端再补。这样 Meet 页从"写死三个人"先进化到"可管理的好友列表"，体验闭环，后端随后接入。

---

## 代码审查：学习数据架构的 11 个债务（2026-06-10）

> Claude Code 审查 `index.html`（~7236 行）的 learning infrastructure，对照 BRAINSTORM.md 和 learning agent.md 的设计。以下按严重程度排列。

### 进度更新（2026-06-10）

- ✅ 已先修正学习路径质量：Desk Plan / Agent Loop 接受路径写入 normalized `interactionLog`；`prefScore` source fallback 统一为 `pendingTask`；Desk-planned / agent-loop event 保留 `sourceTaskId`、`kind`、analytics `type`。
- ✅ 已完成 Phase C 第一刀：`supabase-schema.sql` 创建 `interaction_log` / `pref_store` / `duration_observations` 三张学习表（RLS 开启），前端在保留 `app_state` blob 兼容快照的同时 best-effort 双写三张表。
- ✅ 线上验证：用户在 `calendar.yiwang.dev` 操作后，Supabase 已看到 `pendingTask`、`social` 等 `source/kind` 行，说明新产生的学习信号已进入规范化表。
- ✅ 已完成真实趋势分析：Analytics 用 `interaction_log` / `duration_observations` 算本周 vs 上周、接受率变化、top kind/source。
- ✅ 已完成历史回填：登录拉取 blob 后，`buildBackfillRows` 把旧 `app_state.data.learning`（interactionLog / prefStore / durationStore）一次性写入三张规范化表。`pref_store` 用 upsert 天然幂等；append-only 表靠 blob 内 `learningBackfilledAt` 标记只回填一次。`durationStore` 只存聚合，按 `count` 展开成均值行以保证趋势不失真。
- ⏭️ 下一步：events / tasks / profile 的规范化（Phase C 剩余表），以及 Overdue Follow-up Detector。

### 🔴 CRITICAL

#### 债务 1：Supabase 单 JSON Blob 是学习数据的错误存储模型

**位置**：`supabase-schema.sql` + `snapshotCloud()` (line 4886) + `cloudLoad()` (line 4842)

**现状**：`app_state` 表只有 `(user_id uuid, data jsonb)`。所有数据——eventsDB、pendingTasksDB、completionDB、prefStore、durationStore、interactionLog——打包成**一个 JSON blob**。

**为什么这是问题**：

| 数据 | 写入频率 | 增长趋势 |
|------|:--:|------|
| `interactionLog` | 每次 agent 交互 | 持续 append-only，无限增长 |
| `prefStore` | 每次接受/拒绝 | 频繁增量更新 |
| `eventsDB` | 每次新建/编辑/删除事件 | 线性增长 |
| `durationStore` | 每次事件完成/编辑时长 | 缓慢增长 |

- 一次偏好微调（`alpha += 1`）→ 整个 JSON（含全部历史 interactionLog）重新 upsert
- 1000 条交互后，每次 `cloudSave()` 写 500KB+ 的无意义开销
- **无法跨用户查询**：Stage A 的特征向量全锁在每用户一个 JSON 里 → 做不了"跨用户池化训练" → 文档里写的 ML 护城河无法兑现

**代码已自知**（line 4885 注释）：`schemaVersion: 2 // lets us migrate safely when we normalise into per-entity tables (Phase C)`

**结论**：**Phase C 不该被推迟。** 现在数据少，拆表成本最低。等 interactionLog 攒了几个月再迁移，成本翻倍，而且可能因为怕风险而永远不敢动。

**建议的 Phase C 表结构**：

```sql
-- 学习偏好（频繁读写，小而独立）
create table pref_store (
  user_id uuid references auth.users(id) on delete cascade,
  dimension text not null,
  key text not null,
  alpha int default 1, beta int default 1,
  confidence real default 0.5,
  sample_count int default 0,
  last_updated timestamptz,
  primary key (user_id, dimension, key)
);

-- 交互日志（append-only，海量）
create table interaction_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  action text not null,          -- 'accepted' | 'dismissed' | 'sent' | 'drafted' | 'conflict_override'
  context jsonb,                 -- {windowId, route, mode, minutes, ...}
  top3 jsonb,                    -- [{id, kind, source, involves}]
  chosen_idx int,
  candidate_id text,
  kind text, source text, involves text,
  features jsonb,                -- buildFeatureVector() 的完整输出
  label int                      -- 1=accepted, 0=dismissed, null=undetermined
);
create index idx_il_user_ts on interaction_log(user_id, ts desc);

-- 时长观测（running average 的原始数据）
create table duration_observations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  kind text, person text,
  observed_minutes int not null,
  ts timestamptz not null default now()
);
```

**迁移策略**：`cloudLoad` 检测 `schemaVersion < 3` → 从 JSON blob 拆出 `interactionLog` 的每条记录 → insert 到新表 → 更新 `schemaVersion` → 后续只写新表。旧 `data.jsonb` 保留 `eventsDB` 等仍为 JSON（那些是文档型数据，JSON 合适）。

---

#### 债务 2：Desk Plan 确认路径完全不记录学习信号

**位置**：`confirmDeskPlanWindow()` (line 5953) + `quickPlanToWindow()` (line 4120)

**现状**：用户在 Time Planning Board 点击 Confirm 安排任务 → `confirmDeskPlanWindow()` 创建事件、更新 `todayFreeSlots`——**但整个函数里没有一行 `interactionLog.push()`，没有调用 `buildFeatureVector()`。**

**对比**：`recordCommuteInteraction()` (line 5434) 有完整的 `features` + `label` + `top3`。

**影响**：Desk plan 是用户接受 agent 建议的**主路径之一**。这条路径完全哑火 → agent 学不到用户接受了什么、拒绝了什么 → Stage A 训练数据缺失了最大的一块。

---

#### 债务 3：Agent Loop 的 `scheduleTaskToSlot` 同样静默

**位置**：`scheduleTaskToSlot()` (line 4622)

**现状**：Agent Loop 发现 deadline-risk → 用户点 action → `runMoveAction()` → `scheduleTaskToSlot()`。函数内只调了 `recordSignal`，**没有 `interactionLog.push()`，没有 `buildFeatureVector()`。**

**影响**：Deadline-risk 移动的接受/拒绝信号完全丢失。Agent Loop 是产品的"主动智能"核心——但它产出的用户决策全都没被记录。

---

#### 债务 4：`prefScore` 有 key mismatch bug

**位置**：`prefScore()` (line 5024) vs `recordCommuteInteraction()` (line 5468)

```javascript
// 读：prefScore (line 5027)
const sourcePref = betaConfidence(
  getPreference('candidate_source', candidate.source || 'task')
  //                                                      ^^^^
);

// 写：recordCommuteInteraction (line 5468)
recordSignal('candidate_source', candidate.source || 'pendingTask', true);
//                                                      ^^^^^^^^^^^
```

当 `candidate.source` 为 null/undefined 时：读到 key `'candidate_source::task'`，写入 key `'candidate_source::pendingTask'` → **两个不同的 key → sourcePref 恒为 0.5 → source 偏好完全无效。**

**修复**：统一 fallback 值。一行代码。

---

### 🟠 IMPORTANT

#### 债务 5：Beta 偏好学习仍然是"裸"的

**位置**：`recordSignal()` (line 5013) + `learning agent.md` 第三章

**现状**：`recordSignal` 就是 `alpha += 1` / `beta += 1`。`learning agent.md` 里设计的 6 个增强机制一个都没实现：

| 机制 | 文档 | 代码 | 不做会怎样 |
|------|:--:|:--:|------|
| 时间衰减 | ✅ | ❌ | 去年的偏好和昨天的偏好权重一样 → agent 不会适应变化 |
| 延迟奖励 | ✅ | ❌ | 用户接受了但后来取消了 → agent 仍然当正反馈 |
| 信号分层 | ✅ | ❌ | "无视"和"拒绝"被同等对待 → agent 过度学习噪音 |
| Thompson Sampling | ✅ | ❌ | 从不探索 → 过早收敛到局部最优 |
| 安全信封 | ✅ | ❌ | Tier 2 自动建规则可能覆盖不变量 |
| 冷启动人群先验 | ✅ | ❌ | 新用户 agent 完全"瞎"→ 前几周体验差 |

**当前权重的实际影响**：1 次接受（alpha=2/beta=1/conf=0.67）vs 10 次接受（alpha=11/beta=1/conf=0.92），在 `prefScore` 里的差异仅 `(0.67-0.5)*20=3.4` vs `(0.92-0.5)*20=8.4`。这点差异在 `scoreCandidate` 总分（importance*18 + urgency*14 + ...）里几乎感觉不到 → agent 表面在"学"，实际决策仍由硬编码规则主导。

---

#### 债务 6：`confirmDeskPlanWindow` 不设 `sourceTaskId`

**位置**：`confirmDeskPlanWindow()` (line 5962) vs `scheduleTaskToSlot()` (line 4634)

**现状**：`scheduleTaskToSlot` 设了 `sourceTaskId: source + ':' + id`，Agent Loop 通过 `eventScheduledForTask()` 查这个字段来判断任务是否已排。但 `confirmDeskPlanWindow` **没有设这个字段**。

**影响**：通过 desk plan 安排的任务 → `eventScheduledForTask()` 返回 false → Agent Loop 再次为同一个任务生成 deadline-risk move → **用户看到重复建议**。

---

#### 债务 7：interactionLog schema 不统一

**位置**：`recordCommuteInteraction()` (line 5436) vs `recordConflictOverride()` (line 4381)

| 路径 | schema |
|------|------|
| Commute 交互 | `{ts, action, context, top3, chosenIdx, candidateId, kind, source, involves, draftGenerated, draftSent, features, label}` |
| 冲突覆盖 | `{type: 'conflict_override', kind, mode, at}` ← 完全不同 |
| Desk plan | **不记录** |
| scheduleTaskToSlot | **不记录** |

**影响**：未来做 ML 训练时，需要写特殊 case 解析不同格式。应该统一为一种 `interaction_log` 行结构（见债务 1 的表设计）。

---

### 🟡 NICE TO HAVE

#### 债务 8：13 种 Move 类型只有 1 种实现了

**位置**：`MOVE_DETECTORS` (line 4490)

```javascript
const MOVE_DETECTORS = [detectDeadlineRisk];
```

架构扩展性很好——往数组里 push 一个纯函数就加能力。但目前只有 deadline-risk 一个探测器。没有 Energy Guard / Context Switch Cost / Travel Optimize / Pre-mortem / Cleanup / Rebalance / Prep / Follow-up——产品离"主动 agent"还差 12 个探测器。

---

#### 债务 9：`getPlanWindows` 仍然只看今天

**位置**：`getPlanWindows()` (line 5644)

Agent Loop 的 `proposeSlotsForTask()` 已经能跨天扫描了，但 Time Planning Board 的 `getPlanWindows()` 还是钉死 `todayMonthKey()` + `getTodayDate()`。用户手动规划时看不到明天后天的空闲窗口。

---

#### 债务 10：没有 schema 迁移函数

**位置**：`snapshotCloud()` (line 4886) + `cloudLoad()` (line 4842)

`schemaVersion: 2` 标记了但 `cloudLoad` 里没有任何 `if (remote.schemaVersion < 2) { migrateFrom(remote); }` 的逻辑。Phase C 改表结构时，老用户数据加载会静默失败或行为异常。

---

#### 债务 11：`scheduleTaskToSlot` 硬编码 event type

**位置**：`scheduleTaskToSlot()` (line 4635-4636)

```javascript
t: isOnline ? 'online' : 'deep',
type: isOnline ? 'online' : 'deep',
```

非 call/video 一律 `type: 'deep'`。但如果 kind 是 'social'、'think'、或自定义类型，`type` 丢失了原始信息。`kind` 字段保留但 `type` 不准确——未来 Analytics 按 type 统计会出错。

---

### 修复优先级矩阵

| 排序 | 债务 | 估计工作量 | 不修的后果 |
|:--:|------|:--:|------|
| **1** | #2 Desk Plan 路径补 interactionLog | 30min | Stage A 数据继续缺失主路径 |
| **2** | #4 prefScore key mismatch | 5min | source 偏好完全无效 |
| **3** | #6 confirmDeskPlanWindow 补 sourceTaskId | 10min | 用户看到重复 deadline-risk 建议 |
| **4** | #3 scheduleTaskToSlot 补 interactionLog | 20min | Agent Loop 交互信号丢失 |
| **5** | #1 Supabase 拆表 | 2-3h | 数据越多迁移越痛；跨用户 ML 无法做 |
| **6** | #7 统一 interactionLog schema | 30min | 不同路径的日志无法统一查询 |
| **7** | #5 Beta 增强（至少加时间衰减） | 1-2h | agent 学习效果被硬编码规则淹没 |
| **8** | #10 迁移函数 | 30min | 未来改 schema 时老数据断裂 |
| **9** | #8 加 2-3 个基础 detector | 2-3h | 产品不够"主动" |
| **10** | #9 getPlanWindows 泛化到任意日 | 1h | 手动规划只能看今天 |
| **11** | #11 event type 保留原始 kind | 10min | Analytics 统计不准确 |
