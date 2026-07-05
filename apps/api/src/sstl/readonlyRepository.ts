import mysql from "mysql2/promise";
import type { AnalysisScope, MetricSnapshot } from "@sstl-ai/shared";
import type { Env } from "../env.js";
import { redactValue } from "../security/redact.js";

export interface SstlReadonlyRepository {
  status(): Promise<{ mode: "mysql" | "seed"; connected: boolean; message: string }>;
  getCampaignMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]>;
  getKeywordMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]>;
  getMaterialMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]>;
  getOfferMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]>;
}

const seedMetrics: MetricSnapshot[] = [
  {
    objectType: "Campaign",
    objectId: "IC-US-SEARCH-001",
    name: "US Search AI Loans",
    spend: 1280,
    revenue: 940,
    profit: -340,
    roi: 0.73,
    cpa: 42.7,
    ctr: 1.9,
    conversions: 30,
    riskFlags: ["ROI<1", "high_spend"]
  },
  {
    objectType: "Campaign",
    objectId: "IC-CA-SEARCH-008",
    name: "CA Search Insurance",
    spend: 760,
    revenue: 1180,
    profit: 420,
    roi: 1.55,
    cpa: 28.1,
    ctr: 2.8,
    conversions: 27,
    riskFlags: []
  },
  {
    objectType: "Campaign",
    objectId: "IC-UK-SEARCH-013",
    name: "UK Search Compare",
    spend: 520,
    revenue: 460,
    profit: -60,
    roi: 0.88,
    cpa: 33.4,
    ctr: 1.5,
    conversions: 16,
    riskFlags: ["low_roi", "material_fatigue"]
  }
];

export function createSstlRepository(env: Env): SstlReadonlyRepository {
  if (!env.sstlDb) return new SeedSstlRepository();
  return new MysqlSstlReadonlyRepository(env);
}

class SeedSstlRepository implements SstlReadonlyRepository {
  async status() {
    return { mode: "seed" as const, connected: true, message: "SSTL_DB_* 未配置，当前使用内置演示数据。" };
  }

  async getCampaignMetrics() {
    return seedMetrics;
  }

  async getKeywordMetrics() {
    return seedMetrics.map((row, index) => ({
      ...row,
      objectType: "Keyword",
      objectId: `kw-${index + 1}`,
      name: ["loan search", "insurance quote", "compare rates"][index] ?? "keyword"
    }));
  }

  async getMaterialMetrics() {
    return seedMetrics.map((row, index) => ({
      ...row,
      objectType: "Material",
      objectId: `mat-${index + 1}`,
      name: ["Hook 3s V12", "UGC compare V4", "Text overlay V7"][index] ?? "material"
    }));
  }

  async getOfferMetrics() {
    return seedMetrics.map((row, index) => ({
      ...row,
      objectType: "Offer",
      objectId: `offer-${index + 1}`,
      name: ["TONIC Loans", "System1 Insurance", "Direct Compare"][index] ?? "offer"
    }));
  }
}

class MysqlSstlReadonlyRepository implements SstlReadonlyRepository {
  private pool: mysql.Pool;

  constructor(private env: Env) {
    this.pool = mysql.createPool({
      host: env.sstlDb!.host,
      port: env.sstlDb!.port,
      user: env.sstlDb!.user,
      password: env.sstlDb!.password,
      database: env.sstlDb!.database,
      ssl: env.sstlDb!.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: true
    });
  }

  async status() {
    await this.pool.query("select 1 as ok");
    return { mode: "mysql" as const, connected: true, message: "SSTL 只读生产库已连接。" };
  }

  async getCampaignMetrics(scope: AnalysisScope) {
    return this.queryMetrics(
      "sstl_ai_campaign_metrics",
      "Campaign",
      "campaign_id",
      "campaign_name",
      scope
    );
  }

  async getKeywordMetrics(scope: AnalysisScope) {
    return this.queryMetrics("sstl_ai_keyword_metrics", "Keyword", "keyword_id", "keyword", scope);
  }

  async getMaterialMetrics(scope: AnalysisScope) {
    return this.queryMetrics("sstl_ai_material_metrics", "Material", "material_id", "material_name", scope);
  }

  async getOfferMetrics(scope: AnalysisScope) {
    return this.queryMetrics("sstl_ai_offer_metrics", "Offer", "offer_id", "offer_name", scope);
  }

  private async queryMetrics(
    viewName: string,
    objectType: string,
    idColumn: string,
    nameColumn: string,
    scope: AnalysisScope
  ): Promise<MetricSnapshot[]> {
    const where = ["stat_date between :fromDate and :toDate"];
    const params: Record<string, string> = {
      fromDate: scope.dateRange.from,
      toDate: scope.dateRange.to
    };
    if (scope.operatorId) {
      where.push("operator_id = :operatorId");
      params.operatorId = scope.operatorId;
    }
    if (scope.businessTag) {
      where.push("business_tag = :businessTag");
      params.businessTag = scope.businessTag;
    }
    if (scope.campaignId) {
      where.push("campaign_id = :campaignId");
      params.campaignId = scope.campaignId;
    }

    const sql = `
      select ${idColumn} as object_id,
             ${nameColumn} as name,
             sum(spend) as spend,
             sum(revenue) as revenue,
             sum(revenue) - sum(spend) as profit,
             case when sum(spend) = 0 then 0 else sum(revenue) / sum(spend) end as roi,
             case when sum(conversions) = 0 then 0 else sum(spend) / sum(conversions) end as cpa,
             case when sum(impressions) = 0 then 0 else sum(clicks) / sum(impressions) end as ctr,
             sum(conversions) as conversions
      from ${viewName}
      where ${where.join(" and ")}
      group by ${idColumn}, ${nameColumn}
      order by profit asc
      limit 50`;

    const [rows] = await this.pool.execute(sql, params);
    return (rows as Array<Record<string, unknown>>).map((row) => {
      const safeRow = redactValue(row, this.env.auditRedactionSalt) as Record<string, unknown>;
      const spend = Number(safeRow.spend || 0);
      const revenue = Number(safeRow.revenue || 0);
      const roi = Number(safeRow.roi || 0);
      return {
        objectType,
        objectId: String(safeRow.object_id),
        name: String(safeRow.name),
        spend,
        revenue,
        profit: Number(safeRow.profit || 0),
        roi,
        cpa: Number(safeRow.cpa || 0),
        ctr: Number(safeRow.ctr || 0),
        conversions: Number(safeRow.conversions || 0),
        riskFlags: buildRiskFlags(spend, revenue, roi)
      };
    });
  }
}

function buildRiskFlags(spend: number, revenue: number, roi: number): string[] {
  const flags: string[] = [];
  if (spend > 300 && revenue === 0) flags.push("high_spend_no_revenue");
  if (roi > 0 && roi < 1) flags.push("ROI<1");
  if (spend > 1000 && roi < 0.9) flags.push("high_spend_low_roi");
  return flags;
}
