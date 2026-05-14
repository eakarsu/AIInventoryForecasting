import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/products/stockout-risk
router.get('/stockout-risk', authenticateToken, async (req, res) => {
  try {
    // Get products with their current stock
    const productsResult = await query(`
      SELECT p.id, p.sku, p.name, p.category, p.current_stock, p.unit_price,
             s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.status = 'active'
      ORDER BY p.name
    `);

    const products = productsResult.rows;

    // Get recent forecast averages per product to estimate avg daily demand
    const forecastResult = await query(`
      SELECT product_id, AVG(predicted_demand) as avg_daily_demand
      FROM demand_predictions
      WHERE prediction_date >= NOW() - INTERVAL '30 days'
      GROUP BY product_id
    `);

    const forecastMap = {};
    forecastResult.rows.forEach(r => {
      forecastMap[r.product_id] = parseFloat(r.avg_daily_demand) || 10;
    });

    const critical = [];
    const warning = [];

    for (const p of products) {
      const avgDailyDemand = forecastMap[p.id] || 10;
      const daysOfSupply = avgDailyDemand > 0 ? p.current_stock / avgDailyDemand : 999;

      const item = {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        current_stock: p.current_stock,
        unit_price: p.unit_price,
        supplier_name: p.supplier_name,
        avg_daily_demand: Math.round(avgDailyDemand * 10) / 10,
        days_of_supply: Math.round(daysOfSupply * 10) / 10,
      };

      if (daysOfSupply < 7) {
        critical.push(item);
      } else if (daysOfSupply < 14) {
        warning.push(item);
      }
    }

    // Sort by days_of_supply ascending (most urgent first)
    critical.sort((a, b) => a.days_of_supply - b.days_of_supply);
    warning.sort((a, b) => a.days_of_supply - b.days_of_supply);

    res.json({ critical, warning });
  } catch (error) {
    console.error('Stockout risk error:', error);
    res.status(500).json({ error: 'Failed to compute stockout risk' });
  }
});

export default router;
