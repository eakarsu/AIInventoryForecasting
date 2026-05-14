import { useEffect, useState } from 'react';
import AIResultDisplay from '../components/AIResultDisplay';
import { api } from '../App';

const TOOLS = [
  {
    id: 'markdown-timing',
    title: 'Markdown Timing',
    icon: '🏷️',
    endpoint: '/ai/markdown-timing',
    desc: 'Markdown schedule per product (first markdown days/percent, subsequent steps, minimum acceptable price).',
    fields: [
      { name: 'product_id', label: 'Product (optional)', type: 'product' },
    ],
  },
  {
    id: 'supplier-disruption-simulator',
    title: 'Supplier Disruption Simulator',
    icon: '⚠️',
    endpoint: '/ai/supplier-disruption-simulator',
    desc: 'Impacted SKUs, alternative routing, mitigation actions, expected revenue/margin at risk.',
    fields: [
      { name: 'supplier_id', label: 'Supplier', type: 'supplier', required: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { name: 'duration_days', label: 'Duration (days)', type: 'number', placeholder: '14' },
    ],
  },
  {
    id: 'multi-warehouse-balancing',
    title: 'Multi-Warehouse Balancing',
    icon: '🏭',
    endpoint: '/ai/multi-warehouse-balancing',
    desc: 'Transfer plan, before/after imbalance scores, stockout-days avoided.',
    fields: [
      { name: 'product_id', label: 'Product (optional)', type: 'product' },
      { name: 'horizon_days', label: 'Horizon (days)', type: 'number', placeholder: '30' },
    ],
  },
];

export default function AdvancedAITools() {
  const [tab, setTab] = useState(TOOLS[0].id);
  const [forms, setForms] = useState({});
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const tool = TOOLS.find((t) => t.id === tab);
  const formData = forms[tab] || {};

  useEffect(() => {
    api.get('/products').then((d) => setProducts(Array.isArray(d) ? d : (d?.data || []))).catch(() => setProducts([]));
    api.get('/suppliers').then((d) => setSuppliers(Array.isArray(d) ? d : (d?.data || []))).catch(() => setSuppliers([]));
  }, []);

  const setField = (name, value) => {
    setForms((p) => ({ ...p, [tab]: { ...(p[tab] || {}), [name]: value } }));
  };

  const submit = async (e) => {
    e.preventDefault();
    for (const f of tool.fields) {
      if (f.required && !formData[f.name]) {
        setError(`${f.label} is required`);
        return;
      }
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const body = {};
      tool.fields.forEach((f) => {
        const v = formData[f.name];
        if (v === '' || v === undefined || v === null) return;
        if (f.type === 'number' || f.type === 'product' || f.type === 'supplier') body[f.name] = Number(v);
        else body[f.name] = v;
      });
      const data = await api.post(tool.endpoint, body);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Request failed');
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Advanced AI Tools</h1>
        <p className="text-gray-600 mt-1">Markdown timing, supplier disruption simulation, and multi-warehouse balancing.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setError(null); setResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${tab === t.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            style={tab === t.id ? { background: '#4f46e5', color: 'white', border: '1px solid #4f46e5' } : undefined}
          >
            <span className="mr-1">{t.icon}</span>{t.title}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <h3 className="text-lg font-semibold mb-1">{tool.icon} {tool.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{tool.desc}</p>

        <form onSubmit={submit} className="space-y-4">
          {tool.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === 'product' ? (
                <select
                  value={formData[f.name] || ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">-- Optional --</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name || p.sku || `#${p.id}`}</option>)}
                </select>
              ) : f.type === 'supplier' ? (
                <select
                  value={formData[f.name] || ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required={f.required}
                >
                  <option value="">-- Select supplier --</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name || `#${s.id}`}</option>)}
                </select>
              ) : f.type === 'select' ? (
                <select
                  value={formData[f.name] || ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">-- Select --</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={formData[f.name] || ''}
                  placeholder={f.placeholder || ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50"
            style={{ background: loading ? '#94a3b8' : '#4f46e5', color: 'white' }}
          >
            {loading ? 'Generating...' : 'Run Analysis'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md">{error}</div>
        )}

        <div className="mt-6">
          <AIResultDisplay data={result} title={tool.title} loading={loading} error={error} />
        </div>
      </div>
    </div>
  );
}
