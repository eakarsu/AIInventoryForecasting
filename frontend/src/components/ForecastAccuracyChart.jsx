import { useEffect, useState } from 'react';
import { api } from '../App';

// VIZ 1: Forecast accuracy line chart — predicted vs actual (pure SVG)
export default function ForecastAccuracyChart() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/custom-views/forecast-accuracy')
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load'));
  }, []);

  if (err) return <div className="p-4 text-red-600">Error: {err}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading forecast accuracy...</div>;

  const series = data.series || [];
  const W = 700, H = 260, padL = 50, padR = 20, padT = 20, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxY = Math.max(...series.map((s) => Math.max(s.predicted, s.actual))) * 1.1;
  const minY = 0;
  const x = (i) => padL + (i / Math.max(1, series.length - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const path = (key, color) => {
    const d = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s[key])}`).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth="2.5" />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{data.title}</h3>
        <span className="text-sm text-gray-500">MAPE: <span className="font-semibold text-primary-600">{data.mape_pct}%</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64" data-testid="accuracy-chart">
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#cbd5e1" />
        {/* y ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yv = Math.round(maxY * t);
          return (
            <g key={i}>
              <line x1={padL - 4} x2={padL} y1={y(yv)} y2={y(yv)} stroke="#94a3b8" />
              <text x={padL - 8} y={y(yv) + 4} fontSize="10" textAnchor="end" fill="#475569">{yv}</text>
              <line x1={padL} x2={padL + innerW} y1={y(yv)} y2={y(yv)} stroke="#f1f5f9" />
            </g>
          );
        })}
        {/* x labels */}
        {series.map((s, i) => (
          <text key={i} x={x(i)} y={padT + innerH + 15} fontSize="10" textAnchor="middle" fill="#475569">{s.week}</text>
        ))}
        {path('predicted', '#2563eb')}
        {path('actual', '#16a34a')}
        {series.map((s, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(s.predicted)} r="3" fill="#2563eb" />
            <circle cx={x(i)} cy={y(s.actual)} r="3" fill="#16a34a" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-600 rounded-sm" /> Predicted</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-600 rounded-sm" /> Actual</span>
      </div>
    </div>
  );
}
