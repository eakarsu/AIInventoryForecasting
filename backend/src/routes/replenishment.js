/*
 * routes/replenishment.js — Apply pass 5
 *
 * Mechanical automated replenishment workflow. Generates draft purchase orders
 * for products at-risk of stockout (using existing `products`, `suppliers` tables
 * if available). Status transitions: draft -> approved -> ordered -> received.
 *
 * Additive `replenishment_orders` table (CREATE TABLE IF NOT EXISTS).
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS replenishment_orders (
        id SERIAL PRIMARY KEY,
        product_id INTEGER,
        supplier_id INTEGER,
        order_qty INTEGER,
        unit_cost NUMERIC,
        status TEXT DEFAULT 'draft',
        rationale TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
  } catch (e) { console.error('replenishment bootstrap error:', e.message); }
})();

// POST /api/replenishment/generate-drafts — generate draft POs
// Body: { reorder_threshold_pct?: 0..1, lookback_days?: number, dry_run?: bool }
router.post('/generate-drafts', async (req, res) => {
  try {
    const reorderThresholdPct = Math.min(0.95, Math.max(0.05, Number(req.body?.reorder_threshold_pct) || 0.2));
    const dryRun = !!req.body?.dry_run;

    const products = await query(
      `SELECT id, name, COALESCE(stock_quantity, 0) AS stock, COALESCE(reorder_level, 0) AS reorder_level,
              COALESCE(reorder_quantity, 0) AS reorder_qty, COALESCE(supplier_id, 0) AS supplier_id, COALESCE(unit_cost, 0) AS unit_cost
         FROM products`
    ).catch(() => ({ rows: [] }));

    const drafts = [];
    for (const p of products.rows) {
      const stock = Number(p.stock || 0);
      const reorderLevel = Number(p.reorder_level || 0);
      // If stock has dropped to threshold% of reorder_level (or below), generate a draft.
      if (reorderLevel > 0 && stock <= Math.ceil(reorderLevel * (1 - reorderThresholdPct))) {
        const qty = Number(p.reorder_qty || Math.max(reorderLevel * 2 - stock, 1));
        drafts.push({
          product_id: p.id,
          supplier_id: p.supplier_id || null,
          order_qty: qty,
          unit_cost: Number(p.unit_cost || 0),
          rationale: `stock=${stock} <= ${reorderThresholdPct*100}% of reorder_level=${reorderLevel}`,
        });
      }
    }

    if (dryRun) {
      return res.json({ dry_run: true, drafts });
    }

    const inserted = [];
    for (const d of drafts) {
      const r = await query(
        `INSERT INTO replenishment_orders (product_id, supplier_id, order_qty, unit_cost, status, rationale)
         VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
        [d.product_id, d.supplier_id, d.order_qty, d.unit_cost, d.rationale]
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ created: inserted.length, drafts: inserted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/replenishment?status=
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || null;
    const r = status
      ? await query(`SELECT * FROM replenishment_orders WHERE status = $1 ORDER BY created_at DESC LIMIT 200`, [status])
      : await query(`SELECT * FROM replenishment_orders ORDER BY created_at DESC LIMIT 200`);
    res.json({ orders: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/replenishment/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['draft', 'approved', 'ordered', 'received', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
    const r = await query(
      `UPDATE replenishment_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, Number(req.params.id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
