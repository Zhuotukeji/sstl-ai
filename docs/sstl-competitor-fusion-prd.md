# SSTL 搜索套利投放中台竞品融合 PRD

## 1. 目标

将 SSTL 从“内部投放管理与报表系统”升级为“搜索套利投放操作系统”，把投放创建、流量分发、收益回传、ROI 分析、自动化调控、合规风控串成闭环。

本 PRD 基于三套系统的只读分析：

- SSTL：已有媒体账号配置、TikTok 批量建计划、素材库、文章/样式/域名/代理配置、关键词/Campaign/Adset/素材报表、自动关停规则。
- AdRate：TikTok 广告自动化强，突出批量创建、跨账号复制、规则引擎、素材 AI、团队权限。
- RSOC：搜索套利分发闭环强，突出内部 Campaign、Offer 权重、重定向日志、兜底页、增强展示、TONIC 合规、收益指标。

## 2. 成功标准

- 投放人员可以在 SSTL 内完成广告账户接入、素材管理、批量建计划、投放链接生成、Offer 分发、收益回传、ROI 分析、自动化调控。
- 管理者可以按优化师、关键词、素材、Campaign、Offer、域名查看成本、收益、利润、ROI、风险。
- 系统可以自动发现亏损、无转化、高 CPA、低 ROI、合规异常，并支持提醒、暂停、调预算、调出价、切兜底等动作。

## 3. 竞品能力吸收

### 3.1 吸收 AdRate 的能力

- TikTok 授权、广告账户绑定、账户分配。
- Campaign/Adgroup/Ad 批量创建与跨账号复制。
- 自动化规则指标扩展：spend、CPA、CPC、CPM、CTR、conversion、video views、budget remaining、投放时长、名称匹配。
- 自动化动作扩展：启停、删除、预算增减、出价增减、转化出价增减。
- 素材 AI 分析、AI score、批量推送到广告账户。
- 团队权限、成员分配、审计日志。

### 3.2 吸收 RSOC 的能力

- 内部 Campaign 分发模型：`/r/{campaign_id}` 投放链接。
- Offer 管理：平台、落地页、外部 campaign id、Pixel 注入、标签、状态。
- Offer 权重分发、兜底页、反跟踪参数校验、增强展示。
- 重定向日志：normal、fallback、blocked、enhanced。
- 收益闭环指标：revenue、profit、ROI、profit_rate、RPM、RPA、critical CPA。
- TONIC 合规报告与广告状态联动。
- 自动化计划、执行日志、dry-run 预览。

## 4. 差距与优先级

| 方向 | SSTL 现状 | 竞品强项 | 优先级 |
| --- | --- | --- | --- |
| 流量分发 | 有域名/文章/样式，缺内部 Campaign 分发对象 | RSOC Campaign -> Offer -> Redirect | P0 |
| 收益闭环 | 有 ROI 报表，但自动化偏广告侧 | RSOC 以利润/临界 CPA 驱动运营 | P0 |
| 自动化 | 自动关停指标少，动作少 | AdRate/RSOC 规则细、日志完整 | P0 |
| 跳转日志 | 缺 visitor/hit 级诊断 | RSOC 重定向日志完整 | P0 |
| 跨账号复制 | 有批量创建/复制基础 | AdRate 复制流程完整 | P1 |
| 素材 AI | 有素材报表，无 AI 闭环 | AdRate/RSOC AI 分析 | P1 |
| 合规风控 | 缺 TONIC 闭环 | RSOC 合规联动 | P1 |
| 团队运营 | 有用户角色 | AdRate 团队/审计更细 | P2 |

## 5. 版本规划

### V1：搜索套利闭环基础版

目标：补齐内部 Campaign、Offer、重定向日志、收益指标。

功能：

- Offer 管理：Offer 名称、平台、落地页 URL、外部 Campaign ID、Pixel 注入、Pixel 参数名、业务标签、状态、备注。
- 内部 Campaign 管理：Campaign ID、名称、投放域名、业务标签、目标国家、校验参数、TikTok macro 参数、兜底 URL、状态。
- 投放链接生成：`https://{domain}/r/{campaign_id}`。
- Campaign 绑定多个 Offer，并配置权重。
- 重定向日志记录每次访问、命中 Offer、异常原因。
- Campaign/关键词/素材报表统一增加收益、利润、利润率、RPM、RPA、critical CPA。
- 基础风控：校验 `ttclid`、`campaign_id`、`ad_id` 等必需参数；异常访问进入 fallback 或 blocked。

验收：

- 创建内部 Campaign 后生成可复制投放链接。
- 一个 Campaign 可绑定多个 Offer，权重分发有效。
- 每次跳转均可在日志中查询。
- Campaign 报表能看到 spend、revenue、profit、ROI。

### V2：自动化运营增强版

目标：把现有自动关停升级为通用自动化引擎。

功能：

- 自动化计划：广告账户、Campaign、Adset、内部 Campaign、业务标签维度。
- 触发方式：固定时间、间隔执行、数据同步后执行。
- 条件指标：广告侧、收益侧、素材侧、文本匹配。
- 动作：通知、广告启停/预算/出价、Offer 降权/暂停、Campaign 切兜底、启用增强展示。
- dry-run 预览和执行日志。

验收：

- 支持“花费 > X 且 ROI < Y，暂停 Campaign 并通知”。
- 支持“ROI 连续 2 天 > Y，预算增加 30%，每日最多 2 次”。
- 所有自动动作可追溯。

### V3：TikTok 创建/复制升级

目标：强化批量创建和跨账号复制体验。

功能：

- Campaign/Adgroup/Ad 三层预览。
- 目标账号覆盖 Pixel、事件、落地页、预算、出价、排期。
- 复制 Campaign 到多个目标账号。
- 复制广告组、广告、素材、CTA、Spark Ads 身份、落地页、Pixel。
- 任务中心展示进度、成功数、失败数、失败原因、重试。

### V4：素材 AI 与创意运营

目标：结合素材库和素材 ROI 报表形成素材运营闭环。

功能：

- AI 识别素材类型、语言、场景、人物、卖点、风险点。
- 输出 AI score、建议用途、适配国家、适配关键词、合规风险。
- 素材维度展示 spend、revenue、profit、ROI、CPA、CTR、播放率。
- 批量打标签、推送广告账户、归档。
- AI token 与成本统计。

### V5：合规与外部平台集成

目标：接入 TONIC 并抽象外部平台能力。

功能：

- 服务凭证管理：TONIC、System1、其他上游平台。
- TONIC 合规报告：allowed、declined、last_update。
- 合规 declined 时自动暂停广告、暂停 Offer、切兜底。
- 合规恢复时预览恢复动作，人工确认后恢复。

## 6. 信息架构

- 控制台
- 投放运营
  - TikTok 授权
  - 广告账户
  - Campaign 管理
  - Adset 管理
  - 批量建计划
  - 跨账号复制
  - 任务中心
- 流量分发
  - 内部 Campaign
  - Offer 管理
  - Pixel 管理
  - 域名管理
  - 兜底页
  - 增强展示模板
  - 重定向日志
- 数据洞察
  - 业务总览
  - 关键词分析
  - Campaign 报表
  - Adset 报表
  - 素材报表
  - 优化师报表
  - 域名报表
- 自动化
  - 自动化计划
  - 规则模板
  - 执行日志
  - Dry-run 预览
- 素材中心
  - 素材库
  - 素材 AI 分析
  - 素材推送
  - 素材权限
- 外部平台
  - 收益平台凭证
  - TONIC 合规
  - 汇率管理
- 系统管理
  - 用户
  - 角色权限
  - 团队/组织
  - 操作审计

## 7. 安全与权限

- 所有广告启停、调预算、调出价、合规联动动作必须记录操作日志。
- 自动化动作默认先 dry-run，再开启真实执行。
- 服务凭证加密存储，前端只显示脱敏字段。
- 普通优化师只能管理自己账号和规则，管理员可管理全局。
- 批量暂停、批量调预算、跨账号复制等高风险动作必须二次确认。

## 8. 非目标

- V1 不重构现有报表，只新增分发模块和统一收益指标。
- V1 不做 SaaS 订阅商业化。
- V1 不直接替换现有自动关停，先并行引入自动化计划与 dry-run。
