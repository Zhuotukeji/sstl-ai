import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AIModelConfig, AISkillDraft, AnalysisScope, UserContext } from "@sstl-ai/shared";
import type { Env } from "./env.js";
import { buildContext } from "./ai/contextBuilder.js";
import { ModelClient } from "./ai/modelClient.js";
import { routeSkill } from "./ai/router.js";
import { decryptSecret, encryptSecret } from "./security/secretBox.js";
import type { SstlReadonlyRepository } from "./sstl/readonlyRepository.js";
import { newId, type AppStore, type StoredAIModelConfig } from "./store/appStore.js";
import { redactValue, summarizeForAudit } from "./security/redact.js";

const scopeSchema = z.object({
  dateRange: z.object({ from: z.string(), to: z.string() }),
  ownerId: z.string().optional(),
  operatorId: z.string().optional(),
  teamId: z.string().optional(),
  businessTag: z.string().optional(),
  campaignId: z.string().optional(),
  offerId: z.string().optional(),
  materialId: z.string().optional()
});

const userSchema = z
  .object({
    id: z.string().default("u-admin"),
    name: z.string().default("Admin"),
    role: z.enum(["operator", "leader", "admin", "material"]).default("admin"),
    teamId: z.string().optional(),
    operatorIds: z.array(z.string()).default(["op-001"])
  })
  .default({ id: "u-admin", name: "Admin", role: "admin", operatorIds: ["op-001"] });

export async function registerRoutes(app: FastifyInstance, deps: { env: Env; store: AppStore; sstl: SstlReadonlyRepository }) {
  const model = new ModelClient(deps.env, deps.store);

  app.get("/health", async () => ({ ok: true, service: "sstl-ai-api", time: new Date().toISOString() }));

  app.get("/api/sstl/readonly/status", async () => deps.sstl.status());

  app.get("/api/sstl/live/snapshot", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const scope: AnalysisScope = { dateRange: { from: today, to: today } };
    return deps.sstl.getLiveSnapshot ? deps.sstl.getLiveSnapshot(scope) : { status: await deps.sstl.status() };
  });

  app.get("/api/model-config", async () => {
    const stored = await deps.store.getModelConfig();
    return publicModelConfig(
      stored ?? {
        id: "default",
        provider: "openai-compatible",
        baseUrl: deps.env.openaiBaseUrl,
        model: deps.env.openaiModel,
        temperature: 0.2,
        hasApiKey: Boolean(deps.env.openaiApiKey),
        apiKey: deps.env.openaiApiKey,
        updatedBy: "env",
        updatedAt: new Date().toISOString()
      }
    );
  });

  app.post("/api/model-config", async (request) => {
    const body = z
      .object({
        baseUrl: z.string().url().default(deps.env.openaiBaseUrl),
        model: z.string().min(1).default("gpt-5.5"),
        temperature: z.number().min(0).max(2).default(0.2),
        apiKey: z.string().optional(),
        updatedBy: z.string().default("u-admin")
      })
      .parse(request.body);
    const existing = await deps.store.getModelConfig();
    const existingApiKey =
      existing?.apiKey ?? decryptSecret(existing?.apiKeyCiphertext, deps.env.dataEncryptionKey) ?? deps.env.openaiApiKey;
    const apiKey = body.apiKey === undefined ? existingApiKey : body.apiKey.trim() || undefined;
    const config = await deps.store.upsertModelConfig({
      id: "default",
      provider: "openai-compatible",
      baseUrl: body.baseUrl,
      model: body.model,
      temperature: body.temperature,
      apiKeyCiphertext: encryptSecret(apiKey, deps.env.dataEncryptionKey),
      hasApiKey: Boolean(apiKey),
      apiKeyMasked: maskApiKey(apiKey),
      updatedBy: body.updatedBy,
      updatedAt: new Date().toISOString()
    });
    await deps.store.appendAudit({
      id: newId("aud"),
      actorId: body.updatedBy,
      actorName: body.updatedBy,
      module: "model-config",
      eventType: "model_config.updated",
      dataSources: [],
      outputSummary: JSON.stringify(publicModelConfig(config)),
      costUsd: 0,
      riskLevel: "medium",
      createdAt: new Date().toISOString()
    });
    return publicModelConfig(config);
  });

  app.get("/api/dashboard", async () => {
    const [improvements, audit, usage] = await Promise.all([
      deps.store.listImprovements(),
      deps.store.listAudit(),
      deps.store.listUsage()
    ]);
    return {
      profitRiskCount: 8,
      lowRoiObjects: 17,
      highSpendNoConversion: 5,
      materialFatigue: 11,
      complianceRisks: 3,
      suggestionAdoptionRate: 0.68,
      knowledgeHitRate: 0.82,
      skillRouteAccuracy: 0.89,
      todayCostUsd: usage.reduce((sum, row) => sum + row.costUsd, 0),
      improvementsOpen: improvements.filter((row) => row.status === "open").length,
      recentAudit: audit.slice(0, 5)
    };
  });

  app.get("/api/knowledge", async () => deps.store.listKnowledge());

  app.post("/api/knowledge", async (request) => {
    const body = z
      .object({
        title: z.string(),
        type: z.enum(["sop", "case", "metric", "policy", "prompt", "qa"]),
        content: z.string(),
        businessTags: z.array(z.string()).default([]),
        platforms: z.array(z.string()).default([]),
        applicableObjects: z.array(z.string()).default([]),
        createdBy: z.string().default("u-admin")
      })
      .parse(request.body);
    return deps.store.upsertKnowledge({
      id: newId("kn"),
      title: body.title,
      type: body.type,
      businessTags: body.businessTags,
      platforms: body.platforms,
      applicableObjects: body.applicableObjects,
      status: "pending_review",
      version: "1.0.0",
      vectorStatus: "not_indexed",
      qualityScore: 70,
      content: body.content,
      createdBy: body.createdBy,
      updatedAt: new Date().toISOString()
    });
  });

  app.post("/api/knowledge/:id/review", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.enum(["approved", "rejected"]) }).parse(request.body);
    const result = await deps.store.reviewKnowledge(params.id, body.status);
    if (!result) return reply.code(404).send({ message: "Knowledge item not found" });
    return result;
  });

  app.get("/api/skills", async () => deps.store.listSkills());
  app.get("/api/skills/drafts", async () => deps.store.listSkillDrafts());

  app.post("/api/skills/drafts/generate", async (request) => {
    const body = z.object({ prompt: z.string(), createdBy: z.string().default("u-admin") }).parse(request.body);
    const draft: AISkillDraft = {
      id: newId("draft"),
      prompt: body.prompt,
      generatedConfig: {
        code: body.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "generated_skill",
        name: `${body.prompt.slice(0, 20)} Skill`,
        description: body.prompt,
        riskLevel: body.prompt.includes("暂停") || body.prompt.toLowerCase().includes("budget") ? "high" : "medium",
        status: "pending_review"
      },
      testCases: [`当用户提出“${body.prompt}”时，必须返回证据、动作建议和风险等级。`],
      createdBy: body.createdBy,
      reviewStatus: "pending_review",
      createdAt: new Date().toISOString()
    };
    return deps.store.upsertSkillDraft(draft);
  });

  app.post("/api/skills/:id/review", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.enum(["approved", "rejected"]) }).parse(request.body);
    const drafts = await deps.store.listSkillDrafts();
    const draft = drafts.find((item) => item.id === params.id);
    if (!draft) return reply.code(404).send({ message: "Skill draft not found" });
    const updatedDraft = await deps.store.upsertSkillDraft({ ...draft, reviewStatus: body.status });
    if (body.status === "approved") {
      await deps.store.upsertSkill({
        id: newId("sk"),
        code: String(draft.generatedConfig.code ?? "generated_skill"),
        name: String(draft.generatedConfig.name ?? "Generated Skill"),
        intent: "generated.custom",
        description: String(draft.generatedConfig.description ?? draft.prompt),
        triggerExamples: [draft.prompt],
        requiredInputs: ["dateRange"],
        dataSources: ["sstl.campaign_metrics"],
        knowledgeTypes: ["sop", "case"],
        toolPermissions: ["sstl:metrics:read", "ai:dry-run:create"],
        riskLevel: draft.generatedConfig.riskLevel ?? "medium",
        status: "approved",
        version: "1.0.0",
        owner: draft.createdBy,
        score: 75,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        updatedAt: new Date().toISOString()
      });
    }
    return updatedDraft;
  });

  app.post("/api/ai/route", async (request) => {
    const startedAt = Date.now();
    const body = z.object({ question: z.string(), user: userSchema }).parse(request.body);
    const user = body.user as UserContext;
    const skills = await deps.store.listSkills();
    const routed = routeSkill(body.question, skills);
    const interaction = await deps.store.appendInteraction({
      id: newId("int"),
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: "ai-route",
      question: safeText(body.question, deps.env.auditRedactionSalt),
      responseSummary: safeText(routed.reason, deps.env.auditRedactionSalt),
      responsePreview: safeJson(
        {
          detectedIntent: routed.detectedIntent,
          selectedSkill: { id: routed.selected.id, code: routed.selected.code, name: routed.selected.name },
          candidateSkills: routed.candidateSkills,
          confidence: routed.confidence
        },
        deps.env.auditRedactionSalt
      ),
      skillId: routed.selected.id,
      skillCode: routed.selected.code,
      routeIntent: routed.detectedIntent,
      routeConfidence: routed.confidence,
      routeReason: safeText(routed.reason, deps.env.auditRedactionSalt),
      dataSources: routed.selected.dataSources,
      knowledgeIds: [],
      model: "router-rule-engine",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      status: "success",
      createdAt: new Date().toISOString()
    });
    return {
      interactionId: interaction.id,
      userQuestion: body.question,
      detectedIntent: routed.detectedIntent,
      selectedSkill: routed.selected,
      candidateSkills: routed.candidateSkills,
      routeConfidence: routed.confidence,
      routeReason: routed.reason
    };
  });

  app.post("/api/ai/analyze", async (request) => {
    const startedAt = Date.now();
    const body = z
      .object({
        question: z.string(),
        scope: scopeSchema,
        user: userSchema
      })
      .parse(request.body);
    const user = body.user as UserContext;
    const scope = body.scope as AnalysisScope;
    const [skills, knowledge] = await Promise.all([deps.store.listSkills(), deps.store.listKnowledge()]);
    const routed = routeSkill(body.question, skills);
    const context = await buildContext({ user, scope, skill: routed.selected, knowledge, sstl: deps.sstl });
    const run = await model.analyzeWithUsage({
      userId: user.id,
      question: body.question,
      skill: routed.selected,
      context
    });
    const result = run.result;
    const interaction = await deps.store.appendInteraction({
      id: newId("int"),
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: "ai-analysis",
      question: safeText(body.question, deps.env.auditRedactionSalt),
      responseSummary: safeText(result.summary, deps.env.auditRedactionSalt),
      responsePreview: safeJson(result, deps.env.auditRedactionSalt, 6000),
      skillId: routed.selected.id,
      skillCode: routed.selected.code,
      routeIntent: routed.detectedIntent,
      routeConfidence: routed.confidence,
      routeReason: safeText(routed.reason, deps.env.auditRedactionSalt),
      dataSources: result.dataSources,
      knowledgeIds: result.knowledgeIds,
      scope: context.scope,
      model: run.usage.model,
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
      totalTokens: run.usage.inputTokens + run.usage.outputTokens,
      costUsd: run.usage.costUsd,
      latencyMs: run.latencyMs || Date.now() - startedAt,
      status: run.status,
      usageId: run.usage.id,
      errorMessage: run.errorMessage,
      createdAt: new Date().toISOString()
    });
    await deps.store.appendAudit({
      id: newId("aud"),
      actorId: user.id,
      actorName: user.name,
      module: "ai-analysis",
      eventType: "analysis.completed",
      skillId: routed.selected.id,
      dataSources: result.dataSources,
      readScope: context.scope,
      outputSummary: summarizeForAudit(result, deps.env.auditRedactionSalt),
      costUsd: run.usage.costUsd,
      riskLevel: routed.selected.riskLevel,
      createdAt: new Date().toISOString()
    });
    return {
      interactionId: interaction.id,
      route: {
        detectedIntent: routed.detectedIntent,
        selectedSkill: routed.selected,
        candidateSkills: routed.candidateSkills,
        routeConfidence: routed.confidence,
        routeReason: routed.reason
      },
      context: {
        permissionSummary: context.permissionSummary,
        trimReasons: context.trimReasons,
        knowledge: context.knowledge.map((item) => ({ id: item.id, title: item.title, type: item.type })),
        dataSources: result.dataSources
      },
      result
    };
  });

  app.post("/api/ai/dry-run", async (request) => {
    const body = z
      .object({
        action: z.string(),
        scope: scopeSchema,
        user: userSchema
      })
      .parse(request.body);
    const metrics = await deps.sstl.getCampaignMetrics(body.scope);
    const affected = metrics
      .filter((row) => row.roi < 1 || row.profit < 0)
      .slice(0, 5)
      .map((row) => ({
        type: row.objectType,
        id: row.objectId,
        name: row.name,
        currentState: `spend=${row.spend}, roi=${row.roi}`,
        nextState: body.action.includes("暂停") ? "paused_pending_confirmation" : "budget_down_20_pending_confirmation"
      }));
    const dryRun = {
      id: newId("dry"),
      action: body.action,
      scope: body.scope,
      affectedObjects: affected,
      expectedImpact: Number(affected.reduce((sum, row) => sum + (row.currentState.includes("roi=0") ? 0 : 120), 0).toFixed(2)),
      risks: ["可能误伤短期回本计划", "执行前需要负责人二次确认", "必须保留回滚记录"],
      rollbackPlan: ["记录原始预算/状态", "确认 24 小时内利润未改善时恢复", "自动化执行日志保留 180 天"],
      requiresHumanConfirmation: true as const,
      createdAt: new Date().toISOString()
    };
    await deps.store.appendAudit({
      id: newId("aud"),
      actorId: body.user.id,
      actorName: body.user.name,
      module: "smart-bidding",
      eventType: "dry_run.created",
      dataSources: ["sstl.campaign_metrics"],
      readScope: body.scope,
      outputSummary: summarizeForAudit(dryRun, deps.env.auditRedactionSalt),
      costUsd: 0,
      riskLevel: "high",
      createdAt: new Date().toISOString()
    });
    const interaction = await deps.store.appendInteraction({
      id: newId("int"),
      actorId: body.user.id,
      actorName: body.user.name,
      actorRole: body.user.role,
      module: "smart-bidding",
      question: safeText(body.action, deps.env.auditRedactionSalt),
      responseSummary: `Dry-run generated for ${affected.length} objects`,
      responsePreview: safeJson(dryRun, deps.env.auditRedactionSalt, 6000),
      dataSources: ["sstl.campaign_metrics"],
      knowledgeIds: [],
      scope: body.scope,
      model: "dry-run-engine",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      status: "success",
      createdAt: new Date().toISOString()
    });
    return { ...dryRun, interactionId: interaction.id };
  });

  app.post("/api/material/brief", async (request) => {
    const body = z
      .object({
        businessTag: z.string().default("搜索套利"),
        targetCountry: z.string().default("US"),
        keyword: z.string().default("loan search"),
        user: userSchema
      })
      .parse(request.body);
    const brief = {
      title: `${body.targetCountry} ${body.keyword} 素材 Brief`,
      hooks: ["3 秒内展示搜索结果对比", "用问题句承接用户搜索意图", "结尾强调继续查看结果"],
      scripts: [
        `开头：还在手动比较 ${body.keyword}？`,
        "中段：展示 3 个可比较维度，避免夸大承诺。",
        "结尾：引导点击查看搜索结果，保留合规 disclaimer。"
      ],
      riskNotes: ["避免承诺收益或贷款审批结果", "不要展示虚假倒计时", "落地页需匹配关键词意图"],
      reusableMaterials: ["Hook 3s V12", "UGC compare V4"]
    };
    const user = body.user as UserContext;
    const interaction = await deps.store.appendInteraction({
      id: newId("int"),
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: "material-brief",
      question: safeText(
        `businessTag=${body.businessTag}; targetCountry=${body.targetCountry}; keyword=${body.keyword}`,
        deps.env.auditRedactionSalt
      ),
      responseSummary: safeText(brief.title, deps.env.auditRedactionSalt),
      responsePreview: safeJson(brief, deps.env.auditRedactionSalt, 6000),
      dataSources: [],
      knowledgeIds: [],
      model: "brief-template-engine",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      status: "success",
      createdAt: new Date().toISOString()
    });
    return { ...brief, interactionId: interaction.id };
  });

  app.get("/api/improvements", async () => deps.store.listImprovements());

  app.post("/api/improvements/:id/adopt", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const result = await deps.store.updateImprovement(params.id, "adopted");
    if (!result) return reply.code(404).send({ message: "Improvement not found" });
    return result;
  });

  app.get("/api/audit", async () => deps.store.listAudit());
  app.get("/api/model-usage", async () => deps.store.listUsage());
  app.get("/api/ai/interactions", async (request) => {
    const query = z
      .object({
        actorId: z.string().optional(),
        module: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200)
      })
      .parse(request.query);
    const rows = await deps.store.listInteractions(query.limit);
    return rows.filter((row) => {
      if (query.actorId && row.actorId !== query.actorId) return false;
      if (query.module && row.module !== query.module) return false;
      return true;
    });
  });
}

function safeText(value: unknown, salt: string, limit = 2000): string {
  const redacted = redactValue(value, salt);
  const text = typeof redacted === "string" ? redacted : JSON.stringify(redacted) ?? "";
  return text.slice(0, limit);
}

function safeJson(value: unknown, salt: string, limit = 4000): string {
  return (JSON.stringify(redactValue(value, salt), null, 2) ?? "").slice(0, limit);
}

function publicModelConfig(config: StoredAIModelConfig): AIModelConfig {
  return {
    id: "default",
    provider: "openai-compatible",
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    hasApiKey: Boolean(config.apiKey || config.apiKeyCiphertext || config.hasApiKey),
    apiKeyMasked: maskApiKey(config.apiKey) ?? config.apiKeyMasked,
    updatedBy: config.updatedBy,
    updatedAt: config.updatedAt
  };
}

function maskApiKey(apiKey?: string): string | undefined {
  if (!apiKey) return undefined;
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
