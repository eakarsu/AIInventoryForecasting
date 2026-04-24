import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all products (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR p.category ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Bulk delete products
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM products WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update products
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
      `UPDATE products SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get product by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, s.name as supplier_name, s.email as supplier_email, s.lead_time_days
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      sku, name, description, category, unit_price, cost_price,
      current_stock, min_stock_level, max_stock_level, reorder_point,
      reorder_quantity, supplier_id, location, status
    } = req.body;

    if (!sku || !name || !unit_price) {
      return res.status(400).json({ error: 'SKU, name, and unit_price are required' });
    }

    const result = await query(`
      INSERT INTO products (
        sku, name, description, category, unit_price, cost_price,
        current_stock, min_stock_level, max_stock_level, reorder_point,
        reorder_quantity, supplier_id, location, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      sku, name, description, category, unit_price, cost_price,
      current_stock || 0, min_stock_level || 10, max_stock_level || 1000,
      reorder_point || 20, reorder_quantity || 50, supplier_id, location, status || 'active'
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      sku, name, description, category, unit_price, cost_price,
      current_stock, min_stock_level, max_stock_level, reorder_point,
      reorder_quantity, supplier_id, location, status
    } = req.body;

    const result = await query(`
      UPDATE products SET
        sku = COALESCE($1, sku),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        unit_price = COALESCE($5, unit_price),
        cost_price = COALESCE($6, cost_price),
        current_stock = COALESCE($7, current_stock),
        min_stock_level = COALESCE($8, min_stock_level),
        max_stock_level = COALESCE($9, max_stock_level),
        reorder_point = COALESCE($10, reorder_point),
        reorder_quantity = COALESCE($11, reorder_quantity),
        supplier_id = COALESCE($12, supplier_id),
        location = COALESCE($13, location),
        status = COALESCE($14, status)
      WHERE id = $15
      RETURNING *
    `, [
      sku, name, description, category, unit_price, cost_price,
      current_stock, min_stock_level, max_stock_level, reorder_point,
      reorder_quantity, supplier_id, location, status, req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get low stock products
router.get('/alerts/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.current_stock <= p.reorder_point
      ORDER BY (p.current_stock::float / p.reorder_point::float) ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

export default router;
