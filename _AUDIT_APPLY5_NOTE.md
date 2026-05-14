# Audit Apply 5 — AIInventoryForecasting

- **Date:** 2026-05-08
- **Stack:** Node-Express (ESM) + React (Vite). Postgres (`pg`).
- **Source audit:** `/Users/erolakarsu/projects/_AUDIT/reports/batch_04.md` section 36.

## Verified-present (from prior passes)
- All 10 original AI endpoints (recommendations, forecast, restock,
  price-optimization, anomaly-detection, supplier-scoring, trend-analysis,
  stockout-risk).
- `/markdown-timing`, `/supplier-disruption-simulator`, `/multi-warehouse-balancing` (pass 2).
- Pass 4 was a NO-OP (audit's missing AI list already exhausted).
- FE wired in `pages/AdvancedAITools.jsx`.

## Implemented this pass (3)
1. **Automated replenishment workflow (mechanical, non-AI):**
   `routes/replenishment.js` — generate-drafts pulls from existing
   `products` (stock, reorder_level, reorder_quantity, supplier_id,
   unit_cost) and creates draft POs at-risk; status transitions
   `draft → approved → ordered → received → cancelled`. Additive
   `replenishment_orders` table.
2. **Supplier marketplace + RFQ (mechanical, non-AI):**
   `routes/supplierMarketplace.js` — filtered supplier search with
   deterministic suitability score, RFQ create/list, quote submission.
   Additive `supplier_rfqs` + `supplier_rfq_quotes` tables.
3. **ERP / commerce / accounting integration stubs (NEEDS-CREDS):**
   `routes/integrations.js` — SAP, NetSuite, Shopify, QuickBooks; 503
   with explicit env hints. `/status` for FE.

Plus FE: new `pages/Pass5Tools.jsx` (4 tabs) wired into `App.jsx`
at `/pass5-tools` behind `ProtectedRoute`.

## Deferred (non-mechanical)
- Real ERP/POS/accounting integrations (NEEDS-CREDS — see backlog).
- Agentic inventory manager autonomy bounds (NEEDS-PRODUCT-DECISION).

## Smoke test
- `node --check` clean for all 3 new route files and `index.js`.
- All new routes use existing `authenticateToken` middleware.
- Additive schema only.
