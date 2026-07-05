import type {
  AIAuditLog,
  AIImprovementSuggestion,
  AIKnowledgeItem,
  AIModelConfig,
  AIModelUsage,
  AISkill,
  AISkillDraft,
  DashboardSummary
} from "@sstl-ai/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardSummary & { recentAudit: AIAuditLog[] }>("/api/dashboard"),
  knowledge: () => request<AIKnowledgeItem[]>("/api/knowledge"),
  createKnowledge: (body: Partial<AIKnowledgeItem>) =>
    request<AIKnowledgeItem>("/api/knowledge", { method: "POST", body: JSON.stringify(body) }),
  reviewKnowledge: (id: string, status: "approved" | "rejected") =>
    request<AIKnowledgeItem>(`/api/knowledge/${id}/review`, { method: "POST", body: JSON.stringify({ status }) }),
  skills: () => request<AISkill[]>("/api/skills"),
  drafts: () => request<AISkillDraft[]>("/api/skills/drafts"),
  generateDraft: (prompt: string) =>
    request<AISkillDraft>("/api/skills/drafts/generate", { method: "POST", body: JSON.stringify({ prompt }) }),
  reviewSkill: (id: string, status: "approved" | "rejected") =>
    request<AISkillDraft>(`/api/skills/${id}/review`, { method: "POST", body: JSON.stringify({ status }) }),
  route: (question: string) => request<Record<string, unknown>>("/api/ai/route", { method: "POST", body: JSON.stringify({ question }) }),
  analyze: (question: string) =>
    request<Record<string, unknown>>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({
        question,
        scope: { dateRange: { from: "2026-07-01", to: "2026-07-05" }, businessTag: "搜索套利" },
        user: { id: "u-admin", name: "Admin", role: "admin", operatorIds: ["op-001"] }
      })
    }),
  dryRun: (action: string) =>
    request<Record<string, unknown>>("/api/ai/dry-run", {
      method: "POST",
      body: JSON.stringify({
        action,
        scope: { dateRange: { from: "2026-07-01", to: "2026-07-05" }, businessTag: "搜索套利" },
        user: { id: "u-admin", name: "Admin", role: "admin", operatorIds: ["op-001"] }
      })
    }),
  brief: (keyword: string) =>
    request<Record<string, unknown>>("/api/material/brief", {
      method: "POST",
      body: JSON.stringify({ keyword, businessTag: "搜索套利", targetCountry: "US" })
    }),
  improvements: () => request<AIImprovementSuggestion[]>("/api/improvements"),
  adoptImprovement: (id: string) => request<AIImprovementSuggestion>(`/api/improvements/${id}/adopt`, { method: "POST" }),
  audit: () => request<AIAuditLog[]>("/api/audit"),
  usage: () => request<AIModelUsage[]>("/api/model-usage"),
  sstlStatus: () => request<Record<string, unknown>>("/api/sstl/readonly/status"),
  sstlSnapshot: () => request<Record<string, unknown>>("/api/sstl/live/snapshot"),
  modelConfig: () => request<AIModelConfig>("/api/model-config"),
  updateModelConfig: (body: Partial<AIModelConfig> & { apiKey?: string }) =>
    request<AIModelConfig>("/api/model-config", { method: "POST", body: JSON.stringify(body) })
};
