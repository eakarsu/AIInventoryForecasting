import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all supplier risks (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE sr.risk_level ILIKE $1 OR sr.ai_analysis ILIKE $1 OR s.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM supplier_risks sr LEFT JOIN suppliers s ON sr.supplier_id = s.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT sr.*, s.name as supplier_name, s.email as supplier_email,
             s.rating, s.reliability_score, s.on_time_delivery_rate, s.total_orders
      FROM supplier_risks sr
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      ${whereClause}
      ORDER BY sr.overall_risk_score DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get supplier risks error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier risks' });
  }
});

// Bulk delete supplier risks
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM supplier_risks WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update supplier risks
router.put('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'updates object is required' });
    }
    const allowedFields = ['status'];
    const setFields = Object.keys(updates).filter(k => allowedFields.includes(k));
    if (setFields.length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }
    let paramIdx = 1;
    const setClauses = setFields.map(f => `${f} = $${paramIdx++}`);
    const setParams = setFields.map(f => updates[f]);
    const placeholders = ids.map(() => `$${paramIdx++}`).join(',');
    const result = await query(
      `UPDATE supplier_risks SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get risk by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT sr.*, s.name as supplier_name, s.email as supplier_email,
             s.phone, s.address, s.rating, s.lead_time_days,
             s.reliability_score, s.on_time_delivery_rate, s.total_orders
      FROM supplier_risks sr
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      WHERE sr.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk assessment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get risk error:', error);
    res.status(500).json({ error: 'Failed to fetch risk assessment' });
  }
});

// Create new risk assessment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      supplier_id, risk_level, overall_risk_score, financial_risk_score,
      delivery_risk_score, quality_risk_score, risk_factors, mitigation_strategies
    } = req.body;

    const result = await query(`
      INSERT INTO supplier_risks (supplier_id, risk_level, overall_risk_score,
        financial_risk_score, delivery_risk_score, quality_risk_score,
        risk_factors, mitigation_strategies, review_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE + INTERVAL '30 days', 'active')
      RETURNING *
    `, [supplier_id, risk_level, overall_risk_score, financial_risk_score,
        delivery_risk_score, quality_risk_score, risk_factors, mitigation_strategies]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create risk error:', error);
    res.status(500).json({ error: 'Failed to create risk assessment' });
  }
});

// Update risk assessment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { risk_level, overall_risk_score, status, mitigation_strategies } = req.body;

    const result = await query(`
      UPDATE supplier_risks
      SET risk_level = COALESCE($1, risk_level),
          overall_risk_score = COALESCE($2, overall_risk_score),
          status = COALESCE($3, status),
          mitigation_strategies = COALESCE($4, mitigation_strategies)
      WHERE id = $5
      RETURNING *
    `, [risk_level, overall_risk_score, status, mitigation_strategies, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk assessment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update risk error:', error);
    res.status(500).json({ error: 'Failed to update risk assessment' });
  }
});

// Delete risk assessment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM supplier_risks WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk assessment not found' });
    }

    res.json({ message: 'Risk assessment deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete risk error:', error);
    res.status(500).json({ error: 'Failed to delete risk assessment' });
  }
});

// Generate AI risk analysis for a supplier
router.post('/analyze/:supplierId', authenticateToken, async (req, res) => {
  try {
    const { supplierId } = req.params;

    // Get supplier data
    const supplierResult = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count,
        (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id AND status = 'delivered' AND actual_delivery > expected_delivery) as late_deliveries
      FROM suppliers s
      WHERE s.id = $1
    `, [supplierId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = supplierResult.rows[0];

    // Get recent orders
    const ordersResult = await query(`
      SELECT * FROM orders
      WHERE supplier_id = $1
      ORDER BY order_date DESC
      LIMIT 10
    `, [supplierId]);

    // Get existing risk assessment
    const riskResult = await query(`
      SELECT * FROM supplier_risks
      WHERE supplier_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [supplierId]);

    const prompt = `As a supply chain risk analyst AI, perform a comprehensive risk assessment for this supplier:

Supplier Profile:
- Name: ${supplier.name}
- Rating: ${supplier.rating}/5.0
- Reliability Score: ${supplier.reliability_score}%
- On-Time Delivery Rate: ${supplier.on_time_delivery_rate}%
- Lead Time: ${supplier.lead_time_days} days
- Total Orders: ${supplier.total_orders}
- Products Supplied: ${supplier.product_count}
- Late Deliveries: ${supplier.late_deliveries}
- Location: ${supplier.address}

Recent Orders: ${JSON.stringify(ordersResult.rows.slice(0, 5))}
Current Risk Assessment: ${riskResult.rows.length > 0 ? JSON.stringify(riskResult.rows[0]) : 'None'}

Analyze all risk dimensions and provide a comprehensive assessment.

Respond with this exact JSON structure:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "overall_score": <0-100, higher = more risk>,
  "risk_breakdown": {
    "financial": {"score": <0-100>, "status": "healthy" | "concern" | "warning"},
    "delivery": {"score": <0-100>, "status": "excellent" | "good" | "poor"},
    "quality": {"score": <0-100>, "status": "high" | "acceptable" | "low"},
    "geopolitical": {"score": <0-100>, "status": "stable" | "moderate" | "volatile"},
    "concentration": {"score": <0-100>, "status": "diversified" | "moderate" | "concentrated"}
  },
  "key_risks": ["<risk1>", "<risk2>", "<risk3>"],
  "mitigation_actions": ["<action1>", "<action2>", "<action3>"],
  "alternative_suppliers": ["<supplier1>", "<supplier2>"],
  "recommendation": "maintain" | "monitor" | "reduce_dependency" | "replace",
  "summary": "<2-3 sentence executive summary>",
  "next_review": "<recommended review timeframe>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        rating: supplier.rating,
        reliability_score: supplier.reliability_score
      },
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI risk analysis error:', error);
    res.status(500).json({ error: 'Failed to generate risk analysis' });
  }
});

export default router;
