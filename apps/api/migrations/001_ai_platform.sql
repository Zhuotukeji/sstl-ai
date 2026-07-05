CREATE TABLE IF NOT EXISTS ai_objects (
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_objects_type_updated ON ai_objects (object_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_objects_payload_gin ON ai_objects USING GIN (payload);

CREATE TABLE IF NOT EXISTS ai_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  module TEXT NOT NULL,
  event_type TEXT NOT NULL,
  skill_id TEXT NULL,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_scope JSONB NULL,
  output_summary TEXT NOT NULL,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_model_usage (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  module TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
