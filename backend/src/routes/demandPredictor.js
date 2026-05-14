import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Input validation helper
function validateAnalyzeInput(req, res, next) {
  const { productId } = req.params;
  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    return res.status(400).json({ error: 'Valid productId is required' });
  }
  // Must be a positive integer string
  if (!/^\d+$/.test(productId)) {
    return res.status(400).json({ error: 'productId must be a numeric ID' });
  }
  next();
}

// Get all demand predictions (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE dp.trend_direction ILIKE $1 OR dp.ai_model_used ILIKE $1 OR dp.ai_reasoning ILIKE $1 OR p.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM demand_predictions dp LEFT JOIN products p ON dp.product_id = p.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT dp.*, p.name as product_name, p.sku as product_sku, p.category,
             p.current_stock, p.unit_price
      FROM demand_predictions dp
      LEFT JOIN products p ON dp.product_id = p.id
      ${whereClause}
      ORDER BY dp.prediction_date ASC, dp.confidence_score DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get demand predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch demand predictions' });
  }
});

// Bulk delete demand predictions
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM demand_predictions WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update demand predictions
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
      `UPDATE demand_predictions SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get prediction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT dp.*, p.name as product_name, p.sku as product_sku, p.category,
             p.current_stock, p.unit_price, p.cost_price, p.reorder_point
      FROM demand_predictions dp
      LEFT JOIN products p ON dp.product_id = p.id
      WHERE dp.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// Create new demand prediction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, prediction_date, period_type, predicted_quantity,
      confidence_score, seasonality_index, trend_direction
    } = req.body;

    const result = await query(`
      INSERT INTO demand_predictions (product_id, prediction_date, period_type, predicted_quantity,
        confidence_score, seasonality_index, trend_direction, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *
    `, [product_id, prediction_date, period_type, predicted_quantity,
        confidence_score, seasonality_index, trend_direction]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create prediction error:', error);
    res.status(500).json({ error: 'Failed to create prediction' });
  }
});

// Update prediction
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { predicted_quantity, confidence_score, trend_direction, status } = req.body;

    const result = await query(`
      UPDATE demand_predictions
      SET predicted_quantity = COALESCE($1, predicted_quantity),
          confidence_score = COALESCE($2, confidence_score),
          trend_direction = COALESCE($3, trend_direction),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [predicted_quantity, confidence_score, trend_direction, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update prediction error:', error);
    res.status(500).json({ error: 'Failed to update prediction' });
  }
});

// Delete prediction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM demand_predictions WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json({ message: 'Prediction deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete prediction error:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

// Generate AI demand prediction for a product
router.post('/analyze/:productId', authenticateToken, aiLimiter, validateAnalyzeInput, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product data with historical info
    const productResult = await query(`
      SELECT p.*, s.name as supplier_name, s.lead_time_days
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get historical forecasts
    const historyResult = await query(`
      SELECT * FROM forecasts
      WHERE product_id = $1
      ORDER BY forecast_date DESC
      LIMIT 12
    `, [productId]);

    // Get existing predictions
    const predictionsResult = await query(`
      SELECT * FROM demand_predictions
      WHERE product_id = $1
      ORDER BY prediction_date DESC
      LIMIT 5
    `, [productId]);

    const prompt = `As an AI demand forecasting specialist, analyze this product and provide a comprehensive demand prediction:

Product Details:
- Name: ${product.name} (SKU: ${product.sku})
- Category: ${product.category}
- Current Stock: ${product.current_stock} units
- Unit Price: $${product.unit_price}
- Cost Price: $${product.cost_price}
- Reorder Point: ${product.reorder_point}
- Supplier Lead Time: ${product.lead_time_days} days

Historical Forecasts: ${JSON.stringify(historyResult.rows.slice(0, 5))}
Recent Predictions: ${JSON.stringify(predictionsResult.rows.slice(0, 3))}

Analyze seasonal patterns, market trends, and provide a demand forecast for the next 4 weeks.

Respond with this exact JSON structure:
{
  "weekly_predictions": [
    {"week": 1, "predicted_quantity": <number>, "confidence": <percentage>},
    {"week": 2, "predicted_quantity": <number>, "confidence": <percentage>},
    {"week": 3, "predicted_quantity": <number>, "confidence": <percentage>},
    {"week": 4, "predicted_quantity": <number>, "confidence": <percentage>}
  ],
  "overall_trend": "upward" | "stable" | "downward",
  "seasonality_factor": <multiplier 0.5-2.0>,
  "key_drivers": ["<driver1>", "<driver2>", "<driver3>"],
  "risk_factors": ["<risk1>", "<risk2>"],
  "confidence_level": <overall percentage>,
  "recommendation": "<actionable recommendation>",
  "summary": "<2-3 sentence executive summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    // Persist AI result to ai_recommendations table for audit trail + dashboard visibility
    try {
      const summary = typeof aiResponse === 'object'
        ? (aiResponse.recommendation || aiResponse.summary || JSON.stringify(aiResponse).substring(0, 200))
        : String(aiResponse).substring(0, 200);

      const priority = typeof aiResponse === 'object' && aiResponse.overall_trend === 'downward'
        ? 'high'
        : typeof aiResponse === 'object' && aiResponse.overall_trend === 'upward'
        ? 'medium'
        : 'low';

      await query(`
        INSERT INTO ai_recommendations (product_id, type, priority, title, description, ai_reasoning, status)
        VALUES ($1, 'demand_forecast', $2, $3, $4, $5, 'pending')
        ON CONFLICT DO NOTHING
      `, [
        productId,
        priority,
        `Demand Forecast: ${product.name}`,
        summary,
        JSON.stringify(aiResponse)
      ]);
    } catch (dbErr) {
      // Non-fatal: log but don't fail the response
      console.warn('Failed to persist AI recommendation:', dbErr.message);
    }

    res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        current_stock: product.current_stock
      },
      prediction: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI demand prediction error:', error);
    res.status(500).json({ error: 'Failed to generate demand prediction' });
  }
});

export default router;
