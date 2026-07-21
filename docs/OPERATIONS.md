# Governed inventory forecasting operations

The governed workflow connects versioned SKU/location observations, promotions and lead-time assumptions to deterministic forecasts, backtests, draft replenishment proposals, planner overrides, approval, connector export, and measured outcomes. Forecast uncertainty is always returned. A proposal is never an order: two distinct manager/admin approvals and a ready procurement connector are required before an export request can enter the transactional outbox.

## Lifecycle

1. Copy `.env.example` to an untracked runtime environment and replace placeholders through a secret manager.
2. Run `./scripts/bootstrap.sh` to install lockfiles. It never changes database state.
3. Back up and review the target, then run `ALLOW_SCHEMA_MUTATION=yes DATABASE_URL=... ./scripts/migrate.sh`.
4. Optional sample data is isolated behind `ALLOW_DEVELOPMENT_SEED=yes ./scripts/seed-development.sh` and is forbidden in production.
5. Run `./start.sh`. It refuses missing dependencies/configuration, weak JWT secrets, and occupied ports. It never installs packages, starts PostgreSQL, creates a database, migrates, seeds, or kills another process.

Import-time schema creation was removed from the API. Generated `gap-*` routes are intentionally not mounted; see `docs/QUARANTINED_GENERATED_GAPS.md`.

## Integrations and reconciliation

ERP, WMS, POS, e-commerce, procurement, promotion, weather/event, and planning adapters fail closed unless explicitly enabled with a URL and runtime token. Workers must claim outbox records, use bounded retries, dead-letter exhausted deliveries, record sanitized failures, and reconcile exports back to authoritative order identifiers. Mock data must never be substituted when an adapter is unavailable.

## Release gates still external

- Contract tests against authorized provider sandboxes and reconciliation fixtures.
- Historical backtests by SKU, location, and horizon; agreed thresholds for bias, WMAPE, interval coverage, stockouts, waste, lead-time error, drift, and override value.
- Migration/rollback and backup/restore rehearsals, security/load testing, incident exercises, and production observability.
- Planner, procurement, finance, security, privacy, and data-owner acceptance. Local source and tests cannot satisfy these gates.
