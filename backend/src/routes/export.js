import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const resourceQueries = {
  products: 'SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id ORDER BY p.id',
  suppliers: 'SELECT * FROM suppliers ORDER BY id',
  orders: 'SELECT o.*, s.name as supplier_name FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id ORDER BY o.id',
  forecasts: 'SELECT f.*, p.name as product_name FROM forecasts f LEFT JOIN products p ON f.product_id = p.id ORDER BY f.id',
  analytics: 'SELECT * FROM analytics ORDER BY id',
  'demand-predictions': 'SELECT dp.*, p.name as product_name FROM demand_predictions dp LEFT JOIN products p ON dp.product_id = p.id ORDER BY dp.id',
  'supplier-risks': 'SELECT sr.*, s.name as supplier_name FROM supplier_risks sr LEFT JOIN suppliers s ON sr.supplier_id = s.id ORDER BY sr.id',
  'reorder-optimizations': 'SELECT ro.*, p.name as product_name FROM reorder_optimizations ro LEFT JOIN products p ON ro.product_id = p.id ORDER BY ro.id',
  'dead-stock': 'SELECT ds.*, p.name as product_name FROM dead_stock ds LEFT JOIN products p ON ds.product_id = p.id ORDER BY ds.id',
  'warehouse-zones': 'SELECT * FROM warehouse_zones ORDER BY id',
  'inventory-optimizations': 'SELECT eo.*, p.name as product_name FROM ecommerce_inventory_optimizations eo LEFT JOIN products p ON eo.product_id = p.id ORDER BY eo.id',
  'shipment-tracking': 'SELECT * FROM shipment_tracking ORDER BY id',
};

// CSV export
router.get('/:resource/csv', authenticateToken, async (req, res) => {
  try {
    const { resource } = req.params;
    const sql = resourceQueries[resource];

    if (!sql) {
      return res.status(400).json({ error: `Unknown resource: ${resource}` });
    }

    const result = await query(sql);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(200).send('No data');
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];

    for (const row of rows) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${resource}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// PDF export (generates HTML table that browser can print to PDF)
router.get('/:resource/pdf', authenticateToken, async (req, res) => {
  try {
    const { resource } = req.params;
    const sql = resourceQueries[resource];

    if (!sql) {
      return res.status(400).json({ error: `Unknown resource: ${resource}` });
    }

    const result = await query(sql);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(200).send('<html><body><h1>No data</h1></body></html>');
    }

    const headers = Object.keys(rows[0]).filter(h =>
      !h.includes('password') && !h.includes('token') && !h.includes('_hash')
    );

    const title = resource.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const date = new Date().toLocaleDateString();

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title} Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #1a56db; margin-bottom: 5px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th { background: #1a56db; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
    td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${title} Report</h1>
  <div class="meta">Generated on ${date} | ${rows.length} records</div>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        if (Array.isArray(val)) val = val.join(', ');
        if (typeof val === 'object') val = JSON.stringify(val);
        const str = String(val);
        return `<td>${str.length > 100 ? str.substring(0, 100) + '...' : str}</td>`;
      }).join('')}</tr>`).join('\n')}
    </tbody>
  </table>
  <div class="footer">AI Inventory Forecasting System</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;
