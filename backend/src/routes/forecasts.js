import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all forecasts (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE f.forecast_method ILIKE $1 OR f.trend_direction ILIKE $1 OR f.notes ILIKE $1 OR p.name ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM forecasts f LEFT JOIN products p ON f.product_id = p.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT f.*, p.name as product_name, p.sku as product_sku
      FROM forecasts f
      LEFT JOIN products p ON f.product_id = p.id
      ${whereClause}
      ORDER BY f.forecast_date DESC, f.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get forecasts error:', error);
    res.status(500).json({ error: 'Failed to fetch forecasts' });
  }
});

// Bulk delete forecasts
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM forecasts WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update forecasts
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
      `UPDATE forecasts SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get forecast by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT f.*, p.name as product_name, p.sku as product_sku,
             p.current_stock, p.unit_price
      FROM forecasts f
      LEFT JOIN products p ON f.product_id = p.id
      WHERE f.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forecast not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// Create forecast
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, forecast_date, predicted_demand, actual_demand,
      confidence_level, forecast_method, seasonality_factor, trend_direction, notes
    } = req.body;

    if (!product_id || !forecast_date || !predicted_demand) {
      return res.status(400).json({
        error: 'product_id, forecast_date, and predicted_demand are required'
      });
    }

    const result = await query(`
      INSERT INTO forecasts (
        product_id, forecast_date, predicted_demand, actual_demand,
        confidence_level, forecast_method, seasonality_factor, trend_direction, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      product_id, forecast_date, predicted_demand, actual_demand,
      confidence_level || 85.0, forecast_method || 'AI Model',
      seasonality_factor || 1.0, trend_direction || 'stable', notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create forecast error:', error);
    res.status(500).json({ error: 'Failed to create forecast' });
  }
});

// Update forecast
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      product_id, forecast_date, predicted_demand, actual_demand,
      confidence_level, forecast_method, seasonality_factor, trend_direction, notes
    } = req.body;

    const result = await query(`
      UPDATE forecasts SET
        product_id = COALESCE($1, product_id),
        forecast_date = COALESCE($2, forecast_date),
        predicted_demand = COALESCE($3, predicted_demand),
        actual_demand = COALESCE($4, actual_demand),
        confidence_level = COALESCE($5, confidence_level),
        forecast_method = COALESCE($6, forecast_method),
        seasonality_factor = COALESCE($7, seasonality_factor),
        trend_direction = COALESCE($8, trend_direction),
        notes = COALESCE($9, notes)
      WHERE id = $10
      RETURNING *
    `, [
      product_id, forecast_date, predicted_demand, actual_demand,
      confidence_level, forecast_method, seasonality_factor, trend_direction,
      notes, req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forecast not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update forecast error:', error);
    res.status(500).json({ error: 'Failed to update forecast' });
  }
});

// Delete forecast
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM forecasts WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forecast not found' });
    }

    res.json({ message: 'Forecast deleted successfully' });
  } catch (error) {
    console.error('Delete forecast error:', error);
    res.status(500).json({ error: 'Failed to delete forecast' });
  }
});

// Get forecasts by product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT f.*, p.name as product_name, p.sku as product_sku
      FROM forecasts f
      LEFT JOIN products p ON f.product_id = p.id
      WHERE f.product_id = $1
      ORDER BY f.forecast_date DESC
    `, [req.params.productId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get product forecasts error:', error);
    res.status(500).json({ error: 'Failed to fetch product forecasts' });
  }
});

// Get forecast accuracy metrics
router.get('/metrics/accuracy', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        forecast_method,
        COUNT(*) as total_forecasts,
        AVG(confidence_level) as avg_confidence,
        AVG(
          CASE
            WHEN actual_demand IS NOT NULL AND predicted_demand > 0
            THEN 100 - ABS((actual_demand - predicted_demand)::float / predicted_demand * 100)
            ELSE NULL
          END
        ) as accuracy_percentage
      FROM forecasts
      GROUP BY forecast_method
      ORDER BY accuracy_percentage DESC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get accuracy metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch accuracy metrics' });
  }
});

export default router;
