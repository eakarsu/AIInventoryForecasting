import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { FeatureCard } from '../components/Card';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import { StatusBadge } from '../components/DataTable';
import { api } from '../App';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRec, setSelectedRec] = useState(null);
  const [stockoutRisk, setStockoutRisk] = useState(null);
  const [stockoutLoading, setStockoutLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadStockoutRisk();
  }, []);

  const loadStockoutRisk = async () => {
    setStockoutLoading(true);
    try {
      const data = await api.get('/products/stockout-risk');
      setStockoutRisk(data);
    } catch (err) {
      console.error('Failed to load stockout risk:', err);
    } finally {
      setStockoutLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setError(null);
    try {
      const [summaryData, recsData] = await Promise.all([
        api.get('/analytics/summary/dashboard'),
        api.get('/ai/recommendations'),
      ]);
      console.log('Dashboard data loaded:', { stats: summaryData, recs: recsData.length });
      setStats(summaryData);
      setRecommendations(recsData.filter((r) => r.status === 'pending').slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const coreFeatures = [
    {
      title: 'Product Inventory',
      description: 'Manage stock levels and product catalog',
      href: '/products',
      count: stats?.total_products,
      icon: (
        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: 'Demand Forecasting',
      description: 'AI-powered demand predictions',
      href: '/forecasts',
      icon: (
        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Supplier Management',
      description: 'Track supplier performance',
      href: '/suppliers',
      count: stats?.active_suppliers,
      icon: (
        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: 'Purchase Orders',
      description: 'Manage and track orders',
      href: '/orders',
      count: stats?.active_orders,
      icon: (
        <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ];

  const aiFeatures = [
    {
      title: 'AI Demand Predictor',
      description: 'Seasonal and trend forecasting with machine learning',
      href: '/demand-predictor',
      color: 'from-blue-500 to-cyan-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      title: 'AI Supplier Risk',
      description: 'Supply chain vulnerability analysis',
      href: '/supplier-risk',
      color: 'from-orange-500 to-red-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      title: 'AI Reorder Optimizer',
      description: 'Just-in-time ordering optimization',
      href: '/reorder-optimizer',
      color: 'from-green-500 to-emerald-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: 'AI Dead Stock',
      description: 'Slow-moving inventory alerts',
      href: '/dead-stock',
      color: 'from-purple-500 to-pink-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      title: 'AI Warehouse Layout',
      description: 'Storage efficiency optimization',
      href: '/warehouse-optimizer',
      color: 'from-indigo-500 to-violet-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: 'AI Inventory Optimizer',
      description: 'E-commerce multi-channel optimization',
      href: '/inventory-optimizer',
      color: 'from-teal-500 to-cyan-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: 'AI Shipment Tracker',
      description: 'Manufacturing logistics tracking',
      href: '/shipment-tracker',
      color: 'from-rose-500 to-pink-500',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        <h2 className="font-bold mb-2">Error loading dashboard</h2>
        <p>{error}</p>
        <button onClick={loadDashboardData} className="mt-2 btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card
          title="Total Products"
          value={stats?.total_products || 0}
          icon={
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <Card
          title="Inventory Value"
          value={`$${(stats?.inventory_value || 0).toLocaleString()}`}
          icon={
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <Card
          title="Low Stock Alerts"
          value={stats?.low_stock_alerts || 0}
          icon={
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <Card
          title="Active Orders"
          value={stats?.active_orders || 0}
          icon={
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* Stockout Risk Widget */}
      {(stockoutLoading || stockoutRisk) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stockout Risk Monitor</h2>
          {stockoutLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center text-gray-500 text-sm">Loading stockout risk...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Critical */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">CRITICAL</span>
                  <span className="text-sm text-red-700 font-medium">&lt;7 days supply</span>
                  <span className="ml-auto text-xs text-red-500">{(stockoutRisk?.critical || []).length} items</span>
                </div>
                {(stockoutRisk?.critical || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No critical stockouts</p>
                ) : (
                  <div className="space-y-2">
                    {(stockoutRisk.critical || []).slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:bg-red-50"
                        onClick={() => navigate('/products')}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sku} &middot; {item.supplier_name || 'No supplier'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{item.days_of_supply}d left</p>
                          <p className="text-xs text-gray-500">{item.current_stock} units</p>
                        </div>
                      </div>
                    ))}
                    {(stockoutRisk.critical || []).length > 5 && (
                      <p className="text-xs text-red-500 text-center cursor-pointer" onClick={() => navigate('/products')}>
                        +{stockoutRisk.critical.length - 5} more critical items
                      </p>
                    )}
                  </div>
                )}
              </div>
              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-white">WARNING</span>
                  <span className="text-sm text-yellow-700 font-medium">7-14 days supply</span>
                  <span className="ml-auto text-xs text-yellow-600">{(stockoutRisk?.warning || []).length} items</span>
                </div>
                {(stockoutRisk?.warning || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No warnings</p>
                ) : (
                  <div className="space-y-2">
                    {(stockoutRisk.warning || []).slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:bg-yellow-50"
                        onClick={() => navigate('/products')}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sku} &middot; {item.supplier_name || 'No supplier'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-yellow-600">{item.days_of_supply}d left</p>
                          <p className="text-xs text-gray-500">{item.current_stock} units</p>
                        </div>
                      </div>
                    ))}
                    {(stockoutRisk.warning || []).length > 5 && (
                      <p className="text-xs text-yellow-600 text-center cursor-pointer" onClick={() => navigate('/products')}>
                        +{stockoutRisk.warning.length - 5} more warning items
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Features Section */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Features</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        {aiFeatures.map((feature) => (
          <div
            key={feature.title}
            onClick={() => navigate(feature.href)}
            className={`bg-gradient-to-br ${feature.color} rounded-xl p-5 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-lg`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 p-3 bg-white/20 rounded-xl">
                {feature.icon}
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-white/80 text-xs">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Core Features */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {coreFeatures.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            count={feature.count}
            onClick={() => navigate(feature.href)}
          />
        ))}
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendations</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedRec(rec)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                          rec.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <h4 className="text-sm font-medium text-gray-900">{rec.title}</h4>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{rec.description}</p>
                  </div>
                  {rec.estimated_savings > 0 && (
                    <span className="text-sm font-medium text-green-600">
                      +${rec.estimated_savings.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recommendation Detail Modal */}
      <DetailModal
        isOpen={!!selectedRec}
        onClose={() => setSelectedRec(null)}
        title={selectedRec?.title}
        actions={
          <button
            onClick={() => { setSelectedRec(null); navigate('/analytics'); }}
            className="btn-primary"
          >
            View in Analytics
          </button>
        }
      >
        {selectedRec && (
          <>
            <DetailSection title="Recommendation Details">
              <DetailRow label="Priority" value={<StatusBadge status={selectedRec.priority} />} />
              <DetailRow label="Type" value={selectedRec.type?.replace(/_/g, ' ')} />
              <DetailRow label="Status" value={<StatusBadge status={selectedRec.status} />} />
              <DetailRow label="Description" value={selectedRec.description} />
            </DetailSection>

            <DetailSection title="Impact">
              <DetailRow
                label="Estimated Savings"
                value={selectedRec.estimated_savings > 0 ? `$${selectedRec.estimated_savings.toLocaleString()}` : '-'}
              />
              <DetailRow label="Confidence" value={selectedRec.confidence ? `${selectedRec.confidence}%` : '-'} />
            </DetailSection>

            {selectedRec.details && (
              <DetailSection title="AI Analysis">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {typeof selectedRec.details === 'string'
                    ? selectedRec.details
                    : JSON.stringify(selectedRec.details, null, 2)}
                </div>
              </DetailSection>
            )}
          </>
        )}
      </DetailModal>
    </div>
  );
}
