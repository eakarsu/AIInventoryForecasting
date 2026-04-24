import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all shipments (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE st.shipment_number ILIKE $1 OR st.carrier ILIKE $1 OR st.current_location ILIKE $1 OR st.current_status ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM shipment_tracking st LEFT JOIN suppliers s ON st.supplier_id = s.id LEFT JOIN orders o ON st.order_id = o.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT st.*, s.name as supplier_name, o.order_number
      FROM shipment_tracking st
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      LEFT JOIN orders o ON st.order_id = o.id
      ${whereClause}
      ORDER BY
        CASE st.priority_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        st.estimated_arrival ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
});

// Bulk delete shipments
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM shipment_tracking WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update shipments
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
      `UPDATE shipment_tracking SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get shipment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT st.*, s.name as supplier_name, s.email as supplier_email,
             s.phone as supplier_phone, o.order_number, o.total_amount
      FROM shipment_tracking st
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      LEFT JOIN orders o ON st.order_id = o.id
      WHERE st.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
});

// Create new shipment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      shipment_number, order_id, supplier_id, origin_location, destination_location,
      carrier, tracking_number, shipment_type, weight_kg, volume_cbm,
      estimated_departure, estimated_arrival, priority_level, temperature_sensitive,
      handling_instructions, cost_estimate, insurance_value
    } = req.body;

    const result = await query(`
      INSERT INTO shipment_tracking (shipment_number, order_id, supplier_id, origin_location,
        destination_location, carrier, tracking_number, shipment_type, weight_kg, volume_cbm,
        estimated_departure, estimated_arrival, priority_level, temperature_sensitive,
        handling_instructions, cost_estimate, insurance_value, current_status, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending', 'pending')
      RETURNING *
    `, [shipment_number, order_id, supplier_id, origin_location, destination_location,
        carrier, tracking_number, shipment_type, weight_kg, volume_cbm,
        estimated_departure, estimated_arrival, priority_level, temperature_sensitive,
        handling_instructions, cost_estimate, insurance_value]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create shipment error:', error);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
});

// Update shipment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      current_location, current_status, delay_days, delay_reason,
      actual_departure, actual_arrival, current_temperature, customs_status,
      actual_cost, status
    } = req.body;

    const result = await query(`
      UPDATE shipment_tracking
      SET current_location = COALESCE($1, current_location),
          current_status = COALESCE($2, current_status),
          delay_days = COALESCE($3, delay_days),
          delay_reason = COALESCE($4, delay_reason),
          actual_departure = COALESCE($5, actual_departure),
          actual_arrival = COALESCE($6, actual_arrival),
          current_temperature = COALESCE($7, current_temperature),
          customs_status = COALESCE($8, customs_status),
          actual_cost = COALESCE($9, actual_cost),
          status = COALESCE($10, status),
          last_updated = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [current_location, current_status, delay_days, delay_reason,
        actual_departure, actual_arrival, current_temperature, customs_status,
        actual_cost, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update shipment error:', error);
    res.status(500).json({ error: 'Failed to update shipment' });
  }
});

// Delete shipment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM shipment_tracking WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ message: 'Shipment deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete shipment error:', error);
    res.status(500).json({ error: 'Failed to delete shipment' });
  }
});

// Generate AI shipment analysis
router.post('/analyze/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get shipment data
    const shipmentResult = await query(`
      SELECT st.*, s.name as supplier_name, s.reliability_score, s.on_time_delivery_rate,
             o.order_number, o.total_amount
      FROM shipment_tracking st
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      LEFT JOIN orders o ON st.order_id = o.id
      WHERE st.id = $1
    `, [id]);

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];

    // Get historical shipments from same route
    const historyResult = await query(`
      SELECT * FROM shipment_tracking
      WHERE origin_location = $1 AND destination_location = $2
      AND id != $3
      ORDER BY created_at DESC
      LIMIT 5
    `, [shipment.origin_location, shipment.destination_location, id]);

    const prompt = `As an AI logistics and shipment tracking specialist, analyze this shipment and provide comprehensive tracking insights:

Shipment Details:
- Shipment Number: ${shipment.shipment_number}
- Carrier: ${shipment.carrier}
- Type: ${shipment.shipment_type}
- Route: ${shipment.origin_location} -> ${shipment.destination_location}
- Current Location: ${shipment.current_location || 'Origin'}
- Current Status: ${shipment.current_status}
- Estimated Departure: ${shipment.estimated_departure}
- Estimated Arrival: ${shipment.estimated_arrival}
- Weight: ${shipment.weight_kg} kg
- Volume: ${shipment.volume_cbm} CBM
- Priority: ${shipment.priority_level}
- Temperature Sensitive: ${shipment.temperature_sensitive}
- Current Temperature: ${shipment.current_temperature || 'N/A'}
- Delay Days: ${shipment.delay_days}
- Delay Reason: ${shipment.delay_reason || 'None'}

Supplier Info:
- Name: ${shipment.supplier_name}
- Reliability Score: ${shipment.reliability_score}
- On-Time Delivery Rate: ${shipment.on_time_delivery_rate}%

Historical Route Data: ${JSON.stringify(historyResult.rows.slice(0, 3))}

Analyze the shipment status and provide ETA predictions, risk assessment, and recommendations.

Respond with this exact JSON structure:
{
  "eta_analysis": {
    "predicted_arrival": "<datetime>",
    "confidence": <percentage>,
    "delay_probability": <percentage>,
    "estimated_delay_days": <number if applicable>
  },
  "risk_assessment": {
    "overall_risk": "low" | "medium" | "high" | "critical",
    "risk_score": <0-100>,
    "risk_factors": ["<factor1>", "<factor2>"],
    "mitigation_actions": ["<action1>", "<action2>"]
  },
  "route_analysis": {
    "route_efficiency": <percentage>,
    "alternative_routes": ["<route1>", "<route2>"],
    "optimization_potential": "<description>"
  },
  "temperature_status": {
    "status": "normal" | "warning" | "critical" | "not_applicable",
    "recommendation": "<if temperature sensitive>"
  },
  "customs_prediction": {
    "expected_clearance": "<timeframe>",
    "potential_issues": ["<issue1>"],
    "documentation_status": "complete" | "incomplete" | "pending"
  },
  "cost_analysis": {
    "estimated_final_cost": <number>,
    "cost_variance": <percentage>,
    "cost_optimization": "<suggestion>"
  },
  "carrier_performance": {
    "current_shipment_rating": <1-5>,
    "carrier_recommendation": "<keep/switch/monitor>"
  },
  "action_items": ["<action1>", "<action2>", "<action3>"],
  "summary": "<3-4 sentence executive summary>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      shipment: {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        carrier: shipment.carrier,
        origin: shipment.origin_location,
        destination: shipment.destination_location,
        current_status: shipment.current_status,
        priority: shipment.priority_level
      },
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI shipment analysis error:', error);
    res.status(500).json({ error: 'Failed to generate shipment analysis' });
  }
});

// Analyze all active shipments
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const shipmentsResult = await query(`
      SELECT st.*, s.name as supplier_name
      FROM shipment_tracking st
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      WHERE st.status NOT IN ('delivered', 'cancelled')
      ORDER BY
        CASE st.priority_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        st.delay_days DESC
      LIMIT 15
    `);

    const prompt = `As an AI logistics operations specialist, analyze this fleet of active shipments and provide strategic oversight:

Active Shipments Overview:
${shipmentsResult.rows.map(s => `- ${s.shipment_number}: ${s.origin_location} -> ${s.destination_location}, Status: ${s.current_status}, Priority: ${s.priority_level}, Delay: ${s.delay_days} days`).join('\n')}

Total Active Shipments: ${shipmentsResult.rows.length}
Delayed Shipments: ${shipmentsResult.rows.filter(s => s.delay_days > 0).length}
Critical Priority: ${shipmentsResult.rows.filter(s => s.priority_level === 'critical').length}
Temperature Sensitive: ${shipmentsResult.rows.filter(s => s.temperature_sensitive).length}

Provide comprehensive fleet analysis and operational recommendations.

Respond with this exact JSON structure:
{
  "fleet_overview": {
    "total_in_transit": <number>,
    "on_schedule": <number>,
    "delayed": <number>,
    "at_risk": <number>,
    "fleet_health_score": <0-100>
  },
  "critical_shipments": [
    {"shipment": "<number>", "issue": "<description>", "recommended_action": "<action>"}
  ],
  "delay_analysis": {
    "total_delayed": <number>,
    "average_delay_days": <number>,
    "primary_delay_causes": ["<cause1>", "<cause2>"],
    "delay_trend": "improving" | "stable" | "worsening"
  },
  "carrier_performance": [
    {"carrier": "<name>", "on_time_rate": <percentage>, "recommendation": "<advice>"}
  ],
  "route_insights": {
    "problematic_routes": ["<route1>"],
    "efficient_routes": ["<route1>"],
    "optimization_opportunities": ["<opportunity1>"]
  },
  "cost_summary": {
    "total_estimated_cost": <number>,
    "potential_savings": <number>,
    "cost_optimization_actions": ["<action1>"]
  },
  "immediate_actions": ["<action1>", "<action2>", "<action3>"],
  "strategic_recommendations": ["<rec1>", "<rec2>"],
  "summary": "<4-5 sentence executive summary of fleet status>"
}`;

    const aiResponse = await generateAIResponse(prompt);

    res.json({
      shipments: shipmentsResult.rows,
      analysis: aiResponse,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI fleet analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze fleet' });
  }
});

// Get shipment statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_shipments,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'delayed') as delayed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE priority_level = 'critical') as critical,
        COUNT(*) FILTER (WHERE temperature_sensitive = true) as temperature_sensitive,
        AVG(delay_days) FILTER (WHERE delay_days > 0) as avg_delay_days,
        SUM(cost_estimate) as total_estimated_cost,
        SUM(actual_cost) FILTER (WHERE actual_cost IS NOT NULL) as total_actual_cost
      FROM shipment_tracking
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get shipment stats error:', error);
    res.status(500).json({ error: 'Failed to fetch shipment statistics' });
  }
});

export default router;
