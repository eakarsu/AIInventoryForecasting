import crypto from 'node:crypto';

const TRANSITIONS = Object.freeze({
  draft: new Set(['reviewed', 'cancelled']),
  reviewed: new Set(['approved', 'draft', 'cancelled']),
  approved: new Set(['exported', 'cancelled']),
  exported: new Set(['measured']),
  measured: new Set(),
  cancelled: new Set(),
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function versionDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function numeric(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

export function validateObservation(row) {
  const errors = [];
  if (!String(row?.sku || '').trim()) errors.push('sku is required');
  if (!String(row?.location || '').trim()) errors.push('location is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ''))) errors.push('date must be YYYY-MM-DD');
  for (const field of ['demand', 'onHand', 'leadTimeDays']) {
    const value = Number(row?.[field]);
    if (!Number.isFinite(value) || value < 0) errors.push(`${field} must be non-negative`);
  }
  if (row?.promotionUplift != null && (!Number.isFinite(Number(row.promotionUplift)) || Number(row.promotionUplift) < -1)) {
    errors.push('promotionUplift must be finite and at least -1');
  }
  return { ok: errors.length === 0, errors };
}

function quantile(sorted, percentile) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index];
}

export function createForecast({ observations, horizonDays, promotionUplift = 0, modelVersion }) {
  if (!Array.isArray(observations) || observations.length < 4) throw new Error('at least four observations are required');
  observations.forEach((row, index) => {
    const validation = validateObservation(row);
    if (!validation.ok) throw new Error(`observation ${index}: ${validation.errors.join('; ')}`);
  });
  if (new Set(observations.map((row) => row.sku)).size !== 1 || new Set(observations.map((row) => row.location)).size !== 1) {
    throw new Error('observations must belong to one SKU/location series');
  }
  const horizons = numeric(horizonDays, 'horizonDays');
  if (!Number.isInteger(horizons) || horizons < 1 || horizons > 365) throw new Error('horizonDays must be an integer from 1 to 365');
  if (!String(modelVersion || '').trim()) throw new Error('modelVersion is required');
  const ordered = [...observations].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const demand = ordered.map((row) => Number(row.demand));
  const window = demand.slice(-Math.min(8, demand.length));
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const trend = window.length > 1 ? (window.at(-1) - window[0]) / (window.length - 1) : 0;
  const residuals = window.map((value, index) => Math.abs(value - (mean + trend * (index - window.length + 1)))).sort((a, b) => a - b);
  const uncertainty = Math.max(1, quantile(residuals, 0.9));
  const uplift = numeric(promotionUplift, 'promotionUplift');
  if (uplift < -1 || uplift > 10) throw new Error('promotionUplift is outside the governed range');
  const points = Array.from({ length: horizons }, (_, index) => {
    const expected = Math.max(0, (mean + trend * (index + 1)) * (1 + uplift));
    return {
      horizon: index + 1,
      expected: Number(expected.toFixed(3)),
      lower: Number(Math.max(0, expected - uncertainty).toFixed(3)),
      upper: Number((expected + uncertainty).toFixed(3)),
    };
  });
  return {
    sku: ordered[0].sku,
    location: ordered[0].location,
    modelVersion,
    dataVersion: versionDigest(ordered),
    assumptions: { method: 'bounded-moving-trend-v1', promotionUplift: uplift, sampleCount: ordered.length },
    points,
  };
}

export function createReplenishmentProposal({ forecast, onHand, onOrder = 0, safetyStock, minOrder = 0, maxCapacity, leadTimeDays }) {
  if (!forecast?.points?.length) throw new Error('forecast points are required');
  const values = {
    onHand: numeric(onHand, 'onHand'), onOrder: numeric(onOrder, 'onOrder'),
    safetyStock: numeric(safetyStock, 'safetyStock'), minOrder: numeric(minOrder, 'minOrder'),
    maxCapacity: numeric(maxCapacity, 'maxCapacity'), leadTimeDays: numeric(leadTimeDays, 'leadTimeDays'),
  };
  if (Object.values(values).some((value) => value < 0)) throw new Error('inventory constraints cannot be negative');
  const leadTimeDemand = forecast.points.slice(0, Math.ceil(values.leadTimeDays)).reduce((sum, point) => sum + point.expected, 0);
  const upperDemand = forecast.points.slice(0, Math.ceil(values.leadTimeDays)).reduce((sum, point) => sum + point.upper, 0);
  const netNeed = Math.max(0, upperDemand + values.safetyStock - values.onHand - values.onOrder);
  const capacityRemaining = Math.max(0, values.maxCapacity - values.onHand - values.onOrder);
  let quantity = Math.min(netNeed, capacityRemaining);
  if (quantity > 0 && quantity < values.minOrder) quantity = Math.min(values.minOrder, capacityRemaining);
  return {
    status: 'draft',
    quantity: Math.ceil(quantity),
    expectedLeadTimeDemand: Number(leadTimeDemand.toFixed(3)),
    upperLeadTimeDemand: Number(upperDemand.toFixed(3)),
    uncertaintyExposed: true,
    automaticallyOrdered: false,
    rationale: { ...values, dataVersion: forecast.dataVersion, modelVersion: forecast.modelVersion },
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function backtest(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('backtest rows are required');
  const normalized = rows.map((row) => ({
    predicted: numeric(row.predicted, 'predicted'), actual: numeric(row.actual, 'actual'),
    lower: numeric(row.lower, 'lower'), upper: numeric(row.upper, 'upper'),
    stockoutUnits: numeric(row.stockoutUnits || 0, 'stockoutUnits'), wasteUnits: numeric(row.wasteUnits || 0, 'wasteUnits'),
    predictedLeadTime: numeric(row.predictedLeadTime, 'predictedLeadTime'), actualLeadTime: numeric(row.actualLeadTime, 'actualLeadTime'),
    overrideForecast: row.overrideForecast == null ? null : numeric(row.overrideForecast, 'overrideForecast'),
  }));
  const errors = normalized.map((row) => row.predicted - row.actual);
  const absolute = errors.map(Math.abs);
  const actualTotal = normalized.reduce((sum, row) => sum + Math.abs(row.actual), 0);
  const covered = normalized.filter((row) => row.actual >= row.lower && row.actual <= row.upper).length;
  const overrideRows = normalized.filter((row) => row.overrideForecast != null);
  const midpoint = Math.max(1, Math.floor(normalized.length / 2));
  const referenceMean = average(normalized.slice(0, midpoint).map((row) => row.actual));
  const recentMean = average(normalized.slice(midpoint).map((row) => row.actual));
  return {
    sampleCount: normalized.length,
    bias: average(errors),
    mae: average(absolute),
    wmape: actualTotal ? absolute.reduce((sum, value) => sum + value, 0) / actualTotal : null,
    intervalCoverage: covered / normalized.length,
    stockoutUnits: normalized.reduce((sum, row) => sum + row.stockoutUnits, 0),
    wasteUnits: normalized.reduce((sum, row) => sum + row.wasteUnits, 0),
    leadTimeMae: average(normalized.map((row) => Math.abs(row.predictedLeadTime - row.actualLeadTime))),
    overrideValue: overrideRows.length ? average(overrideRows.map((row) => Math.abs(row.predicted - row.actual) - Math.abs(row.overrideForecast - row.actual))) : null,
    demandDriftPct: referenceMean ? (recentMean - referenceMean) / Math.abs(referenceMean) : null,
  };
}

export function authorizeProposalTransition({ current, next, role, approvals = [], connectorReady = false, evidence }) {
  const errors = [];
  if (!TRANSITIONS[current]?.has(next)) errors.push(`transition ${current} -> ${next} is not allowed`);
  if (!['planner', 'manager', 'admin'].includes(role)) errors.push('planner role is required');
  const distinctApprovers = new Set(approvals.filter((item) => item.decision === 'approve').map((item) => item.actorId));
  if (['approved', 'exported'].includes(next) && distinctApprovers.size < 2) errors.push('two distinct approvals are required');
  if (next === 'exported' && !connectorReady) errors.push('authoritative procurement connector is not ready');
  if (next === 'exported' && !evidence?.approvalDigest) errors.push('approval evidence digest is required');
  return { ok: errors.length === 0, errors, evidenceDigest: evidence ? versionDigest(evidence) : null };
}

export { TRANSITIONS };
