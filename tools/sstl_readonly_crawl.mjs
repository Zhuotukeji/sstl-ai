import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SSTL_BASE_URL || "https://sstl.sonicmobi.com";
const USERNAME = process.env.SSTL_USERNAME;
const PASSWORD = process.env.SSTL_PASSWORD;
const PAGE_SIZE = Number(process.env.SSTL_PAGE_SIZE || 500);
const MAX_PAGES = Number(process.env.SSTL_MAX_PAGES || 1000);
const OUT_ROOT = process.env.SSTL_OUT_ROOT || "sstl_capture";

if (!USERNAME || !PASSWORD) {
  console.error("Missing SSTL_USERNAME or SSTL_PASSWORD environment variable.");
  process.exit(1);
}

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(OUT_ROOT, stamp);
const rawDir = path.join(outDir, "raw");
const assetDir = path.join(outDir, "assets");

const unsafePathParts = [
  "/add",
  "/edit",
  "/update",
  "/delete",
  "/remove",
  "/save",
  "/sync",
  "/upload",
  "/batch",
  "/changeStatus",
  "/editStatus",
  "/disable",
  "/grant",
  "/revoke",
  "/move",
  "/rename",
  "/copy",
  "/cancel",
  "/public",
  "/import",
  "/set-default",
  "/editPassWord",
];

function md5(input) {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
}

function safeName(value) {
  return value
    .replace(/^\/+/, "")
    .replace(/\$\{[^}]+\}/g, "param")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

async function ensureDirs() {
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(assetDir, { recursive: true });
}

async function requestJson(urlPath, options = {}) {
  const url = new URL(urlPath, BASE_URL);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }

  const headers = {
    Accept: "*/*",
    ...(options.headers || {}),
  };

  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  let payload = text;
  if (contentType.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message = typeof payload === "string" ? payload.slice(0, 500) : JSON.stringify(payload).slice(0, 500);
    throw new Error(`HTTP ${res.status}: ${message}`);
  }

  return payload;
}

async function fetchText(urlPath) {
  const url = new URL(urlPath, BASE_URL);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.href}`);
  return res.text();
}

async function login() {
  const payload = await requestJson("/api/sstl-sys-backend/sys/user/admin/login", {
    method: "POST",
    body: { userName: USERNAME, pwd: md5(PASSWORD) },
  });
  const token = payload?.data?.token;
  if (!token) {
    throw new Error(`Login did not return token: ${JSON.stringify(payload).slice(0, 500)}`);
  }
  return { token, loginShape: redactToken(payload) };
}

function redactToken(value) {
  if (Array.isArray(value)) return value.map(redactToken);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = key.toLowerCase().includes("token") ? "[redacted]" : redactToken(val);
    }
    return out;
  }
  return value;
}

async function discoverAssets() {
  const html = await fetchText("/");
  await fs.writeFile(path.join(assetDir, "index.html"), html, "utf8");

  const queue = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|json|ico))"/g), (m) => m[1]);
  const seen = new Set();
  const jsAssets = [];

  while (queue.length) {
    const asset = queue.shift();
    if (!asset || seen.has(asset)) continue;
    seen.add(asset);

    const text = await fetchText(asset);
    const localPath = path.join(assetDir, safeName(asset));
    await fs.writeFile(localPath, text, "utf8");

    if (asset.endsWith(".js")) {
      jsAssets.push({ asset, text });
      for (const match of text.matchAll(/["']([^"']+\.(?:js|css))["']/g)) {
        const next = match[1].startsWith("assets/")
          ? `/${match[1]}`
          : match[1].startsWith("./")
            ? `/assets/${match[1].slice(2)}`
            : match[1].startsWith("/")
              ? match[1]
              : null;
        if (next && !seen.has(next)) queue.push(next);
      }
      for (const match of text.matchAll(/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)) {
        const next = `/${match[0]}`;
        if (!seen.has(next)) queue.push(next);
      }
    }
  }

  return { html, jsAssets };
}

function extractCatalog(jsAssets) {
  const endpoints = new Map();
  const routes = [];

  for (const { asset, text } of jsAssets) {
    for (const match of text.matchAll(/nt\((`[^`]+`|"[^"]+"|'[^']+')\s*,\s*["']([A-Z]+)["']/g)) {
      const literal = match[1].slice(1, -1);
      const endpoint = literal.replace(/\$\{[^}]+\}/g, "${param}");
      if (!endpoint.includes("/sstl-sys-backend/")) continue;
      const current = endpoints.get(endpoint) || { endpoint, methods: new Set(), assets: new Set() };
      current.methods.add(match[2].toUpperCase());
      current.assets.add(asset);
      endpoints.set(endpoint, current);
    }

    for (const match of text.matchAll(/path:"([^"]+)"(?:,title:"([^"]+)")?(?:,code:"([^"]+)")?/g)) {
      routes.push({
        path: match[1],
        title: match[2] || "",
        code: match[3] || "",
        asset,
      });
    }
  }

  const endpointList = Array.from(endpoints.values())
    .map((item) => ({
      endpoint: item.endpoint,
      methods: Array.from(item.methods).sort(),
      assets: Array.from(item.assets).sort(),
    }))
    .sort((a, b) => a.endpoint.localeCompare(b.endpoint));

  return { endpoints: endpointList, routes };
}

function isSafeReadEndpoint(endpoint, method) {
  if (endpoint.includes("${param}")) return false;
  if (unsafePathParts.some((part) => endpoint.includes(part))) return false;
  if (endpoint.includes("/export")) return false;
  if (method === "GET") return true;

  return [
    "/page",
    "/list",
    "/dropdown",
    "/all",
    "/chart",
    "/report/",
    "/summary",
    "/trend",
    "/category-dist",
    "/cost-threshold",
    "/designers",
    "/designer-summary",
    "/roi-dist",
    "/roi-rank",
    "/overview",
    "/daily",
    "/association-analysis",
    "/recent-logs",
    "/stats",
  ].some((part) => endpoint.includes(part));
}

function todayLocal() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.result?.records)) return payload.result.records;
  return [];
}

function getTotal(payload) {
  return (
    payload?.totalCount ??
    payload?.total ??
    payload?.data?.totalCount ??
    payload?.data?.total ??
    payload?.data?.count ??
    payload?.result?.total ??
    null
  );
}

function responseLooksUsable(payload) {
  if (payload == null) return false;
  if (typeof payload !== "object") return true;
  if (payload.status === 200 || payload.resultCode === 200) return true;
  if (payload.data !== undefined || payload.result !== undefined) return true;
  return false;
}

function postPatterns(endpoint) {
  const today = todayLocal();
  const basePage = { page: 1, pageSize: PAGE_SIZE, params: {} };
  const barePage = { page: 1, pageSize: PAGE_SIZE };
  const currentPage = { current: 1, pageSize: PAGE_SIZE };
  const oldPage = { page: 1, rows: PAGE_SIZE };
  const reportPage = { ...basePage, params: { startDate: today, endDate: today, startTime: today, endTime: today } };
  const patterns = [];

  if (endpoint.includes("/report/")) {
    patterns.push(basePage, reportPage, barePage, { params: {} }, {});
  } else if (endpoint.includes("/page")) {
    patterns.push(basePage, barePage, oldPage, currentPage, {});
  } else if (endpoint.includes("/list")) {
    patterns.push(basePage, barePage, { params: {} }, {});
  } else {
    patterns.push({}, basePage, { params: {} });
  }

  return patterns;
}

function getPatterns(endpoint) {
  if (endpoint.includes("getUserMenuAll")) {
    return [
      { parentId: 1, isUserMenuTree: false },
      {},
    ];
  }
  return [
    {},
    { page: 1, rows: PAGE_SIZE },
    { page: 1, pageSize: PAGE_SIZE },
  ];
}

function nextPageBody(body, page) {
  const next = structuredClone(body);
  if ("page" in next) next.page = page;
  else if ("current" in next) next.current = page;
  else next.page = page;
  return next;
}

function nextPageQuery(query, page) {
  const next = { ...query };
  if ("current" in next) next.current = page;
  else next.page = page;
  return next;
}

async function callEndpoint(endpoint, method, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const apiPath = `/api${endpoint}`;
  const attempts = method === "GET" ? getPatterns(endpoint) : postPatterns(endpoint);
  const errors = [];

  for (const pattern of attempts) {
    try {
      const first = await requestJson(apiPath, {
        method,
        headers,
        ...(method === "GET" ? { query: pattern } : { body: pattern }),
      });
      if (!responseLooksUsable(first)) {
        errors.push({ pattern, error: `Unusable response: ${JSON.stringify(first).slice(0, 300)}` });
        continue;
      }

      const records = getRecords(first);
      const total = getTotal(first);
      const pages = [first];

      if (records.length && total && Number(total) > records.length) {
        const totalPages = Math.min(Math.ceil(Number(total) / PAGE_SIZE), MAX_PAGES);
        for (let page = 2; page <= totalPages; page += 1) {
          const payload = await requestJson(apiPath, {
            method,
            headers,
            ...(method === "GET" ? { query: nextPageQuery(pattern, page) } : { body: nextPageBody(pattern, page) }),
          });
          pages.push(payload);
        }
      }

      return {
        ok: true,
        endpoint,
        method,
        pattern,
        pages,
        recordCount: pages.reduce((sum, item) => sum + getRecords(item).length, 0),
        total,
      };
    } catch (error) {
      errors.push({ pattern, error: error.message });
    }
  }

  return { ok: false, endpoint, method, errors };
}

function sampleFields(result) {
  const firstRecord = result.pages?.map(getRecords).flat().find(Boolean);
  if (firstRecord && typeof firstRecord === "object") return Object.keys(firstRecord).sort();
  const firstPage = result.pages?.[0];
  if (firstPage && typeof firstPage === "object") return Object.keys(firstPage).sort();
  return [];
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  await ensureDirs();
  const { token, loginShape } = await login();
  await writeJson(path.join(outDir, "login_shape.redacted.json"), loginShape);

  const { jsAssets } = await discoverAssets();
  const catalog = extractCatalog(jsAssets);
  await writeJson(path.join(outDir, "endpoints.catalog.json"), catalog.endpoints);
  await writeJson(path.join(outDir, "routes.catalog.json"), catalog.routes);

  const menuResult = await callEndpoint("/sstl-sys-backend/sys/menu/getUserMenuAll", "GET", token);
  await writeJson(path.join(outDir, "menus.raw.json"), redactToken(menuResult));

  const candidates = catalog.endpoints.flatMap((entry) =>
    entry.methods
      .filter((method) => isSafeReadEndpoint(entry.endpoint, method))
      .map((method) => ({ endpoint: entry.endpoint, method }))
  );

  const results = [];
  for (const [index, candidate] of candidates.entries()) {
    process.stdout.write(`[${index + 1}/${candidates.length}] ${candidate.method} ${candidate.endpoint} ... `);
    const result = await callEndpoint(candidate.endpoint, candidate.method, token);
    results.push(result);
    const file = path.join(rawDir, `${safeName(`${candidate.method}_${candidate.endpoint}`)}.json`);
    await writeJson(file, redactToken(result));
    process.stdout.write(result.ok ? `ok (${result.recordCount} records)\n` : "failed\n");
  }

  const summary = {
    baseUrl: BASE_URL,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    assetCount: jsAssets.length,
    endpointCount: catalog.endpoints.length,
    safeCandidateCount: candidates.length,
    successCount: results.filter((item) => item.ok).length,
    failureCount: results.filter((item) => !item.ok).length,
    successes: results
      .filter((item) => item.ok)
      .map((item) => ({
        endpoint: item.endpoint,
        method: item.method,
        recordCount: item.recordCount,
        total: item.total,
        fields: sampleFields(item),
        file: path.relative(outDir, path.join(rawDir, `${safeName(`${item.method}_${item.endpoint}`)}.json`)),
      })),
    failures: results
      .filter((item) => !item.ok)
      .map((item) => ({
        endpoint: item.endpoint,
        method: item.method,
        errors: item.errors,
      })),
  };
  await writeJson(path.join(outDir, "crawl.summary.json"), summary);

  const md = [
    "# SSTL Read-only Crawl Summary",
    "",
    `- Base URL: ${BASE_URL}`,
    `- Started: ${summary.startedAt}`,
    `- Finished: ${summary.finishedAt}`,
    `- Frontend JS assets discovered: ${summary.assetCount}`,
    `- API endpoints discovered: ${summary.endpointCount}`,
    `- Read-only candidates attempted: ${summary.safeCandidateCount}`,
    `- Successful reads: ${summary.successCount}`,
    `- Failed reads: ${summary.failureCount}`,
    "",
    "## Successful Reads",
    "",
    "| Method | Endpoint | Records | Total | Fields |",
    "| --- | --- | ---: | ---: | --- |",
    ...summary.successes.map(
      (item) =>
        `| ${item.method} | \`${item.endpoint}\` | ${item.recordCount} | ${item.total ?? ""} | ${item.fields
          .slice(0, 12)
          .map((field) => `\`${field}\``)
          .join(", ")} |`
    ),
    "",
    "## Failed Reads",
    "",
    ...summary.failures.map((item) => `- ${item.method} \`${item.endpoint}\`: ${item.errors[0]?.error || "unknown error"}`),
    "",
  ].join("\n");
  await fs.writeFile(path.join(outDir, "SUMMARY.md"), md, "utf8");

  console.log(`\nOutput: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
