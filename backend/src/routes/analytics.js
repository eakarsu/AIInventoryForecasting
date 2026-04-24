import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all analytics (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE a.metric_name ILIKE $1 OR a.category ILIKE $1 OR a.notes ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM analytics a LEFT JOIN products p ON a.product_id = p.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT a.*, p.name as product_name, p.sku as product_sku
      FROM analytics a
      LEFT JOIN products p ON a.product_id = p.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get analytics by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.*, p.name as product_name, p.sku as product_sku
      FROM analytics a
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analytics record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get summary statistics
router.get('/summary/dashboard', authenticateToken, async (req, res) => {
  try {
    // Total products
    const productsResult = await query('SELECT COUNT(*) as count FROM products');

    // Total inventory value
    const inventoryResult = await query(
      'SELECT SUM(current_stock * unit_price) as total_value FROM products'
    );

    // Low stock alerts
    const lowStockResult = await query(
      'SELECT COUNT(*) as count FROM products WHERE current_stock <= reorder_point'
    );

    // Active orders
    const ordersResult = await query(
      "SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'processing', 'in_transit')"
    );

    // Total suppliers
    const suppliersResult = await query(
      "SELECT COUNT(*) as count FROM suppliers WHERE status = 'active'"
    );

    // Pending recommendations
    const recommendationsResult = await query(
      "SELECT COUNT(*) as count FROM ai_recommendations WHERE status = 'pending'"
    );

    res.json({
      total_products: parseInt(productsResult.rows[0].count),
      inventory_value: parseFloat(inventoryResult.rows[0].total_value || 0),
      low_stock_alerts: parseInt(lowStockResult.rows[0].count),
      active_orders: parseInt(ordersResult.rows[0].count),
      active_suppliers: parseInt(suppliersResult.rows[0].count),
      pending_recommendations: parseInt(recommendationsResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get analytics by category
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.*, p.name as product_name
      FROM analytics a
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.category = $1
      ORDER BY a.created_at DESC
    `, [req.params.category]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch category analytics' });
  }
});

// Get inventory turnover
router.get('/metrics/turnover', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        p.id, p.sku, p.name, p.current_stock, p.unit_price,
        (p.current_stock * p.unit_price) as inventory_value,
        CASE
          WHEN p.current_stock > 0 THEN ROUND((p.max_stock_level::decimal / p.current_stock), 2)
          ELSE 0
        END as turnover_ratio
      FROM products p
      WHERE p.status = 'active'
      ORDER BY turnover_ratio DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get turnover metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch turnover metrics' });
  }
});

// Get stock level distribution
router.get('/metrics/stock-distribution', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        CASE
          WHEN current_stock = 0 THEN 'Out of Stock'
          WHEN current_stock <= reorder_point THEN 'Low Stock'
          WHEN current_stock <= (max_stock_level * 0.5) THEN 'Normal'
          ELSE 'Overstocked'
        END as status,
        COUNT(*) as count,
        SUM(current_stock * unit_price) as value
      FROM products
      GROUP BY
        CASE
          WHEN current_stock = 0 THEN 'Out of Stock'
          WHEN current_stock <= reorder_point THEN 'Low Stock'
          WHEN current_stock <= (max_stock_level * 0.5) THEN 'Normal'
          ELSE 'Overstocked'
        END
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get stock distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch stock distribution' });
  }
});

// Get category breakdown
router.get('/metrics/categories', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        category,
        COUNT(*) as product_count,
        SUM(current_stock) as total_stock,
        SUM(current_stock * unit_price) as total_value,
        AVG(unit_price) as avg_price
      FROM products
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY total_value DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get categories breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch categories breakdown' });
  }
});

// Create analytics record
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      metric_name, metric_value, metric_type, category, period_start, period_end,
      product_id, comparison_value, change_percentage, trend, notes
    } = req.body;

    if (!metric_name || metric_value === undefined) {
      return res.status(400).json({ error: 'metric_name and metric_value are required' });
    }

    const result = await query(`
      INSERT INTO analytics (
        metric_name, metric_value, metric_type, category, period_start, period_end,
        product_id, comparison_value, change_percentage, trend, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      metric_name, metric_value, metric_type, category, period_start, period_end,
      product_id, comparison_value, change_percentage, trend, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create analytics error:', error);
    res.status(500).json({ error: 'Failed to create analytics record' });
  }
});

export default router;
