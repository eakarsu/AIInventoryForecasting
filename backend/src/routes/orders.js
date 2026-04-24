import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination, paginatedResponse } from '../middleware/pagination.js';

const router = express.Router();

// Get all orders (with pagination + search)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req);

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = `WHERE o.order_number ILIKE $1 OR o.notes ILIKE $1 OR o.status ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT o.*, s.name as supplier_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      ${whereClause}
      ORDER BY o.order_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json(paginatedResponse(result.rows, total, { page, limit }));
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Bulk delete orders
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`DELETE FROM orders WHERE id IN (${placeholders}) RETURNING id`, ids);
    res.json({ message: `${result.rows.length} items deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Bulk update orders
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
      `UPDATE orders SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING id`,
      [...setParams, ...ids]
    );
    res.json({ message: `${result.rows.length} items updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderResult = await query(`
      SELECT o.*, s.name as supplier_name, s.email as supplier_email,
             u.name as created_by_name
      FROM orders o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = $1
    `, [req.params.id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items
    const itemsResult = await query(`
      SELECT oi.*, p.name as product_name, p.sku as product_sku
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [req.params.id]);

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      supplier_id, expected_delivery, status, shipping_cost, notes, items
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: 'supplier_id is required' });
    }

    // Generate order number
    const orderNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Calculate total amount from items
    let totalAmount = 0;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    }

    const orderResult = await query(`
      INSERT INTO orders (
        order_number, supplier_id, expected_delivery, status,
        total_amount, shipping_cost, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      orderNumber, supplier_id, expected_delivery, status || 'pending',
      totalAmount, shipping_cost || 0, notes, req.user.id
    ]);

    const order = orderResult.rows[0];

    // Insert order items
    if (items && items.length > 0) {
      for (const item of items) {
        await query(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]);
      }
    }

    // Fetch complete order with items
    const completeOrder = await query(`
      SELECT o.*, s.name as supplier_name
      FROM orders o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      WHERE o.id = $1
    `, [order.id]);

    res.status(201).json(completeOrder.rows[0]);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      supplier_id, expected_delivery, actual_delivery, status,
      total_amount, shipping_cost, notes
    } = req.body;

    const result = await query(`
      UPDATE orders SET
        supplier_id = COALESCE($1, supplier_id),
        expected_delivery = COALESCE($2, expected_delivery),
        actual_delivery = COALESCE($3, actual_delivery),
        status = COALESCE($4, status),
        total_amount = COALESCE($5, total_amount),
        shipping_cost = COALESCE($6, shipping_cost),
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *
    `, [
      supplier_id, expected_delivery, actual_delivery, status,
      total_amount, shipping_cost, notes, req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete order
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Get orders by status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT o.*, s.name as supplier_name
      FROM orders o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      WHERE o.status = $1
      ORDER BY o.order_date DESC
    `, [req.params.status]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get orders by status error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order summary statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_value
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to fetch order statistics' });
  }
});

export default router;
