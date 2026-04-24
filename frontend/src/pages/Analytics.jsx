import { useState, useEffect } from 'react';
import DataTable, { StatusBadge } from '../components/DataTable';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import Card from '../components/Card';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api, useAuth } from '../App';

export default function Analytics() {
  const [analytics, setAnalytics] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stockDistribution, setStockDistribution] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('metrics');
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [page, limit, search]);

  const loadData = async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit, ...(search && { search }) });
      const [analyticsRes, recsData, summaryData, stockData, categoryData] = await Promise.all([
        api.get(`/analytics?${params}`),
        api.get('/ai/recommendations'),
        api.get('/analytics/summary/dashboard'),
        api.get('/analytics/metrics/stock-distribution'),
        api.get('/analytics/metrics/categories'),
      ]);
      // Handle both paginated and non-paginated responses
      if (analyticsRes.data) {
        setAnalytics(analyticsRes.data);
        setPagination(analyticsRes.pagination);
      } else {
        setAnalytics(Array.isArray(analyticsRes) ? analyticsRes : []);
        setPagination(null);
      }
      setRecommendations(Array.isArray(recsData) ? recsData : recsData.data || []);
      setSummary(summaryData);
      setStockDistribution(Array.isArray(stockData) ? stockData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTrendAnalysis = async () => {
    setAiLoading(true);
    try {
      const data = await api.post('/ai/trend-analysis');
      console.log('Trend analysis raw response:', data);

      // If analysis is a string, try to parse it
      if (typeof data.analysis === 'string') {
        try {
          data.analysis = JSON.parse(data.analysis);
          console.log('Parsed analysis from string:', data.analysis);
        } catch (e) {
          console.error('Failed to parse analysis string:', e);
        }
      }

      setTrendAnalysis(data);
      // Auto-switch to Insights tab to show results
      setActiveTab('insights');
    } catch (error) {
      console.error('Failed to get trend analysis:', error);
      toast.error('Failed to get trend analysis: ' + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const updateRecommendationStatus = async (id, status) => {
    try {
      await api.put(`/ai/recommendations/${id}`, { status });
      toast.success(`Recommendation ${status === 'implemented' ? 'marked as implemented' : 'dismissed'}`);
      loadData();
      setSelectedRecommendation(null);
    } catch (error) {
      console.error('Failed to update recommendation:', error);
      toast.error('Failed to update recommendation: ' + error.message);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const analyticsColumns = [
    { key: 'metric_name', label: 'Metric', sortable: true },
    {
      key: 'metric_value',
      label: 'Value',
      sortable: true,
      render: (value, row) => {
        if (row.metric_type === 'currency') return `$${parseFloat(value).toLocaleString()}`;
        if (row.metric_type === 'percentage') return `${parseFloat(value).toFixed(1)}%`;
        if (row.metric_type === 'days') return `${value} days`;
        return parseFloat(value).toLocaleString();
      },
    },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'change_percentage',
      label: 'Change',
      sortable: true,
      render: (value) => {
        if (!value) return '-';
        const isPositive = parseFloat(value) > 0;
        return (
          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}
            {parseFloat(value).toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'trend',
      label: 'Trend',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const recommendationColumns = [
    {
      key: 'priority',
      label: 'Priority',
      render: (value) => <StatusBadge status={value} />,
    },
    { key: 'title', label: 'Recommendation', sortable: true },
    { key: 'recommendation_type', label: 'Type', sortable: true },
    {
      key: 'confidence_score',
      label: 'Confidence',
      render: (value) => `${parseFloat(value).toFixed(0)}%`,
    },
    {
      key: 'estimated_savings',
      label: 'Est. Savings',
      render: (value) => (value > 0 ? `$${parseFloat(value).toLocaleString()}` : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const tabs = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'recommendations', label: 'AI Recommendations' },
    { id: 'insights', label: 'Insights' },
  ];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
          <p className="text-gray-500">AI-powered analytics and recommendations</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="analytics" />
          <button onClick={getTrendAnalysis} className="btn-primary" disabled={aiLoading}>
            {aiLoading ? 'Analyzing...' : 'Run AI Trend Analysis'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search analytics by metric name, category..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card
          title="Total Products"
          value={summary?.total_products || 0}
          trend="up"
          trendValue="+5.2%"
        />
        <Card
          title="Inventory Value"
          value={`$${((summary?.inventory_value || 0) / 1000).toFixed(0)}K`}
          trend="up"
          trendValue="+7.5%"
        />
        <Card
          title="Low Stock Items"
          value={summary?.low_stock_alerts || 0}
          trend="down"
          trendValue="-3 items"
        />
        <Card
          title="Pending Actions"
          value={summary?.pending_recommendations || 0}
        />
      </div>

      {/* AI Trend Analysis */}
      {trendAnalysis && (
        <div className="mb-6 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Trend Analysis</h3>
            <button onClick={() => setTrendAnalysis(null)} className="text-gray-400 hover:text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Key Trends</h4>
              <div className="space-y-2">
                {trendAnalysis.analysis?.trends?.map((trend, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{trend.category}</span>
                      <StatusBadge status={trend.direction === 'growing' ? 'upward' : trend.direction === 'declining' ? 'downward' : 'stable'} />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{trend.insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Opportunities & Risks</h4>
              <div className="space-y-4">
                {trendAnalysis.analysis?.opportunities?.length > 0 && (
                  <div>
                    <p className="text-sm text-green-700 font-medium mb-2">Opportunities</p>
                    <ul className="space-y-1">
                      {trendAnalysis.analysis.opportunities.map((opp, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trendAnalysis.analysis?.risks?.length > 0 && (
                  <div>
                    <p className="text-sm text-red-700 font-medium mb-2">Risks</p>
                    <ul className="space-y-1">
                      {trendAnalysis.analysis.risks.map((risk, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.id === 'recommendations' && recommendations.filter((r) => r.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                  {recommendations.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'metrics' && (
        <>
          <DataTable
            columns={analyticsColumns}
            data={analytics}
            onRowClick={setSelectedItem}
            emptyMessage="No analytics data available"
          />
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {/* AI-Generated Recommendations from Trend Analysis */}
          {trendAnalysis?.analysis?.recommendations?.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
              <h3 className="text-lg font-bold text-purple-800 mb-4">AI-Generated Recommendations (from Trend Analysis)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendAnalysis.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
                    <div className="flex items-start">
                      <span className="text-purple-600 font-bold mr-2">{i + 1}.</span>
                      <p className="text-gray-700">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stored Recommendations from Database */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stored Recommendations</h3>
            <DataTable
              columns={recommendationColumns}
              data={recommendations}
              onRowClick={setSelectedRecommendation}
              emptyMessage="No recommendations available"
            />
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* AI Trend Analysis Results in Insights Tab */}
          {trendAnalysis && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">AI Trend Analysis Results</h3>

              {/* Key Trends */}
              {trendAnalysis.analysis?.trends?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Key Trends</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {trendAnalysis.analysis.trends.map((trend, i) => (
                      <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">{trend.category}</span>
                          <StatusBadge status={trend.direction === 'growing' ? 'upward' : trend.direction === 'declining' ? 'downward' : 'stable'} />
                        </div>
                        <p className="text-sm text-gray-600">{trend.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opportunities & Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendAnalysis.analysis?.opportunities?.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-medium text-green-700 mb-2">Opportunities</h4>
                    <ul className="space-y-2">
                      {trendAnalysis.analysis.opportunities.map((opp, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <span className="text-green-500 mr-2">+</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trendAnalysis.analysis?.risks?.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-medium text-red-700 mb-2">Risks</h4>
                    <ul className="space-y-2">
                      {trendAnalysis.analysis.risks.map((risk, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <span className="text-red-500 mr-2">!</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {trendAnalysis.analysis?.recommendations?.length > 0 && (
                <div className="mt-4 bg-white rounded-lg p-4">
                  <h4 className="font-medium text-primary-700 mb-2">AI Recommendations</h4>
                  <ul className="space-y-2">
                    {trendAnalysis.analysis.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start">
                        <span className="text-primary-500 mr-2">{'->'}</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Stock Distribution & Category Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stock Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Distribution</h3>
              <div className="space-y-4">
                {stockDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${
                          item.status === 'Out of Stock'
                            ? 'bg-red-500'
                            : item.status === 'Low Stock'
                            ? 'bg-yellow-500'
                            : item.status === 'Normal'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <span className="text-gray-700">{item.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-gray-900">{item.count} products</span>
                      <span className="text-sm text-gray-500 ml-2">
                        (${parseFloat(item.value || 0).toLocaleString()})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
              <div className="space-y-4">
                {categories.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-gray-700">{cat.category}</span>
                    <div className="text-right">
                      <span className="font-medium text-gray-900">{cat.product_count} products</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ${parseFloat(cat.total_value || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Detail Modal */}
      <DetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.metric_name}
        size="md"
      >
        {selectedItem && (
          <>
            <DetailSection title="Metric Details">
              <DetailRow label="Metric Name" value={selectedItem.metric_name} />
              <DetailRow
                label="Value"
                value={
                  selectedItem.metric_type === 'currency'
                    ? `$${parseFloat(selectedItem.metric_value).toLocaleString()}`
                    : selectedItem.metric_type === 'percentage'
                    ? `${parseFloat(selectedItem.metric_value).toFixed(1)}%`
                    : selectedItem.metric_value
                }
              />
              <DetailRow label="Category" value={selectedItem.category} />
              <DetailRow label="Type" value={selectedItem.metric_type} />
              <DetailRow label="Trend" value={<StatusBadge status={selectedItem.trend} />} />
              <DetailRow
                label="Change"
                value={
                  selectedItem.change_percentage
                    ? `${parseFloat(selectedItem.change_percentage) > 0 ? '+' : ''}${parseFloat(selectedItem.change_percentage).toFixed(1)}%`
                    : '-'
                }
              />
            </DetailSection>
            {selectedItem.notes && (
              <DetailSection title="Notes">
                <p className="text-gray-600">{selectedItem.notes}</p>
              </DetailSection>
            )}
          </>
        )}
      </DetailModal>

      {/* Recommendation Detail Modal */}
      <DetailModal
        isOpen={!!selectedRecommendation}
        onClose={() => setSelectedRecommendation(null)}
        title={selectedRecommendation?.title}
        size="lg"
        actions={
          selectedRecommendation?.status === 'pending' && (
            <>
              <button
                onClick={() => updateRecommendationStatus(selectedRecommendation.id, 'dismissed')}
                className="btn-secondary"
              >
                Dismiss
              </button>
              <button
                onClick={() => updateRecommendationStatus(selectedRecommendation.id, 'implemented')}
                className="btn-primary"
              >
                Mark Implemented
              </button>
            </>
          )
        }
      >
        {selectedRecommendation && (
          <>
            <DetailSection title="Recommendation Details">
              <DetailRow label="Type" value={selectedRecommendation.recommendation_type} />
              <DetailRow label="Priority" value={<StatusBadge status={selectedRecommendation.priority} />} />
              <DetailRow label="Status" value={<StatusBadge status={selectedRecommendation.status} />} />
              <DetailRow label="Confidence" value={`${parseFloat(selectedRecommendation.confidence_score).toFixed(0)}%`} />
            </DetailSection>

            <DetailSection title="Description">
              <p className="text-gray-600">{selectedRecommendation.description}</p>
            </DetailSection>

            <DetailSection title="Impact">
              <DetailRow label="Potential Impact" value={selectedRecommendation.potential_impact} />
              <DetailRow
                label="Estimated Savings"
                value={selectedRecommendation.estimated_savings > 0 ? `$${parseFloat(selectedRecommendation.estimated_savings).toLocaleString()}` : '-'}
              />
            </DetailSection>

            {selectedRecommendation.action_required && (
              <DetailSection title="Action Required">
                <p className="text-gray-600">{selectedRecommendation.action_required}</p>
              </DetailSection>
            )}

            {selectedRecommendation.product_name && (
              <DetailSection title="Related Product">
                <DetailRow label="Product" value={selectedRecommendation.product_name} />
                <DetailRow label="SKU" value={selectedRecommendation.product_sku} />
              </DetailSection>
            )}
          </>
        )}
      </DetailModal>
    </div>
  );
}
