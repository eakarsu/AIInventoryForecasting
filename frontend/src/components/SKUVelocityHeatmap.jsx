import { useEffect, useState } from 'react';
import { api } from '../App';

// VIZ 2: SKU velocity heatmap — SKU rows x weeks columns
export default function SKUVelocityHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/custom-views/sku-velocity-heatmap')
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load'));
  }, []);

  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading SKU heatmap...</div>;

  const cellColor = (v) => {
    // 0-100 scale -> light to deep blue/red gradient
    const ratio = Math.min(1, Math.max(0, v / 100));
    const r = Math.round(255 - ratio * 200);
    const g = Math.round(240 - ratio * 180);
    const b = Math.round(255 - ratio * 50);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{data.title}</h3>
        <span className="text-sm text-gray-500">{data.skus?.length || 0} SKUs x {data.weeks} weeks</span>
      </div>
      <div className="overflow-x-auto" data-testid="velocity-heatmap">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-gray-600">SKU</th>
              {data.skus?.[0]?.cells?.map((c) => (
                <th key={c.week} className="px-2 py-1 text-gray-600">{c.week}</th>
              ))}
              <th className="px-2 py-1 text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.skus || []).map((row) => (
              <tr key={row.sku}>
                <td className="px-2 py-1 font-medium text-gray-700 whitespace-nowrap">{row.sku}</td>
                {row.cells.map((c) => (
                  <td
                    key={c.week}
                    className="px-2 py-1 text-center text-gray-800"
                    style={{ backgroundColor: cellColor(c.value), minWidth: 36 }}
                    title={`${row.sku} ${c.week}: ${c.value}`}
                  >
                    {c.value}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-semibold text-gray-700">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-gray-500">Darker = higher unit velocity</div>
    </div>
  );
}
