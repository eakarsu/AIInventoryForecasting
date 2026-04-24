import { useState, useEffect } from 'react';
import DataTable, { StatusBadge } from '../components/DataTable';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import NewItemForm from '../components/NewItemForm';
import AIResultDisplay from '../components/AIResultDisplay';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api, useAuth } from '../App';

export default function InventoryOptimizer() {
  const [optimizations, setOptimizations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
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
      const [optimizationsRes, productsData] = await Promise.all([
        api.get(`/inventory-optimizer?${params}`),
        api.get('/products'),
      ]);
      if (optimizationsRes.data) {
        setOptimizations(optimizationsRes.data);
        setPagination(optimizationsRes.pagination);
      } else {
        setOptimizations(Array.isArray(optimizationsRes) ? optimizationsRes : []);
        setPagination(null);
      }
      setProducts(Array.isArray(productsData) ? productsData : productsData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/inventory-optimizer', data);
    toast.success('Optimization created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/inventory-optimizer/${selectedItem.id}`, editData);
      toast.success('Optimization updated successfully');
      setEditMode(false);
      setSelectedItem(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Optimization', 'Are you sure you want to delete this optimization? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/inventory-optimizer/${id}`);
        toast.success('Optimization deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} optimizations?`);
    if (confirmed) {
      try {
        await api.delete('/inventory-optimizer/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} optimizations deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const runAIAnalysis = async (productId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.post(`/inventory-optimizer/analyze/${productId}`);
      setAiResult(data);
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResult({ error: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const runPortfolioAnalysis = async () => {
    setPortfolioLoading(true);
    setPortfolioAnalysis(null);
    try {
      const data = await api.post('/inventory-optimizer/analyze-all');
      setPortfolioAnalysis(data);
    } catch (error) {
      console.error('Portfolio analysis failed:', error);
      setPortfolioAnalysis({ error: error.message });
    } finally {
      setPortfolioLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 75) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getChannelColor = (channel) => {
    const colors = {
      'Amazon': 'bg-orange-100 text-orange-800',
      'Shopify': 'bg-green-100 text-green-800',
      'eBay': 'bg-blue-100 text-blue-800',
      'Direct Website': 'bg-purple-100 text-purple-800',
      'Multi-Channel': 'bg-indigo-100 text-indigo-800',
    };
    return colors[channel] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'product_sku', label: 'SKU', sortable: true },
    {
      key: 'channel',
      label: 'Channel',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getChannelColor(value)}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'current_stock',
      label: 'Current',
      sortable: true,
      render: (value) => <span className="font-medium">{value} units</span>,
    },
    {
      key: 'optimal_stock',
      label: 'Optimal',
      sortable: true,
      render: (value) => <span className="font-medium text-blue-600">{value} units</span>,
    },
    {
      key: 'sell_through_rate',
      label: 'Sell-Through',
      sortable: true,
      render: (value) => <span>{(value * 100).toFixed(1)}%</span>,
    },
    {
      key: 'conversion_rate',
      label: 'Conversion',
      sortable: true,
      render: (value) => <span>{parseFloat(value).toFixed(1)}%</span>,
    },
    {
      key: 'profit_margin',
      label: 'Margin',
      sortable: true,
      render: (value) => (
        <span className={value >= 40 ? 'text-green-600' : value >= 30 ? 'text-yellow-600' : 'text-red-600'}>
          {parseFloat(value).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'optimization_score',
      label: 'Score',
      sortable: true,
      render: (value) => (
        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold ${getScoreColor(value)}`}>
          {parseFloat(value).toFixed(0)}
        </div>
      ),
    },
  ];

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  const formFields = [
    {
      name: 'product_id',
      label: 'Product',
      type: 'select',
      required: true,
      options: products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` })),
    },
    {
      name: 'channel',
      label: 'Sales Channel',
      type: 'select',
      required: true,
      options: [
        { value: 'Amazon', label: 'Amazon' },
        { value: 'Shopify', label: 'Shopify' },
        { value: 'eBay', label: 'eBay' },
        { value: 'Direct Website', label: 'Direct Website' },
        { value: 'Multi-Channel', label: 'Multi-Channel' },
      ],
    },
    { name: 'current_stock', label: 'Current Stock', type: 'number', required: true },
    { name: 'optimal_stock', label: 'Optimal Stock', type: 'number', required: true },
    { name: 'sell_through_rate', label: 'Sell-Through Rate', type: 'number', required: true },
    { name: 'days_of_supply', label: 'Days of Supply', type: 'number', required: true },
    { name: 'conversion_rate', label: 'Conversion Rate (%)', type: 'number', required: true },
    { name: 'cart_abandonment_rate', label: 'Cart Abandonment Rate (%)', type: 'number' },
    { name: 'return_rate', label: 'Return Rate (%)', type: 'number' },
    { name: 'profit_margin', label: 'Profit Margin (%)', type: 'number', required: true },
    { name: 'recommended_price', label: 'Recommended Price ($)', type: 'number' },
  ];

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Inventory Optimizer (E-commerce)</h1>
          <p className="text-gray-500">Multi-channel inventory and pricing optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="inventory-optimizations" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          <button
            onClick={runPortfolioAnalysis}
            className="btn-secondary"
            disabled={portfolioLoading}
          >
            {portfolioLoading ? 'Analyzing...' : 'Analyze Portfolio'}
          </button>
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Optimization
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search optimizations by product, SKU, or channel..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <SummaryCard
          title="Total Products"
          value={optimizations.length}
          subtitle="optimized"
          color="blue"
        />
        <SummaryCard
          title="Avg Score"
          value={optimizations.length > 0
            ? (optimizations.reduce((sum, o) => sum + parseFloat(o.optimization_score || 0), 0) / optimizations.length).toFixed(0)
            : '0'}
          subtitle="optimization score"
          color="green"
        />
        <SummaryCard
          title="Avg Conversion"
          value={`${optimizations.length > 0
            ? (optimizations.reduce((sum, o) => sum + parseFloat(o.conversion_rate || 0), 0) / optimizations.length).toFixed(1)
            : '0'}%`}
          subtitle="conversion rate"
          color="purple"
        />
        <SummaryCard
          title="Avg Margin"
          value={`${optimizations.length > 0
            ? (optimizations.reduce((sum, o) => sum + parseFloat(o.profit_margin || 0), 0) / optimizations.length).toFixed(1)
            : '0'}%`}
          subtitle="profit margin"
          color="green"
        />
        <SummaryCard
          title="Stock Gap"
          value={optimizations.reduce((sum, o) => sum + Math.max(0, (o.optimal_stock || 0) - (o.current_stock || 0)), 0)}
          subtitle="units needed"
          color="orange"
        />
      </div>

      {/* Portfolio Analysis Results */}
      {(portfolioLoading || portfolioAnalysis) && (
        <div className="mb-6">
          <AIResultDisplay
            data={portfolioAnalysis?.analysis}
            title="AI Portfolio Analysis"
            loading={portfolioLoading}
            error={portfolioAnalysis?.error}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={optimizations}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No inventory optimizations found"
        selectable={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Detail Modal */}
      <DetailModal
        isOpen={!!selectedItem}
        onClose={() => {
          setSelectedItem(null);
          setAiResult(null);
          setEditMode(false);
        }}
        title={`E-commerce Optimization: ${selectedItem?.product_name}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => runAIAnalysis(selectedItem?.product_id)}
              className="btn-primary"
              disabled={aiLoading}
            >
              {aiLoading ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
            {canWrite && (
              <>
                {editMode ? (
                  <>
                    <button onClick={handleUpdate} className="btn-secondary">Save</button>
                    <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditMode(true); setEditData(selectedItem); }} className="btn-secondary">
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(selectedItem?.id)} className="btn-danger">
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {selectedItem && (
          <>
            {(aiLoading || aiResult) && (
              <div className="mb-6">
                <AIResultDisplay
                  data={aiResult?.optimization}
                  title="AI E-commerce Optimization"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Optimal Stock</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.optimal_stock || ''}
                    onChange={(e) => setEditData({ ...editData, optimal_stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Recommended Price ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.recommended_price || ''}
                    onChange={(e) => setEditData({ ...editData, recommended_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Optimization Score</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.optimization_score || ''}
                    onChange={(e) => setEditData({ ...editData, optimization_score: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={editData.status || ''}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Product Information">
                  <DetailRow label="Product" value={selectedItem.product_name} />
                  <DetailRow label="SKU" value={selectedItem.product_sku} />
                  <DetailRow label="Category" value={selectedItem.category} />
                  <DetailRow
                    label="Channel"
                    value={
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getChannelColor(selectedItem.channel)}`}>
                        {selectedItem.channel}
                      </span>
                    }
                  />
                </DetailSection>

                <DetailSection title="Inventory Metrics">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">Current Stock</p>
                      <p className="text-2xl font-bold text-gray-700">{selectedItem.current_stock}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-blue-600 mb-1">Optimal Stock</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedItem.optimal_stock}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-green-600 mb-1">Days of Supply</p>
                      <p className="text-2xl font-bold text-green-700">{selectedItem.days_of_supply}</p>
                    </div>
                  </div>
                  <DetailRow label="Sell-Through Rate" value={`${(selectedItem.sell_through_rate * 100).toFixed(2)}%`} />
                </DetailSection>

                <DetailSection title="E-commerce Performance">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-purple-600 mb-1">Conversion Rate</p>
                      <p className="text-2xl font-bold text-purple-700">{parseFloat(selectedItem.conversion_rate).toFixed(1)}%</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-orange-600 mb-1">Cart Abandonment</p>
                      <p className="text-2xl font-bold text-orange-700">{parseFloat(selectedItem.cart_abandonment_rate).toFixed(1)}%</p>
                    </div>
                  </div>
                  <DetailRow label="Return Rate" value={`${parseFloat(selectedItem.return_rate).toFixed(1)}%`} />
                  <DetailRow label="Profit Margin" value={`${parseFloat(selectedItem.profit_margin).toFixed(1)}%`} />
                </DetailSection>

                <DetailSection title="Pricing Analysis">
                  <DetailRow label="Price Elasticity" value={selectedItem.price_elasticity} />
                  <DetailRow label="Competitor Price" value={selectedItem.competitor_price ? `$${parseFloat(selectedItem.competitor_price).toFixed(2)}` : 'N/A'} />
                  <DetailRow label="Recommended Price" value={selectedItem.recommended_price ? `$${parseFloat(selectedItem.recommended_price).toFixed(2)}` : 'N/A'} />
                </DetailSection>

                <DetailSection title="Optimization Score">
                  <div className="flex items-center space-x-4">
                    <div className={`text-4xl font-bold px-4 py-2 rounded-lg ${getScoreColor(selectedItem.optimization_score)}`}>
                      {parseFloat(selectedItem.optimization_score).toFixed(0)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Optimization Score</p>
                      <p className="text-xs text-gray-400">Based on inventory, pricing, and conversion metrics</p>
                    </div>
                  </div>
                </DetailSection>

                {selectedItem.bundle_opportunities && selectedItem.bundle_opportunities.length > 0 && (
                  <DetailSection title="Bundle Opportunities">
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.bundle_opportunities.map((bundle, idx) => (
                        <span key={idx} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                          {bundle}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {selectedItem.cross_sell_products && selectedItem.cross_sell_products.length > 0 && (
                  <DetailSection title="Cross-Sell Products">
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.cross_sell_products.map((product, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {product}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {selectedItem.ai_recommendation && (
                  <DetailSection title="AI Recommendation">
                    <p className="text-gray-700">{selectedItem.ai_recommendation}</p>
                  </DetailSection>
                )}
              </>
            )}
          </>
        )}
      </DetailModal>

      {/* New Item Form */}
      <NewItemForm
        isOpen={showNewForm}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleCreate}
        title="Add E-commerce Optimization"
        fields={formFields}
      />
    </div>
  );
}

function SummaryCard({ title, value, subtitle, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
  };

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    purple: 'text-purple-700',
    orange: 'text-orange-700',
    red: 'text-red-700',
  };

  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}
