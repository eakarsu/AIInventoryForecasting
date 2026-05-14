// Multi-warehouse network optimization recommending transfers and
// diversification.
// Audit: batch_04.md / AIInventoryForecasting / Custom Feature Suggestions #3
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import pool from '../db/connection.js';

const router = express.Router();
router.use(authenticateToken);

function parseJSON(t) { try { const m = t.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (_) {} return { notes: t }; }

// POST /api/multi-warehouse-balancer/plan { horizon_days? }
router.post('/plan', async (req, res) => {
  try {
    const { horizon_days = 14 } = req.body || {};

    let onHandByWh = { rows: [] }, forecasts = { rows: [] }, shipments = { rows: [] };
    try {
      onHandByWh = await pool.query(
        `SELECT warehouse_id, product_id, units_on_hand FROM warehouse_inventory LIMIT 200`
      );
    } catch (_) {}
    try {
      forecasts = await pool.query(
        `SELECT product_id, warehouse_id, expected_units, period_end FROM forecasts
         WHERE period_end > NOW() AND period_end < NOW() + ($1 || ' days')::interval LIMIT 200`,
        [String(horizon_days)]
      );
    } catch (_) {}
    try {
      shipments = await pool.query(
        `SELECT * FROM shipment_tracker ORDER BY created_at DESC LIMIT 50`
      );
    } catch (_) {}

    const prompt = `You are a multi-warehouse network balancer. Identify imbalances (one site overstocked,
another short of forecast) and recommend stock transfers, ETA-aware. Return STRICT JSON only.

Horizon (days): ${horizon_days}
On-hand by warehouse: ${JSON.stringify(onHandByWh.rows.slice(0, 60))}
Forecasts: ${JSON.stringify(forecasts.rows.slice(0, 60))}
Recent shipments: ${JSON.stringify(shipments.rows.slice(0, 20))}

Return JSON:
{
  "summary": "...",
  "transfer_recommendations": [
    { "product_id": 0, "from_warehouse_id": 0, "to_warehouse_id": 0, "units": 0, "rationale": "string", "expected_savings_usd": 0, "transit_days_estimate": 0 }
  ],
  "diversification_recommendations": [{ "product_id": 0, "concentration_warning": "string", "action": "string" }],
  "warehouse_utilization": [{ "warehouse_id": 0, "utilization_pct": 0 }],
  "disclaimer": "Network plan advisory; review with logistics team."
}`;

    const raw = await generateAIResponse(prompt);
    const text = typeof raw === 'string' ? raw : (raw?.content || JSON.stringify(raw));
    res.json({ horizon_days, plan: parseJSON(text) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/warehouses', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT warehouse_id FROM warehouse_inventory LIMIT 50`
    ).catch(() => ({ rows: [] }));
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
