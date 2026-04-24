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

export default function DemandPredictor() {
  const [predictions, setPredictions] = useState([]);
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
      const [predictionsRes, productsData] = await Promise.all([
        api.get(`/demand-predictor?${params}`),
        api.get('/products'),
      ]);
      // Handle both paginated and non-paginated responses
      if (predictionsRes.data) {
        setPredictions(predictionsRes.data);
        setPagination(predictionsRes.pagination);
      } else {
        setPredictions(Array.isArray(predictionsRes) ? predictionsRes : []);
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
    await api.post('/demand-predictor', data);
    toast.success('Prediction created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    await api.put(`/demand-predictor/${selectedItem.id}`, editData);
    toast.success('Prediction updated successfully');
    setEditMode(false);
    setSelectedItem(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Prediction', 'Are you sure you want to delete this prediction? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/demand-predictor/${id}`);
        toast.success('Prediction deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete prediction: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} predictions?`);
    if (confirmed) {
      try {
        await api.delete('/demand-predictor/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} predictions deleted`);
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
      const data = await api.post(`/demand-predictor/analyze/${productId}`);
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

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'product_sku', label: 'SKU', sortable: true },
    {
      key: 'prediction_date',
      label: 'Forecast Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'predicted_quantity',
      label: 'Predicted Qty',
      sortable: true,
      render: (value) => <span className="font-semibold text-blue-600">{value}</span>,
    },
    {
      key: 'confidence_score',
      label: 'Confidence',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div
              className={`h-2 rounded-full ${
                value >= 90 ? 'bg-green-500' : value >= 75 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm">{value}%</span>
        </div>
      ),
    },
    {
      key: 'trend_direction',
      label: 'Trend',
      render: (value) => {
        const colors = {
          upward: 'text-green-600 bg-green-50',
          stable: 'text-blue-600 bg-blue-50',
          downward: 'text-red-600 bg-red-50',
        };
        const icons = { upward: '↑', stable: '→', downward: '↓' };
        return (
          <span className={`px-2 py-1 rounded-full text-sm font-medium ${colors[value] || 'bg-gray-50'}`}>
            {icons[value]} {value}
          </span>
        );
      },
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
    { name: 'prediction_date', label: 'Forecast Date', type: 'date', required: true },
    { name: 'period_type', label: 'Period Type', type: 'select', required: true, options: [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
    ]},
    { name: 'predicted_quantity', label: 'Predicted Quantity', type: 'number', required: true },
    { name: 'confidence_score', label: 'Confidence Score (%)', type: 'number', required: true },
    { name: 'seasonality_index', label: 'Seasonality Index', type: 'number', step: '0.01' },
    { name: 'trend_direction', label: 'Trend Direction', type: 'select', options: [
      { value: 'upward', label: 'Upward' },
      { value: 'stable', label: 'Stable' },
      { value: 'downward', label: 'Downward' },
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
          <h1 className="text-2xl font-bold text-gray-900">AI Demand Predictor</h1>
          <p className="text-gray-500">Seasonal and trend forecasting powered by AI</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="demand-predictions" />
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
              New Prediction
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search predictions by product, SKU, or trend..." />
      </div>

      <DataTable
        columns={columns}
        data={predictions}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No demand predictions found"
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
        title={`Demand Prediction: ${selectedItem?.product_name}`}
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
                  data={aiResult?.prediction}
                  title="AI Demand Forecast"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Predicted Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.predicted_quantity || ''}
                    onChange={(e) => setEditData({ ...editData, predicted_quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Confidence Score (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.confidence_score || ''}
                    onChange={(e) => setEditData({ ...editData, confidence_score: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Trend Direction</label>
                  <select
                    className="input"
                    value={editData.trend_direction || ''}
                    onChange={(e) => setEditData({ ...editData, trend_direction: e.target.value })}
                  >
                    <option value="upward">Upward</option>
                    <option value="stable">Stable</option>
                    <option value="downward">Downward</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Prediction Details">
                  <DetailRow label="Product" value={selectedItem.product_name} />
                  <DetailRow label="SKU" value={selectedItem.product_sku} />
                  <DetailRow label="Category" value={selectedItem.category} />
                  <DetailRow label="Forecast Date" value={new Date(selectedItem.prediction_date).toLocaleDateString()} />
                  <DetailRow label="Period Type" value={selectedItem.period_type} />
                </DetailSection>

                <DetailSection title="Forecast Metrics">
                  <DetailRow label="Predicted Quantity" value={<span className="text-2xl font-bold text-blue-600">{selectedItem.predicted_quantity} units</span>} />
                  <DetailRow label="Confidence Score" value={`${selectedItem.confidence_score}%`} />
                  <DetailRow label="Seasonality Index" value={selectedItem.seasonality_index} />
                  <DetailRow label="Trend Direction" value={selectedItem.trend_direction} />
                  <DetailRow label="Trend Coefficient" value={selectedItem.trend_coefficient} />
                </DetailSection>

                <DetailSection title="Current Stock">
                  <DetailRow label="Current Stock" value={`${selectedItem.current_stock} units`} />
                  <DetailRow label="Unit Price" value={`$${parseFloat(selectedItem.unit_price).toFixed(2)}`} />
                </DetailSection>

                {selectedItem.ai_reasoning && (
                  <DetailSection title="AI Reasoning">
                    <p className="text-gray-700">{selectedItem.ai_reasoning}</p>
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
        title="Create New Demand Prediction"
        fields={formFields}
      />
    </div>
  );
}
