# SSTL 自我复盘迭代型 AI 中台

这是基于 SSTL 搜索套利投放中台搭建的独立 AI 中台 MVP。系统定位不是单纯聊天机器人，而是连接知识库、Skill Registry、AI Router、Context Builder、SSTL 实时只读数据、Dry-run 和复盘反馈的智能运营层。

## 当前交付内容

- `apps/api`：TypeScript Fastify API，提供知识库、Skill、AI 分析、Dry-run、审计、成本、模型配置和 SSTL 只读数据访问。
- `apps/web`：React/Vite 管理台，覆盖 AI 控制台、SSTL 实时数据、对话助手、数据分析、智能投放、素材制作、Skill、知识库、复盘、模型配置等页面。
- `packages/shared`：前后端共享类型。
- `apps/api/migrations`：AI 中台自有数据表初始化 SQL。
- `demo`：无需后端的 H5 原型，适合产品/设计评审。
- `docs`：PRD、技术设计、OpenAPI、schema 和验收清单。
- `tools/scan-secrets.mjs`：提交前敏感信息扫描。

## 本地启动

```bash
npm install
npm run build
npm run dev
```

默认地址：

```text
API: http://localhost:8787
Web: http://localhost:5173
```

如本地 `5173` 被占用，可以单独启动 Web：

```bash
npm run dev --workspace @sstl-ai/web -- --port 5178 --host 0.0.0.0
```

## SSTL 数据接入

系统支持两种 SSTL 只读数据源。

### HTTP 只读接入

适合没有生产库账号、但可以通过 SSTL Web 登录读取数据的场景。系统会登录 SSTL 获取 token，只调用白名单读取接口，不调用暂停、调预算、调出价、删除、同步、上传等写接口。

```text
SSTL_BASE_URL=https://sstl.sonicmobi.com
SSTL_USERNAME=
SSTL_PASSWORD=
SSTL_HTTP_PAGE_SIZE=100
SSTL_HTTP_MAX_PAGES=10
```

验证接口：

```text
GET /api/sstl/readonly/status
GET /api/sstl/live/snapshot
```

### MySQL 只读接入

适合后续生产部署。请使用只读账号，并建议在 SSTL 侧准备稳定视图：

- `sstl_ai_campaign_metrics`
- `sstl_ai_adset_metrics`
- `sstl_ai_keyword_metrics`
- `sstl_ai_material_metrics`
- `sstl_ai_offer_metrics`

```text
SSTL_DB_HOST=
SSTL_DB_PORT=3306
SSTL_DB_USER=
SSTL_DB_PASSWORD=
SSTL_DB_NAME=
SSTL_DB_SSL=false
```

## AI 模型配置

默认模型为 `gpt-5.5`，支持 OpenAI-compatible Chat Completions 接口。启动时可用环境变量提供默认值，后台“模型与成本”页面可覆盖配置。

```text
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

后台接口：

```text
GET /api/model-config
POST /api/model-config
GET /api/model-usage
GET /api/ai/interactions
```

前端不会回显完整 API Key，只显示脱敏后的 `apiKeyMasked`。后台保存配置时会使用 `DATA_ENCRYPTION_KEY` 加密 Key，模型调用时仅在服务端解密使用。未配置 Key 时，API 使用 deterministic fallback，方便离线验收。

每次 AI 分析会记录模型、输入 token、输出 token、估算成本、调用人和调用时间。每次 AI 交互会额外记录用户、角色、问题、响应摘要、Skill、Router 意图、数据源、知识引用、scope、模型状态和 `interactionId`，用于后续按投手/负责人/管理员追踪 AI 使用与复盘。

## 安全边界

- AI 只能读取脱敏后的只读投放数据。
- AI 可以生成分析结论、建议动作、素材 Brief 和 Dry-run。
- AI 不直接暂停广告、不调预算、不调出价、不修改 Offer 权重。
- 高风险动作必须人工确认，并写入审计日志。
- Prompt、审计、知识库、向量索引不得保存凭证、token、cookie、完整连接串或 Pixel secret。
- SSTL 账号密码和模型 Key 只能通过环境变量或后台配置提供，不写入仓库。

## 检查命令

```bash
npm run typecheck
npm run build
npm run check:demo
npm run scan:secrets
```

一键验证：

```bash
npm run validate
```

## 静态 H5 原型

投放中台 Demo：

```text
demo/index.html
```

AI 中台 Demo：

```text
demo/ai-platform.html
```
