# SSTL 自我复盘迭代型 AI 中台

这是基于 SSTL 搜索套利投放中台规划的独立 AI 中台 MVP。它不是单纯聊天机器人，而是一个连接知识库、Skill Registry、AI Router、Context Builder、只读投放数据、Dry-run 和复盘反馈的智能运营层。

## 当前交付内容

- `apps/api`：TypeScript Fastify API，提供知识库、Skill、AI 分析、Dry-run、审计、成本和 SSTL 只读数据访问。
- `apps/web`：React/Vite 管理台，覆盖 AI 控制台、对话助手、数据分析、智能投放、素材制作、Skill、知识库、复盘、审计等页面。
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

默认 API 地址：

```text
http://localhost:8787
```

默认 Web 地址：

```text
http://localhost:5173
```

如果没有配置 `AI_PLATFORM_DATABASE_URL` 和 `SSTL_DB_*`，系统会使用内置 seed 数据运行，便于本地预览。

## Docker 启动

```bash
cp .env.example .env
docker compose up --build
```

Docker Compose 会启动：

- PostgreSQL：AI 中台自有数据
- Redis：预留任务队列
- API：`http://localhost:8787`
- Web：`http://localhost:5173`

## 生产库只读接入

第一版按只读 MySQL 方式接入 SSTL 生产数据。请使用只读账号，并建议在 SSTL 侧准备稳定视图：

- `sstl_ai_campaign_metrics`
- `sstl_ai_keyword_metrics`
- `sstl_ai_material_metrics`
- `sstl_ai_offer_metrics`

API 代码只允许调用 allowlist repository，不允许 AI 生成任意 SQL 直接执行。

关键环境变量：

```text
SSTL_DB_HOST=
SSTL_DB_PORT=3306
SSTL_DB_USER=
SSTL_DB_PASSWORD=
SSTL_DB_NAME=
SSTL_DB_SSL=false
```

## AI 模型配置

默认支持 OpenAI-compatible Chat Completions 接口。未配置 `OPENAI_API_KEY` 时，API 使用 deterministic fallback 结果，方便离线验收。

```text
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## 安全边界

- AI 可以读取脱敏后的只读投放数据。
- AI 可以生成分析结论、建议动作、素材 Brief 和 Dry-run。
- AI 不直接暂停广告、不调预算、不调出价、不修改 Offer 权重。
- 高风险动作必须人工确认，并写入审计日志。
- Prompt、审计、知识库、向量索引不得保存凭证、token、cookie、完整连接串或 Pixel secret。

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
