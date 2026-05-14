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

// STOCKOUT-RISK SCORING
// Scores every SKU by days-of-supply remaining, flags critical items,
// generates AI-driven reorder recommendations, and persists them to ai_recommendations.
// This is the most impactful proposed feature from the audit.
router.get('/stockout-risk', authenticateToken, async (req, res) => {
  try {
    const thresholdDays = parseInt(req.query.threshold_days) || 14;

    // Calculate days-of-supply for all active products
    // days_of_supply = current_stock / avg_daily_demand (estimated from reorder_point / lead_time)
    const productsResult = await query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.category,
        p.current_stock,
        p.reorder_point,
        p.unit_price,
        p.cost_price,
        p.max_stock,
        s.name as supplier_name,
        s.lead_time_days,
        s.id as supplier_id,
        -- Estimate avg daily demand: reorder_point is typically 2x lead_time_days demand
        CASE
          WHEN s.lead_time_days > 0
          THEN ROUND(p.reorder_point::numeric / GREATEST(s.lead_time_days, 1), 2)
          ELSE ROUND(p.reorder_point::numeric / 7, 2)
        END as est_daily_demand,
        -- Days of supply remaining
        CASE
          WHEN s.lead_time_days > 0 AND p.reorder_point > 0
          THEN ROUND(p.current_stock::numeric / GREATEST(p.reorder_point::numeric / GREATEST(s.lead_time_days, 1), 0.1), 1)
          ELSE ROUND(p.current_stock::numeric / GREATEST(p.reorder_point::numeric / 7, 0.1), 1)
        END as days_of_supply
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.current_stock >= 0
      ORDER BY days_of_supply ASC NULLS FIRST
    `);

    const allProducts = productsResult.rows;

    // Classify risk levels
    const critical = allProducts.filter(p => p.days_of_supply !== null && parseFloat(p.days_of_supply) <= (thresholdDays / 2));
    const atRisk = allProducts.filter(p => p.days_of_supply !== null && parseFloat(p.days_of_supply) > (thresholdDays / 2) && parseFloat(p.days_of_supply) <= thresholdDays);
    const healthy = allProducts.filter(p => p.days_of_supply === null || parseFloat(p.days_of_supply) > thresholdDays);

    // Build risk summary for AI analysis
    const riskProducts = [...critical, ...atRisk].slice(0, 20); // Top 20 at-risk

    let aiAnalysis = null;
    if (riskProducts.length > 0) {
      const prompt = `You are an inventory risk management specialist. Analyze these products at risk of stockout and provide prioritized reorder recommendations.

Products at stockout risk (ordered by days_of_supply ascending):
${riskProducts.map(p => `- ${p.name} (SKU: ${p.sku}): ${p.days_of_supply} days left, stock=${p.current_stock}, reorder_point=${p.reorder_point}, supplier_lead_time=${p.lead_time_days}d, value=$${p.unit_price}`).join('\n')}

For each critical product, provide specific reorder quantities and urgency. Consider lead times when setting deadlines.

Respond with JSON:
{
  "critical_actions": [
    {
      "sku": "<sku>",
      "product_name": "<name>",
      "urgency": "immediate" | "this_week" | "this_month",
      "recommended_order_qty": <number>,
      "reorder_deadline": "<YYYY-MM-DD>",
      "reasoning": "<brief explanation>",
      "estimated_cost": <number>
    }
  ],
  "total_at_risk_value": <number>,
  "summary": "<2-3 sentence executive summary of overall stockout risk situation>"
}`;

      aiAnalysis = await generateAIResponse(prompt);

      // Persist each critical action as an ai_recommendation
      if (typeof aiAnalysis === 'object' && Array.isArray(aiAnalysis.critical_actions)) {
        for (const action of aiAnalysis.critical_actions) {
          const product = riskProducts.find(p => p.sku === action.sku);
          if (!product) continue;

          const priority = action.urgency === 'immediate' ? 'high'
                         : action.urgency === 'this_week' ? 'medium' : 'low';

          try {
            await query(`
              INSERT INTO ai_recommendations (product_id, supplier_id, type, priority, title, description, ai_reasoning, status)
              VALUES ($1, $2, 'stockout_risk', $3, $4, $5, $6, 'pending')
            `, [
              product.id,
              product.supplier_id,
              priority,
              `Stockout Risk: ${product.name} (${product.days_of_supply} days left)`,
              `Order ${action.recommended_order_qty} units by ${action.reorder_deadline}. ${action.reasoning}`,
              JSON.stringify(action)
            ]);
          } catch (insertErr) {
            console.warn(`Failed to persist stockout recommendation for ${action.sku}:`, insertErr.message);
          }
        }
      }
    }

    res.json({
      threshold_days: thresholdDays,
      summary: {
        total_products: allProducts.length,
        critical_count: critical.length,
        at_risk_count: atRisk.length,
        healthy_count: healthy.length
      },
      critical,
      at_risk: atRisk,
      ai_analysis: aiAnalysis,
      scored_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stockout risk scoring error:', error);
    res.status(500).json({ error: 'Failed to score stockout risk' });
  }
});

// Input validation for AI POST routes
function validateProductId(req, res, next) {
  const { product_id } = req.body;
  if (product_id !== undefined && (isNaN(parseInt(product_id)) || parseInt(product_id) <= 0)) {
    return res.status(400).json({ error: 'product_id must be a positive integer' });
  }
  next();
}

// Markdown timing recommendation for slow-moving / dead stock
router.post('/markdown-timing', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;

    let products = [];
    if (product_id) {
      const r = await query(
        `SELECT p.*, s.name AS supplier_name FROM products p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.id = $1`,
        [product_id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      products = r.rows;
    } else {
      const r = await query(
        `SELECT p.*, s.name AS supplier_name FROM products p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         ORDER BY p.current_stock DESC LIMIT 30`
      );
      products = r.rows;
    }

    const deadStockRows = await query('SELECT * FROM dead_stock ORDER BY id DESC LIMIT 30').catch(() => ({ rows: [] }));

    const prompt = `As an inventory markdown strategist, recommend markdown timing and pricing tiers to clear slow-moving inventory while protecting margin on healthy SKUs.

Candidate products:
${JSON.stringify(products.slice(0, 30), null, 2)}

Dead stock signals:
${JSON.stringify(deadStockRows.rows.slice(0, 20), null, 2)}

Return JSON:
{
  "recommendations": [
    {
      "product_id": number,
      "product_name": string,
      "current_velocity": "fast|moderate|slow|stagnant",
      "first_markdown_in_days": number,
      "first_markdown_pct": number,
      "subsequent_markdowns": [{ "after_days": number, "pct": number }],
      "expected_sell_through_days": number,
      "minimum_acceptable_price": number,
      "rationale": string
    }
  ],
  "portfolio_notes": [string],
  "summary": string
}`;

    const ai = await generateAIResponse(prompt);
    res.json({ analyzed: products.length, recommendations: ai, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Markdown timing error:', error);
    res.status(500).json({ error: 'Failed to generate markdown timing recommendations' });
  }
});

// Supplier disruption simulator
router.post('/supplier-disruption-simulator', authenticateToken, async (req, res) => {
  try {
    const { supplier_id, scenario, duration_days } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id required' });

    const supplierResult = await query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplierResult.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    const supplier = supplierResult.rows[0];

    const productsResult = await query('SELECT * FROM products WHERE supplier_id = $1', [supplier_id]).catch(() => ({ rows: [] }));
    const altSuppliersResult = await query('SELECT id, name, lead_time_days, reliability_score FROM suppliers WHERE id <> $1 ORDER BY reliability_score DESC NULLS LAST LIMIT 10', [supplier_id]).catch(() => ({ rows: [] }));

    const prompt = `As a supply chain risk simulator, model the impact of a supplier disruption.

Disrupted supplier: ${JSON.stringify(supplier)}
Scenario: ${scenario || 'unspecified — assume full outage'}
Duration (days): ${duration_days || 30}

Affected products (count=${productsResult.rows.length}):
${JSON.stringify(productsResult.rows.slice(0, 30), null, 2)}

Alternative suppliers:
${JSON.stringify(altSuppliersResult.rows, null, 2)}

Return JSON:
{
  "impacted_skus": [{ "product_id": number, "name": string, "stockout_in_days": number, "revenue_at_risk_30d": number, "criticality": "low|medium|high|critical" }],
  "alternative_routing": [{ "product_id": number, "alternative_supplier": string, "expected_lead_time_days": number, "cost_delta_pct": number, "feasibility": "good|marginal|poor" }],
  "mitigation_actions": [{ "action": string, "owner": string, "deadline_days": number }],
  "expected_total_revenue_at_risk_usd": number,
  "expected_total_margin_at_risk_usd": number,
  "summary": string
}`;

    const ai = await generateAIResponse(prompt);
    res.json({ supplier: supplier.name, scenario: scenario || 'full_outage', duration_days: duration_days || 30, simulation: ai, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Supplier disruption simulator error:', error);
    res.status(500).json({ error: 'Failed to simulate supplier disruption' });
  }
});

// Multi-warehouse inventory balancing
router.post('/multi-warehouse-balancing', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;

    let products = [];
    if (product_id) {
      const r = await query('SELECT * FROM products WHERE id = $1', [product_id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      products = r.rows;
    } else {
      const r = await query('SELECT * FROM products ORDER BY current_stock DESC LIMIT 30');
      products = r.rows;
    }

    let warehouses = [];
    let inventoryByWarehouse = [];
    try {
      const w = await query('SELECT * FROM warehouses ORDER BY id ASC');
      warehouses = w.rows;
    } catch (_) { /* warehouses table may not exist */ }
    try {
      const inv = await query('SELECT * FROM warehouse_inventory ORDER BY id ASC LIMIT 200');
      inventoryByWarehouse = inv.rows;
    } catch (_) { /* table may not exist */ }

    const prompt = `As a multi-warehouse network optimization AI, recommend inventory transfers to balance stock across warehouses.

Products of interest (${products.length}):
${JSON.stringify(products.slice(0, 30), null, 2)}

Warehouses (${warehouses.length}):
${JSON.stringify(warehouses, null, 2)}

Per-warehouse inventory (sample):
${JSON.stringify(inventoryByWarehouse.slice(0, 100), null, 2)}

If no warehouse data is available, infer reasonable assumptions from product current_stock and explicitly note the assumption.

Return JSON:
{
  "transfers": [{ "product_id": number, "from_warehouse": string, "to_warehouse": string, "quantity": number, "rationale": string, "expected_lead_time_days": number, "estimated_transport_cost": number }],
  "imbalance_score_before": number,
  "imbalance_score_after": number,
  "expected_stockout_days_avoided": number,
  "warnings": [string],
  "summary": string
}`;

    const ai = await generateAIResponse(prompt);
    res.json({ analyzed: products.length, warehouses: warehouses.length, balancing: ai, generated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Multi-warehouse balancing error:', error);
    res.status(500).json({ error: 'Failed to recommend warehouse balancing' });
  }
});

export default router;
