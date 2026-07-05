import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  Megaphone,
  MessageSquareText,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  TestTube2,
  WalletCards
} from "lucide-react";
import type {
  AIAuditLog,
  AIImprovementSuggestion,
  AIKnowledgeItem,
  AIModelUsage,
  AISkill,
  AISkillDraft,
  DashboardSummary
} from "@sstl-ai/shared";
import { api } from "./api";

type PageKey =
  | "dashboard"
  | "chat"
  | "analysis"
  | "operator"
  | "bidding"
  | "creative"
  | "skills"
  | "drafts"
  | "skillReview"
  | "skillTest"
  | "knowledge"
  | "knowledgeReview"
  | "sop"
  | "review"
  | "tasks"
  | "cost"
  | "audit";

const nav = [
  { key: "dashboard", label: "AI 控制台", icon: Gauge },
  { key: "chat", label: "AI 对话助手", icon: MessageSquareText },
  { key: "analysis", label: "AI 数据分析", icon: BarChart3 },
  { key: "operator", label: "投手经营分析", icon: Activity },
  { key: "bidding", label: "智能投放助手", icon: Megaphone },
  { key: "creative", label: "素材制作助手", icon: Sparkles },
  { key: "skills", label: "Skill Registry", icon: GitBranch },
  { key: "drafts", label: "Skill 草稿", icon: FileText },
  { key: "skillReview", label: "Skill 审核", icon: ShieldCheck },
  { key: "skillTest", label: "Skill 测试", icon: TestTube2 },
  { key: "knowledge", label: "知识库", icon: BookOpen },
  { key: "knowledgeReview", label: "知识审核", icon: CheckCircle2 },
  { key: "sop", label: "案例/SOP 库", icon: ClipboardList },
  { key: "review", label: "AI 复盘中心", icon: BrainCircuit },
  { key: "tasks", label: "AI 任务中心", icon: Layers3 },
  { key: "cost", label: "模型与成本", icon: WalletCards },
  { key: "audit", label: "AI 审计日志", icon: Database }
] as const;

export function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [toast, setToast] = useState("");
  const [dashboard, setDashboard] = useState<(DashboardSummary & { recentAudit: AIAuditLog[] })>();
  const [knowledge, setKnowledge] = useState<AIKnowledgeItem[]>([]);
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [drafts, setDrafts] = useState<AISkillDraft[]>([]);
  const [improvements, setImprovements] = useState<AIImprovementSuggestion[]>([]);
  const [audit, setAudit] = useState<AIAuditLog[]>([]);
  const [usage, setUsage] = useState<AIModelUsage[]>([]);
  const [modal, setModal] = useState<{ title: string; content: unknown }>();
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => nav.find((item) => item.key === page)?.label ?? "AI 中台", [page]);

  async function load() {
    setLoading(true);
    try {
      const [dashboardData, knowledgeData, skillsData, draftData, improvementData, auditData, usageData] = await Promise.all([
        api.dashboard(),
        api.knowledge(),
        api.skills(),
        api.drafts(),
        api.improvements(),
        api.audit(),
        api.usage()
      ]);
      setDashboard(dashboardData);
      setKnowledge(knowledgeData);
      setSkills(skillsData);
      setDrafts(draftData);
      setImprovements(improvementData);
      setAudit(auditData);
      setUsage(usageData);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function runAction<T>(message: string, action: () => Promise<T>, title?: string) {
    try {
      const result = await action();
      if (title) setModal({ title, content: result });
      showToast(message);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败");
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrainCircuit size={24} />
          <div>
            <strong>SSTL AI</strong>
            <span>自我复盘中台</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key as PageKey)}>
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>知识库 + Skill Registry + Router + Context Builder + Dry-run + 复盘闭环</p>
          </div>
          <div className="actions">
            <button onClick={() => void runAction("只读数据源状态已刷新", api.sstlStatus, "SSTL 只读数据源")}>
              <Database size={16} /> 数据源
            </button>
            <button onClick={() => void load()} disabled={loading}>
              <Activity size={16} /> 刷新
            </button>
          </div>
        </header>
        {renderPage()}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
      {modal ? (
        <div className="overlay" onClick={() => setModal(undefined)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>{modal.title}</h2>
              <button onClick={() => setModal(undefined)}>关闭</button>
            </header>
            <pre>{JSON.stringify(modal.content, null, 2)}</pre>
          </section>
        </div>
      ) : null}
    </div>
  );

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard data={dashboard} audit={audit} improvements={improvements} />;
      case "chat":
        return <AssistantPanel onRun={(question) => runAction("AI 分析完成", () => api.analyze(question), "AI 对话分析结果")} />;
      case "analysis":
        return <AnalysisPanel onAnalyze={() => runAction("结构化分析已生成", () => api.analyze("分析最近 7 天为什么亏损"), "AI 数据分析结果")} />;
      case "operator":
        return <OperatorPanel onAnalyze={() => runAction("投手经营分析已生成", () => api.analyze("分析投手 op-001 的经营表现和风险"), "投手经营分析")} />;
      case "bidding":
        return <DryRunPanel onDryRun={() => runAction("Dry-run 已生成，未执行真实动作", () => api.dryRun("暂停 ROI<0.8 且高消耗 Campaign"), "智能投放 Dry-run")} />;
      case "creative":
        return <CreativePanel onBrief={(keyword) => runAction("素材 Brief 已生成", () => api.brief(keyword), "素材制作 Brief")} />;
      case "skills":
        return <SkillTable skills={skills} />;
      case "drafts":
        return <DraftPanel drafts={drafts} onGenerate={(prompt) => runAction("Skill 草稿已生成", () => api.generateDraft(prompt))} />;
      case "skillReview":
        return <DraftReview drafts={drafts} onReview={(id, status) => runAction("Skill 审核状态已更新", () => api.reviewSkill(id, status))} />;
      case "skillTest":
        return <SkillTest onRun={(question) => runAction("Skill 测试完成", () => api.route(question), "Skill 路由测试")} />;
      case "knowledge":
        return <KnowledgePanel knowledge={knowledge} onCreate={() => runAction("知识草稿已创建", () => api.createKnowledge({ title: "新投放复盘知识", type: "case", content: "补充一次投放复盘结论。", businessTags: ["搜索套利"], platforms: ["TikTok"], applicableObjects: ["Campaign"] }))} />;
      case "knowledgeReview":
        return <KnowledgeReview knowledge={knowledge} onReview={(id, status) => runAction("知识审核状态已更新", () => api.reviewKnowledge(id, status))} />;
      case "sop":
        return <SopPanel knowledge={knowledge} />;
      case "review":
        return <ImprovementPanel improvements={improvements} onAdopt={(id) => runAction("已采纳为改进草稿", () => api.adoptImprovement(id))} />;
      case "tasks":
        return <TasksPanel />;
      case "cost":
        return <UsagePanel usage={usage} />;
      case "audit":
        return <AuditPanel audit={audit} />;
      default:
        return null;
    }
  }
}

function Dashboard({ data, audit, improvements }: { data?: DashboardSummary & { recentAudit: AIAuditLog[] }; audit: AIAuditLog[]; improvements: AIImprovementSuggestion[] }) {
  const cards: Array<[string, unknown]> = [
    ["利润风险", data?.profitRiskCount],
    ["低 ROI 对象", data?.lowRoiObjects],
    ["高消耗无收益", data?.highSpendNoConversion],
    ["素材衰退", data?.materialFatigue],
    ["合规风险", data?.complianceRisks],
    ["待改进项", data?.improvementsOpen]
  ];
  return (
    <div className="page-grid">
      <section className="metric-grid">
        {cards.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{String(value ?? "-")}</strong>
          </article>
        ))}
      </section>
      <section className="panel span2">
        <h2>AI 能力健康度</h2>
        <div className="progress-row"><span>建议采纳率</span><progress value={Number(data?.suggestionAdoptionRate ?? 0)} max={1} /></div>
        <div className="progress-row"><span>知识命中率</span><progress value={Number(data?.knowledgeHitRate ?? 0)} max={1} /></div>
        <div className="progress-row"><span>Skill 路由准确率</span><progress value={Number(data?.skillRouteAccuracy ?? 0)} max={1} /></div>
      </section>
      <Table title="待处理改进项" rows={improvements} columns={["suggestionType", "target", "problemSummary", "status"]} />
      <Table title="最近审计" rows={audit} columns={["module", "eventType", "outputSummary", "riskLevel", "createdAt"]} />
    </div>
  );
}

function AssistantPanel({ onRun }: { onRun: (question: string) => void }) {
  const [question, setQuestion] = useState("昨天为什么亏损？请拆 Campaign、素材、关键词并给出 Dry-run 建议");
  return (
    <section className="panel">
      <h2>自然语言分析入口</h2>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
      <button className="primary" onClick={() => onRun(question)}>
        <PlayCircle size={16} /> 调用 Router + Skill + Context Builder
      </button>
    </section>
  );
}

function AnalysisPanel({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <section className="panel">
      <h2>结构化数据分析</h2>
      <div className="filters">
        <input defaultValue="2026-07-01 ~ 2026-07-05" />
        <input defaultValue="负责人：全部" />
        <input defaultValue="业务标签：搜索套利" />
        <input defaultValue="维度：Campaign + Keyword + Material" />
      </div>
      <button className="primary" onClick={onAnalyze}>
        <BarChart3 size={16} /> 生成分析结论
      </button>
    </section>
  );
}

function OperatorPanel({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <section className="panel">
      <h2>投手/负责人经营分析</h2>
      <div className="score-board">
        <div><strong>op-001</strong><span>ROI 0.92 / 待优化</span></div>
        <div><strong>op-008</strong><span>ROI 1.42 / 可放量</span></div>
        <div><strong>leader-US</strong><span>利润 +$1,840 / 合规风险 2</span></div>
      </div>
      <button className="primary" onClick={onAnalyze}>
        <Activity size={16} /> 生成个人经营诊断
      </button>
    </section>
  );
}

function DryRunPanel({ onDryRun }: { onDryRun: () => void }) {
  return (
    <section className="panel danger-zone">
      <h2>智能投放助手</h2>
      <p>高风险动作只生成 Dry-run，必须人工确认后才允许进入现有投放中台执行。</p>
      <button className="danger" onClick={onDryRun}>
        <ShieldCheck size={16} /> 生成暂停/降预算 Dry-run
      </button>
    </section>
  );
}

function CreativePanel({ onBrief }: { onBrief: (keyword: string) => void }) {
  const [keyword, setKeyword] = useState("loan search");
  return (
    <section className="panel">
      <h2>素材制作助手</h2>
      <div className="filters">
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <input defaultValue="国家：US" />
        <input defaultValue="素材类型：UGC + 搜索结果页" />
      </div>
      <button className="primary" onClick={() => onBrief(keyword)}>
        <Sparkles size={16} /> 生成 Brief/脚本
      </button>
    </section>
  );
}

function SkillTable({ skills }: { skills: AISkill[] }) {
  return <Table title="已发布 Skill" rows={skills} columns={["code", "name", "intent", "riskLevel", "status", "score", "updatedAt"]} />;
}

function DraftPanel({ drafts, onGenerate }: { drafts: AISkillDraft[]; onGenerate: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("根据 TONIC declined 状态生成 Offer 暂停 dry-run");
  return (
    <section className="panel">
      <h2>Skill 草稿生成</h2>
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <button className="primary" onClick={() => onGenerate(prompt)}>
        <FileText size={16} /> 生成 Skill 草稿
      </button>
      <SimpleTable rows={drafts} columns={["id", "prompt", "reviewStatus", "createdBy", "createdAt"]} />
    </section>
  );
}

function DraftReview({ drafts, onReview }: { drafts: AISkillDraft[]; onReview: (id: string, status: "approved" | "rejected") => void }) {
  return (
    <section className="panel">
      <h2>Skill 审核</h2>
      {drafts.map((draft) => (
        <div className="review-row" key={draft.id}>
          <div><strong>{draft.prompt}</strong><span>{draft.reviewStatus}</span></div>
          <button onClick={() => onReview(draft.id, "approved")}>通过</button>
          <button onClick={() => onReview(draft.id, "rejected")}>驳回</button>
        </div>
      ))}
    </section>
  );
}

function SkillTest({ onRun }: { onRun: (question: string) => void }) {
  const [question, setQuestion] = useState("哪些 Campaign 应该降预算？");
  return (
    <section className="panel">
      <h2>Skill 路由测试</h2>
      <input value={question} onChange={(event) => setQuestion(event.target.value)} />
      <button className="primary" onClick={() => onRun(question)}>
        <GitBranch size={16} /> 测试路由
      </button>
    </section>
  );
}

function KnowledgePanel({ knowledge, onCreate }: { knowledge: AIKnowledgeItem[]; onCreate: () => void }) {
  return (
    <section className="panel">
      <h2>知识库</h2>
      <button className="primary" onClick={onCreate}>
        <BookOpen size={16} /> 新建知识草稿
      </button>
      <SimpleTable rows={knowledge} columns={["title", "type", "status", "vectorStatus", "qualityScore", "updatedAt"]} />
    </section>
  );
}

function KnowledgeReview({ knowledge, onReview }: { knowledge: AIKnowledgeItem[]; onReview: (id: string, status: "approved" | "rejected") => void }) {
  return (
    <section className="panel">
      <h2>知识审核</h2>
      {knowledge.map((item) => (
        <div className="review-row" key={item.id}>
          <div><strong>{item.title}</strong><span>{item.status} / {item.type}</span></div>
          <button onClick={() => onReview(item.id, "approved")}>通过</button>
          <button onClick={() => onReview(item.id, "rejected")}>驳回</button>
        </div>
      ))}
    </section>
  );
}

function SopPanel({ knowledge }: { knowledge: AIKnowledgeItem[] }) {
  return <Table title="案例 / SOP 库" rows={knowledge.filter((item) => item.type === "sop" || item.type === "case")} columns={["title", "type", "businessTags", "platforms", "qualityScore"]} />;
}

function ImprovementPanel({ improvements, onAdopt }: { improvements: AIImprovementSuggestion[]; onAdopt: (id: string) => void }) {
  return (
    <section className="panel">
      <h2>AI 复盘中心</h2>
      {improvements.map((item) => (
        <div className="review-row" key={item.id}>
          <div><strong>{item.problemSummary}</strong><span>{item.suggestionType} {"->"} {item.target}</span></div>
          <button disabled={item.status !== "open"} onClick={() => onAdopt(item.id)}>采纳</button>
        </div>
      ))}
    </section>
  );
}

function TasksPanel() {
  return <Table title="AI 任务中心" rows={[{ task: "每日亏损归因", status: "completed", owner: "AI Ops" }, { task: "知识向量索引", status: "running", owner: "System" }]} columns={["task", "status", "owner"]} />;
}

function UsagePanel({ usage }: { usage: AIModelUsage[] }) {
  return <Table title="模型与成本" rows={usage} columns={["model", "module", "inputTokens", "outputTokens", "costUsd", "createdAt"]} />;
}

function AuditPanel({ audit }: { audit: AIAuditLog[] }) {
  return <Table title="AI 审计日志" rows={audit} columns={["actorName", "module", "eventType", "outputSummary", "riskLevel", "createdAt"]} />;
}

function Table({ title, rows, columns }: { title: string; rows: object[]; columns: string[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <SimpleTable rows={rows} columns={columns} />
    </section>
  );
}

function SimpleTable({ rows, columns }: { rows: object[]; columns: string[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(getCell(row, "id") ?? index)}>
              {columns.map((column) => (
                <td key={column}>{formatCell(getCell(row, column))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "-");
}

function getCell(row: object, column: string): unknown {
  return (row as Record<string, unknown>)[column];
}
