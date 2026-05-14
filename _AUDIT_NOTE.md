# Audit Apply Notes — AIInventoryForecasting

## Source
`/Users/erolakarsu/projects/_AUDIT/reports/batch_04.md` section 36.

## Original Recommendations (AI Counterparts)
- `/markdown-timing`
- `/supplier-disruption-simulator`
- `/multi-warehouse-balancing`

## Implemented (this pass)
Three endpoints appended to `backend/src/routes/ai.js` (ESM, uses existing `generateAIResponse` and `authenticateToken`):

- `POST /api/ai/markdown-timing` — accepts optional `product_id` (else top-30 by stock); pulls dead-stock signals; returns markdown schedule per product (first markdown days/pct, subsequent steps, minimum acceptable price).
- `POST /api/ai/supplier-disruption-simulator` — requires `supplier_id`; pulls affected products + alternate suppliers; returns impacted SKUs, alternative routing, mitigation actions, expected revenue/margin at risk.
- `POST /api/ai/multi-warehouse-balancing` — accepts optional `product_id`; pulls warehouses + warehouse_inventory if those tables exist (gracefully degrades when absent); returns transfer plan, before/after imbalance scores, stockout-days avoided.

Syntax: `node --check` passes.

## Backlog
- Custom: agentic inventory manager, demand+supply fusion across customer/supplier signals, network optimization (deeper than balancing), supplier reliability scoring, seasonal/promotional planning.
- Non-AI: customer order/sales integration, financial P&L integration, automated replenishment workflow, ERP integrations (SAP, NetSuite).

## Categorization
- MECHANICAL: 3 endpoints (done — exhausts the audit's missing list).
- NEEDS-CREDS: ERP integrations (SAP, NetSuite), POS/sales feeds.
- NEEDS-PRODUCT-DECISION: agent autonomy bounds, replenishment approval policy.

## Apply pass 3 (frontend)

- Stack: Vite + React frontend, Express backend (ESM).
- All three apply-pass-2 AI endpoints (`/ai/markdown-timing`,
  `/ai/supplier-disruption-simulator`, `/ai/multi-warehouse-balancing`)
  are wired in `frontend/src/pages/AdvancedAITools.jsx` (each entry uses
  the matching `endpoint` key).
- Action: **LEFT-AS-IS** — frontend is already wired (idempotence rule).
- No files changed this pass.

## Apply pass 4 (mechanical backlog)

- Action: **NO-OP** — apply pass 2 already exhausted the audit's
  missing-AI-endpoint list (3/3 implemented), and apply pass 3 wired
  all three into `AdvancedAITools.jsx`. Remaining backlog items are
  all NEEDS-CREDS (ERP / SAP / NetSuite, POS/sales feeds) or
  NEEDS-PRODUCT-DECISION (agent autonomy bounds, replenishment
  approval policy).
- No files changed this pass.
