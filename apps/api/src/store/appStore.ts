import { nanoid } from "nanoid";
import { Pool } from "pg";
import type {
  AIAuditLog,
  AIImprovementSuggestion,
  AIKnowledgeItem,
  AIModelUsage,
  AISkill,
  AISkillDraft
} from "@sstl-ai/shared";
import { seedAudit, seedDrafts, seedImprovements, seedKnowledge, seedSkills, seedUsage } from "./seed.js";

export interface AppStore {
  listKnowledge(): Promise<AIKnowledgeItem[]>;
  upsertKnowledge(item: AIKnowledgeItem): Promise<AIKnowledgeItem>;
  reviewKnowledge(id: string, status: AIKnowledgeItem["status"]): Promise<AIKnowledgeItem | undefined>;
  listSkills(): Promise<AISkill[]>;
  upsertSkill(skill: AISkill): Promise<AISkill>;
  listSkillDrafts(): Promise<AISkillDraft[]>;
  upsertSkillDraft(draft: AISkillDraft): Promise<AISkillDraft>;
  listImprovements(): Promise<AIImprovementSuggestion[]>;
  updateImprovement(id: string, status: AIImprovementSuggestion["status"]): Promise<AIImprovementSuggestion | undefined>;
  appendAudit(log: AIAuditLog): Promise<AIAuditLog>;
  listAudit(): Promise<AIAuditLog[]>;
  appendUsage(usage: AIModelUsage): Promise<AIModelUsage>;
  listUsage(): Promise<AIModelUsage[]>;
}

type ObjectType = "knowledge" | "skill" | "skill_draft" | "improvement" | "audit" | "usage";

export class MemoryStore implements AppStore {
  private knowledge = [...seedKnowledge];
  private skills = [...seedSkills];
  private drafts = [...seedDrafts];
  private improvements = [...seedImprovements];
  private audit = [...seedAudit];
  private usage = [...seedUsage];

  async listKnowledge() {
    return [...this.knowledge].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async upsertKnowledge(item: AIKnowledgeItem) {
    this.knowledge = upsertById(this.knowledge, item);
    return item;
  }

  async reviewKnowledge(id: string, status: AIKnowledgeItem["status"]) {
    const item = this.knowledge.find((row) => row.id === id);
    if (!item) return undefined;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  async listSkills() {
    return [...this.skills].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async upsertSkill(skill: AISkill) {
    this.skills = upsertById(this.skills, skill);
    return skill;
  }

  async listSkillDrafts() {
    return [...this.drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async upsertSkillDraft(draft: AISkillDraft) {
    this.drafts = upsertById(this.drafts, draft);
    return draft;
  }

  async listImprovements() {
    return [...this.improvements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateImprovement(id: string, status: AIImprovementSuggestion["status"]) {
    const item = this.improvements.find((row) => row.id === id);
    if (!item) return undefined;
    item.status = status;
    return item;
  }

  async appendAudit(log: AIAuditLog) {
    this.audit.unshift(log);
    return log;
  }

  async listAudit() {
    return [...this.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async appendUsage(usage: AIModelUsage) {
    this.usage.unshift(usage);
    return usage;
  }

  async listUsage() {
    return [...this.usage].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class PostgresStore extends MemoryStore {
  private pool: Pool;

  constructor(databaseUrl: string) {
    super();
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  override async listKnowledge() {
    return this.listObjects<AIKnowledgeItem>("knowledge", seedKnowledge);
  }

  override async upsertKnowledge(item: AIKnowledgeItem) {
    return this.upsertObject("knowledge", item.id, item);
  }

  override async reviewKnowledge(id: string, status: AIKnowledgeItem["status"]) {
    const items = await this.listKnowledge();
    const item = items.find((row) => row.id === id);
    if (!item) return undefined;
    return this.upsertKnowledge({ ...item, status, updatedAt: new Date().toISOString() });
  }

  override async listSkills() {
    return this.listObjects<AISkill>("skill", seedSkills);
  }

  override async upsertSkill(skill: AISkill) {
    return this.upsertObject("skill", skill.id, skill);
  }

  override async listSkillDrafts() {
    return this.listObjects<AISkillDraft>("skill_draft", seedDrafts);
  }

  override async upsertSkillDraft(draft: AISkillDraft) {
    return this.upsertObject("skill_draft", draft.id, draft);
  }

  override async listImprovements() {
    return this.listObjects<AIImprovementSuggestion>("improvement", seedImprovements);
  }

  override async updateImprovement(id: string, status: AIImprovementSuggestion["status"]) {
    const items = await this.listImprovements();
    const item = items.find((row) => row.id === id);
    if (!item) return undefined;
    return this.upsertObject("improvement", id, { ...item, status });
  }

  override async appendAudit(log: AIAuditLog) {
    await this.pool.query(
      `insert into ai_audit_events (id, actor_id, actor_name, module, event_type, skill_id, data_sources, read_scope, output_summary, cost_usd, risk_level, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do nothing`,
      [
        log.id,
        log.actorId,
        log.actorName,
        log.module,
        log.eventType,
        log.skillId ?? null,
        JSON.stringify(log.dataSources),
        log.readScope ? JSON.stringify(log.readScope) : null,
        log.outputSummary,
        log.costUsd,
        log.riskLevel,
        log.createdAt
      ]
    );
    return log;
  }

  override async listAudit() {
    const result = await this.pool.query("select * from ai_audit_events order by created_at desc limit 200");
    if (!result.rows.length) return seedAudit;
    return result.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      module: row.module,
      eventType: row.event_type,
      skillId: row.skill_id ?? undefined,
      dataSources: row.data_sources,
      readScope: row.read_scope ?? undefined,
      outputSummary: row.output_summary,
      costUsd: Number(row.cost_usd),
      riskLevel: row.risk_level,
      createdAt: row.created_at.toISOString()
    }));
  }

  override async appendUsage(usage: AIModelUsage) {
    await this.pool.query(
      `insert into ai_model_usage (id, model, module, input_tokens, output_tokens, cost_usd, created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do nothing`,
      [
        usage.id,
        usage.model,
        usage.module,
        usage.inputTokens,
        usage.outputTokens,
        usage.costUsd,
        usage.createdBy,
        usage.createdAt
      ]
    );
    return usage;
  }

  override async listUsage() {
    const result = await this.pool.query("select * from ai_model_usage order by created_at desc limit 200");
    if (!result.rows.length) return seedUsage;
    return result.rows.map((row) => ({
      id: row.id,
      model: row.model,
      module: row.module,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      costUsd: Number(row.cost_usd),
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString()
    }));
  }

  private async listObjects<T extends { id: string }>(objectType: ObjectType, fallback: T[]): Promise<T[]> {
    const result = await this.pool.query("select payload from ai_objects where object_type = $1 order by updated_at desc", [
      objectType
    ]);
    if (!result.rows.length) {
      await Promise.all(fallback.map((item) => this.upsertObject(objectType, item.id, item)));
      return fallback;
    }
    return result.rows.map((row) => row.payload as T);
  }

  private async upsertObject<T>(objectType: ObjectType, objectId: string, payload: T): Promise<T> {
    await this.pool.query(
      `insert into ai_objects (object_type, object_id, payload)
       values ($1, $2, $3)
       on conflict (object_type, object_id)
       do update set payload = excluded.payload, updated_at = now()`,
      [objectType, objectId, JSON.stringify(payload)]
    );
    return payload;
  }
}

export function createStore(databaseUrl?: string): AppStore {
  return databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore();
}

export function newId(prefix: string): string {
  return `${prefix}-${nanoid(10)}`;
}

function upsertById<T extends { id: string }>(rows: T[], item: T): T[] {
  const index = rows.findIndex((row) => row.id === item.id);
  if (index === -1) return [item, ...rows];
  const next = [...rows];
  next[index] = item;
  return next;
}
