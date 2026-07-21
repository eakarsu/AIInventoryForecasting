import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { authorizeProposalTransition, backtest, createForecast, createReplenishmentProposal, versionDigest } from '../domain/forecastPolicy.js';
import { integrationReadiness } from '../services/integrationBoundary.js';

const router = Router();
router.use(authenticateToken);
const plan = requireRole('analyst', 'planner', 'manager', 'admin');
const approve = requireRole('manager', 'admin');

function tenant(req) {
  return String(req.user?.tenantId || '');
}

function requiredHeader(req, name) {
  const value = String(req.get(name) || '').trim();
  if (!value || value.length > 160) throw Object.assign(new Error(`${name} header is required`), { status: 400 });
  return value;
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function sendError(res, error, fallback) {
  const status = error.status || (/required|must|cannot|outside|at least/.test(error.message) ? 422 : 500);
  res.status(status).json({ error: status === 500 ? fallback : error.message });
}

router.get('/integrations/readiness', (_req, res) => {
  const readiness = integrationReadiness();
  res.status(readiness.ready ? 200 : 503).json(readiness);
});

router.post('/model-versions', approve, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    if (!String(req.body?.name || '').trim() || !String(req.body?.version || '').trim() || !/^[a-f0-9]{64}$/.test(String(req.body?.artifactDigest || ''))) {
      return res.status(422).json({ error: 'name, version, and SHA-256 artifactDigest are required' });
    }
    const inserted = await pool.query(
      `INSERT INTO forecast_model_versions (tenant_id,name,version,artifact_digest,evaluation_status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
      [tenantId, req.body.name, req.body.version, req.body.artifactDigest]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (error) { sendError(res, error, 'model version could not be registered'); }
});

router.post('/model-versions/:id/decision', approve, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    if (!['accepted', 'rejected', 'retired'].includes(req.body?.decision)) return res.status(422).json({ error: 'invalid evaluation decision' });
    if (!String(req.body?.evaluationEvidence || '').trim()) return res.status(422).json({ error: 'evaluation evidence is required' });
    const updated = await transaction(async (client) => {
      const result = await client.query(
        `UPDATE forecast_model_versions SET evaluation_status=$1,approved_by=$2
         WHERE id=$3 AND tenant_id=$4 RETURNING *`,
        [req.body.decision, req.user.id, req.params.id, tenantId]
      );
      if (!result.rows[0]) throw Object.assign(new Error('model version not found'), { status: 404 });
      await client.query(
        `INSERT INTO forecast_workflow_events
         (tenant_id,aggregate_type,aggregate_id,actor_id,event_type,payload,evidence_digest)
         VALUES ($1,'model_version',$2,$3,'evaluation_decision',$4,$5)`,
        [tenantId, req.params.id, req.user.id, { decision: req.body.decision }, versionDigest({ evidence: req.body.evaluationEvidence })]
      );
      return result.rows[0];
    });
    res.json(updated);
  } catch (error) { sendError(res, error, 'model decision could not be recorded'); }
});

router.post('/runs', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    const idempotencyKey = requiredHeader(req, 'Idempotency-Key');
    const result = createForecast(req.body || {});
    const persisted = await transaction(async (client) => {
      const replay = await client.query('SELECT * FROM forecast_runs WHERE tenant_id=$1 AND idempotency_key=$2', [tenantId, idempotencyKey]);
      if (replay.rows[0]) return { run: replay.rows[0], replayed: true };
      const model = await client.query(
        `SELECT id FROM forecast_model_versions
         WHERE tenant_id=$1 AND version=$2 AND evaluation_status='accepted' LIMIT 1`,
        [tenantId, result.modelVersion]
      );
      if (!model.rows[0]) throw Object.assign(new Error('forecast model version is not accepted'), { status: 422 });
      await client.query(
        `INSERT INTO forecast_dataset_versions (tenant_id,digest,source_watermarks,row_count,created_by)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,digest) DO NOTHING`,
        [tenantId, result.dataVersion, req.body.sourceWatermarks || {}, req.body.observations.length, req.user.id]
      );
      const inserted = await client.query(
        `INSERT INTO forecast_runs
         (tenant_id,idempotency_key,dataset_digest,model_version,sku,location,horizon_days,assumptions,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [tenantId, idempotencyKey, result.dataVersion, result.modelVersion, result.sku, result.location, result.points.length, result.assumptions, req.user.id]
      );
      for (const point of result.points) {
        await client.query(
          'INSERT INTO forecast_points (run_id,horizon,expected,lower_bound,upper_bound) VALUES ($1,$2,$3,$4,$5)',
          [inserted.rows[0].id, point.horizon, point.expected, point.lower, point.upper]
        );
      }
      await client.query(
        `INSERT INTO forecast_workflow_events
         (tenant_id,aggregate_type,aggregate_id,actor_id,event_type,payload,evidence_digest)
         VALUES ($1,'forecast_run',$2,$3,'forecast_created',$4,$5)`,
        [tenantId, inserted.rows[0].id, req.user.id, { assumptions: result.assumptions }, versionDigest(result)]
      );
      return { run: inserted.rows[0], forecast: result, replayed: false };
    });
    res.status(persisted.replayed ? 200 : 201).json(persisted);
  } catch (error) { sendError(res, error, 'forecast run failed'); }
});

router.post('/backtests', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    for (const field of ['sku', 'location', 'horizon', 'datasetDigest', 'modelVersion']) {
      if (!req.body?.[field]) return res.status(422).json({ error: `${field} is required` });
    }
    const metrics = backtest(req.body.rows);
    const inserted = await pool.query(
      `INSERT INTO forecast_backtests (tenant_id,sku,location,horizon,dataset_digest,model_version,metrics)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, req.body.sku, req.body.location, req.body.horizon, req.body.datasetDigest, req.body.modelVersion, metrics]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (error) { sendError(res, error, 'backtest could not be recorded'); }
});

router.post('/proposals', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    const run = await pool.query(
      `SELECT r.*, COALESCE(json_agg(json_build_object('horizon',p.horizon,'expected',p.expected,'lower',p.lower_bound,'upper',p.upper_bound)
       ORDER BY p.horizon) FILTER (WHERE p.run_id IS NOT NULL),'[]') AS points
       FROM forecast_runs r LEFT JOIN forecast_points p ON p.run_id=r.id
       WHERE r.id=$1 AND r.tenant_id=$2 GROUP BY r.id`,
      [req.body?.forecastRunId, tenantId]
    );
    if (!run.rows[0]) return res.status(404).json({ error: 'forecast run not found' });
    const forecast = {
      points: run.rows[0].points, dataVersion: run.rows[0].dataset_digest,
      modelVersion: run.rows[0].model_version,
    };
    const proposal = createReplenishmentProposal({ forecast, ...req.body });
    const inserted = await pool.query(
      `INSERT INTO replenishment_proposals
       (tenant_id,forecast_run_id,sku,location,quantity,status,uncertainty,rationale,created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8) RETURNING *`,
      [tenantId, run.rows[0].id, run.rows[0].sku, run.rows[0].location, proposal.quantity,
        { lowerToUpper: true, upperLeadTimeDemand: proposal.upperLeadTimeDemand }, proposal.rationale, req.user.id]
    );
    res.status(201).json({ ...inserted.rows[0], automaticallyOrdered: false });
  } catch (error) { sendError(res, error, 'proposal could not be created'); }
});

router.post('/proposals/:id/approvals', approve, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    if (!['approve', 'reject'].includes(req.body?.decision) || !String(req.body?.attestation || '').trim()) {
      return res.status(422).json({ error: 'decision and attestation are required' });
    }
    const proposal = await pool.query('SELECT id,created_by FROM replenishment_proposals WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    if (!proposal.rows[0]) return res.status(404).json({ error: 'proposal not found' });
    if (Number(proposal.rows[0].created_by) === Number(req.user.id)) return res.status(409).json({ error: 'proposal creator cannot self-approve' });
    const digest = versionDigest({ decision: req.body.decision, attestation: req.body.attestation });
    const inserted = await pool.query(
      `INSERT INTO replenishment_approvals (tenant_id,proposal_id,actor_id,decision,evidence_digest)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,proposal_id,actor_id)
       DO UPDATE SET decision=EXCLUDED.decision,evidence_digest=EXCLUDED.evidence_digest,created_at=NOW() RETURNING *`,
      [tenantId, req.params.id, req.user.id, req.body.decision, digest]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (error) { sendError(res, error, 'approval could not be recorded'); }
});

router.post('/proposals/:id/transition', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    const revision = Number(requiredHeader(req, 'If-Match'));
    if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ error: 'If-Match must be a positive revision' });
    const updated = await transaction(async (client) => {
      const found = await client.query('SELECT * FROM replenishment_proposals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenantId]);
      const proposal = found.rows[0];
      if (!proposal) throw Object.assign(new Error('proposal not found'), { status: 404 });
      if (proposal.revision !== revision) throw Object.assign(new Error('proposal revision conflict'), { status: 409 });
      const approvals = (await client.query(
        'SELECT actor_id AS "actorId",decision FROM replenishment_approvals WHERE tenant_id=$1 AND proposal_id=$2', [tenantId, proposal.id]
      )).rows;
      const procurement = integrationReadiness().integrations.find((entry) => entry.name === 'procurement');
      const authorization = authorizeProposalTransition({
        current: proposal.status, next: req.body?.nextState, role: req.user.role,
        approvals, connectorReady: procurement?.ready, evidence: req.body?.evidence,
      });
      if (!authorization.ok) throw Object.assign(new Error(authorization.errors.join('; ')), { status: 422 });
      const result = await client.query(
        `UPDATE replenishment_proposals SET status=$1,revision=revision+1,updated_at=NOW()
         WHERE id=$2 AND tenant_id=$3 AND revision=$4 RETURNING *`,
        [req.body.nextState, proposal.id, tenantId, revision]
      );
      await client.query(
        `INSERT INTO forecast_workflow_events
         (tenant_id,aggregate_type,aggregate_id,actor_id,event_type,payload,evidence_digest)
         VALUES ($1,'replenishment_proposal',$2,$3,'state_transition',$4,$5)`,
        [tenantId, proposal.id, req.user.id, { from: proposal.status, to: req.body.nextState }, authorization.evidenceDigest]
      );
      if (req.body.nextState === 'exported') {
        await client.query(
          `INSERT INTO forecast_integration_outbox (tenant_id,aggregate_type,aggregate_id,event_type,payload)
           VALUES ($1,'replenishment_proposal',$2,'approved_order_export_requested',$3)`,
          [tenantId, proposal.id, { quantity: proposal.quantity, requiresReconciliation: true }]
        );
      }
      return result.rows[0];
    });
    res.json(updated);
  } catch (error) { sendError(res, error, 'proposal transition failed'); }
});

router.post('/proposals/:id/overrides', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0 || !String(req.body?.reason || '').trim()) {
      return res.status(422).json({ error: 'non-negative integer quantity and reason are required' });
    }
    const result = await transaction(async (client) => {
      const found = await client.query('SELECT * FROM replenishment_proposals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenantId]);
      if (!found.rows[0]) throw Object.assign(new Error('proposal not found'), { status: 404 });
      if (!['draft', 'reviewed'].includes(found.rows[0].status)) throw Object.assign(new Error('approved/exported proposals cannot be overridden'), { status: 409 });
      await client.query(
        `INSERT INTO forecast_overrides (tenant_id,proposal_id,actor_id,previous_quantity,override_quantity,reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, req.params.id, req.user.id, found.rows[0].quantity, quantity, req.body.reason]
      );
      return (await client.query(
        'UPDATE replenishment_proposals SET quantity=$1,revision=revision+1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
        [quantity, req.params.id, tenantId]
      )).rows[0];
    });
    res.json(result);
  } catch (error) { sendError(res, error, 'override could not be recorded'); }
});

router.post('/proposals/:id/outcomes', plan, async (req, res) => {
  try {
    const tenantId = tenant(req);
    if (!tenantId) return res.status(403).json({ error: 'active tenant membership is required' });
    const values = ['actualDemand', 'stockoutUnits', 'wasteUnits'].map((name) => Number(req.body?.[name]));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return res.status(422).json({ error: 'outcome values must be non-negative numbers' });
    const inserted = await pool.query(
      `INSERT INTO forecast_outcomes (tenant_id,proposal_id,actual_demand,stockout_units,waste_units,actual_lead_time_days)
       SELECT $1,id,$3,$4,$5,$6 FROM replenishment_proposals WHERE id=$2 AND tenant_id=$1 RETURNING *`,
      [tenantId, req.params.id, ...values, req.body?.actualLeadTimeDays ?? null]
    );
    if (!inserted.rows[0]) return res.status(404).json({ error: 'proposal not found' });
    res.status(201).json(inserted.rows[0]);
  } catch (error) { sendError(res, error, 'outcome could not be recorded'); }
});

export default router;
