import express from 'express';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateAIResponse } from '../services/openrouter.js';
import { logAICall } from '../services/aiAudit.js';

const router = express.Router();

// POST /api/ai/supplier-diversification
router.post('/supplier-diversification', authenticateToken, async (req, res) => {
  try {
    // Get all products with their suppliers
    const productsResult = await query(`
      SELECT p.id, p.name, p.sku, p.category, s.id as supplier_id, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.status = 'active'
    `);

    const products = productsResult.rows;
    const totalSKUs = products.length;

    // Group products by supplier
    const supplierMap = {};
    for (const p of products) {
      const supplierId = p.supplier_id || 'unknown';
      if (!supplierMap[supplierId]) {
        supplierMap[supplierId] = { name: p.supplier_name || 'Unknown', products: [] };
      }
      supplierMap[supplierId].products.push(p);
    }

    // Find single-source suppliers responsible for >30% of SKUs
    const highRiskSuppliers = Object.entries(supplierMap)
      .filter(([, v]) => v.products.length / totalSKUs > 0.3)
      .map(([id, v]) => ({ supplier_id: id, supplier_name: v.name, products: v.products, pct: Math.round(v.products.length / totalSKUs * 100) }));

    const productList = highRiskSuppliers
      .flatMap(s => s.products.map(p => `${p.name} (SKU: ${p.sku}, Supplier: ${s.supplier_name}, ${s.pct}% of SKUs)`))
      .join('\n');

    if (!productList) {
      return res.json({
        high_risk_products: [],
        diversification_recommendations: [],
        overall_risk_score: 0,
        message: 'No single supplier controls more than 30% of SKUs. Supply chain appears diversified.',
      });
    }

    const prompt = `You are a supply chain risk expert. Analyze the following products that rely heavily on single suppliers:

${productList}

These products rely on a single supplier. Recommend diversification strategy.
Return JSON with this exact structure:
{
  "high_risk_products": ["product name 1", "product name 2"],
  "diversification_recommendations": [
    {
      "product": "product name",
      "alternative_suppliers": ["supplier type or name 1", "supplier type or name 2"],
      "lead_time_impact": "description of lead time impact"
    }
  ],
  "overall_risk_score": <number 0-100>
}`;

    const aiResult = await generateAIResponse(prompt);

    logAICall({ user_id: req.user?.id, endpoint: '/api/ai/supplier-diversification', entity_id: null, tokens_used: null });

    res.json(typeof aiResult === 'object' ? aiResult : { raw: aiResult });
  } catch (error) {
    console.error('Supplier diversification error:', error);
    res.status(500).json({ error: 'Failed to analyze supplier diversification' });
  }
});

export default router;
