import crypto from "node:crypto";
import type {
  AnalysisScope,
  MetricSnapshot,
  SstlEndpointSnapshot,
  SstlLiveSnapshot,
  SstlReadonlyStatus
} from "@sstl-ai/shared";
import type { Env } from "../env.js";
import { redactValue } from "../security/redact.js";
import type { SstlReadonlyRepository } from "./readonlyRepository.js";

type JsonObject = Record<string, unknown>;

interface EndpointConfig {
  key: string;
  endpoint: string;
  method: "GET" | "POST";
  params?: JsonObject;
}

const LOGIN_PATH = "/api/sstl-sys-backend/sys/user/admin/login";
const TOKEN_TTL_MS = 50 * 60 * 1000;

const liveEndpoints: EndpointConfig[] = [
  { key: "campaign_report", endpoint: "/sstl-sys-backend/sstl/sstl-report/campaign", method: "POST" },
  { key: "adset_report", endpoint: "/sstl-sys-backend/sstl/sstl-report/adset", method: "POST" },
  { key: "keyword_report", endpoint: "/sstl-sys-backend/sstl/sstl-report/term", method: "POST" },
  { key: "material_report", endpoint: "/sstl-sys-backend/sstl/sstl-report-material-report/list", method: "POST" },
  { key: "domain_report", endpoint: "/sstl-sys-backend/sstl/sstl-report/domain", method: "POST" },
  { key: "campaign_entities", endpoint: "/sstl-sys-backend/sstl/sstl-media-campaign/page", method: "POST" },
  { key: "adset_entities", endpoint: "/sstl-sys-backend/sstl/sstl-media-ad-set/page", method: "POST" },
  { key: "media_accounts", endpoint: "/sstl-sys-backend/sstl/sstl-media-account/page", method: "POST" },
  { key: "image_materials", endpoint: "/sstl-sys-backend/sstl/sstl-material/images/page", method: "POST" },
  { key: "video_materials", endpoint: "/sstl-sys-backend/sstl/sstl-material/videos/page", method: "POST" },
  { key: "material_folders", endpoint: "/sstl-sys-backend/sstl/material-folder/tree", method: "GET" }
];

export class SstlHttpReadonlyRepository implements SstlReadonlyRepository {
  private authValue?: string;
  private tokenExpiresAt = 0;

  constructor(private env: Env) {}

  async status(): Promise<SstlReadonlyStatus> {
    await this.login();
    return {
      mode: "http",
      connected: true,
      message: "SSTL HTTP 只读数据源已连接，AI 分析将使用线上实时数据。",
      details: {
        baseUrl: this.safeBaseUrl(),
        pageSize: this.env.sstlHttp!.pageSize,
        maxPages: this.env.sstlHttp!.maxPages,
        writeAccess: false
      }
    };
  }

  async getCampaignMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]> {
    const report = await this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report/campaign", "Campaign", scope, {
        idKeys: ["mediaCampaignId", "campaignId", "id"],
        nameKeys: ["mediaCampaignName", "campaignName", "name"]
      }),
      []
    );
    if (report.length > 0) return report;

    const rows = await this.postAllPages("/sstl-sys-backend/sstl/sstl-media-campaign/page", {});
    return rows.map((row) =>
      toMetricSnapshot(row, {
        objectType: "Campaign",
        idKeys: ["mediaCampaignId", "id"],
        nameKeys: ["mediaCampaignName", "campaignName", "name"]
      })
    );
  }

  async getAdsetMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]> {
    const report = await this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report/adset", "Adset", scope, {
        idKeys: ["mediaAdSetId", "adSetId", "id"],
        nameKeys: ["mediaAdSetName", "adSetName", "name"]
      }),
      []
    );
    if (report.length > 0) return report;

    const rows = await this.postAllPages("/sstl-sys-backend/sstl/sstl-media-ad-set/page", {});
    return rows.map((row) =>
      toMetricSnapshot(row, {
        objectType: "Adset",
        idKeys: ["mediaAdSetId", "id"],
        nameKeys: ["mediaAdSetName", "adSetName", "name"]
      })
    );
  }

  async getKeywordMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]> {
    const termReport = await this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report/term", "Keyword", scope, {
        idKeys: ["term", "keyword", "id"],
        nameKeys: ["term", "keyword", "name"]
      }),
      []
    );
    if (termReport.length > 0) return termReport;

    return this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report/keyword/list", "Keyword", scope, {
        idKeys: ["keywordId", "term", "keyword", "id"],
        nameKeys: ["term", "keyword", "keywordName", "name"]
      }),
      []
    );
  }

  async getMaterialMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]> {
    const report = await this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report-material-report/list", "Material", scope, {
        idKeys: ["materialId", "id"],
        nameKeys: ["materialName", "fileName", "name"]
      }),
      []
    );
    if (report.length > 0) return report;

    const [images, videos] = await Promise.all([
      this.safeMetricRead(() => this.postAllPages("/sstl-sys-backend/sstl/sstl-material/images/page", {}), []),
      this.safeMetricRead(() => this.postAllPages("/sstl-sys-backend/sstl/sstl-material/videos/page", {}), [])
    ]);
    return [...images, ...videos].map((row) =>
      toMetricSnapshot(row, {
        objectType: "Material",
        idKeys: ["materialId", "id"],
        nameKeys: ["materialName", "fileName", "name"]
      })
    );
  }

  async getOfferMetrics(scope: AnalysisScope): Promise<MetricSnapshot[]> {
    return this.safeMetricRead(
      () => this.readReportMetrics("/sstl-sys-backend/sstl/sstl-report/domain", "Offer", scope, {
        idKeys: ["domainId", "domain", "id"],
        nameKeys: ["domain", "domainName", "name"]
      }),
      []
    );
  }

  async getLiveSnapshot(scope: AnalysisScope): Promise<SstlLiveSnapshot> {
    const status = await this.status();
    const [endpoints, campaigns, adsets, keywords, materials, offers] = await Promise.all([
      this.readEndpointSnapshots(scope),
      this.getCampaignMetrics(scope),
      this.getAdsetMetrics(scope),
      this.getKeywordMetrics(scope),
      this.getMaterialMetrics(scope),
      this.getOfferMetrics(scope)
    ]);

    return {
      mode: "http",
      fetchedAt: new Date().toISOString(),
      status,
      endpoints,
      metrics: {
        campaigns,
        adsets,
        keywords,
        materials,
        offers
      }
    };
  }

  private async readEndpointSnapshots(scope: AnalysisScope): Promise<SstlEndpointSnapshot[]> {
    const results: SstlEndpointSnapshot[] = [];
    for (const config of liveEndpoints) {
      try {
        const rows =
          config.method === "GET"
            ? await this.getAllPages(config.endpoint, config.params ?? {})
            : await this.postAllPages(config.endpoint, this.paramsForEndpoint(config.endpoint, scope, config.params));
        const safeRows = redactValue(rows.slice(0, 5), this.env.auditRedactionSalt) as Array<Record<string, unknown>>;
        results.push({
          key: config.key,
          endpoint: config.endpoint,
          method: config.method,
          ok: true,
          recordCount: rows.length,
          total: null,
          fields: Object.keys(rows.find((row) => Object.keys(row).length > 0) ?? {}).sort(),
          sample: safeRows
        });
      } catch (error) {
        results.push({
          key: config.key,
          endpoint: config.endpoint,
          method: config.method,
          ok: false,
          recordCount: 0,
          fields: [],
          sample: [],
          message: error instanceof Error ? error.message.slice(0, 300) : "Unknown SSTL read error"
        });
      }
    }
    return results;
  }

  private async readReportMetrics(
    endpoint: string,
    objectType: string,
    scope: AnalysisScope,
    keys: { idKeys: string[]; nameKeys: string[] }
  ): Promise<MetricSnapshot[]> {
    const rows = await this.postAllPages(endpoint, this.paramsForEndpoint(endpoint, scope));
    return rows.map((row) => toMetricSnapshot(row, { objectType, ...keys }));
  }

  private paramsForEndpoint(endpoint: string, scope: AnalysisScope, extra: JsonObject = {}): JsonObject {
    if (!endpoint.includes("report")) return extra;
    const params: JsonObject = {
      startDate: scope.dateRange.from,
      endDate: scope.dateRange.to,
      ...extra
    };
    if (scope.operatorId) params.userIdList = [scope.operatorId];
    if (scope.campaignId) params.campaignIdList = [scope.campaignId];
    if (scope.materialId) params.materialId = scope.materialId;
    if (scope.businessTag) params.businessTag = scope.businessTag;
    return params;
  }

  private async postAllPages(endpoint: string, params: JsonObject): Promise<JsonObject[]> {
    const rows: JsonObject[] = [];
    let total: number | null = null;
    for (let page = 1; page <= this.env.sstlHttp!.maxPages; page += 1) {
      const payload = await this.requestJson(`/api${endpoint}`, {
        method: "POST",
        body: {
          page,
          pageSize: this.env.sstlHttp!.pageSize,
          params
        }
      });
      const records = getRecords(payload);
      total = getTotal(payload);
      rows.push(...records);
      if (records.length < this.env.sstlHttp!.pageSize) break;
      if (total != null && rows.length >= total) break;
    }
    return rows;
  }

  private async getAllPages(endpoint: string, query: JsonObject): Promise<JsonObject[]> {
    const payload = await this.requestJson(`/api${endpoint}`, {
      method: "GET",
      query
    });
    return getRecords(payload);
  }

  private async safeMetricRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  private async login(): Promise<string> {
    const now = Date.now();
    if (this.authValue && now < this.tokenExpiresAt) return this.authValue;

    const payload = await this.requestJson(
      LOGIN_PATH,
      {
        method: "POST",
        body: {
          userName: this.env.sstlHttp!.username,
          ["pwd"]: crypto.createHash("md5").update(this.env.sstlHttp!.password, "utf8").digest("hex")
        },
        auth: false
      },
      false
    );
    const sessionAuthValue = pickString(payload, ["data.token", "token", "data.accessToken", "accessToken"]);
    if (!sessionAuthValue) {
      throw new Error("SSTL login did not return a token.");
    }
    this.authValue = sessionAuthValue;
    this.tokenExpiresAt = now + TOKEN_TTL_MS;
    return sessionAuthValue;
  }

  private async requestJson(
    pathName: string,
    options: {
      method: "GET" | "POST";
      query?: JsonObject;
      body?: unknown;
      auth?: boolean;
    },
    retry = true
  ): Promise<unknown> {
    const url = new URL(pathName, this.env.sstlHttp!.baseUrl);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "*/*" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.auth !== false) headers.Authorization = `Bearer ${await this.login()}`;

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    const payload = parseJson(text);
    if (response.status === 401 && retry) {
      this.authValue = undefined;
      this.tokenExpiresAt = 0;
      return this.requestJson(pathName, options, false);
    }
    if (!response.ok) {
      throw new Error(`SSTL ${options.method} ${pathName} failed with HTTP ${response.status}: ${safeMessage(payload)}`);
    }
    if (isSstlBusinessError(payload)) {
      throw new Error(`SSTL ${options.method} ${pathName} returned error: ${safeMessage(payload)}`);
    }
    return payload;
  }

  private safeBaseUrl(): string {
    try {
      const url = new URL(this.env.sstlHttp!.baseUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "[invalid-url]";
    }
  }
}

function getRecords(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (!isObject(payload)) return [];
  const candidates = [
    payload.data,
    isObject(payload.data) ? payload.data.rows : undefined,
    isObject(payload.data) ? payload.data.records : undefined,
    payload.result,
    isObject(payload.result) ? payload.result.records : undefined,
    isObject(payload.result) ? payload.result.rows : undefined
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isObject);
  }
  return [];
}

function getTotal(payload: unknown): number | null {
  if (!isObject(payload)) return null;
  const values = [
    payload.totalCount,
    payload.total,
    payload.count,
    isObject(payload.data) ? payload.data.totalCount : undefined,
    isObject(payload.data) ? payload.data.total : undefined,
    isObject(payload.result) ? payload.result.total : undefined
  ];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function toMetricSnapshot(
  row: JsonObject,
  config: {
    objectType: string;
    idKeys: string[];
    nameKeys: string[];
  }
): MetricSnapshot {
  const spend = numberFrom(row, ["mediaCost", "cost", "spend", "todayCost", "cashSpend", "totalCost"]);
  const revenue = numberFrom(row, ["upstreamRevenue", "revenue", "income", "totalRevenue", "estimatedRevenue"]);
  const conversions = numberFrom(row, ["mediaConversion", "conversions", "conversion", "totalConversion"]);
  const ctr = normalizeRate(numberFrom(row, ["ctr", "clickThroughRate"]));
  const cpa = numberFrom(row, ["cpa"]);
  const roi = numberFrom(row, ["roi"]) || (spend > 0 ? revenue / spend : 0);
  const profit = numberFrom(row, ["profit"]) || revenue - spend;
  const objectId = stringFrom(row, config.idKeys) || stringFrom(row, config.nameKeys) || "unknown";
  const name = stringFrom(row, config.nameKeys) || objectId;

  return {
    objectType: config.objectType,
    objectId,
    name,
    spend,
    revenue,
    profit,
    roi,
    cpa: cpa || (conversions > 0 ? spend / conversions : 0),
    ctr,
    conversions,
    riskFlags: buildRiskFlags(spend, revenue, roi, row)
  };
}

function buildRiskFlags(spend: number, revenue: number, roi: number, row: JsonObject): string[] {
  const flags: string[] = [];
  if (spend > 300 && revenue === 0) flags.push("high_spend_no_revenue");
  if (roi > 0 && roi < 1) flags.push("ROI<1");
  if (spend > 1000 && roi < 0.9) flags.push("high_spend_low_roi");
  const status = `${stringFrom(row, ["mediaSourceStatus", "mediaCampaignSourceStatus", "mediaAdSetSourceStatus", "status"])}`.toLowerCase();
  if (status.includes("暂停") || status.includes("disable") || status === "0") flags.push("paused_or_disabled");
  return flags;
}

function numberFrom(row: JsonObject, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === "") continue;
    const number = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function stringFrom(row: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function pickString(payload: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => (isObject(current) ? current[key] : undefined), payload);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isSstlBusinessError(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  const status = Number(payload.status);
  const resultCode = Number(payload.resultCode);
  if (Number.isFinite(status) && status !== 200) return true;
  if (Number.isFinite(resultCode) && resultCode !== 200) return true;
  return false;
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeMessage(payload: unknown): string {
  if (typeof payload === "string") return payload.slice(0, 300);
  if (isObject(payload)) return String(payload.msg || payload.message || JSON.stringify(payload).slice(0, 300));
  return "Unknown response";
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
