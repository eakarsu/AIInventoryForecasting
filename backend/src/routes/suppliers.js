import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all suppliers (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE s.name ILIKE $1 OR s.email ILIKE $1 OR s.address ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM suppliers s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count,
        (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id) as order_count
      FROM suppliers s
      ${whereClause}
      ORDER BY s.rating DESC, s.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Bulk delete suppliers
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM suppliers WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update suppliers
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
      `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get supplier by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplierResult = await query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = supplierResult.rows[0];

    // Get associated products
    const productsResult = await query(
      'SELECT id, sku, name, current_stock FROM products WHERE supplier_id = $1',
      [req.params.id]
    );

    // Get recent orders
    const ordersResult = await query(`
      SELECT id, order_number, order_date, status, total_amount
      FROM orders
      WHERE supplier_id = $1
      ORDER BY order_date DESC
      LIMIT 10
    `, [req.params.id]);

    res.json({
      ...supplier,
      products: productsResult.rows,
      recent_orders: ordersResult.rows
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// Create supplier
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name, email, phone, address, rating, lead_time_days,
      reliability_score, total_orders, on_time_delivery_rate, status, notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate rating is between 0-5
    const validRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));
    // Validate percentages are between 0-100
    const validReliability = Math.min(100, Math.max(0, parseFloat(reliability_score) || 0));
    const validOnTime = Math.min(100, Math.max(0, parseFloat(on_time_delivery_rate) || 0));

    const result = await query(`
      INSERT INTO suppliers (
        name, email, phone, address, rating, lead_time_days,
        reliability_score, total_orders, on_time_delivery_rate, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name, email, phone, address, validRating, lead_time_days || 7,
      validReliability, total_orders || 0, validOnTime,
      status || 'active', notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name, email, phone, address, rating, lead_time_days,
      reliability_score, total_orders, on_time_delivery_rate, status, notes
    } = req.body;

    const result = await query(`
      UPDATE suppliers SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        rating = COALESCE($5, rating),
        lead_time_days = COALESCE($6, lead_time_days),
        reliability_score = COALESCE($7, reliability_score),
        total_orders = COALESCE($8, total_orders),
        on_time_delivery_rate = COALESCE($9, on_time_delivery_rate),
        status = COALESCE($10, status),
        notes = COALESCE($11, notes)
      WHERE id = $12
      RETURNING *
    `, [
      name, email, phone, address, rating, lead_time_days,
      reliability_score, total_orders, on_time_delivery_rate, status, notes,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if supplier has associated products
    const productCheck = await query(
      'SELECT COUNT(*) FROM products WHERE supplier_id = $1',
      [req.params.id]
    );

    if (parseInt(productCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Cannot delete supplier with associated products'
      });
    }

    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Get top suppliers by rating
router.get('/ranking/top', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count
      FROM suppliers s
      WHERE s.status = 'active'
      ORDER BY s.rating DESC, s.on_time_delivery_rate DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get top suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch top suppliers' });
  }
});

export default router;
