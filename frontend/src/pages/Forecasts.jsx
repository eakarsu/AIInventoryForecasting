import { useState, useEffect } from 'react';
import DataTable, { StatusBadge } from '../components/DataTable';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import NewItemForm from '../components/NewItemForm';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api, useAuth } from '../App';

export default function Forecasts() {
  const [forecasts, setForecasts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForecast, setSelectedForecast] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
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
      const [forecastsRes, productsData] = await Promise.all([
        api.get(`/forecasts?${params}`),
        api.get('/products'),
      ]);
      // Handle both paginated and non-paginated responses
      if (forecastsRes.data) {
        setForecasts(forecastsRes.data);
        setPagination(forecastsRes.pagination);
      } else {
        setForecasts(Array.isArray(forecastsRes) ? forecastsRes : []);
        setPagination(null);
      }
      setProducts(Array.isArray(productsData) ? productsData : productsData.data || []);
    } catch (error) {
      console.error('Failed to load forecasts:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/forecasts', data);
    toast.success('Forecast created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/forecasts/${selectedForecast.id}`, editData);
      toast.success('Forecast updated successfully');
      setEditMode(false);
      setSelectedForecast(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update forecast: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Forecast', 'Are you sure you want to delete this forecast? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/forecasts/${id}`);
        toast.success('Forecast deleted successfully');
        setSelectedForecast(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete forecast: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} forecasts?`);
    if (confirmed) {
      try {
        await api.delete('/forecasts/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} forecasts deleted`);
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

  const columns = [
    {
      key: 'product_name',
      label: 'Product',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.product_sku}</p>
        </div>
      ),
    },
    {
      key: 'forecast_date',
      label: 'Forecast Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'predicted_demand',
      label: 'Predicted',
      sortable: true,
      render: (value) => <span className="font-medium">{value} units</span>,
    },
    {
      key: 'actual_demand',
      label: 'Actual',
      render: (value) => (value !== null ? `${value} units` : '-'),
    },
    {
      key: 'confidence_level',
      label: 'Confidence',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div
              className="bg-primary-600 h-2 rounded-full"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">{parseFloat(value).toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: 'trend_direction',
      label: 'Trend',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const forecastFields = [
    {
      name: 'product_id',
      label: 'Product',
      type: 'select',
      required: true,
      options: products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
    },
    { name: 'forecast_date', label: 'Forecast Date', type: 'date', required: true },
    { name: 'predicted_demand', label: 'Predicted Demand', type: 'number', required: true, min: 0 },
    { name: 'confidence_level', label: 'Confidence Level (%)', type: 'number', min: 0, max: 100 },
    {
      name: 'forecast_method',
      label: 'Forecast Method',
      type: 'select',
      options: [
        { value: 'ARIMA', label: 'ARIMA' },
        { value: 'Moving Average', label: 'Moving Average' },
        { value: 'Exponential Smoothing', label: 'Exponential Smoothing' },
        { value: 'Neural Network', label: 'Neural Network' },
        { value: 'AI Model', label: 'AI Model' },
      ],
    },
    {
      name: 'trend_direction',
      label: 'Trend Direction',
      type: 'select',
      options: [
        { value: 'upward', label: 'Upward' },
        { value: 'stable', label: 'Stable' },
        { value: 'downward', label: 'Downward' },
      ],
    },
    { name: 'seasonality_factor', label: 'Seasonality Factor', type: 'number', min: 0, step: 0.01 },
    { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
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
          <h1 className="text-2xl font-bold text-gray-900">Demand Forecasts</h1>
          <p className="text-gray-500">AI-powered demand predictions</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="forecasts" />
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
              Add Forecast
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search forecasts by product, SKU, or trend..." />
      </div>

      {/* Forecast Accuracy Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Forecasts</p>
          <p className="text-2xl font-bold text-gray-900">{forecasts.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Avg Confidence</p>
          <p className="text-2xl font-bold text-gray-900">
            {forecasts.length > 0
              ? (forecasts.reduce((acc, f) => acc + parseFloat(f.confidence_level || 0), 0) / forecasts.length).toFixed(1)
              : 0}
            %
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Upward Trends</p>
          <p className="text-2xl font-bold text-green-600">
            {forecasts.filter((f) => f.trend_direction === 'upward').length}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={forecasts}
        loading={loading}
        onRowClick={setSelectedForecast}
        emptyMessage="No forecasts found"
        selectable={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Forecast Detail Modal */}
      <DetailModal
        isOpen={!!selectedForecast}
        onClose={() => { setSelectedForecast(null); setEditMode(false); }}
        title="Forecast Details"
        size="lg"
        actions={
          <>
            {canWrite && (
              <>
                {editMode ? (
                  <>
                    <button onClick={handleUpdate} className="btn-secondary">Save</button>
                    <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditMode(true); setEditData(selectedForecast); }} className="btn-secondary">
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(selectedForecast?.id)} className="btn-danger">
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {selectedForecast && (
          <>
            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Predicted Demand</label>
                    <input type="number" className="input" value={editData.predicted_demand || ''} onChange={(e) => setEditData({ ...editData, predicted_demand: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Actual Demand</label>
                    <input type="number" className="input" value={editData.actual_demand || ''} onChange={(e) => setEditData({ ...editData, actual_demand: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Confidence Level (%)</label>
                    <input type="number" className="input" value={editData.confidence_level || ''} onChange={(e) => setEditData({ ...editData, confidence_level: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Forecast Method</label>
                    <select className="input" value={editData.forecast_method || ''} onChange={(e) => setEditData({ ...editData, forecast_method: e.target.value })}>
                      <option value="ARIMA">ARIMA</option>
                      <option value="Moving Average">Moving Average</option>
                      <option value="Exponential Smoothing">Exponential Smoothing</option>
                      <option value="Neural Network">Neural Network</option>
                      <option value="AI Model">AI Model</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Trend Direction</label>
                    <select className="input" value={editData.trend_direction || ''} onChange={(e) => setEditData({ ...editData, trend_direction: e.target.value })}>
                      <option value="upward">Upward</option>
                      <option value="stable">Stable</option>
                      <option value="downward">Downward</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Seasonality Factor</label>
                    <input type="number" step="0.01" className="input" value={editData.seasonality_factor || ''} onChange={(e) => setEditData({ ...editData, seasonality_factor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                </div>
              </div>
            ) : (
            <>
            <DetailSection title="Product Information">
              <DetailRow label="Product" value={selectedForecast.product_name} />
              <DetailRow label="SKU" value={selectedForecast.product_sku} />
            </DetailSection>

            <DetailSection title="Forecast Data">
              <DetailRow
                label="Forecast Date"
                value={new Date(selectedForecast.forecast_date).toLocaleDateString()}
              />
              <DetailRow label="Predicted Demand" value={`${selectedForecast.predicted_demand} units`} />
              <DetailRow
                label="Actual Demand"
                value={selectedForecast.actual_demand !== null ? `${selectedForecast.actual_demand} units` : 'Not yet available'}
              />
              <DetailRow
                label="Accuracy"
                value={
                  selectedForecast.actual_demand !== null
                    ? `${(100 - Math.abs((selectedForecast.actual_demand - selectedForecast.predicted_demand) / selectedForecast.predicted_demand * 100)).toFixed(1)}%`
                    : '-'
                }
              />
            </DetailSection>

            <DetailSection title="Model Information">
              <DetailRow label="Forecast Method" value={selectedForecast.forecast_method} />
              <DetailRow label="Confidence Level" value={`${parseFloat(selectedForecast.confidence_level).toFixed(1)}%`} />
              <DetailRow
                label="Trend Direction"
                value={<StatusBadge status={selectedForecast.trend_direction} />}
              />
              <DetailRow label="Seasonality Factor" value={`${selectedForecast.seasonality_factor}x`} />
            </DetailSection>

            {selectedForecast.notes && (
              <DetailSection title="Notes">
                <p className="text-gray-600">{selectedForecast.notes}</p>
              </DetailSection>
            )}
            </>
            )}
          </>
        )}
      </DetailModal>

      {/* New Forecast Form */}
      <NewItemForm
        isOpen={showNewForm}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleCreate}
        title="Add New Forecast"
        fields={forecastFields}
      />
    </div>
  );
}
