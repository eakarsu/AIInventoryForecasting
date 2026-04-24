import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';

const router = express.Router();

// Get all AI recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, p.name as product_name, p.sku as product_sku,
             s.name as supplier_name
      FROM ai_recommendations r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN suppliers s ON r.supplier_id = s.id
      ORDER BY
        CASE r.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Get recommendation by ID
router.get('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, p.name as product_name, p.sku as product_sku,
             p.current_stock, p.unit_price, s.name as supplier_name
      FROM ai_recommendations r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN suppliers s ON r.supplier_id = s.id
      WHERE r.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get recommendation error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendation' });
  }
});

// Update recommendation status
router.put('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    const result = await query(`
      UPDATE ai_recommendations
      SET status = $1,
          implemented_at = CASE WHEN $1 = 'implemented' THEN CURRENT_TIMESTAMP ELSE implemented_at END
      WHERE id = $2
      RETURNING *
    `, [status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update recommendation error:', error);
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
});

// Generate demand forecast using AI
router.post('/forecast', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;

    // Get product data
    const productResult = await query(`
      SELECT p.*, s.name as supplier_name, s.lead_time_days
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [product_id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get historical forecasts
    const historyResult = await query(`
      SELECT * FROM forecasts
      WHERE product_id = $1
      ORDER BY forecast_date DESC
      LIMIT 10
    `, [product_id]);

    const prompt = `As an inventory forecasting AI, analyze this product and provide a demand forecast:

Product: ${product.name} (SKU: ${product.sku})
Category: ${product.category}
Current Stock: ${product.current_stock}
Unit Price: $${product.unit_price}
Reorder Point: ${product.reorder_point}
Historical Forecasts: ${JSON.stringify(historyResult.rows.slice(0, 5))}

Provide a JSON response with:
{
  "predicted_demand": <number>,
  "confidence_level": <percentage>,
  "trend_direction": "upward" | "stable" | "downward",
  "seasonality_factor": <multiplier>,
  "reasoning": "<brief explanation>",
  "recommended_action": "<action to take>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      product: product.name,
      forecast: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI forecast error:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// Generate restock recommendations
router.post('/restock', authenticateToken, async (req, res) => {
  try {
    // Get low stock products
    const lowStockResult = await query(`
      SELECT p.*, s.name as supplier_name, s.lead_time_days
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.current_stock <= p.reorder_point
      ORDER BY (p.current_stock::float / NULLIF(p.reorder_point, 0)) ASC
      LIMIT 10
    `);

    if (lowStockResult.rows.length === 0) {
      return res.json({
        message: 'No products need restocking',
        recommendations: []
      });
    }

    const prompt = `As an inventory management AI, analyze these low-stock products and provide restock recommendations:

Products needing restock:
${JSON.stringify(lowStockResult.rows, null, 2)}

For each product, provide a JSON array with recommendations:
[{
  "product_sku": "<sku>",
  "recommended_quantity": <number>,
  "priority": "high" | "medium" | "low",
  "reasoning": "<brief explanation>",
  "estimated_days_until_stockout": <number>
}]`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      products_analyzed: lowStockResult.rows.length,
      recommendations: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI restock error:', error);
    res.status(500).json({ error: 'Failed to generate restock recommendations' });
  }
});

// Generate price optimization suggestions
router.post('/price-optimization', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;

    let products;
    if (product_id) {
      const result = await query('SELECT * FROM products WHERE id = $1', [product_id]);
      products = result.rows;
    } else {
      const result = await query('SELECT * FROM products LIMIT 10');
      products = result.rows;
    }

    const prompt = `As a pricing optimization AI, analyze these products and suggest optimal pricing:

Products:
${JSON.stringify(products, null, 2)}

Consider factors like:
- Current margin (unit_price vs cost_price)
- Stock levels
- Category positioning

Provide a JSON response:
{
  "optimizations": [{
    "product_sku": "<sku>",
    "current_price": <number>,
    "suggested_price": <number>,
    "change_percentage": <number>,
    "reasoning": "<explanation>",
    "expected_impact": "<impact description>"
  }]
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      products_analyzed: products.length,
      optimizations: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI price optimization error:', error);
    res.status(500).json({ error: 'Failed to generate price optimizations' });
  }
});

// Detect demand anomalies
router.post('/anomaly-detection', authenticateToken, async (req, res) => {
  try {
    // Get forecasts with actual data
    const forecastResult = await query(`
      SELECT f.*, p.name as product_name, p.sku as product_sku
      FROM forecasts f
      JOIN products p ON f.product_id = p.id
      WHERE f.actual_demand IS NOT NULL
      ORDER BY f.forecast_date DESC
      LIMIT 20
    `);

    const prompt = `As an anomaly detection AI, analyze these forecasts vs actual demand:

Forecast Data:
${JSON.stringify(forecastResult.rows, null, 2)}

Identify any anomalies where actual demand significantly differs from predictions.

Provide a JSON response:
{
  "anomalies": [{
    "product_sku": "<sku>",
    "forecast_date": "<date>",
    "predicted": <number>,
    "actual": <number>,
    "deviation_percentage": <number>,
    "severity": "high" | "medium" | "low",
    "possible_cause": "<explanation>",
    "recommended_action": "<action>"
  }],
  "summary": "<overall analysis>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      records_analyzed: forecastResult.rows.length,
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI anomaly detection error:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// Score suppliers using AI
router.post('/supplier-scoring', authenticateToken, async (req, res) => {
  try {
    const supplierResult = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count,
        (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id AND status = 'delivered') as delivered_orders
      FROM suppliers s
      WHERE s.status = 'active'
      ORDER BY s.rating DESC
      LIMIT 8
    `);

    const prompt = `As a supplier evaluation AI, score these top suppliers concisely:

Suppliers:
${JSON.stringify(supplierResult.rows, null, 2)}

Consider: reliability score, on-time delivery rate, lead times, and order history.

Provide a JSON response:
{
  "scores": [{
    "supplier_name": "<name>",
    "overall_score": <0-100>,
    "reliability_grade": "A" | "B" | "C" | "D" | "F",
    "strengths": ["<strength1>", "<strength2>"],
    "weaknesses": ["<weakness1>"],
    "recommendation": "<keep/review/replace>"
  }],
  "top_performer": "<supplier name>",
  "needs_review": ["<supplier names needing attention>"]
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      suppliers_analyzed: supplierResult.rows.length,
      scoring: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI supplier scoring error:', error);
    res.status(500).json({ error: 'Failed to score suppliers' });
  }
});

// Trend analysis
router.post('/trend-analysis', authenticateToken, async (req, res) => {
  try {
    // Get analytics data
    const analyticsResult = await query(`
      SELECT * FROM analytics
      ORDER BY created_at DESC
      LIMIT 30
    `);

    // Get category sales data
    const categoryResult = await query(`
      SELECT category, COUNT(*) as product_count,
             SUM(current_stock * unit_price) as inventory_value
      FROM products
      GROUP BY category
    `);

    const prompt = `As a trend analysis AI, analyze these inventory metrics and market data:

Analytics:
${JSON.stringify(analyticsResult.rows, null, 2)}

Categories:
${JSON.stringify(categoryResult.rows, null, 2)}

Identify trends and provide insights.

Provide a JSON response:
{
  "trends": [{
    "category": "<category or metric>",
    "direction": "growing" | "declining" | "stable",
    "change_rate": "<percentage or description>",
    "insight": "<explanation>"
  }],
  "opportunities": ["<opportunity1>", "<opportunity2>"],
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": ["<recommendation1>", "<recommendation2>"]
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      data_points_analyzed: analyticsResult.rows.length + categoryResult.rows.length,
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI trend analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze trends' });
  }
});

export default router;
