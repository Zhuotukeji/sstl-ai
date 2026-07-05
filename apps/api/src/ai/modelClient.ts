import type {
  AIAnalysisResult,
  AIInteractionStatus,
  AIModelConfig,
  AIModelUsage,
  AISkill,
  MetricSnapshot
} from "@sstl-ai/shared";
import { decryptSecret } from "../security/secretBox.js";
import { newId, type AppStore, type StoredAIModelConfig } from "../store/appStore.js";
import type { Env } from "../env.js";

type AnalyzeInput = {
  userId: string;
  question: string;
  skill: AISkill;
  context: {
    knowledge: Array<{ id: string; title: string; content: string }>;
    metrics: Record<string, MetricSnapshot[]>;
  };
};

export interface AIModelRun {
  result: AIAnalysisResult;
  usage: AIModelUsage;
  status: AIInteractionStatus;
  latencyMs: number;
  errorMessage?: string;
}

export class ModelClient {
  constructor(
    private env: Env,
    private store: AppStore
  ) {}

  async analyze(input: AnalyzeInput): Promise<AIAnalysisResult> {
    return (await this.analyzeWithUsage(input)).result;
  }

  async analyzeWithUsage(input: AnalyzeInput): Promise<AIModelRun> {
    const config = await this.getEffectiveModelConfig();
    if (config.apiKey) {
      const result = await this.callOpenAI(input, config);
      if (result) return result;
    }
    return this.fallbackAnalysis(input);
  }

  private async callOpenAI(input: AnalyzeInput, config: AIModelConfig & { apiKey?: string }): Promise<AIModelRun | undefined> {
    const prompt = [
      "你是 SSTL 搜索套利 AI 中台，只能输出 JSON。",
      "必须给出 summary、evidence、rootCauses、suggestedActions、confidence。",
      "高风险动作必须 requiresConfirmation=true。",
      JSON.stringify({
        question: input.question,
        skill: input.skill,
        knowledge: input.context.knowledge,
        metrics: input.context.metrics
      })
    ].join("\n");

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: "Return compact valid JSON only." },
            { role: "user", content: prompt }
          ],
          temperature: config.temperature,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return undefined;
      const parsed = JSON.parse(content) as Partial<AIAnalysisResult>;
      const inputTokens = payload.usage?.prompt_tokens ?? estimateTokens(prompt);
      const outputTokens = payload.usage?.completion_tokens ?? estimateTokens(content);
      const usage: AIModelUsage = {
        id: newId("usage"),
        model: config.model,
        module: "ai-analysis",
        inputTokens,
        outputTokens,
        costUsd: estimateCost(inputTokens, outputTokens),
        createdBy: input.userId,
        createdAt: new Date().toISOString()
      };
      await this.store.appendUsage(usage);
      return {
        result: normalizeResult(parsed, input, Date.now() - startedAt),
        usage,
        status: "success",
        latencyMs: Date.now() - startedAt
      };
    } catch {
      return undefined;
    }
  }

  private async fallbackAnalysis(input: AnalyzeInput): Promise<AIModelRun> {
    const startedAt = Date.now();
    const allMetrics = Object.values(input.context.metrics).flat();
    const risky = allMetrics.filter((row) => row.profit < 0 || row.roi < 1).slice(0, 5);
    const topRisk = risky[0] ?? allMetrics[0];
    const summary = topRisk
      ? `发现 ${risky.length} 个低利润/低 ROI 对象，最主要风险来自 ${topRisk.name}，profit=${topRisk.profit.toFixed(2)}，ROI=${topRisk.roi.toFixed(2)}。`
      : "当前范围内没有读取到显著风险对象，建议扩大日期范围或检查数据源。";

    const result: AIAnalysisResult = {
      id: newId("analysis"),
      target: input.question,
      summary,
      evidence: risky.map((row) => `${row.objectType} ${row.name}: spend=${row.spend}, revenue=${row.revenue}, ROI=${row.roi}`),
      rootCauses: [
        "低 ROI 对象集中在高消耗 Campaign，需要拆解关键词与素材。",
        "部分对象存在高消耗但收益不足，建议先做暂停/降预算 Dry-run。",
        "结合知识库 SOP，ROI<1 且持续放量应进入人工确认流程。"
      ],
      suggestedActions: risky.slice(0, 3).map((row) => ({
        action: row.roi < 0.8 ? "生成暂停 Dry-run" : "生成降预算 20% Dry-run",
        targetType: row.objectType,
        targetId: row.objectId,
        expectedImpact: Math.abs(row.profit),
        riskLevel: "high",
        requiresConfirmation: true
      })),
      confidence: risky.length ? 0.84 : 0.62,
      skillIds: [input.skill.id],
      knowledgeIds: input.context.knowledge.map((item) => item.id),
      dataSources: input.skill.dataSources,
      createdAt: new Date().toISOString()
    };

    const usage = await this.store.appendUsage({
      id: newId("usage"),
      model: "fallback-local",
      module: "ai-analysis",
      inputTokens: estimateTokens(JSON.stringify(input)),
      outputTokens: estimateTokens(JSON.stringify(result)),
      costUsd: 0,
      createdBy: input.userId,
      createdAt: new Date().toISOString()
    });

    return {
      result,
      usage,
      status: "fallback",
      latencyMs: Date.now() - startedAt
    };
  }

  private async getEffectiveModelConfig(): Promise<AIModelConfig & { apiKey?: string }> {
    const stored = await this.store.getModelConfig();
    if (stored) return withDecryptedApiKey(stored, this.env.dataEncryptionKey);
    return {
      id: "default",
      provider: "openai-compatible",
      baseUrl: this.env.openaiBaseUrl,
      model: this.env.openaiModel,
      temperature: 0.2,
      hasApiKey: Boolean(this.env.openaiApiKey),
      apiKey: this.env.openaiApiKey,
      apiKeyMasked: maskApiKey(this.env.openaiApiKey),
      updatedBy: "env",
      updatedAt: new Date().toISOString()
    };
  }
}

function withDecryptedApiKey(config: StoredAIModelConfig, dataEncryptionKey: string): AIModelConfig & { apiKey?: string } {
  return {
    ...config,
    apiKey: config.apiKey ?? decryptSecret(config.apiKeyCiphertext, dataEncryptionKey)
  };
}

function maskApiKey(apiKey?: string): string | undefined {
  if (!apiKey) return undefined;
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function normalizeResult(
  parsed: Partial<AIAnalysisResult>,
  input: { question: string; skill: AISkill; context: { knowledge: Array<{ id: string }>; metrics: Record<string, MetricSnapshot[]> } },
  elapsedMs: number
): AIAnalysisResult {
  return {
    id: newId("analysis"),
    target: parsed.target ?? input.question,
    summary: parsed.summary ?? `AI 分析完成，用时 ${elapsedMs}ms。`,
    evidence: parsed.evidence ?? [],
    rootCauses: parsed.rootCauses ?? [],
    suggestedActions:
      parsed.suggestedActions?.map((action) => ({ ...action, requiresConfirmation: true })) ?? [],
    confidence: parsed.confidence ?? 0.78,
    skillIds: parsed.skillIds ?? [input.skill.id],
    knowledgeIds: parsed.knowledgeIds ?? input.context.knowledge.map((item) => item.id),
    dataSources: parsed.dataSources ?? input.skill.dataSources,
    createdAt: new Date().toISOString()
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens / 1_000_000) * 0.4 + (outputTokens / 1_000_000) * 1.6).toFixed(6));
}
