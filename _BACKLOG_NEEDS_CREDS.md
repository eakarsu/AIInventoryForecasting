# Backlog — credentials required

503-stubbed in `backend/src/routes/integrations.js`:

| Endpoint | Required env var(s) |
|----------|---------------------|
| `POST /api/integrations/sap/sync` | `SAP_BASE_URL`, `SAP_API_KEY` |
| `POST /api/integrations/netsuite/sync` | `NETSUITE_ACCOUNT_ID`, `NETSUITE_TOKEN`, `NETSUITE_TOKEN_SECRET`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET` |
| `POST /api/integrations/shopify/orders` | `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_SHOP_DOMAIN` |
| `POST /api/integrations/quickbooks/pl` | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REALM_ID` |

`GET /api/integrations/status` exposes config booleans.
