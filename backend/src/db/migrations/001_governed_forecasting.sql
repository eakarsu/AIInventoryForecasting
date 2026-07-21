-- Additive governed forecasting schema. Apply explicitly; never from application startup.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('viewer','analyst','planner','manager','admin')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS inventory_observations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  source_system TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  observation_date DATE NOT NULL,
  demand NUMERIC NOT NULL CHECK (demand >= 0),
  on_hand NUMERIC NOT NULL CHECK (on_hand >= 0),
  lead_time_days NUMERIC NOT NULL CHECK (lead_time_days >= 0),
  promotion_uplift NUMERIC,
  source_version TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_system, source_record_id, source_version)
);
CREATE INDEX IF NOT EXISTS inventory_observation_series_idx ON inventory_observations(tenant_id, sku, location, observation_date);

CREATE TABLE IF NOT EXISTS forecast_dataset_versions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  digest CHAR(64) NOT NULL,
  source_watermarks JSONB NOT NULL,
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, digest)
);

CREATE TABLE IF NOT EXISTS forecast_model_versions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  artifact_digest CHAR(64) NOT NULL,
  evaluation_status TEXT NOT NULL DEFAULT 'pending' CHECK (evaluation_status IN ('pending','accepted','rejected','retired')),
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, version)
);

CREATE TABLE IF NOT EXISTS forecast_runs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  idempotency_key TEXT NOT NULL,
  dataset_digest CHAR(64) NOT NULL,
  model_version TEXT NOT NULL,
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days BETWEEN 1 AND 365),
  assumptions JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS forecast_points (
  run_id BIGINT NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  horizon INTEGER NOT NULL,
  expected NUMERIC NOT NULL CHECK (expected >= 0),
  lower_bound NUMERIC NOT NULL CHECK (lower_bound >= 0),
  upper_bound NUMERIC NOT NULL CHECK (upper_bound >= lower_bound),
  PRIMARY KEY (run_id, horizon)
);

CREATE TABLE IF NOT EXISTS forecast_backtests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  horizon INTEGER NOT NULL,
  dataset_digest CHAR(64) NOT NULL,
  model_version TEXT NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replenishment_proposals (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  forecast_run_id BIGINT NOT NULL REFERENCES forecast_runs(id),
  sku TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','exported','measured','cancelled')),
  revision INTEGER NOT NULL DEFAULT 1,
  uncertainty JSONB NOT NULL,
  rationale JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS replenishment_proposal_queue_idx ON replenishment_proposals(tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS replenishment_approvals (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  proposal_id BIGINT NOT NULL REFERENCES replenishment_proposals(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  evidence_digest CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, proposal_id, actor_id)
);

CREATE TABLE IF NOT EXISTS forecast_overrides (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  proposal_id BIGINT NOT NULL REFERENCES replenishment_proposals(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  previous_quantity INTEGER NOT NULL,
  override_quantity INTEGER NOT NULL CHECK (override_quantity >= 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS forecast_outcomes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  proposal_id BIGINT NOT NULL REFERENCES replenishment_proposals(id),
  actual_demand NUMERIC NOT NULL,
  stockout_units NUMERIC NOT NULL DEFAULT 0,
  waste_units NUMERIC NOT NULL DEFAULT 0,
  actual_lead_time_days NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecast_workflow_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id BIGINT NOT NULL,
  actor_id INTEGER REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_digest CHAR(64),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION prevent_forecast_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'forecast workflow evidence is append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS forecast_workflow_events_append_only ON forecast_workflow_events;
CREATE TRIGGER forecast_workflow_events_append_only BEFORE UPDATE OR DELETE ON forecast_workflow_events
FOR EACH ROW EXECUTE FUNCTION prevent_forecast_event_mutation();

CREATE TABLE IF NOT EXISTS forecast_integration_outbox (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS forecast_outbox_delivery_idx ON forecast_integration_outbox(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS forecast_integration_failures (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  integration TEXT NOT NULL,
  operation TEXT NOT NULL,
  aggregate_id BIGINT,
  retryable BOOLEAN NOT NULL,
  error_code TEXT NOT NULL,
  sanitized_detail TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables previously created as import-time side effects are managed here instead.
CREATE TABLE IF NOT EXISTS ai_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  endpoint TEXT,
  entity_id INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS replenishment_orders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  supplier_id INTEGER,
  order_qty INTEGER,
  unit_cost NUMERIC,
  status TEXT DEFAULT 'draft',
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS supplier_rfqs (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  category TEXT,
  target_qty INTEGER,
  target_unit_cost NUMERIC,
  deadline DATE,
  notes TEXT,
  status TEXT DEFAULT 'open',
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS supplier_rfq_quotes (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER REFERENCES supplier_rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER,
  unit_cost NUMERIC,
  lead_time_days INTEGER,
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
