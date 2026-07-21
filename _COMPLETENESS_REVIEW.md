# Completeness Review: AIInventoryForecasting

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad inventory forecasting surface (104 source files and 35 route modules), but static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path to connect SKU/location history, promotions, lead times, constraints, forecasts, replenishment proposals, overrides, and outcomes.

## Why it is not complete

- 20 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- The route/page inventory includes `ai`, `analytics`, `custom views`, `dead stock`; these surfaces show breadth but not durable execution against authoritative systems.
- 24 files reference model-provider or chat-completion behavior; generic LLM calls are not a substitute for deterministic domain execution, grounding, or evaluation.
- 50 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No recognizable application test files were found in the inspected tree.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to connect SKU/location history, promotions, lead times, constraints, forecasts, replenishment proposals, overrides, and outcomes.
- 2. Connect ERP/WMS/POS/e-commerce, supplier/procurement, promotion, weather/event, and planning systems; replace seed/demo records with durable synchronized data and explicit failure handling.
- 3. Backtest by SKU/location/horizon; measure bias, uncertainty, stockouts, waste, lead-time error, drift, and override value.
- 4. Version data/models, prevent unapproved orders, expose uncertainty, and keep planners in control.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `backend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `frontend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `backend/src/index.js` — service composition, middleware, and registered routes.
- `backend/src/routes/ai.js` — implemented API surface and domain/AI request handling.
- `backend/src/routes/analytics.js` — implemented API surface and domain/AI request handling.
- `backend/src/routes/auth.js` — implemented API surface and domain/AI request handling.

## Recommended next action

Treat this as a prototype: use ai and analytics to select one narrow inventory forecasting outcome, quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress

- **1 — Implemented locally:** `backend/src/domain/forecastPolicy.js` validates and versions one SKU/location observation series, deterministically produces bounded forecasts from history plus explicit promotion assumptions, converts lead-time demand/uncertainty and inventory/capacity constraints into draft replenishment proposals, preserves planner overrides with reasons, and measures outcomes. `backend/src/routes/governedForecasting.js` persists idempotent runs, points, proposals, approvals, state transitions, overrides, and outcomes with tenant scoping and optimistic revisions.
- **2 — Integration boundary implemented; live synchronization blocked:** migration `001_governed_forecasting.sql` adds durable observations, data/model versions, forecast runs/points, proposal workflow, append-only events, transactional outbox, dead-letter status, and sanitized integration failures. `integrationBoundary.js` makes ERP, WMS, POS, e-commerce, procurement, promotion, weather/event, and planning adapters fail closed unless explicitly enabled with an endpoint and runtime token. Mock/generated gap routes were removed from application mounting and documented in `docs/QUARANTINED_GENERATED_GAPS.md`. Real synchronization and reconciliation remain unclaimed pending provider contracts, credentials, sandboxes, mapping decisions, and authoritative fixtures.
- **3 — Implemented locally; historical acceptance blocked:** the dependency-free backtest policy reports sample size, bias, MAE, WMAPE, prediction-interval coverage, stockout units, waste units, lead-time MAE, demand drift, and measured override value. Metrics are stored by tenant, SKU, location, horizon, dataset digest, and model version. Nine focused tests cover observation validation, versioning, deterministic uncertainty, mixed-series rejection, constrained proposals, backtest metrics, approval/export controls, and integration readiness. Production thresholds and representative historical/seasonal datasets still require planner/data-owner approval.
- **4 — Implemented locally:** dataset digests and source watermarks are immutable evidence; forecast runs require a separately registered and accepted model version. Every proposal exposes lower/upper uncertainty and remains a draft, never an automatic order. Planner overrides are reasoned and auditable; creator self-approval is forbidden; two distinct manager/admin approvals plus a ready procurement connector and evidence digest are required before an export request can enter the outbox. The planner remains in control of review, cancellation, overrides, and outcome measurement.
- **5 — Implemented locally; external acceptance blocked:** authentication no longer accepts query-string tokens or fallback JWT secrets, requires an issuer-bound strong runtime secret, supports scrypt demo credentials while retaining bcrypt compatibility, carries tenant membership roles, defaults to one-hour tokens, disables self-registration, and hides development tokens unless explicitly enabled. Import-time schema creation was removed. `.env.example`, CI, the operations/quarantine documents, explicit lockfile bootstrap/migration/guarded-seed scripts, and a non-destructive `start.sh` define the lifecycle; startup never installs, starts PostgreSQL, creates/migrates/seeds a database, or kills occupied ports. The maintained 9-test policy suite and optimized frontend build pass. Guarded disposable-database initialization plus isolated runtime validation on PostgreSQL/API/UI ports `55574`/`5968`/`5969` recorded `2026-07-20T18:59:06Z AIInventoryForecasting API_VERIFIED startup_login_session_api`, including login and authenticated-session verification. Browser, provider, licensed-dataset, and professional acceptance remain external.
