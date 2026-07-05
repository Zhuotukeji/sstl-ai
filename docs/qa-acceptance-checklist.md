# QA 验收清单

## V1：内部 Campaign + Offer 分发

- [ ] 管理员可以创建 Offer。
- [ ] Offer 必填字段校验生效：名称、落地页 URL。
- [ ] `inject_pixel=true` 时，Pixel 参数配置校验生效。
- [ ] 管理员可以创建内部 Campaign。
- [ ] 未填写 campaign_id 时系统自动生成唯一值。
- [ ] Campaign 投放链接格式正确：`https://{domain}/r/{campaign_id}`。
- [ ] Campaign 可绑定多个 Offer。
- [ ] Offer 权重必须为正整数。
- [ ] 同一 Campaign 不能重复绑定同一 Offer。
- [ ] Campaign 无可用 Offer 时跳兜底并记录日志。
- [ ] Campaign 停用时跳兜底或 blocked，并记录日志。
- [ ] 缺少 `ttclid`、`campaign_id`、`ad_id` 等必需参数时记录异常原因。
- [ ] 重定向日志包含 hit id、visitor id、Campaign、Offer、国家、referer、origin、类型、原因、时间。
- [ ] 日志可以按 Campaign、Offer、国家、类型、日期筛选。
- [ ] 统计接口返回 total、normal、fallback、blocked、enhanced 数量。
- [ ] Campaign 报表显示 spend、revenue、profit、ROI、profit_rate、RPM、RPA、critical CPA。
- [ ] 所有 Offer/Campaign/权重写操作记录审计日志。

## V2：自动化 dry-run 与执行日志

- [ ] 可创建自动化计划。
- [ ] 可创建自动化规则。
- [ ] 支持按 Campaign、Adset、广告账户、内部 Campaign、业务标签选择目标。
- [ ] 支持广告侧指标条件。
- [ ] 支持收益侧指标条件。
- [ ] 支持素材侧指标条件。
- [ ] 支持文本包含/不包含条件。
- [ ] Dry-run 展示命中对象、条件、拟执行动作。
- [ ] Dry-run 不改变广告状态、预算、出价、Offer 状态。
- [ ] 执行日志记录成功、跳过、失败和失败原因。

## V3：批量创建与复制

- [ ] 批量创建前可预览 Campaign/Adgroup/Ad 三层结构。
- [ ] 每个目标账号可覆盖 Pixel、事件、落地页、预算、出价、排期。
- [ ] 创建失败时可自动清理半成品。
- [ ] 跨账号复制支持多个目标账号。
- [ ] 复制任务展示 pending、running、completed、partial_failed、failed。
- [ ] 失败项可重试，可导出明细。

## V4：素材 AI

- [ ] 素材详情展示 AI score。
- [ ] 素材详情展示语言、场景、卖点、风险点、建议。
- [ ] 素材可按 AI score、语言、风险标签筛选。
- [ ] 素材报表展示 spend、revenue、profit、ROI、CPA、CTR、播放率。
- [ ] 可筛选高消耗低 ROI 素材。
- [ ] 可批量归档或打标签。
- [ ] AI token 和估算成本记录正确。

## V5：合规与外部平台

- [ ] 可创建 TONIC 凭证，前端脱敏展示。
- [ ] 可测试凭证连接。
- [ ] 可拉取 TONIC 合规报告。
- [ ] Campaign/Offer 可看到 allowed/declined 状态。
- [ ] declined 可触发自动化 dry-run。
- [ ] 合规联动动作可追溯。
