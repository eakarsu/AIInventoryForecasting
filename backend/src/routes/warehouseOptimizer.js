import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all warehouse zones (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE zone_name ILIKE $1 OR zone_type ILIKE $1 OR location_code ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM warehouse_zones ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT * FROM warehouse_zones
      ${whereClause}
      ORDER BY
        CASE zone_type
          WHEN 'fast_pick' THEN 1
          WHEN 'premium' THEN 2
          WHEN 'specialized' THEN 3
          WHEN 'standard' THEN 4
          WHEN 'bulk' THEN 5
          ELSE 6
        END,
        zone_name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get warehouse zones error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse zones' });
  }
});

// Bulk delete warehouse zones
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM warehouse_zones WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update warehouse zones
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
      `UPDATE warehouse_zones SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get zone by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM warehouse_zones WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get zone error:', error);
    res.status(500).json({ error: 'Failed to fetch zone' });
  }
});

// Create new zone
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      zone_name, zone_type, location_code, capacity_units,
      current_utilization, access_frequency, temperature_controlled,
      humidity_controlled, product_categories
    } = req.body;

    const result = await query(`
      INSERT INTO warehouse_zones (zone_name, zone_type, location_code, capacity_units,
        current_utilization, optimal_utilization, access_frequency, temperature_controlled,
        humidity_controlled, product_categories, status)
      VALUES ($1, $2, $3, $4, $5, 75.0, $6, $7, $8, $9, 'active')
      RETURNING *
    `, [zone_name, zone_type, location_code, capacity_units,
        current_utilization, access_frequency, temperature_controlled,
        humidity_controlled, product_categories]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create zone error:', error);
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// Update zone
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { current_utilization, product_categories, ai_layout_suggestion, status } = req.body;

    const result = await query(`
      UPDATE warehouse_zones
      SET current_utilization = COALESCE($1, current_utilization),
          product_categories = COALESCE($2, product_categories),
          ai_layout_suggestion = COALESCE($3, ai_layout_suggestion),
          status = COALESCE($4, status),
          last_optimized = CASE WHEN $3 IS NOT NULL THEN CURRENT_DATE ELSE last_optimized END
      WHERE id = $5
      RETURNING *
    `, [current_utilization, product_categories, ai_layout_suggestion, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update zone error:', error);
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

// Delete zone
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM warehouse_zones WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    res.json({ message: 'Zone deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete zone error:', error);
    res.status(500).json({ error: 'Failed to delete zone' });
  }
});

// Generate AI layout optimization for a zone
router.post('/analyze/:zoneId', authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.params;

    // Get zone data
    const zoneResult = await query(`
      SELECT * FROM warehouse_zones WHERE id = $1
    `, [zoneId]);

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    const zone = zoneResult.rows[0];

    // Get all zones for context
    const allZonesResult = await query(`
      SELECT zone_name, zone_type, current_utilization, capacity_units
      FROM warehouse_zones
      ORDER BY zone_name
    `);

    // Get products by category for suggestions
    const productsResult = await query(`
      SELECT category, COUNT(*) as count, SUM(current_stock) as total_stock
      FROM products
      GROUP BY category
      ORDER BY total_stock DESC
    `);

    // Get high-velocity products
    const velocityResult = await query(`
      SELECT p.name, p.sku, p.category, p.current_stock, p.location,
             dp.predicted_quantity
      FROM products p
      LEFT JOIN demand_predictions dp ON p.id = dp.product_id
      ORDER BY dp.predicted_quantity DESC NULLS LAST
      LIMIT 10
    `);

    const prompt = `As a warehouse layout optimization AI, analyze this storage zone and provide recommendations:

Zone Details:
- Name: ${zone.zone_name}
- Type: ${zone.zone_type}
- Location Code: ${zone.location_code}
- Capacity: ${zone.capacity_units} units
- Current Utilization: ${zone.current_utilization}%
- Optimal Utilization: ${zone.optimal_utilization}%
- Access Frequency: ${zone.access_frequency}
- Temperature Controlled: ${zone.temperature_controlled}
- Humidity Controlled: ${zone.humidity_controlled}
- Current Categories: ${JSON.stringify(zone.product_categories)}
- Efficiency Score: ${zone.efficiency_score}
- Picking Efficiency: ${zone.picking_efficiency}%

All Warehouse Zones: ${JSON.stringify(allZonesResult.rows)}
Product Categories: ${JSON.stringify(productsResult.rows)}
High-Velocity Products: ${JSON.stringify(velocityResult.rows.slice(0, 5))}

Analyze the zone layout and provide optimization recommendations.

Respond with this exact JSON structure:
{
  "current_efficiency": <percentage>,
  "potential_efficiency": <percentage after optimization>,
  "utilization_status": "optimal" | "underutilized" | "overutilized",
  "layout_score": {
    "overall": <0-100>,
    "accessibility": <0-100>,
    "organization": <0-100>,
    "flow_optimization": <0-100>
  },
  "product_placement": {
    "well_placed": ["<product/category>"],
    "should_relocate": ["<product/category>"],
    "suggested_additions": ["<product/category>"]
  },
  "optimization_actions": [
    {"action": "<action1>", "impact": "high" | "medium" | "low", "effort": "easy" | "moderate" | "complex"},
    {"action": "<action2>", "impact": "high" | "medium" | "low", "effort": "easy" | "moderate" | "complex"}
  ],
  "space_recommendations": {
    "vertical_utilization": "<suggestion>",
    "aisle_configuration": "<suggestion>",
    "equipment_needs": ["<equipment1>", "<equipment2>"]
  },
  "estimated_improvements": {
    "picking_time_reduction": "<percentage>",
    "storage_capacity_increase": "<percentage>",
    "labor_cost_savings": "<monthly estimate>"
  },
  "summary": "<2-3 sentence optimization summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      zone: {
        id: zone.id,
        name: zone.zone_name,
        type: zone.zone_type,
        utilization: zone.current_utilization,
        capacity: zone.capacity_units
      },
      optimization: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI warehouse optimization error:', error);
    res.status(500).json({ error: 'Failed to generate warehouse optimization' });
  }
});

// Get warehouse overview with AI analysis
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    // Get all zones
    const zonesResult = await query('SELECT * FROM warehouse_zones ORDER BY zone_name');

    // Get summary stats
    const statsResult = await query(`
      SELECT
        COUNT(*) as total_zones,
        SUM(capacity_units) as total_capacity,
        AVG(current_utilization) as avg_utilization,
        AVG(efficiency_score) as avg_efficiency
      FROM warehouse_zones
    `);

    // Get product distribution
    const productsResult = await query(`
      SELECT location, COUNT(*) as product_count, SUM(current_stock) as total_units
      FROM products
      WHERE location IS NOT NULL
      GROUP BY location
    `);

    const prompt = `As a warehouse optimization AI, provide a comprehensive analysis of the entire warehouse layout:

Warehouse Overview:
${JSON.stringify(statsResult.rows[0])}

All Zones:
${JSON.stringify(zonesResult.rows)}

Product Distribution by Location:
${JSON.stringify(productsResult.rows)}

Provide a holistic warehouse optimization strategy.

Respond with this exact JSON structure:
{
  "warehouse_health_score": <0-100>,
  "overall_efficiency": <percentage>,
  "capacity_status": "optimal" | "underutilized" | "near_capacity" | "overutilized",
  "zone_analysis": [
    {"zone": "<name>", "status": "optimal" | "needs_attention" | "critical", "priority": <1-5>}
  ],
  "top_recommendations": [
    {"recommendation": "<rec1>", "impact": "high" | "medium" | "low", "zone": "<affected zone>"},
    {"recommendation": "<rec2>", "impact": "high" | "medium" | "low", "zone": "<affected zone>"},
    {"recommendation": "<rec3>", "impact": "high" | "medium" | "low", "zone": "<affected zone>"}
  ],
  "flow_optimization": {
    "bottlenecks": ["<bottleneck1>", "<bottleneck2>"],
    "improvement_opportunities": ["<opportunity1>", "<opportunity2>"]
  },
  "investment_priorities": ["<priority1>", "<priority2>"],
  "summary": "<3-4 sentence executive summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      stats: statsResult.rows[0],
      zones: zonesResult.rows,
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI warehouse analysis error:', error);
    res.status(500).json({ error: 'Failed to generate warehouse analysis' });
  }
});

export default router;
