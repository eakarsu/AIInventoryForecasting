import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeProposalTransition, backtest, createForecast, createReplenishmentProposal, validateObservation, versionDigest } from '../src/domain/forecastPolicy.js';
import { integrationReadiness, requireIntegration } from '../src/services/integrationBoundary.js';

function observations() {
  return [8, 10, 12, 14, 13].map((demand, index) => ({
    sku: 'SKU-1', location: 'DC-A', date: `2026-01-0${index + 1}`,
    demand, onHand: 50 - index, leadTimeDays: 2, promotionUplift: 0,
  }));
}

test('validates authoritative observation shape', () => {
  assert.equal(validateObservation(observations()[0]).ok, true);
  assert.equal(validateObservation({ sku: '', location: '', date: 'today', demand: -1 }).ok, false);
});

test('creates a versioned bounded forecast with uncertainty', () => {
  const result = createForecast({ observations: observations(), horizonDays: 3, promotionUplift: 0.1, modelVersion: 'trend-v1' });
  assert.equal(result.points.length, 3);
  assert.equal(result.points.every((point) => point.lower <= point.expected && point.expected <= point.upper), true);
  assert.match(result.dataVersion, /^[a-f0-9]{64}$/);
});

test('rejects mixed SKU/location series and insufficient history', () => {
  assert.throws(() => createForecast({ observations: observations().slice(0, 3), horizonDays: 1, modelVersion: 'v1' }), /at least four/);
  const mixed = observations();
  mixed[2].location = 'DC-B';
  assert.throws(() => createForecast({ observations: mixed, horizonDays: 1, modelVersion: 'v1' }), /one SKU\/location/);
});

test('stable versions do not depend on object key order', () => {
  assert.equal(versionDigest({ b: 2, a: 1 }), versionDigest({ a: 1, b: 2 }));
});

test('proposal respects capacity and remains a draft rather than an order', () => {
  const forecast = createForecast({ observations: observations(), horizonDays: 4, modelVersion: 'v1' });
  const proposal = createReplenishmentProposal({ forecast, onHand: 5, onOrder: 0, safetyStock: 10, minOrder: 6, maxCapacity: 25, leadTimeDays: 3 });
  assert.equal(proposal.status, 'draft');
  assert.equal(proposal.automaticallyOrdered, false);
  assert.equal(proposal.quantity <= 20, true);
  assert.equal(proposal.uncertaintyExposed, true);
});

test('backtest exposes bias, uncertainty coverage, stockout, waste, lead-time error, and override value', () => {
  const metrics = backtest([
    { predicted: 10, actual: 8, lower: 7, upper: 12, stockoutUnits: 1, wasteUnits: 0, predictedLeadTime: 4, actualLeadTime: 5, overrideForecast: 8 },
    { predicted: 12, actual: 15, lower: 9, upper: 14, stockoutUnits: 2, wasteUnits: 1, predictedLeadTime: 5, actualLeadTime: 5 },
  ]);
  assert.equal(metrics.sampleCount, 2);
  assert.equal(metrics.intervalCoverage, 0.5);
  assert.equal(metrics.stockoutUnits, 3);
  assert.equal(metrics.wasteUnits, 1);
  assert.equal(metrics.overrideValue, 2);
  assert.equal(metrics.demandDriftPct, 0.875);
});

test('approval and export require dual control and a ready procurement connector', () => {
  const approvals = [{ actorId: 1, decision: 'approve' }, { actorId: 2, decision: 'approve' }];
  assert.equal(authorizeProposalTransition({ current: 'reviewed', next: 'approved', role: 'manager', approvals }).ok, true);
  const blocked = authorizeProposalTransition({ current: 'approved', next: 'exported', role: 'manager', approvals, connectorReady: false, evidence: { approvalDigest: 'x' } });
  assert.equal(blocked.ok, false);
  const allowed = authorizeProposalTransition({ current: 'approved', next: 'exported', role: 'manager', approvals, connectorReady: true, evidence: { approvalDigest: 'x' } });
  assert.equal(allowed.ok, true);
});

test('all authoritative integrations fail closed without explicit configuration', () => {
  assert.equal(integrationReadiness({}).ready, false);
  assert.throws(() => requireIntegration('procurement', {}), /not ready/);
});

test('readiness requires enablement, endpoint, and token for all integrations', () => {
  const env = {};
  for (const name of ['ERP', 'WMS', 'POS', 'ECOMMERCE', 'PROCUREMENT', 'PROMOTIONS', 'WEATHER_EVENTS', 'PLANNING']) {
    env[`${name}_ENABLED`] = 'true';
    env[`${name}_URL`] = `https://${name.toLowerCase()}.example.invalid`;
    env[`${name}_TOKEN`] = 'configured-at-runtime';
  }
  assert.equal(integrationReadiness(env).ready, true);
});
