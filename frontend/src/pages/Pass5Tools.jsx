import { useEffect, useState } from 'react';
import { api } from '../App';

/* Apply pass 5: 4-tab page covering replenishment workflow,
   supplier marketplace + RFQs, and integration status. */
export default function Pass5Tools() {
  const [tab, setTab] = useState('replenishment');
  return (
    <div style={{ padding: 16 }}>
      <h2>Pass 5 Tools</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['replenishment', 'marketplace', 'rfqs', 'integrations'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', background: tab === t ? '#222' : '#fff', color: tab === t ? '#fff' : '#222', border: '1px solid #ccc' }}>{t}</button>
        ))}
      </div>
      {tab === 'replenishment' && <Replenishment />}
      {tab === 'marketplace' && <Marketplace />}
      {tab === 'rfqs' && <RFQs />}
      {tab === 'integrations' && <Integrations />}
    </div>
  );
}

function Replenishment() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  async function load() {
    setError(null);
    try { const r = await api.get('/replenishment'); setOrders(r.orders || []); }
    catch (e) { setError(e.message); }
  }
  async function genDrafts() {
    try { await api.post('/replenishment/generate-drafts', { reorder_threshold_pct: 0.2 }); load(); }
    catch (e) { setError(e.message); }
  }
  async function setStatus(id, status) {
    try { await api.put(`/replenishment/${id}/status`, { status }); load(); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h3>Replenishment Orders</h3>
      <button onClick={genDrafts}>Generate Drafts</button>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <ul>{orders.map(o => (
        <li key={o.id}>#{o.id} product={o.product_id} qty={o.order_qty} — <strong>{o.status}</strong>
          {' '}<button onClick={() => setStatus(o.id, 'approved')}>approve</button>
          {' '}<button onClick={() => setStatus(o.id, 'ordered')}>order</button>
          {' '}<button onClick={() => setStatus(o.id, 'received')}>receive</button>
        </li>
      ))}</ul>
    </div>
  );
}

function Marketplace() {
  const [filters, setFilters] = useState({ category: '', max_lead_days: '', target_cost: '' });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  async function search() {
    setError(null);
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([_, v]) => v)).toString();
      const r = await api.get(`/supplier-marketplace/search?${qs}`);
      setResults(r.results || []);
    } catch (e) { setError(e.message); }
  }
  return (
    <div>
      <h3>Supplier Marketplace</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.keys(filters).map(k => <input key={k} value={filters[k]} onChange={e => setFilters({ ...filters, [k]: e.target.value })} placeholder={k} />)}
        <button onClick={search}>Search</button>
      </div>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <ul>{results.map(s => <li key={s.id}>{s.name} — score {s.suitability_score} — lead {s.lead_time_days}d</li>)}</ul>
    </div>
  );
}

function RFQs() {
  const [list, setList] = useState([]);
  const [draft, setDraft] = useState({ product_id: '', category: '', target_qty: '', target_unit_cost: '' });
  const [error, setError] = useState(null);
  async function load() {
    setError(null);
    try { const r = await api.get('/supplier-marketplace/rfqs'); setList(r.rfqs || []); }
    catch (e) { setError(e.message); }
  }
  async function create() {
    if (!draft.target_qty) return;
    try { await api.post('/supplier-marketplace/rfqs', draft); setDraft({ product_id: '', category: '', target_qty: '', target_unit_cost: '' }); load(); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  return (
    <div>
      <h3>RFQs</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {Object.keys(draft).map(k => <input key={k} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} placeholder={k} />)}
      </div>
      <button onClick={create}>Create RFQ</button>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <ul>{list.map(r => <li key={r.id}>RFQ #{r.id} — {r.category} qty={r.target_qty} status={r.status}</li>)}</ul>
    </div>
  );
}

function Integrations() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api.get('/integrations/status').then(setStatus).catch(() => {}); }, []);
  if (!status) return <div>Loading...</div>;
  return (
    <div>
      <h3>Integration Status</h3>
      <ul>{Object.entries(status).map(([k, v]) => <li key={k}>{k}: {v ? 'configured' : 'NOT configured (returns 503)'}</li>)}</ul>
      <p>See <code>_BACKLOG_NEEDS_CREDS.md</code>.</p>
    </div>
  );
}
