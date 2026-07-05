import type { AIKnowledgeItem, AISkill, AnalysisScope, UserContext } from "@sstl-ai/shared";
import type { SstlReadonlyRepository } from "../sstl/readonlyRepository.js";

export async function buildContext(input: {
  user: UserContext;
  scope: AnalysisScope;
  skill: AISkill;
  knowledge: AIKnowledgeItem[];
  sstl: SstlReadonlyRepository;
}) {
  const { user, scope, skill, knowledge, sstl } = input;
  const allowedScope = enforceScope(user, scope);
  const relatedKnowledge = knowledge
    .filter((item) => item.status === "approved")
    .filter((item) => skill.knowledgeTypes.includes(item.type) || item.businessTags.includes(scope.businessTag ?? ""))
    .slice(0, 5);

  const dataSources = new Set(skill.dataSources);
  const [campaigns, keywords, materials, offers] = await Promise.all([
    dataSources.has("sstl.campaign_metrics") ? sstl.getCampaignMetrics(allowedScope) : Promise.resolve([]),
    dataSources.has("sstl.keyword_metrics") ? sstl.getKeywordMetrics(allowedScope) : Promise.resolve([]),
    dataSources.has("sstl.material_metrics") ? sstl.getMaterialMetrics(allowedScope) : Promise.resolve([]),
    dataSources.has("sstl.offer_metrics") ? sstl.getOfferMetrics(allowedScope) : Promise.resolve([])
  ]);

  return {
    scope: allowedScope,
    permissionSummary:
      user.role === "admin"
        ? "管理员可查看全局数据"
        : user.role === "leader"
          ? `负责人限定 teamId=${user.teamId}`
          : `投手限定 operatorIds=${user.operatorIds.join(",")}`,
    trimReasons:
      JSON.stringify(scope) === JSON.stringify(allowedScope)
        ? []
        : ["根据用户权限裁剪了请求范围，避免越权读取数据"],
    knowledge: relatedKnowledge,
    metrics: {
      campaigns,
      keywords,
      materials,
      offers
    }
  };
}

function enforceScope(user: UserContext, scope: AnalysisScope): AnalysisScope {
  if (user.role === "admin") return scope;
  if (user.role === "leader") {
    return { ...scope, teamId: user.teamId };
  }
  return { ...scope, operatorId: scope.operatorId && user.operatorIds.includes(scope.operatorId) ? scope.operatorId : user.operatorIds[0] };
}
