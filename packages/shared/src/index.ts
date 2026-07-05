export type Role = "operator" | "leader" | "admin" | "material";
export type ReviewStatus = "draft" | "pending_review" | "approved" | "rejected";
export type RiskLevel = "low" | "medium" | "high";
export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface UserContext {
  id: string;
  name: string;
  role: Role;
  teamId?: string;
  operatorIds: string[];
}

export interface AIKnowledgeItem {
  id: string;
  title: string;
  type: "sop" | "case" | "metric" | "policy" | "prompt" | "qa";
  businessTags: string[];
  platforms: string[];
  applicableObjects: string[];
  status: ReviewStatus;
  version: string;
  vectorStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  qualityScore: number;
  content: string;
  source?: string;
  expiresAt?: string;
  createdBy: string;
  updatedAt: string;
}

export interface AISkill {
  id: string;
  code: string;
  name: string;
  intent: string;
  description: string;
  triggerExamples: string[];
  requiredInputs: string[];
  dataSources: string[];
  knowledgeTypes: string[];
  toolPermissions: string[];
  riskLevel: RiskLevel;
  status: ReviewStatus;
  version: string;
  owner: string;
  score: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  updatedAt: string;
}

export interface AISkillDraft {
  id: string;
  prompt: string;
  generatedConfig: Partial<AISkill>;
  testCases: string[];
  createdBy: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface AISkillRouteLog {
  id: string;
  userQuestion: string;
  detectedIntent: string;
  candidateSkills: Array<{ skillId: string; score: number; reason: string }>;
  selectedSkillId: string;
  routeConfidence: number;
  routeReason: string;
  createdAt: string;
}

export interface AIContextBuildLog {
  id: string;
  userId: string;
  skillId: string;
  scope: AnalysisScope;
  dataSources: string[];
  knowledgeIds: string[];
  permissionSummary: string;
  trimReasons: string[];
  createdAt: string;
}

export interface AnalysisScope {
  dateRange: { from: string; to: string };
  ownerId?: string;
  operatorId?: string;
  teamId?: string;
  businessTag?: string;
  campaignId?: string;
  offerId?: string;
  materialId?: string;
}

export interface MetricSnapshot {
  objectType: string;
  objectId: string;
  name: string;
  spend: number;
  revenue: number;
  profit: number;
  roi: number;
  cpa: number;
  ctr: number;
  conversions: number;
  riskFlags: string[];
}

export interface SstlReadonlyStatus {
  mode: "http" | "mysql" | "seed";
  connected: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SstlEndpointSnapshot {
  key: string;
  endpoint: string;
  method: "GET" | "POST";
  ok: boolean;
  recordCount: number;
  total?: number | null;
  fields: string[];
  sample: Array<Record<string, unknown>>;
  message?: string;
}

export interface SstlLiveSnapshot {
  mode: "http" | "mysql" | "seed";
  fetchedAt: string;
  status: SstlReadonlyStatus;
  endpoints: SstlEndpointSnapshot[];
  metrics: {
    campaigns: MetricSnapshot[];
    adsets: MetricSnapshot[];
    keywords: MetricSnapshot[];
    materials: MetricSnapshot[];
    offers: MetricSnapshot[];
  };
}

export interface AIAnalysisResult {
  id: string;
  target: string;
  summary: string;
  evidence: string[];
  rootCauses: string[];
  suggestedActions: Array<{
    action: string;
    targetType: string;
    targetId: string;
    expectedImpact: number;
    riskLevel: RiskLevel;
    requiresConfirmation: boolean;
  }>;
  confidence: number;
  skillIds: string[];
  knowledgeIds: string[];
  dataSources: string[];
  createdAt: string;
}

export interface AIDryRunResult {
  id: string;
  action: string;
  scope: AnalysisScope;
  affectedObjects: Array<{ type: string; id: string; name: string; currentState: string; nextState: string }>;
  expectedImpact: number;
  risks: string[];
  rollbackPlan: string[];
  requiresHumanConfirmation: true;
  createdAt: string;
}

export interface AIFeedback {
  id: string;
  analysisId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  adopted: boolean;
  actualResult?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface AIImprovementSuggestion {
  id: string;
  suggestionType: "knowledge_update" | "skill_improvement" | "prompt_improvement";
  target: string;
  problemSummary: string;
  suggestedChange: string;
  status: "open" | "adopted" | "dismissed";
  createdAt: string;
}

export interface AIAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  module: string;
  eventType: string;
  skillId?: string;
  dataSources: string[];
  readScope?: AnalysisScope;
  outputSummary: string;
  costUsd: number;
  riskLevel: RiskLevel;
  createdAt: string;
}

export interface AIModelUsage {
  id: string;
  model: string;
  module: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdBy: string;
  createdAt: string;
}

export interface AIModelConfig {
  id: "default";
  provider: "openai-compatible";
  baseUrl: string;
  model: string;
  temperature: number;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface DashboardSummary {
  profitRiskCount: number;
  lowRoiObjects: number;
  highSpendNoConversion: number;
  materialFatigue: number;
  complianceRisks: number;
  suggestionAdoptionRate: number;
  knowledgeHitRate: number;
  skillRouteAccuracy: number;
  todayCostUsd: number;
  improvementsOpen: number;
}
