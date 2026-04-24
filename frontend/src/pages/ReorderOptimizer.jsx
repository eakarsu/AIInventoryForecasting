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

export default function ReorderOptimizer() {
  const [optimizations, setOptimizations] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
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
      const [optRes, productsData, suppliersData] = await Promise.all([
        api.get(`/reorder-optimizer?${params}`),
        api.get('/products'),
        api.get('/suppliers'),
      ]);
      // Handle both paginated and non-paginated responses
      if (optRes.data) {
        setOptimizations(optRes.data);
        setPagination(optRes.pagination);
      } else {
        setOptimizations(Array.isArray(optRes) ? optRes : []);
        setPagination(null);
      }
      setProducts(Array.isArray(productsData) ? productsData : productsData.data || []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/reorder-optimizer', data);
    toast.success('Optimization created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    await api.put(`/reorder-optimizer/${selectedItem.id}`, editData);
    toast.success('Optimization updated successfully');
    setEditMode(false);
    setSelectedItem(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Optimization', 'Are you sure you want to delete this optimization? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/reorder-optimizer/${id}`);
        toast.success('Optimization deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete optimization: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} optimizations?`);
    if (confirmed) {
      try {
        await api.delete('/reorder-optimizer/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} optimizations deleted`);
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
      const data = await api.post(`/reorder-optimizer/analyze/${productId}`);
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

  const getUrgencyStyle = (urgency) => {
    const styles = {
      low: 'bg-green-100 text-green-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800 animate-pulse',
    };
    return styles[urgency] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'product_sku', label: 'SKU', sortable: true },
    {
      key: 'current_stock',
      label: 'Current Stock',
      sortable: true,
      render: (value, row) => (
        <span className={value <= row.reorder_point ? 'text-red-600 font-bold' : ''}>
          {value}
        </span>
      ),
    },
    {
      key: 'optimal_order_quantity',
      label: 'Order Qty',
      sortable: true,
      render: (value) => <span className="font-semibold text-blue-600">{value}</span>,
    },
    {
      key: 'optimal_order_date',
      label: 'Order By',
      sortable: true,
      render: (value) => {
        const date = new Date(value);
        const today = new Date();
        const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        return (
          <span className={diff <= 3 ? 'text-red-600 font-bold' : diff <= 7 ? 'text-orange-600' : ''}>
            {date.toLocaleDateString()} {diff <= 3 && '(URGENT)'}
          </span>
        );
      },
    },
    {
      key: 'total_cost_savings',
      label: 'Savings',
      sortable: true,
      render: (value) => (
        <span className="text-green-600 font-semibold">${parseFloat(value).toLocaleString()}</span>
      ),
    },
    {
      key: 'urgency',
      label: 'Urgency',
      sortable: true,
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getUrgencyStyle(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
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
    {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      required: true,
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'optimal_order_quantity', label: 'Order Quantity', type: 'number', required: true },
    { name: 'optimal_order_date', label: 'Order Date', type: 'date', required: true },
    { name: 'safety_stock_level', label: 'Safety Stock Level', type: 'number' },
    { name: 'reorder_point_suggested', label: 'Suggested Reorder Point', type: 'number' },
    { name: 'urgency', label: 'Urgency', type: 'select', required: true, options: [
      { value: 'low', label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
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
          <h1 className="text-2xl font-bold text-gray-900">AI Reorder Optimizer</h1>
          <p className="text-gray-500">Just-in-time ordering optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="reorder-optimizations" />
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
              New Optimization
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search optimizations by product, SKU, or urgency..." />
      </div>

      <DataTable
        columns={columns}
        data={optimizations}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No reorder optimizations found"
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
        title={`Reorder: ${selectedItem?.product_name}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => runAIAnalysis(selectedItem?.product_id)}
              className="btn-primary"
              disabled={aiLoading}
            >
              {aiLoading ? 'Optimizing...' : 'Run AI Optimization'}
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
                  title="AI Reorder Optimization"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Order Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.optimal_order_quantity || ''}
                    onChange={(e) => setEditData({ ...editData, optimal_order_quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Order Date</label>
                  <input
                    type="date"
                    className="input"
                    value={editData.optimal_order_date?.split('T')[0] || ''}
                    onChange={(e) => setEditData({ ...editData, optimal_order_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Urgency</label>
                  <select
                    className="input"
                    value={editData.urgency || ''}
                    onChange={(e) => setEditData({ ...editData, urgency: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={editData.status || ''}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="ordered">Ordered</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Product Information">
                  <DetailRow label="Product" value={selectedItem.product_name} />
                  <DetailRow label="SKU" value={selectedItem.product_sku} />
                  <DetailRow label="Current Stock" value={`${selectedItem.current_stock} units`} />
                  <DetailRow label="Reorder Point" value={`${selectedItem.reorder_point} units`} />
                  <DetailRow label="Unit Price" value={`$${parseFloat(selectedItem.unit_price).toFixed(2)}`} />
                </DetailSection>

                <DetailSection title="Order Recommendation">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-blue-600 mb-1">Order Quantity</p>
                      <p className="text-3xl font-bold text-blue-700">{selectedItem.optimal_order_quantity}</p>
                      <p className="text-xs text-blue-500">units</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-green-600 mb-1">Cost Savings</p>
                      <p className="text-3xl font-bold text-green-700">
                        ${parseFloat(selectedItem.total_cost_savings).toLocaleString()}
                      </p>
                      <p className="text-xs text-green-500">estimated</p>
                    </div>
                  </div>
                  <DetailRow label="Order By" value={new Date(selectedItem.optimal_order_date).toLocaleDateString()} />
                  <DetailRow label="EOQ (Economic Order Quantity)" value={selectedItem.economic_order_quantity} />
                  <DetailRow label="Safety Stock" value={`${selectedItem.safety_stock_level} units`} />
                  <DetailRow label="Suggested Reorder Point" value={`${selectedItem.reorder_point_suggested} units`} />
                </DetailSection>

                <DetailSection title="Supplier Information">
                  <DetailRow label="Supplier" value={selectedItem.supplier_name} />
                  <DetailRow label="Lead Time" value={`${selectedItem.supplier_lead_time || selectedItem.lead_time_days} days`} />
                  <DetailRow label="Reliability" value={`${selectedItem.reliability_score}%`} />
                  <DetailRow label="On-Time Delivery" value={`${selectedItem.on_time_delivery_rate}%`} />
                </DetailSection>

                <DetailSection title="Cost Analysis">
                  <DetailRow label="Holding Cost (Daily)" value={`$${parseFloat(selectedItem.holding_cost_daily || 0).toFixed(2)}`} />
                  <DetailRow label="Ordering Cost" value={`$${parseFloat(selectedItem.ordering_cost || 0).toFixed(2)}`} />
                  <DetailRow label="Stockout Cost" value={`$${parseFloat(selectedItem.stockout_cost || 0).toFixed(2)}`} />
                  <DetailRow label="Service Level Target" value={`${selectedItem.service_level_target}%`} />
                </DetailSection>

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
        title="Create New Reorder Optimization"
        fields={formFields}
      />
    </div>
  );
}
