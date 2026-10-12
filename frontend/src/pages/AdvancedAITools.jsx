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
      { name: 'scenario', label: 'Disruption scenario', type: 'select', options: ['partial outage', 'full outage', 'quality hold', 'transport disruption'] },
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

  const fillExample = (selectedTool, index = 0) => {
    const next = Object.fromEntries(selectedTool.fields.map((field) => {
      if (field.type === 'product' || field.type === 'supplier') {
        const records = field.type === 'product' ? products : suppliers;
        const current = forms[selectedTool.id]?.[field.name];
        const selected = records.find((record) => String(record.id) === String(current)) || records[index % Math.max(records.length, 1)];
        return [field.name, selected ? String(selected.id) : ''];
      }
      if (field.type === 'select') return [field.name, field.options[index % field.options.length]];
      return [field.name, field.name === 'duration_days' ? [7, 14, 30][index] : [14, 30, 60][index]];
    }));
    setForms((current) => ({ ...current, [selectedTool.id]: next }));
    setError(null); setResult(null);
  };
  const missingRequiredReference = tool.fields.some((field) => field.required && (field.type === 'product' ? !products.length : field.type === 'supplier' ? !suppliers.length : false));

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
            onClick={() => { setTab(t.id); fillExample(t); }}
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
          <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-4" aria-label="Complete example inputs">
            <strong>Fill every field, including optional inputs</strong>
            <p className="text-sm text-gray-600 my-2">Examples select an existing product or supplier from your loaded records. They do not create records or run AI.</p>
            <div className="flex flex-wrap gap-2">{['Short horizon', 'Standard planning', 'Extended disruption'].map((label, index) => <button key={label} type="button" disabled={loading} className="border rounded px-3 py-2" onClick={() => fillExample(tool, index)}>Demo AI · {label}</button>)}</div>
            {tool.fields.some((field) => field.type === 'product') && !products.length && <p role="status" className="text-sm mt-2">No product is available to select. Leave the optional product blank for the native all-products scope, or create/select an actual product.</p>}
            {missingRequiredReference && <p role="status" className="text-sm mt-2">Add or load an actual supplier before generating this analysis. Examples never invent supplier IDs.</p>}
          </section>
          {tool.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === 'product' ? (
                <select
                  value={formData[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">-- Optional --</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name || p.sku || `#${p.id}`}</option>)}
                </select>
              ) : f.type === 'supplier' ? (
                <select
                  value={formData[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required={f.required}
                >
                  <option value="">-- Select supplier --</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name || `#${s.id}`}</option>)}
                </select>
              ) : f.type === 'select' ? (
                <select
                  value={formData[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">-- Select --</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={formData[f.name] ?? ''}
                  placeholder={f.placeholder || ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading || missingRequiredReference}
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
