import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { logAICall } from '../services/aiAudit.js';

const router = express.Router();

// POST /api/ai/promotion-simulator
router.post('/promotion-simulator', authenticateToken, async (req, res) => {
  try {
    const { product_id, discount_percent, campaign_duration_days } = req.body;

    if (!product_id || discount_percent === undefined || !campaign_duration_days) {
      return res.status(400).json({ error: 'product_id, discount_percent, and campaign_duration_days are required' });
    }

    // Fetch product details
    const productResult = await query(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [product_id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get recent forecasts for context
    const forecastsResult = await query(`
      SELECT predicted_demand, prediction_date
      FROM demand_predictions
      WHERE product_id = $1
      ORDER BY prediction_date DESC
      LIMIT 5
    `, [product_id]);

    const forecastSummary = forecastsResult.rows.length > 0
      ? forecastsResult.rows.map(f => `${f.prediction_date?.toISOString?.().split('T')[0] || f.prediction_date}: ${f.predicted_demand} units`).join(', ')
      : 'No forecast history available';

    const prompt = `You are a retail demand analyst. Simulate demand impact of a promotional campaign.

Product: ${product.name} (SKU: ${product.sku})
Category: ${product.category}
Current Price: $${product.unit_price}
Current Stock: ${product.current_stock} units
Cost Price: $${product.cost_price || 'N/A'}
Recent Demand Forecasts: ${forecastSummary}

Promotion: ${discount_percent}% discount for ${campaign_duration_days} days.

Simulate demand impact and return JSON with this exact structure:
{
  "demand_multiplier": <number, e.g. 1.5 means 50% increase>,
  "expected_units_sold": <number>,
  "recommended_stock_increase": <number of additional units to stock>,
  "revenue_impact": <number, net revenue change in dollars>,
  "risks": ["risk1", "risk2"]
}`;

    const aiResult = await generateAIResponse(prompt);

    logAICall({ user_id: req.user?.id, endpoint: '/api/ai/promotion-simulator', entity_id: product_id, tokens_used: null });

    res.json({
      product: { id: product.id, name: product.name, sku: product.sku, unit_price: product.unit_price, current_stock: product.current_stock },
      simulation: typeof aiResult === 'object' ? aiResult : { raw: aiResult },
    });
  } catch (error) {
    console.error('Promotion simulator error:', error);
    res.status(500).json({ error: 'Failed to simulate promotion' });
  }
});

export default router;
