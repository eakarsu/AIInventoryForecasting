import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all e-commerce inventory optimizations (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE eio.channel ILIKE $1 OR eio.ai_recommendation ILIKE $1 OR p.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM ecommerce_inventory_optimizations eio LEFT JOIN products p ON eio.product_id = p.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT eio.*, p.name as product_name, p.sku as product_sku, p.category,
             p.unit_price, p.cost_price
      FROM ecommerce_inventory_optimizations eio
      LEFT JOIN products p ON eio.product_id = p.id
      ${whereClause}
      ORDER BY eio.optimization_score DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get inventory optimizations error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory optimizations' });
  }
});

// Bulk delete e-commerce inventory optimizations
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM ecommerce_inventory_optimizations WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update e-commerce inventory optimizations
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
      `UPDATE ecommerce_inventory_optimizations SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
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
      SELECT eio.*, p.name as product_name, p.sku as product_sku, p.category,
             p.unit_price, p.cost_price, p.current_stock, p.reorder_point
      FROM ecommerce_inventory_optimizations eio
      LEFT JOIN products p ON eio.product_id = p.id
      WHERE eio.id = $1
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

// Create new inventory optimization
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, channel, current_stock, optimal_stock, sell_through_rate,
      days_of_supply, conversion_rate, cart_abandonment_rate, return_rate,
      profit_margin, recommended_price
    } = req.body;

    const result = await query(`
      INSERT INTO ecommerce_inventory_optimizations (product_id, channel, current_stock,
        optimal_stock, sell_through_rate, days_of_supply, conversion_rate,
        cart_abandonment_rate, return_rate, profit_margin, recommended_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *
    `, [product_id, channel, current_stock, optimal_stock, sell_through_rate,
        days_of_supply, conversion_rate, cart_abandonment_rate, return_rate,
        profit_margin, recommended_price]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create optimization error:', error);
    res.status(500).json({ error: 'Failed to create optimization' });
  }
});

// Update optimization
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { optimal_stock, recommended_price, ai_recommendation, optimization_score, status } = req.body;

    const result = await query(`
      UPDATE ecommerce_inventory_optimizations
      SET optimal_stock = COALESCE($1, optimal_stock),
          recommended_price = COALESCE($2, recommended_price),
          ai_recommendation = COALESCE($3, ai_recommendation),
          optimization_score = COALESCE($4, optimization_score),
          status = COALESCE($5, status)
      WHERE id = $6
      RETURNING *
    `, [optimal_stock, recommended_price, ai_recommendation, optimization_score, status, req.params.id]);

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
    const result = await query('DELETE FROM ecommerce_inventory_optimizations WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }

    res.json({ message: 'Optimization deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete optimization error:', error);
    res.status(500).json({ error: 'Failed to delete optimization' });
  }
});

// Generate AI e-commerce optimization analysis for a product
router.post('/analyze/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product data
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

    // Get existing optimization data
    const optimizationResult = await query(`
      SELECT * FROM ecommerce_inventory_optimizations
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [productId]);

    // Get analytics data
    const analyticsResult = await query(`
      SELECT * FROM analytics
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [productId]);

    const prompt = `As an AI e-commerce inventory optimization specialist, analyze this product and provide comprehensive optimization recommendations:

Product Details:
- Name: ${product.name} (SKU: ${product.sku})
- Category: ${product.category}
- Current Stock: ${product.current_stock} units
- Unit Price: $${product.unit_price}
- Cost Price: $${product.cost_price}
- Min Stock Level: ${product.min_stock_level}
- Max Stock Level: ${product.max_stock_level}
- Supplier Lead Time: ${product.lead_time_days} days

Current Optimization Data: ${JSON.stringify(optimizationResult.rows.slice(0, 2))}
Recent Analytics: ${JSON.stringify(analyticsResult.rows.slice(0, 3))}

Analyze e-commerce performance and provide optimization strategies for multiple sales channels.

Respond with this exact JSON structure:
{
  "channel_recommendations": [
    {
      "channel": "Amazon",
      "optimal_stock": <number>,
      "recommended_price": <number>,
      "expected_conversion_rate": <percentage>,
      "strategy": "<specific strategy>"
    },
    {
      "channel": "Shopify",
      "optimal_stock": <number>,
      "recommended_price": <number>,
      "expected_conversion_rate": <percentage>,
      "strategy": "<specific strategy>"
    }
  ],
  "pricing_analysis": {
    "current_position": "competitive" | "premium" | "discount",
    "recommended_adjustment": <percentage>,
    "price_elasticity": <number -0.5 to -2.0>,
    "competitor_comparison": "<brief analysis>"
  },
  "inventory_optimization": {
    "optimal_total_stock": <number>,
    "safety_stock": <number>,
    "reorder_point": <number>,
    "days_of_supply_target": <number>
  },
  "bundle_opportunities": ["<bundle1>", "<bundle2>"],
  "cross_sell_products": ["<product1>", "<product2>"],
  "marketing_recommendations": ["<rec1>", "<rec2>"],
  "optimization_score": <0-100>,
  "expected_revenue_increase": <percentage>,
  "summary": "<2-3 sentence executive summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        current_stock: product.current_stock,
        unit_price: product.unit_price
      },
      optimization: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI inventory optimization error:', error);
    res.status(500).json({ error: 'Failed to generate inventory optimization' });
  }
});

// Analyze all products for e-commerce optimization
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const optimizationsResult = await query(`
      SELECT eio.*, p.name as product_name, p.sku, p.category, p.current_stock, p.unit_price
      FROM ecommerce_inventory_optimizations eio
      LEFT JOIN products p ON eio.product_id = p.id
      WHERE eio.status = 'active'
      ORDER BY eio.optimization_score DESC
      LIMIT 10
    `);

    const prompt = `As an AI e-commerce portfolio optimization specialist, analyze this product portfolio and provide strategic recommendations:

Product Portfolio Summary:
${optimizationsResult.rows.map(o => `- ${o.product_name} (${o.channel}): Score ${o.optimization_score}, Stock ${o.current_stock}, Price $${o.unit_price}`).join('\n')}

Provide portfolio-level optimization insights.

Respond with this exact JSON structure:
{
  "portfolio_health": {
    "overall_score": <0-100>,
    "total_products_analyzed": <number>,
    "optimization_opportunities": <number>,
    "estimated_revenue_impact": "<dollar amount>"
  },
  "top_performers": [
    {"product": "<name>", "channel": "<channel>", "strength": "<key strength>"}
  ],
  "underperformers": [
    {"product": "<name>", "channel": "<channel>", "issue": "<key issue>", "recommendation": "<action>"}
  ],
  "channel_insights": {
    "best_channel": "<channel name>",
    "channel_recommendations": "<strategic advice>"
  },
  "quick_wins": ["<action1>", "<action2>", "<action3>"],
  "strategic_recommendations": ["<rec1>", "<rec2>"],
  "summary": "<3-4 sentence executive summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      portfolio: optimizationsResult.rows,
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI portfolio analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze portfolio' });
  }
});

export default router;
