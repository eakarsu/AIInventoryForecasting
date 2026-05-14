import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { api } from '../App';

export default function PromotionSimulator() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [campaignDays, setCampaignDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.get('/products?limit=100');
      setProducts(data.data || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!productId) { toast.error('Please select a product'); return; }
    setLoading(true);
    setResult(null);
    try {
      const data = await api.post('/ai/promotion-simulator', {
        product_id: parseInt(productId),
        discount_percent: parseFloat(discountPercent),
        campaign_duration_days: parseInt(campaignDays),
      });
      setResult(data);
      toast.success('Simulation complete');
    } catch (err) {
      if (err.message && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))) {
        toast.error('AI rate limit reached. Please wait before making more requests.');
      } else {
        toast.error('Simulation failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sim = result?.simulation;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotion Simulator</h1>
        <p className="text-gray-500">AI-powered demand simulation for promotional campaigns</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configure Promotion</h2>
          <form onSubmit={handleSimulate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) — ${p.unit_price}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Percentage: <span className="text-primary-600 font-bold">{discountPercent}%</span>
              </label>
              <input
                type="range"
                min="1"
                max="80"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1%</span><span>40%</span><span>80%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Duration: <span className="text-primary-600 font-bold">{campaignDays} days</span>
              </label>
              <input
                type="range"
                min="1"
                max="90"
                value={campaignDays}
                onChange={(e) => setCampaignDays(e.target.value)}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1d</span><span>45d</span><span>90d</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn-primary py-2.5"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Simulating...
                </span>
              ) : 'Simulate Promotion'}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Simulation Results</h2>
          {!result && !loading && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Configure and run a simulation to see AI-powered results
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-primary-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 text-sm">AI is simulating demand impact...</p>
              </div>
            </div>
          )}
          {result && sim && !loading && (
            <div className="space-y-4">
              {result.product && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-gray-700">{result.product.name}</p>
                  <p className="text-gray-500 text-xs">{result.product.sku} &middot; ${result.product.unit_price} &middot; {result.product.current_stock} units in stock</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{sim.demand_multiplier ? `${sim.demand_multiplier}x` : '—'}</p>
                  <p className="text-xs text-blue-600 mt-1">Demand Multiplier</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{sim.expected_units_sold ?? '—'}</p>
                  <p className="text-xs text-green-600 mt-1">Expected Units Sold</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{sim.recommended_stock_increase ?? '—'}</p>
                  <p className="text-xs text-orange-600 mt-1">Recommended Stock Increase</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${(sim.revenue_impact ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl font-bold ${(sim.revenue_impact ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {sim.revenue_impact != null ? `$${sim.revenue_impact.toLocaleString()}` : '—'}
                  </p>
                  <p className={`text-xs mt-1 ${(sim.revenue_impact ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Revenue Impact</p>
                </div>
              </div>

              {sim.risks && sim.risks.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-700 mb-2">Risks to Consider</p>
                  <ul className="space-y-1">
                    {sim.risks.map((r, i) => (
                      <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                        <span className="mt-0.5 text-red-400 flex-shrink-0">&#9888;</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sim.raw && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-mono whitespace-pre-wrap">{typeof sim.raw === 'string' ? sim.raw : JSON.stringify(sim.raw, null, 2)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
