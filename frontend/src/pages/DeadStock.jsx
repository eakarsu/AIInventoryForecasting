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

export default function DeadStock() {
  const [deadStock, setDeadStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
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
      const [deadStockRes, productsData] = await Promise.all([
        api.get(`/dead-stock?${params}`),
        api.get('/products'),
      ]);
      // Handle both paginated and non-paginated responses
      if (deadStockRes.data) {
        setDeadStock(deadStockRes.data);
        setPagination(deadStockRes.pagination);
      } else {
        setDeadStock(Array.isArray(deadStockRes) ? deadStockRes : []);
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
    await api.post('/dead-stock', data);
    toast.success('Dead stock entry created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    await api.put(`/dead-stock/${selectedItem.id}`, editData);
    toast.success('Dead stock entry updated successfully');
    setEditMode(false);
    setSelectedItem(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Entry', 'Are you sure you want to delete this entry? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/dead-stock/${id}`);
        toast.success('Entry deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete entry: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} entries?`);
    if (confirmed) {
      try {
        await api.delete('/dead-stock/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} entries deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const runAIAnalysis = async (productId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.post(`/dead-stock/analyze/${productId}`);
      setAiResult(data);
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResult({ error: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const getVelocityStyle = (velocity) => {
    const styles = {
      fast: 'bg-green-100 text-green-800',
      moderate: 'bg-blue-100 text-blue-800',
      slow: 'bg-yellow-100 text-yellow-800',
      very_slow: 'bg-orange-100 text-orange-800',
      dead: 'bg-red-100 text-red-800',
    };
    return styles[velocity] || 'bg-gray-100 text-gray-800';
  };

  const getRiskStyle = (risk) => {
    const styles = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return styles[risk] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'product_sku', label: 'SKU', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'days_without_sale',
      label: 'Days Stagnant',
      sortable: true,
      render: (value) => (
        <span className={`font-semibold ${value > 60 ? 'text-red-600' : value > 30 ? 'text-orange-600' : 'text-gray-700'}`}>
          {value} days
        </span>
      ),
    },
    {
      key: 'quantity_in_stock',
      label: 'Quantity',
      sortable: true,
    },
    {
      key: 'stock_value',
      label: 'Value at Risk',
      sortable: true,
      render: (value) => <span className="font-semibold">${parseFloat(value).toLocaleString()}</span>,
    },
    {
      key: 'velocity_category',
      label: 'Velocity',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getVelocityStyle(value)}`}>
          {value?.replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'risk_category',
      label: 'Risk',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRiskStyle(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'recommended_action',
      label: 'Action',
      render: (value) => (
        <span className="text-sm text-blue-600">
          {value?.replace('_', ' ')}
        </span>
      ),
    },
  ];

  const formFields = [
    {
      name: 'product_id',
      label: 'Product',
      type: 'select',
      required: true,
      options: products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` })),
    },
    { name: 'days_without_sale', label: 'Days Without Sale', type: 'number', required: true },
    { name: 'last_sale_date', label: 'Last Sale Date', type: 'date' },
    { name: 'quantity_in_stock', label: 'Quantity in Stock', type: 'number', required: true },
    { name: 'stock_value', label: 'Stock Value ($)', type: 'number', required: true },
    { name: 'velocity_category', label: 'Velocity Category', type: 'select', required: true, options: [
      { value: 'fast', label: 'Fast' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'slow', label: 'Slow' },
      { value: 'very_slow', label: 'Very Slow' },
      { value: 'dead', label: 'Dead' },
    ]},
    { name: 'risk_category', label: 'Risk Category', type: 'select', required: true, options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ]},
    { name: 'recommended_action', label: 'Recommended Action', type: 'select', options: [
      { value: 'monitor', label: 'Monitor' },
      { value: 'discount_sale', label: 'Discount Sale' },
      { value: 'bundle_promotion', label: 'Bundle Promotion' },
      { value: 'marketing_push', label: 'Marketing Push' },
      { value: 'clearance', label: 'Clearance' },
      { value: 'write_off', label: 'Write Off' },
    ]},
  ];

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Dead Stock Identifier</h1>
          <p className="text-gray-500">Slow-moving inventory alerts and recovery</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="dead-stock" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Entry
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search dead stock by product, SKU, or category..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Total Dead Stock"
          value={deadStock.length}
          subtitle="items identified"
          color="red"
        />
        <SummaryCard
          title="Value at Risk"
          value={`$${deadStock.reduce((sum, item) => sum + parseFloat(item.stock_value || 0), 0).toLocaleString()}`}
          subtitle="total inventory value"
          color="orange"
        />
        <SummaryCard
          title="Critical Items"
          value={deadStock.filter(d => d.risk_category === 'critical' || d.risk_category === 'high').length}
          subtitle="need immediate action"
          color="red"
        />
        <SummaryCard
          title="Recovery Potential"
          value={`$${deadStock.reduce((sum, item) => sum + parseFloat(item.liquidation_value || 0), 0).toLocaleString()}`}
          subtitle="estimated liquidation"
          color="green"
        />
      </div>

      <DataTable
        columns={columns}
        data={deadStock}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No dead stock identified"
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
        title={`Dead Stock: ${selectedItem?.product_name}`}
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
                  data={aiResult?.analysis}
                  title="AI Dead Stock Analysis"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Recommended Action</label>
                  <select
                    className="input"
                    value={editData.recommended_action || ''}
                    onChange={(e) => setEditData({ ...editData, recommended_action: e.target.value })}
                  >
                    <option value="monitor">Monitor</option>
                    <option value="discount_sale">Discount Sale</option>
                    <option value="bundle_promotion">Bundle Promotion</option>
                    <option value="marketing_push">Marketing Push</option>
                    <option value="clearance">Clearance</option>
                    <option value="write_off">Write Off</option>
                  </select>
                </div>
                <div>
                  <label className="label">Discount Suggestion (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.discount_suggestion || ''}
                    onChange={(e) => setEditData({ ...editData, discount_suggestion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Action Taken</label>
                  <input
                    type="text"
                    className="input"
                    value={editData.action_taken || ''}
                    onChange={(e) => setEditData({ ...editData, action_taken: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={editData.status || ''}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  >
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="action_taken">Action Taken</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Product Information">
                  <DetailRow label="Product" value={selectedItem.product_name} />
                  <DetailRow label="SKU" value={selectedItem.product_sku} />
                  <DetailRow label="Category" value={selectedItem.category} />
                  <DetailRow label="Location" value={selectedItem.location} />
                  <DetailRow label="Unit Price" value={`$${parseFloat(selectedItem.unit_price).toFixed(2)}`} />
                </DetailSection>

                <DetailSection title="Stock Analysis">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-red-600 mb-1">Days Without Sale</p>
                      <p className="text-3xl font-bold text-red-700">{selectedItem.days_without_sale}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-orange-600 mb-1">Value at Risk</p>
                      <p className="text-3xl font-bold text-orange-700">
                        ${parseFloat(selectedItem.stock_value).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <DetailRow label="Quantity in Stock" value={`${selectedItem.quantity_in_stock} units`} />
                  <DetailRow label="Last Sale Date" value={selectedItem.last_sale_date ? new Date(selectedItem.last_sale_date).toLocaleDateString() : 'N/A'} />
                  <DetailRow label="Turnover Rate" value={selectedItem.turnover_rate} />
                  <DetailRow label="Holding Cost Accumulated" value={`$${parseFloat(selectedItem.holding_cost_accumulated || 0).toFixed(2)}`} />
                </DetailSection>

                <DetailSection title="Risk Assessment">
                  <DetailRow
                    label="Velocity Category"
                    value={
                      <span className={`px-3 py-1 rounded-full font-semibold ${getVelocityStyle(selectedItem.velocity_category)}`}>
                        {selectedItem.velocity_category?.replace('_', ' ').toUpperCase()}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Risk Category"
                    value={
                      <span className={`px-3 py-1 rounded-full font-semibold ${getRiskStyle(selectedItem.risk_category)}`}>
                        {selectedItem.risk_category?.toUpperCase()}
                      </span>
                    }
                  />
                </DetailSection>

                <DetailSection title="Recovery Options">
                  <DetailRow label="Recommended Action" value={selectedItem.recommended_action?.replace('_', ' ')} />
                  <DetailRow label="Discount Suggestion" value={selectedItem.discount_suggestion ? `${selectedItem.discount_suggestion}%` : 'N/A'} />
                  <DetailRow label="Liquidation Value" value={`$${parseFloat(selectedItem.liquidation_value || 0).toLocaleString()}`} />
                  <DetailRow label="Write-off Recommendation" value={selectedItem.write_off_recommendation ? 'Yes' : 'No'} />
                </DetailSection>

                {selectedItem.ai_analysis && (
                  <DetailSection title="AI Analysis">
                    <p className="text-gray-700">{selectedItem.ai_analysis}</p>
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
        title="Add Dead Stock Entry"
        fields={formFields}
      />
    </div>
  );
}

function SummaryCard({ title, value, subtitle, color }) {
  const colors = {
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
  };

  const textColors = {
    red: 'text-red-700',
    orange: 'text-orange-700',
    green: 'text-green-700',
    blue: 'text-blue-700',
  };

  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}
