# SSTL 竞品融合实施 Backlog

## P0 / V1

### Backend

- 新增数据库表：见 `docs/v1-schema.sql`。
- 新增 Offer CRUD：
  - `GET /sstl/offers`
  - `POST /sstl/offers`
  - `GET /sstl/offers/{id}`
  - `PUT /sstl/offers/{id}`
  - `PATCH /sstl/offers/{id}/status`
- 新增 Internal Campaign CRUD：
  - `GET /sstl/internal-campaigns`
  - `POST /sstl/internal-campaigns`
  - `GET /sstl/internal-campaigns/{id}`
  - `PUT /sstl/internal-campaigns/{id}`
- 新增 Campaign Offer 权重配置：
  - `GET /sstl/internal-campaigns/{id}/offers`
  - `PUT /sstl/internal-campaigns/{id}/offers`
- 新增公开跳转入口：
  - `GET /r/{campaign_id}`
- 新增 Redirect Log：
  - `GET /sstl/redirect-logs`
  - `GET /sstl/redirect-logs/stats`
- 报表统一指标：
  - 在 Campaign 报表聚合层增加 `revenue`、`profit`、`roi`、`profit_rate`、`rpm`、`rpa`、`critical_cpa`。
- 审计日志：
  - Offer、Campaign、权重配置、状态修改均写操作日志。

### Frontend

- 新增主导航：流量分发。
- 新增页面：Offer 管理。
- 新增页面：内部 Campaign 管理。
- 新增弹窗/抽屉：Campaign 权重配置。
- 新增页面：重定向日志。
- Campaign 报表增加收益闭环字段。
- 高风险操作二次确认：停用 Campaign、停用 Offer、替换权重配置。

### Acceptance

- 内部 Campaign 可生成投放链接。
- Offer 权重分发生效。
- 缺少必需参数时进入 fallback 或 blocked。
- 重定向日志可筛选、可统计。
- Campaign 报表能显示 profit 和 ROI。

## P0 / V2

### Backend

- 新增自动化计划、规则、执行日志表。
- 自动化 dry-run：
  - 输入 plan/rule/target。
  - 输出命中对象、命中条件、拟执行动作。
  - 不改变广告或分发状态。
- 条件指标扩展：
  - 广告侧：spend、cash_spend、CPA、CPC、CPM、CTR、clicks、impressions、conversions、budget、bid。
  - 收益侧：revenue、profit、ROI、profit_rate、RPM、RPA、critical CPA。
- 动作扩展：
  - 通知、暂停广告、调预算、调出价、Offer 暂停、Campaign 切兜底。

### Frontend

- 自动化计划列表。
- 自动化规则编辑器。
- Dry-run 预览页。
- 执行日志页。

## P1 / V3

- 批量创建三层预览。
- 跨账号 Campaign 复制。
- 复制任务中心。
- 失败重试和失败明细导出。
- 账号绑定优化师、标签、规则、素材权限。

## P1 / V4

- 素材 AI 分析服务。
- 素材 AI 分析结果页。
- 素材表现归因增强。
- 批量打标签、推送、归档。
- AI 成本统计。

## P1 / V5

- 服务凭证管理。
- TONIC 合规报告。
- 合规 declined 自动化动作。
- 合规恢复预览。
- 合规操作日志。

## 工程接入说明

当前工作区没有 SSTL 前后端源码，只有线上系统抓取产物。因此本 Backlog 固化接口、表结构、页面和验收标准；接入真实源码后，应按现有技术栈映射到实际 controller/service/mapper/router/component 目录。
