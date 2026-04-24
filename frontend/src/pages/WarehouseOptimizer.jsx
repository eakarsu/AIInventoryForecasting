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

export default function WarehouseOptimizer() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewResult, setOverviewResult] = useState(null);
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
      const zonesRes = await api.get(`/warehouse-optimizer?${params}`);
      // Handle both paginated and non-paginated responses
      if (zonesRes.data) {
        setZones(zonesRes.data);
        setPagination(zonesRes.pagination);
      } else {
        setZones(Array.isArray(zonesRes) ? zonesRes : []);
        setPagination(null);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/warehouse-optimizer', {
      ...data,
      product_categories: data.product_categories ? data.product_categories.split(',').map(s => s.trim()) : [],
    });
    toast.success('Warehouse zone created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    await api.put(`/warehouse-optimizer/${selectedItem.id}`, editData);
    toast.success('Warehouse zone updated successfully');
    setEditMode(false);
    setSelectedItem(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Zone', 'Are you sure you want to delete this zone? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/warehouse-optimizer/${id}`);
        toast.success('Zone deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete zone: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} zones?`);
    if (confirmed) {
      try {
        await api.delete('/warehouse-optimizer/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} zones deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const runAIAnalysis = async (zoneId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.post(`/warehouse-optimizer/analyze/${zoneId}`);
      setAiResult(data);
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResult({ error: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const runOverviewAnalysis = async () => {
    setOverviewLoading(true);
    setOverviewResult(null);
    try {
      const data = await api.post('/warehouse-optimizer/analyze-all');
      setOverviewResult(data);
    } catch (error) {
      console.error('Overview analysis failed:', error);
      setOverviewResult({ error: error.message });
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const getUtilizationColor = (utilization, optimal) => {
    const ratio = utilization / optimal;
    if (ratio < 0.5) return 'text-yellow-600';
    if (ratio <= 1.1) return 'text-green-600';
    return 'text-red-600';
  };

  const getZoneTypeStyle = (type) => {
    const styles = {
      fast_pick: 'bg-green-100 text-green-800',
      standard: 'bg-blue-100 text-blue-800',
      bulk: 'bg-purple-100 text-purple-800',
      specialized: 'bg-indigo-100 text-indigo-800',
      premium: 'bg-yellow-100 text-yellow-800',
      secure: 'bg-red-100 text-red-800',
      cold: 'bg-cyan-100 text-cyan-800',
      receiving: 'bg-teal-100 text-teal-800',
      staging: 'bg-orange-100 text-orange-800',
      returns: 'bg-gray-100 text-gray-800',
      reserve: 'bg-slate-100 text-slate-800',
      overflow: 'bg-amber-100 text-amber-800',
      cross_dock: 'bg-lime-100 text-lime-800',
      hazmat: 'bg-rose-100 text-rose-800',
    };
    return styles[type] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    { key: 'zone_name', label: 'Zone', sortable: true },
    {
      key: 'zone_type',
      label: 'Type',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getZoneTypeStyle(value)}`}>
          {value?.replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    { key: 'location_code', label: 'Code', sortable: true },
    { key: 'capacity_units', label: 'Capacity', sortable: true },
    {
      key: 'current_utilization',
      label: 'Utilization',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center">
          <div className="w-20 bg-gray-200 rounded-full h-3 mr-2">
            <div
              className={`h-3 rounded-full ${
                value > row.optimal_utilization ? 'bg-red-500' : value < row.optimal_utilization * 0.5 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(value, 100)}%` }}
            />
          </div>
          <span className={`font-semibold ${getUtilizationColor(value, row.optimal_utilization)}`}>
            {value}%
          </span>
        </div>
      ),
    },
    {
      key: 'efficiency_score',
      label: 'Efficiency',
      sortable: true,
      render: (value) => (
        <span className={`font-semibold ${value >= 90 ? 'text-green-600' : value >= 75 ? 'text-blue-600' : 'text-orange-600'}`}>
          {value}%
        </span>
      ),
    },
    {
      key: 'access_frequency',
      label: 'Access',
      render: (value) => {
        const colors = {
          very_high: 'text-red-600',
          high: 'text-orange-600',
          medium: 'text-blue-600',
          low: 'text-gray-600',
        };
        return <span className={colors[value] || 'text-gray-600'}>{value?.replace('_', ' ')}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const formFields = [
    { name: 'zone_name', label: 'Zone Name', type: 'text', required: true },
    { name: 'zone_type', label: 'Zone Type', type: 'select', required: true, options: [
      { value: 'fast_pick', label: 'Fast Pick' },
      { value: 'standard', label: 'Standard' },
      { value: 'bulk', label: 'Bulk' },
      { value: 'specialized', label: 'Specialized' },
      { value: 'premium', label: 'Premium' },
      { value: 'secure', label: 'Secure' },
      { value: 'cold', label: 'Cold Storage' },
      { value: 'receiving', label: 'Receiving' },
      { value: 'staging', label: 'Staging' },
      { value: 'returns', label: 'Returns' },
    ]},
    { name: 'location_code', label: 'Location Code', type: 'text', required: true },
    { name: 'capacity_units', label: 'Capacity (units)', type: 'number', required: true },
    { name: 'current_utilization', label: 'Current Utilization (%)', type: 'number', required: true },
    { name: 'access_frequency', label: 'Access Frequency', type: 'select', options: [
      { value: 'very_high', label: 'Very High' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ]},
    { name: 'temperature_controlled', label: 'Temperature Controlled', type: 'checkbox' },
    { name: 'humidity_controlled', label: 'Humidity Controlled', type: 'checkbox' },
    { name: 'product_categories', label: 'Product Categories (comma-separated)', type: 'text' },
  ];

  // Calculate summary stats
  const avgUtilization = zones.length > 0
    ? (zones.reduce((sum, z) => sum + parseFloat(z.current_utilization || 0), 0) / zones.length).toFixed(1)
    : 0;
  const avgEfficiency = zones.length > 0
    ? (zones.reduce((sum, z) => sum + parseFloat(z.efficiency_score || 0), 0) / zones.length).toFixed(1)
    : 0;
  const totalCapacity = zones.reduce((sum, z) => sum + parseInt(z.capacity_units || 0), 0);

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
          <h1 className="text-2xl font-bold text-gray-900">AI Warehouse Layout Optimizer</h1>
          <p className="text-gray-500">Storage efficiency and layout optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="warehouse-zones" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          <button
            onClick={runOverviewAnalysis}
            className="btn-secondary"
            disabled={overviewLoading}
          >
            {overviewLoading ? 'Analyzing...' : 'Analyze All Zones'}
          </button>
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Zone
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search zones by name, type, or location code..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Total Zones"
          value={zones.length}
          subtitle="warehouse zones"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="blue"
        />
        <SummaryCard
          title="Total Capacity"
          value={totalCapacity.toLocaleString()}
          subtitle="storage units"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
          color="purple"
        />
        <SummaryCard
          title="Avg Utilization"
          value={`${avgUtilization}%`}
          subtitle="across all zones"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          color="green"
        />
        <SummaryCard
          title="Avg Efficiency"
          value={`${avgEfficiency}%`}
          subtitle="operational score"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          color="orange"
        />
      </div>

      {/* Overview AI Analysis */}
      {(overviewLoading || overviewResult) && (
        <div className="mb-6">
          <AIResultDisplay
            data={overviewResult?.analysis}
            title="Warehouse Overview Analysis"
            loading={overviewLoading}
            error={overviewResult?.error}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={zones}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No warehouse zones found"
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
        title={`Zone: ${selectedItem?.zone_name}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => runAIAnalysis(selectedItem?.id)}
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
                  title="AI Layout Optimization"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Current Utilization (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.current_utilization || ''}
                    onChange={(e) => setEditData({ ...editData, current_utilization: e.target.value })}
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
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Zone Information">
                  <DetailRow label="Zone Name" value={selectedItem.zone_name} />
                  <DetailRow
                    label="Zone Type"
                    value={
                      <span className={`px-3 py-1 rounded-full font-semibold ${getZoneTypeStyle(selectedItem.zone_type)}`}>
                        {selectedItem.zone_type?.replace('_', ' ').toUpperCase()}
                      </span>
                    }
                  />
                  <DetailRow label="Location Code" value={selectedItem.location_code} />
                  <DetailRow label="Access Frequency" value={selectedItem.access_frequency?.replace('_', ' ')} />
                </DetailSection>

                <DetailSection title="Capacity & Utilization">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-blue-600 mb-1">Capacity</p>
                      <p className="text-3xl font-bold text-blue-700">{selectedItem.capacity_units}</p>
                      <p className="text-xs text-blue-500">units</p>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${
                      selectedItem.current_utilization > selectedItem.optimal_utilization
                        ? 'bg-red-50'
                        : selectedItem.current_utilization < selectedItem.optimal_utilization * 0.5
                        ? 'bg-yellow-50'
                        : 'bg-green-50'
                    }`}>
                      <p className="text-sm text-gray-600 mb-1">Utilization</p>
                      <p className="text-3xl font-bold">{selectedItem.current_utilization}%</p>
                      <p className="text-xs text-gray-500">target: {selectedItem.optimal_utilization}%</p>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Efficiency Metrics">
                  <div className="grid grid-cols-3 gap-4">
                    <MetricCard label="Overall" value={selectedItem.efficiency_score} suffix="%" />
                    <MetricCard label="Travel Distance" value={selectedItem.travel_distance_score} suffix="%" />
                    <MetricCard label="Picking" value={selectedItem.picking_efficiency} suffix="%" />
                  </div>
                </DetailSection>

                <DetailSection title="Environment Controls">
                  <DetailRow
                    label="Temperature Controlled"
                    value={selectedItem.temperature_controlled ? 'Yes' : 'No'}
                  />
                  <DetailRow
                    label="Humidity Controlled"
                    value={selectedItem.humidity_controlled ? 'Yes' : 'No'}
                  />
                  <DetailRow
                    label="Storage Cost"
                    value={`$${parseFloat(selectedItem.storage_cost_per_unit || 0).toFixed(2)}/unit`}
                  />
                </DetailSection>

                {selectedItem.product_categories && selectedItem.product_categories.length > 0 && (
                  <DetailSection title="Product Categories">
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.product_categories.map((cat, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {selectedItem.ai_layout_suggestion && (
                  <DetailSection title="AI Layout Suggestion">
                    <p className="text-gray-700">{selectedItem.ai_layout_suggestion}</p>
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
        title="Add Warehouse Zone"
        fields={formFields}
      />
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
  };

  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={colors[color]}>{icon}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, suffix }) {
  const getColor = (v) => {
    if (v >= 90) return 'text-green-600 bg-green-50';
    if (v >= 75) return 'text-blue-600 bg-blue-50';
    if (v >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className={`p-3 rounded-lg text-center ${getColor(value)}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}{suffix}</p>
    </div>
  );
}
