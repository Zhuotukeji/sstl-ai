import type {
  AIAuditLog,
  AIImprovementSuggestion,
  AIKnowledgeItem,
  AIModelUsage,
  AISkill,
  AISkillDraft
} from "@sstl-ai/shared";

const now = new Date().toISOString();

export const seedKnowledge: AIKnowledgeItem[] = [
  {
    id: "kn-profit-roi",
    title: "搜索套利 ROI 与利润判断 SOP",
    type: "sop",
    businessTags: ["搜索套利", "ROI", "亏损诊断"],
    platforms: ["TikTok", "TONIC"],
    applicableObjects: ["Campaign", "Adset", "Keyword", "Offer"],
    status: "approved",
    version: "1.0.0",
    vectorStatus: "indexed",
    qualityScore: 93,
    content: "先看 spend、revenue、profit、ROI，再拆 Campaign、关键词、素材和 Offer。ROI 低于 1 且 spend 持续放大时优先进入 dry-run 暂停或降预算。",
    source: "internal-sop",
    createdBy: "admin",
    updatedAt: now
  },
  {
    id: "kn-material-fatigue",
    title: "素材衰退识别方法",
    type: "case",
    businessTags: ["素材", "衰退", "复用"],
    platforms: ["TikTok"],
    applicableObjects: ["Material", "Ad"],
    status: "approved",
    version: "1.1.0",
    vectorStatus: "indexed",
    qualityScore: 88,
    content: "同素材 CTR 连续下降且 CPA 上升时，通常代表受众疲劳。优先替换开头 3 秒钩子，保留已验证的关键词和 Offer。",
    source: "review-2026-06",
    createdBy: "material-lead",
    updatedAt: now
  },
  {
    id: "kn-tonic-compliance",
    title: "TONIC declined 联动处理规范",
    type: "policy",
    businessTags: ["合规", "TONIC", "兜底"],
    platforms: ["TONIC"],
    applicableObjects: ["Campaign", "Offer", "Keyword"],
    status: "approved",
    version: "1.0.0",
    vectorStatus: "indexed",
    qualityScore: 91,
    content: "当 TONIC 返回 declined 时，不允许继续放量。AI 只能建议暂停 Offer、切兜底或暂停广告，必须由负责人确认执行。",
    source: "compliance-policy",
    createdBy: "admin",
    updatedAt: now
  }
];

export const seedSkills: AISkill[] = [
  {
    id: "sk-loss-analysis",
    code: "loss_root_cause_analysis",
    name: "亏损归因分析",
    intent: "analysis.loss.root_cause",
    description: "分析指定时间范围内亏损原因，拆解 Campaign、关键词、素材、Offer 和合规风险。",
    triggerExamples: ["昨天为什么亏损", "帮我分析最近 7 天低 ROI Campaign", "这个投手利润下降的原因"],
    requiredInputs: ["dateRange"],
    dataSources: ["sstl.campaign_metrics", "sstl.keyword_metrics", "sstl.material_metrics", "sstl.offer_metrics"],
    knowledgeTypes: ["sop", "case", "metric"],
    toolPermissions: ["sstl:metrics:read", "ai:dry-run:create"],
    riskLevel: "medium",
    status: "approved",
    version: "1.0.0",
    owner: "AI Ops",
    score: 94,
    inputSchema: { type: "object", required: ["dateRange"] },
    outputSchema: { type: "object", required: ["summary", "evidence", "suggestedActions"] },
    updatedAt: now
  },
  {
    id: "sk-budget-dry-run",
    code: "budget_optimization_dry_run",
    name: "预算优化 Dry-run",
    intent: "operation.budget.dry_run",
    description: "根据 ROI、CPA、转化和消耗生成预算调整建议，只输出 dry-run。",
    triggerExamples: ["哪些 Campaign 应该降预算", "ROI 好的计划可以加多少预算", "生成预算调整预览"],
    requiredInputs: ["dateRange", "scope"],
    dataSources: ["sstl.campaign_metrics", "sstl.automation_logs"],
    knowledgeTypes: ["sop", "metric"],
    toolPermissions: ["sstl:metrics:read", "ai:dry-run:create"],
    riskLevel: "high",
    status: "approved",
    version: "1.0.0",
    owner: "Optimization",
    score: 89,
    inputSchema: { type: "object", required: ["dateRange"] },
    outputSchema: { type: "object", required: ["affectedObjects", "risks", "rollbackPlan"] },
    updatedAt: now
  },
  {
    id: "sk-material-brief",
    code: "material_brief_generator",
    name: "素材 Brief 生成",
    intent: "creative.material.brief",
    description: "基于高 ROI 素材、关键词和合规规则生成素材脚本与 Brief。",
    triggerExamples: ["生成一批素材脚本", "这个关键词适合什么素材角度", "复用高 ROI 素材"],
    requiredInputs: ["businessTag", "targetCountry"],
    dataSources: ["sstl.material_metrics", "sstl.keyword_metrics"],
    knowledgeTypes: ["case", "policy", "sop"],
    toolPermissions: ["sstl:metrics:read"],
    riskLevel: "low",
    status: "approved",
    version: "1.0.0",
    owner: "Creative",
    score: 92,
    inputSchema: { type: "object", required: ["businessTag"] },
    outputSchema: { type: "object", required: ["brief", "scripts", "riskNotes"] },
    updatedAt: now
  }
];

export const seedDrafts: AISkillDraft[] = [
  {
    id: "draft-offer-weight",
    prompt: "根据 Offer ROI 和合规状态生成权重调整建议",
    generatedConfig: {
      code: "offer_weight_dry_run",
      name: "Offer 权重调整 Dry-run",
      riskLevel: "high",
      status: "pending_review"
    },
    testCases: ["Campaign A 两个 Offer ROI 差异明显时给出权重调整预览"],
    createdBy: "leader-01",
    reviewStatus: "pending_review",
    createdAt: now
  }
];

export const seedImprovements: AIImprovementSuggestion[] = [
  {
    id: "imp-001",
    suggestionType: "knowledge_update",
    target: "kn-profit-roi",
    problemSummary: "AI 在低转化但高 CTR 场景下缺少素材疲劳解释。",
    suggestedChange: "补充 CTR 高、CVR 低时应检查落地页与 Offer 匹配度的判断规则。",
    status: "open",
    createdAt: now
  },
  {
    id: "imp-002",
    suggestionType: "skill_improvement",
    target: "sk-loss-analysis",
    problemSummary: "部分问题路由到亏损分析 Skill 时没有读取 TONIC 合规数据。",
    suggestedChange: "当问题包含 declined、合规、兜底等词时强制加入 compliance data source。",
    status: "open",
    createdAt: now
  }
];

export const seedAudit: AIAuditLog[] = [
  {
    id: "aud-001",
    actorId: "u-admin",
    actorName: "Admin",
    module: "ai-analysis",
    eventType: "analysis.completed",
    skillId: "sk-loss-analysis",
    dataSources: ["sstl.campaign_metrics", "knowledge"],
    outputSummary: "分析最近 7 天低 ROI Campaign，生成 3 条建议。",
    costUsd: 0.018,
    riskLevel: "medium",
    createdAt: now
  }
];

export const seedUsage: AIModelUsage[] = [
  {
    id: "usage-001",
    model: "fallback-local",
    module: "ai-analysis",
    inputTokens: 1820,
    outputTokens: 620,
    costUsd: 0,
    createdBy: "u-admin",
    createdAt: now
  }
];
