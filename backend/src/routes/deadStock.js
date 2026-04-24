import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all dead stock items (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE ds.velocity_category ILIKE $1 OR ds.risk_category ILIKE $1 OR ds.recommended_action ILIKE $1 OR p.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM dead_stock ds LEFT JOIN products p ON ds.product_id = p.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT ds.*, p.name as product_name, p.sku as product_sku,
             p.category, p.unit_price, p.cost_price, p.location
      FROM dead_stock ds
      LEFT JOIN products p ON ds.product_id = p.id
      ${whereClause}
      ORDER BY
        CASE ds.risk_category
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        ds.days_without_sale DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get dead stock error:', error);
    res.status(500).json({ error: 'Failed to fetch dead stock' });
  }
});

// Bulk delete dead stock
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM dead_stock WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update dead stock
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
      `UPDATE dead_stock SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get dead stock item by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT ds.*, p.name as product_name, p.sku as product_sku,
             p.category, p.description, p.unit_price, p.cost_price,
             p.current_stock, p.location, s.name as supplier_name
      FROM dead_stock ds
      LEFT JOIN products p ON ds.product_id = p.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE ds.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dead stock item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get dead stock error:', error);
    res.status(500).json({ error: 'Failed to fetch dead stock item' });
  }
});

// Create new dead stock entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, days_without_sale, last_sale_date, quantity_in_stock,
      stock_value, velocity_category, risk_category, recommended_action
    } = req.body;

    const result = await query(`
      INSERT INTO dead_stock (product_id, days_without_sale, last_sale_date,
        quantity_in_stock, stock_value, velocity_category, risk_category,
        recommended_action, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'identified')
      RETURNING *
    `, [product_id, days_without_sale, last_sale_date, quantity_in_stock,
        stock_value, velocity_category, risk_category, recommended_action]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create dead stock error:', error);
    res.status(500).json({ error: 'Failed to create dead stock entry' });
  }
});

// Update dead stock entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { recommended_action, discount_suggestion, action_taken, status } = req.body;

    const result = await query(`
      UPDATE dead_stock
      SET recommended_action = COALESCE($1, recommended_action),
          discount_suggestion = COALESCE($2, discount_suggestion),
          action_taken = COALESCE($3, action_taken),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [recommended_action, discount_suggestion, action_taken, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dead stock item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update dead stock error:', error);
    res.status(500).json({ error: 'Failed to update dead stock entry' });
  }
});

// Delete dead stock entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM dead_stock WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dead stock item not found' });
    }

    res.json({ message: 'Dead stock entry deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete dead stock error:', error);
    res.status(500).json({ error: 'Failed to delete dead stock entry' });
  }
});

// Generate AI dead stock analysis for a product
router.post('/analyze/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product data
    const productResult = await query(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get existing dead stock assessment
    const deadStockResult = await query(`
      SELECT * FROM dead_stock
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [productId]);

    // Get demand predictions to understand velocity
    const predictionsResult = await query(`
      SELECT * FROM demand_predictions
      WHERE product_id = $1
      ORDER BY prediction_date DESC
      LIMIT 4
    `, [productId]);

    // Get category performance
    const categoryResult = await query(`
      SELECT
        AVG(current_stock) as avg_stock,
        AVG(unit_price) as avg_price
      FROM products
      WHERE category = $1
    `, [product.category]);

    const currentDeadStock = deadStockResult.rows[0];
    const stockValue = product.current_stock * product.unit_price;
    const holdingCostRate = 0.25; // 25% annual holding cost
    const dailyHoldingCost = (stockValue * holdingCostRate) / 365;

    const prompt = `As an inventory liquidation specialist AI, analyze this potentially slow-moving product:

Product Details:
- Name: ${product.name} (SKU: ${product.sku})
- Category: ${product.category}
- Current Stock: ${product.current_stock} units
- Unit Price: $${product.unit_price}
- Cost Price: $${product.cost_price}
- Stock Value: $${stockValue.toFixed(2)}
- Location: ${product.location}
- Daily Holding Cost: $${dailyHoldingCost.toFixed(2)}

Current Assessment: ${currentDeadStock ? JSON.stringify(currentDeadStock) : 'None'}
Recent Demand Predictions: ${JSON.stringify(predictionsResult.rows)}
Category Average Stock: ${categoryResult.rows[0]?.avg_stock || 'N/A'}

Analyze if this is dead/slow-moving stock and recommend actions.

Respond with this exact JSON structure:
{
  "velocity_category": "fast" | "moderate" | "slow" | "very_slow" | "dead",
  "risk_category": "low" | "medium" | "high" | "critical",
  "days_of_supply": <number>,
  "turnover_rate": <annual turns>,
  "holding_cost_impact": {
    "monthly": <number>,
    "yearly": <number>,
    "accumulated": <number>
  },
  "recommended_action": "monitor" | "discount_sale" | "bundle_promotion" | "marketing_push" | "clearance" | "write_off" | "return_to_supplier",
  "discount_suggestion": <percentage if applicable, 0 otherwise>,
  "liquidation_value": <estimated recovery amount>,
  "action_timeline": "<urgency description>",
  "recovery_strategies": ["<strategy1>", "<strategy2>", "<strategy3>"],
  "root_cause": "<likely reason for slow movement>",
  "summary": "<2-3 sentence assessment and recommendation>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        current_stock: product.current_stock,
        stock_value: stockValue
      },
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI dead stock analysis error:', error);
    res.status(500).json({ error: 'Failed to generate dead stock analysis' });
  }
});

export default router;
