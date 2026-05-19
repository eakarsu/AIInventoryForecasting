
// === Batch 04 Gaps & Frontend Mounts ===
import route_gap_no_markdown_timing_ai from '../routes/gap-no-markdown-timing-ai.js';
import route_gap_no_supplier_disruption_simulator from '../routes/gap-no-supplier-disruption-simulator.js';
import route_gap_no_multi_warehouse_balancing_ai from '../routes/gap-no-multi-warehouse-balancing-ai.js';
import route_gap_no_sku_rationalization_which_skus_to from '../routes/gap-no-sku-rationalization-which-skus-to.js';
import route_gap_live_erp_sap_netsuite_integrations_still from '../routes/gap-live-erp-sap-netsuite-integrations-still.js';
import route_gap_no_financial_pl_module from '../routes/gap-no-financial-pl-module.js';
import route_gap_no_notifications_module_0_references from '../routes/gap-no-notifications-module-0-references.js';
import route_gap_no_webhook_surface from '../routes/gap-no-webhook-surface.js';
import route_gap_no_file_upload_for_supplier_docs from '../routes/gap-no-file-upload-for-supplier-docs.js';
import route_gap_no_real_time_websocket_inventory_updates from '../routes/gap-no-real-time-websocket-inventory-updates.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generalLimiter, authLimiter, aiLimiter, aiAnalyzeLimiter } from './middleware/rateLimit.js';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

// Import routes
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import forecastsRoutes from './routes/forecasts.js';
import suppliersRoutes from './routes/suppliers.js';
import ordersRoutes from './routes/orders.js';
import analyticsRoutes from './routes/analytics.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/export.js';

// Import new AI feature routes
import demandPredictorRoutes from './routes/demandPredictor.js';
import supplierRiskRoutes from './routes/supplierRisk.js';
import reorderOptimizerRoutes from './routes/reorderOptimizer.js';
import deadStockRoutes from './routes/deadStock.js';
import warehouseOptimizerRoutes from './routes/warehouseOptimizer.js';
import inventoryOptimizerRoutes from './routes/inventoryOptimizer.js';
import shipmentTrackerRoutes from './routes/shipmentTracker.js';
import stockoutRiskRoutes from './routes/stockoutRisk.js';
import supplierDiversificationRoutes from './routes/supplierDiversification.js';
import promotionSimulatorRoutes from './routes/promotionSimulator.js';

// Apply pass 5 — additive
import replenishmentRoutes from './routes/replenishment.js';
import supplierMarketplaceRoutes from './routes/supplierMarketplace.js';
import integrationRoutes from './routes/integrations.js';

// Custom Views (4 features)
import customViewsRoutes from './routes/customViews.js';

import { ensureAuditTable } from './services/aiAudit.js';

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/forecasts', forecastsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/export', exportRoutes);

// New AI Feature Routes
app.use('/api/demand-predictor', demandPredictorRoutes);
app.use('/api/supplier-risk', supplierRiskRoutes);
app.use('/api/reorder-optimizer', reorderOptimizerRoutes);
app.use('/api/dead-stock', deadStockRoutes);
app.use('/api/warehouse-optimizer', warehouseOptimizerRoutes);
app.use('/api/inventory-optimizer', inventoryOptimizerRoutes);
app.use('/api/shipment-tracker', shipmentTrackerRoutes);

// Apply AI analyze rate limiter to all AI analyze sub-routes
app.use('/api/demand-predictor/analyze', aiAnalyzeLimiter);
app.use('/api/supplier-risk/analyze', aiAnalyzeLimiter);
app.use('/api/reorder-optimizer/analyze', aiAnalyzeLimiter);
app.use('/api/dead-stock/analyze', aiAnalyzeLimiter);
app.use('/api/warehouse-optimizer/analyze', aiAnalyzeLimiter);
app.use('/api/inventory-optimizer/analyze', aiAnalyzeLimiter);
app.use('/api/shipment-tracker/analyze', aiAnalyzeLimiter);

// New routes
app.use('/api/products', stockoutRiskRoutes);
app.use('/api/ai', aiAnalyzeLimiter, supplierDiversificationRoutes);
app.use('/api/ai', aiAnalyzeLimiter, promotionSimulatorRoutes);

// Apply pass 5
app.use('/api/replenishment', replenishmentRoutes);
app.use('/api/supplier-marketplace', supplierMarketplaceRoutes);
app.use('/api/integrations', integrationRoutes);
import('./routes/markdownOptimizer.js').then(m => app.use('/api/markdown-optimizer', m.default));
import('./routes/multiWarehouseBalancer.js').then(m => app.use('/api/multi-warehouse-balancer', m.default));

// Custom Views mounted BEFORE 404 handler
app.use('/api/custom-views', customViewsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});


app.use('/api/gap-no-markdown-timing-ai', route_gap_no_markdown_timing_ai);
app.use('/api/gap-no-supplier-disruption-simulator', route_gap_no_supplier_disruption_simulator);
app.use('/api/gap-no-multi-warehouse-balancing-ai', route_gap_no_multi_warehouse_balancing_ai);
app.use('/api/gap-no-sku-rationalization-which-skus-to', route_gap_no_sku_rationalization_which_skus_to);
app.use('/api/gap-live-erp-sap-netsuite-integrations-still', route_gap_live_erp_sap_netsuite_integrations_still);
app.use('/api/gap-no-financial-pl-module', route_gap_no_financial_pl_module);
app.use('/api/gap-no-notifications-module-0-references', route_gap_no_notifications_module_0_references);
app.use('/api/gap-no-webhook-surface', route_gap_no_webhook_surface);
app.use('/api/gap-no-file-upload-for-supplier-docs', route_gap_no_file_upload_for_supplier_docs);
app.use('/api/gap-no-real-time-websocket-inventory-updates', route_gap_no_real_time_websocket_inventory_updates);

app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  await ensureAuditTable();
});
