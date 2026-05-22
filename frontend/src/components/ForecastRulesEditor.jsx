import { useEffect, useState } from 'react';
import { api } from '../App';

// NON-VIZ 2: Forecast rules editor — CRUD for safety stock & lead times
export default function ForecastRulesEditor() {
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sku: '', safety_stock: 0, lead_time_days: 0, reorder_point: 0, notes: '' });
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    api.get('/custom-views/forecast-rules')
      .then((d) => setRules(d.rules || []))
      .catch((e) => setErr(e.message || 'Failed to load'));
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditingId(null);
    setForm({ sku: '', safety_stock: 0, lead_time_days: 0, reorder_point: 0, notes: '' });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/custom-views/forecast-rules/${editingId}`, form);
      } else {
        await api.post('/custom-views/forecast-rules', form);
      }
      reset();
      load();
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const edit = (r) => {
    setEditingId(r.id);
    setForm({ sku: r.sku, safety_stock: r.safety_stock, lead_time_days: r.lead_time_days, reorder_point: r.reorder_point, notes: r.notes || '' });
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await api.delete(`/custom-views/forecast-rules/${id}`);
      load();
    } catch (e) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Forecast Rules Editor</h3>
      {err && <div className="mb-2 text-sm text-red-600">{err}</div>}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
        <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border rounded px-2 py-1 text-sm" />
        <input type="number" placeholder="Safety Stock" value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: Number(e.target.value) })} className="border rounded px-2 py-1 text-sm" />
        <input type="number" placeholder="Lead Time (days)" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: Number(e.target.value) })} className="border rounded px-2 py-1 text-sm" />
        <input type="number" placeholder="Reorder Point" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: Number(e.target.value) })} className="border rounded px-2 py-1 text-sm" />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border rounded px-2 py-1 text-sm" />
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={save} disabled={busy || !form.sku} data-testid="save-rule-btn" className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">
          {editingId ? 'Update Rule' : 'Add Rule'}
        </button>
        {editingId && (
          <button onClick={reset} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">Cancel</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-right">Safety Stock</th>
              <th className="px-2 py-1 text-right">Lead Time (d)</th>
              <th className="px-2 py-1 text-right">Reorder Point</th>
              <th className="px-2 py-1 text-left">Notes</th>
              <th className="px-2 py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1 font-medium">{r.sku}</td>
                <td className="px-2 py-1 text-right">{r.safety_stock}</td>
                <td className="px-2 py-1 text-right">{r.lead_time_days}</td>
                <td className="px-2 py-1 text-right">{r.reorder_point}</td>
                <td className="px-2 py-1 text-gray-600">{r.notes}</td>
                <td className="px-2 py-1 text-right">
                  <button onClick={() => edit(r)} className="text-primary-600 hover:underline mr-2">Edit</button>
                  <button onClick={() => remove(r.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan="6" className="text-center py-4 text-gray-500">No rules yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
