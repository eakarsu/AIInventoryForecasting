/*
 * routes/integrations.js — Apply pass 5 (NEEDS-CREDS stubs)
 *
 * ERP / POS / accounting integration scaffolds. 503 with explicit env hints.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

function noKey(res, provider, vars) {
  return res.status(503).json({
    error: `${provider} integration unavailable: credentials not configured`,
    required_env: vars,
    provider_status: 'not_configured',
  });
}

router.post('/sap/sync', (_req, res) => {
  if (!process.env.SAP_BASE_URL || !process.env.SAP_API_KEY) {
    return noKey(res, 'SAP', ['SAP_BASE_URL', 'SAP_API_KEY']);
  }
  res.status(501).json({ error: 'SAP integration scaffolded but not implemented' });
});

router.post('/netsuite/sync', (_req, res) => {
  if (!process.env.NETSUITE_ACCOUNT_ID || !process.env.NETSUITE_TOKEN) {
    return noKey(res, 'NetSuite', ['NETSUITE_ACCOUNT_ID', 'NETSUITE_TOKEN', 'NETSUITE_TOKEN_SECRET', 'NETSUITE_CONSUMER_KEY', 'NETSUITE_CONSUMER_SECRET']);
  }
  res.status(501).json({ error: 'NetSuite integration scaffolded but not implemented' });
});

router.post('/shopify/orders', (_req, res) => {
  if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
    return noKey(res, 'Shopify', ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP_DOMAIN']);
  }
  res.status(501).json({ error: 'Shopify integration scaffolded but not implemented' });
});

router.post('/quickbooks/pl', (_req, res) => {
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_REALM_ID) {
    return noKey(res, 'QuickBooks', ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET', 'QUICKBOOKS_REALM_ID']);
  }
  res.status(501).json({ error: 'QuickBooks P&L scaffolded but not implemented' });
});

router.get('/status', (_req, res) => {
  res.json({
    sap: !!(process.env.SAP_BASE_URL && process.env.SAP_API_KEY),
    netsuite: !!(process.env.NETSUITE_ACCOUNT_ID && process.env.NETSUITE_TOKEN),
    shopify: !!(process.env.SHOPIFY_ACCESS_TOKEN && process.env.SHOPIFY_SHOP_DOMAIN),
    quickbooks: !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_REALM_ID),
  });
});

export default router;
