// Markdown + clearance optimizer balancing dead-stock clearance against margin
// protection.
// Audit: batch_04.md / AIInventoryForecasting / Custom Feature Suggestions #4
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import pool from '../db/connection.js';

const router = express.Router();
router.use(authenticateToken);

function parseJSON(t) { try { const m = t.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (_) {} return { notes: t }; }

// POST /api/markdown-optimizer/recommend { focus_categories?, horizon_days? }
router.post('/recommend', async (req, res) => {
  try {
    const { focus_categories = [], horizon_days = 30 } = req.body || {};

    let deadStock = { rows: [] }, products = { rows: [] };
    try { deadStock = await pool.query(`SELECT * FROM dead_stock ORDER BY aging_days DESC LIMIT 60`); } catch (_) {}
    try {
      products = await pool.query(
        `SELECT id, name, category, price, cost, units_on_hand FROM products
         ${focus_categories.length ? 'WHERE category = ANY($1)' : ''}
         ORDER BY units_on_hand DESC LIMIT 100`,
        focus_categories.length ? [focus_categories] : []
      );
    } catch (_) {}

    const prompt = `You are an inventory markdown + clearance optimizer. Recommend per-SKU markdown depths,
clearance channels, and timing that balance freeing working capital against margin protection. Return STRICT
JSON only.

Horizon days: ${horizon_days}
Dead stock candidates: ${JSON.stringify(deadStock.rows.slice(0, 30))}
Slow-moving products (sample): ${JSON.stringify(products.rows.slice(0, 30))}

Return JSON:
{
  "summary": "...",
  "recommendations": [
    { "product_id": 0, "current_price": 0, "recommended_markdown_pct": 0, "new_price": 0, "channel": "store|outlet|liquidator|donation|bundle", "expected_sell_through_days": 0, "expected_recovery_pct_of_cost": 0, "margin_impact_usd": 0 }
  ],
  "bundling_opportunities": [{ "skus": ["..."], "bundle_price": 0, "rationale": "string" }],
  "total_capital_freed_estimate_usd": 0,
  "warnings": ["..."],
  "disclaimer": "Markdown plan advisory; merch lead approval required."
}`;

    const raw = await generateAIResponse(prompt);
    const text = typeof raw === 'string' ? raw : (raw?.content || JSON.stringify(raw));
    res.json({ horizon_days, recommendations: parseJSON(text) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dead-stock', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, product_id, aging_days, value_usd FROM dead_stock ORDER BY aging_days DESC LIMIT 50`
    ).catch(() => ({ rows: [] }));
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
