import "dotenv/config";

export interface Env {
  apiHost: string;
  apiPort: number;
  webOrigin: string;
  aiDatabaseUrl?: string;
  openaiBaseUrl: string;
  openaiApiKey?: string;
  openaiModel: string;
  auditRedactionSalt: string;
  sstlDb?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
  };
}

function optional(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined;
}

export function loadEnv(): Env {
  const sstlHost = optional(process.env.SSTL_DB_HOST);
  const sstlDb =
    sstlHost && optional(process.env.SSTL_DB_USER) && optional(process.env.SSTL_DB_NAME)
      ? {
          host: sstlHost,
          port: Number(process.env.SSTL_DB_PORT || 3306),
          user: process.env.SSTL_DB_USER!,
          password: process.env.SSTL_DB_PASSWORD || "",
          database: process.env.SSTL_DB_NAME!,
          ssl: process.env.SSTL_DB_SSL === "true"
        }
      : undefined;

  return {
    apiHost: process.env.API_HOST || "0.0.0.0",
    apiPort: Number(process.env.API_PORT || 8787),
    webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173",
    aiDatabaseUrl: optional(process.env.AI_PLATFORM_DATABASE_URL),
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    openaiApiKey: optional(process.env.OPENAI_API_KEY),
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    auditRedactionSalt: process.env.AUDIT_REDACTION_SALT || "local-dev-redaction-salt",
    sstlDb
  };
}
