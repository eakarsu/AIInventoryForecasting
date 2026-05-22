import express from 'express';
const router = express.Router();

function optimize(input = {}) {
  const skus = input.skus || [
    { sku: 'YOG-12', days_to_expiry: 5, units: 180, daily_velocity: 22, margin: 1.2 },
    { sku: 'SAUCE-8', days_to_expiry: 40, units: 95, daily_velocity: 8, margin: 2.1 },
  ];
  return { skus: skus.map((s) => {
    const excess = Math.max(0, Number(s.units) - Number(s.daily_velocity) * Number(s.days_to_expiry));
    return { ...s, excess_units: Math.round(excess), action: excess > 50 ? 'markdown_or_bundle' : excess > 0 ? 'promote' : 'hold_price' };
  }) };
}
router.get('/', (req, res) => res.json(optimize()));
router.post('/optimize', (req, res) => res.json(optimize(req.body || {})));
export default router;
