import type { AISkill } from "@sstl-ai/shared";

const intentKeywords: Array<{ intent: string; keywords: string[] }> = [
  { intent: "analysis.loss.root_cause", keywords: ["亏损", "利润", "ROI", "为什么", "下降", "低 roi"] },
  { intent: "operation.budget.dry_run", keywords: ["预算", "出价", "暂停", "加预算", "降预算", "dry-run"] },
  { intent: "creative.material.brief", keywords: ["素材", "脚本", "brief", "创意", "复用", "钩子"] }
];

export function routeSkill(question: string, skills: AISkill[]) {
  const normalized = question.toLowerCase();
  const intent =
    intentKeywords.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.intent ??
    "analysis.loss.root_cause";

  const candidates = skills
    .filter((skill) => skill.status === "approved")
    .map((skill) => {
      const intentScore = skill.intent === intent ? 60 : 0;
      const exampleScore = skill.triggerExamples.reduce(
        (score, example) => score + (normalized.includes(example.toLowerCase().slice(0, 4)) ? 10 : 0),
        0
      );
      const keywordScore = skill.triggerExamples.some((example) =>
        example
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part.length > 1 && normalized.includes(part))
      )
        ? 8
        : 0;
      return {
        skill,
        score: intentScore + exampleScore + keywordScore + skill.score / 10,
        reason: skill.intent === intent ? "意图匹配，且 Skill 已发布" : "作为备用候选 Skill"
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = candidates[0]?.skill ?? skills[0]!;
  return {
    detectedIntent: intent,
    selected,
    candidateSkills: candidates.slice(0, 3).map((item) => ({
      skillId: item.skill.id,
      score: Math.round(item.score),
      reason: item.reason
    })),
    confidence: Math.min(0.97, Math.max(0.62, (candidates[0]?.score ?? 60) / 100)),
    reason: `根据问题关键词识别为 ${intent}，选择 ${selected.name}。`
  };
}
