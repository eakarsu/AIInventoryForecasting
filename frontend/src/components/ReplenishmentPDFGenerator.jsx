import { useState } from 'react';

// NON-VIZ 1: Replenishment Order PDF generator
export default function ReplenishmentPDFGenerator() {
  const [sku, setSku] = useState('SKU-1001');
  const [qty, setQty] = useState(100);
  const [supplier, setSupplier] = useState('Acme Supply Co');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setStatus('');
    try {
      const params = new URLSearchParams({ sku, qty: String(qty), supplier });
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/custom-views/replenishment-pdf?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO-${sku}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('PDF downloaded.');
    } catch (e) {
      setStatus('Error: ' + (e.message || 'failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Replenishment Order PDF</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">SKU</span>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Quantity</span>
          <input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)} className="w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-700 mb-1">Supplier</span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full border rounded px-2 py-1" />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={generate}
          disabled={busy}
          data-testid="generate-pdf-btn"
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? 'Generating...' : 'Generate PDF'}
        </button>
        {status && <span className="text-sm text-gray-600">{status}</span>}
      </div>
    </div>
  );
}
