/*
 * routes/supplierMarketplace.js — Apply pass 5
 *
 * Mechanical supplier-marketplace discovery + RFQ scaffold. Filters the existing
 * `suppliers` table by category and lead time + computes a deterministic
 * suitability score. Allows posting / listing RFQs (Request For Quotation).
 *
 * Additive `supplier_rfqs` and `supplier_rfq_quotes` tables.
 */
import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

(async () => {
  try {
    await query(`
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
        created_at TIMESTAMP DEFAULT NOW()
      )`);
    await query(`
      CREATE TABLE IF NOT EXISTS supplier_rfq_quotes (
        id SERIAL PRIMARY KEY,
        rfq_id INTEGER REFERENCES supplier_rfqs(id) ON DELETE CASCADE,
        supplier_id INTEGER,
        unit_cost NUMERIC,
        lead_time_days INTEGER,
        notes TEXT,
        submitted_at TIMESTAMP DEFAULT NOW()
      )`);
  } catch (e) { console.error('supplierMarketplace bootstrap error:', e.message); }
})();

function scoreSupplier(s, targetCost, maxLeadDays) {
  let score = 50;
  const lt = Number(s.lead_time_days || 30);
  if (maxLeadDays && lt <= maxLeadDays) score += 20;
  if (lt <= 7) score += 15;
  else if (lt <= 14) score += 10;
  else if (lt <= 21) score += 5;
  if (targetCost && Number(s.unit_cost || 0) <= Number(targetCost)) score += 20;
  if (s.reliability_score != null) score += Number(s.reliability_score) / 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// GET /api/supplier-marketplace/search?category=&max_lead_days=&target_cost=
router.get('/search', async (req, res) => {
  try {
    const category = req.query.category || null;
    const maxLead = req.query.max_lead_days ? Number(req.query.max_lead_days) : null;
    const target = req.query.target_cost ? Number(req.query.target_cost) : null;
    const params = [];
    let where = '1=1';
    if (category) { params.push(`%${category}%`); where += ` AND COALESCE(category, '') ILIKE $${params.length}`; }
    if (maxLead) { params.push(maxLead); where += ` AND COALESCE(lead_time_days, 999) <= $${params.length}`; }
    const r = await query(`SELECT * FROM suppliers WHERE ${where} ORDER BY lead_time_days ASC NULLS LAST LIMIT 100`, params).catch(() => ({ rows: [] }));
    const ranked = r.rows.map((s) => ({ ...s, suitability_score: scoreSupplier(s, target, maxLead) }))
      .sort((a, b) => b.suitability_score - a.suitability_score);
    res.json({ count: ranked.length, results: ranked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/supplier-marketplace/rfqs
router.post('/rfqs', async (req, res) => {
  try {
    const { product_id, category, target_qty, target_unit_cost, deadline, notes } = req.body || {};
    if (!target_qty) return res.status(400).json({ error: 'target_qty required' });
    const r = await query(
      `INSERT INTO supplier_rfqs (product_id, category, target_qty, target_unit_cost, deadline, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [product_id || null, category || null, Number(target_qty), target_unit_cost || null, deadline || null, notes || null, req.user?.id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/supplier-marketplace/rfqs
router.get('/rfqs', async (_req, res) => {
  try {
    const r = await query(`SELECT * FROM supplier_rfqs ORDER BY created_at DESC LIMIT 100`);
    res.json({ rfqs: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/supplier-marketplace/rfqs/:id/quotes
router.post('/rfqs/:id/quotes', async (req, res) => {
  try {
    const { supplier_id, unit_cost, lead_time_days, notes } = req.body || {};
    if (!supplier_id || unit_cost == null) return res.status(400).json({ error: 'supplier_id and unit_cost required' });
    const r = await query(
      `INSERT INTO supplier_rfq_quotes (rfq_id, supplier_id, unit_cost, lead_time_days, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [Number(req.params.id), Number(supplier_id), Number(unit_cost), lead_time_days != null ? Number(lead_time_days) : null, notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/supplier-marketplace/rfqs/:id/quotes
router.get('/rfqs/:id/quotes', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM supplier_rfq_quotes WHERE rfq_id = $1 ORDER BY unit_cost ASC, lead_time_days ASC`, [Number(req.params.id)]);
    res.json({ quotes: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
