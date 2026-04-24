import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all reorder optimizations (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE ro.urgency ILIKE $1 OR ro.ai_recommendation ILIKE $1 OR p.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM reorder_optimizations ro LEFT JOIN products p ON ro.product_id = p.id LEFT JOIN suppliers s ON ro.supplier_id = s.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT ro.*, p.name as product_name, p.sku as product_sku,
             p.current_stock, p.reorder_point, p.unit_price,
             s.name as supplier_name, s.lead_time_days as supplier_lead_time
      FROM reorder_optimizations ro
      LEFT JOIN products p ON ro.product_id = p.id
      LEFT JOIN suppliers s ON ro.supplier_id = s.id
      ${whereClause}
      ORDER BY
        CASE ro.urgency
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        ro.optimal_order_date ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get reorder optimizations error:', error);
    res.status(500).json({ error: 'Failed to fetch reorder optimizations' });
  }
});

// Bulk delete reorder optimizations
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM reorder_optimizations WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update reorder optimizations
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
      `UPDATE reorder_optimizations SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get optimization by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT ro.*, p.name as product_name, p.sku as product_sku,
             p.current_stock, p.min_stock_level, p.max_stock_level,
             p.reorder_point, p.reorder_quantity, p.unit_price, p.cost_price,
             s.name as supplier_name, s.lead_time_days as supplier_lead_time,
             s.reliability_score, s.on_time_delivery_rate
      FROM reorder_optimizations ro
      LEFT JOIN products p ON ro.product_id = p.id
      LEFT JOIN suppliers s ON ro.supplier_id = s.id
      WHERE ro.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get optimization error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization' });
  }
});

// Create new optimization
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, supplier_id, optimal_order_quantity, optimal_order_date,
      safety_stock_level, reorder_point_suggested, urgency
    } = req.body;

    const result = await query(`
      INSERT INTO reorder_optimizations (product_id, supplier_id, optimal_order_quantity,
        optimal_order_date, safety_stock_level, reorder_point_suggested, urgency, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [product_id, supplier_id, optimal_order_quantity, optimal_order_date,
        safety_stock_level, reorder_point_suggested, urgency]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create optimization error:', error);
    res.status(500).json({ error: 'Failed to create optimization' });
  }
});

// Update optimization
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { optimal_order_quantity, optimal_order_date, urgency, status } = req.body;

    const result = await query(`
      UPDATE reorder_optimizations
      SET optimal_order_quantity = COALESCE($1, optimal_order_quantity),
          optimal_order_date = COALESCE($2, optimal_order_date),
          urgency = COALESCE($3, urgency),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [optimal_order_quantity, optimal_order_date, urgency, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update optimization error:', error);
    res.status(500).json({ error: 'Failed to update optimization' });
  }
});

// Delete optimization
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM reorder_optimizations WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }

    res.json({ message: 'Optimization deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete optimization error:', error);
    res.status(500).json({ error: 'Failed to delete optimization' });
  }
});

// Generate AI reorder optimization for a product
router.post('/analyze/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product data
    const productResult = await query(`
      SELECT p.*, s.name as supplier_name, s.lead_time_days,
             s.reliability_score, s.on_time_delivery_rate
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get demand predictions
    const predictionsResult = await query(`
      SELECT * FROM demand_predictions
      WHERE product_id = $1
      ORDER BY prediction_date ASC
      LIMIT 4
    `, [productId]);

    // Get recent orders for this product
    const ordersResult = await query(`
      SELECT o.*, oi.quantity, oi.unit_price
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.product_id = $1
      ORDER BY o.order_date DESC
      LIMIT 5
    `, [productId]);

    // Get existing optimization
    const optResult = await query(`
      SELECT * FROM reorder_optimizations
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [productId]);

    const prompt = `As an inventory optimization AI specialist, calculate the optimal reorder strategy for this product:

Product Details:
- Name: ${product.name} (SKU: ${product.sku})
- Current Stock: ${product.current_stock} units
- Min Stock Level: ${product.min_stock_level}
- Max Stock Level: ${product.max_stock_level}
- Current Reorder Point: ${product.reorder_point}
- Current Reorder Quantity: ${product.reorder_quantity}
- Unit Price: $${product.unit_price}
- Cost Price: $${product.cost_price}

Supplier Info:
- Name: ${product.supplier_name}
- Lead Time: ${product.lead_time_days} days
- Reliability Score: ${product.reliability_score}%
- On-Time Delivery: ${product.on_time_delivery_rate}%

Demand Predictions: ${JSON.stringify(predictionsResult.rows)}
Recent Orders: ${JSON.stringify(ordersResult.rows.slice(0, 3))}
Current Optimization: ${optResult.rows.length > 0 ? JSON.stringify(optResult.rows[0]) : 'None'}

Calculate Economic Order Quantity (EOQ), safety stock, and optimal timing using Just-In-Time principles.

Respond with this exact JSON structure:
{
  "optimal_order_quantity": <number>,
  "optimal_order_date": "<YYYY-MM-DD>",
  "economic_order_quantity": <number>,
  "safety_stock_recommended": <number>,
  "reorder_point_suggested": <number>,
  "urgency": "low" | "normal" | "high" | "critical",
  "days_until_stockout": <number>,
  "cost_analysis": {
    "holding_cost_daily": <number>,
    "ordering_cost": <number>,
    "potential_stockout_cost": <number>,
    "total_savings": <number>
  },
  "service_level": <percentage>,
  "reasoning": "<brief explanation of calculations>",
  "action_items": ["<action1>", "<action2>"],
  "summary": "<2-3 sentence recommendation>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        current_stock: product.current_stock,
        reorder_point: product.reorder_point
      },
      optimization: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI reorder optimization error:', error);
    res.status(500).json({ error: 'Failed to generate reorder optimization' });
  }
});

export default router;
