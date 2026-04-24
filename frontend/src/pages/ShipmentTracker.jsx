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

export default function ShipmentTracker() {
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [fleetAnalysis, setFleetAnalysis] = useState(null);
  const [fleetLoading, setFleetLoading] = useState(false);
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
      const [shipmentsRes, ordersData, suppliersData] = await Promise.all([
        api.get(`/shipment-tracker?${params}`),
        api.get('/orders'),
        api.get('/suppliers'),
      ]);
      if (shipmentsRes.data) {
        setShipments(shipmentsRes.data);
        setPagination(shipmentsRes.pagination);
      } else {
        setShipments(Array.isArray(shipmentsRes) ? shipmentsRes : []);
        setPagination(null);
      }
      setOrders(Array.isArray(ordersData) ? ordersData : ordersData.data || []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/shipment-tracker', data);
    toast.success('Shipment created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/shipment-tracker/${selectedItem.id}`, editData);
      toast.success('Shipment updated successfully');
      setEditMode(false);
      setSelectedItem(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Shipment', 'Are you sure you want to delete this shipment? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/shipment-tracker/${id}`);
        toast.success('Shipment deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} shipments?`);
    if (confirmed) {
      try {
        await api.delete('/shipment-tracker/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} shipments deleted`);
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

  const runAIAnalysis = async (shipmentId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.post(`/shipment-tracker/analyze/${shipmentId}`);
      setAiResult(data);
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResult({ error: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const runFleetAnalysis = async () => {
    setFleetLoading(true);
    setFleetAnalysis(null);
    try {
      const data = await api.post('/shipment-tracker/analyze-all');
      setFleetAnalysis(data);
    } catch (error) {
      console.error('Fleet analysis failed:', error);
      setFleetAnalysis({ error: error.message });
    } finally {
      setFleetLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 text-gray-800',
      'in_transit': 'bg-blue-100 text-blue-800',
      'out_for_delivery': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'delayed': 'bg-red-100 text-red-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'critical': 'bg-red-500 text-white',
      'high': 'bg-orange-100 text-orange-800',
      'normal': 'bg-blue-100 text-blue-800',
      'low': 'bg-gray-100 text-gray-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getShipmentTypeColor = (type) => {
    const colors = {
      'ground': 'bg-green-100 text-green-800',
      'expedited': 'bg-purple-100 text-purple-800',
      'ocean': 'bg-blue-100 text-blue-800',
      'air': 'bg-cyan-100 text-cyan-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  const columns = [
    { key: 'shipment_number', label: 'Shipment #', sortable: true },
    { key: 'carrier', label: 'Carrier', sortable: true },
    {
      key: 'shipment_type',
      label: 'Type',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getShipmentTypeColor(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'origin_location',
      label: 'Origin',
      render: (value) => (
        <span className="text-sm truncate max-w-32 block" title={value}>
          {value?.split(',')[0]}
        </span>
      ),
    },
    {
      key: 'destination_location',
      label: 'Destination',
      render: (value) => (
        <span className="text-sm truncate max-w-32 block" title={value}>
          {value?.split(',')[0]}
        </span>
      ),
    },
    {
      key: 'current_status',
      label: 'Status',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(value)}`}>
          {value?.replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'priority_level',
      label: 'Priority',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'delay_days',
      label: 'Delay',
      sortable: true,
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {value > 0 ? `+${value} days` : 'On Time'}
        </span>
      ),
    },
    {
      key: 'estimated_arrival',
      label: 'ETA',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
  ];

  const formFields = [
    { name: 'shipment_number', label: 'Shipment Number', type: 'text', required: true },
    {
      name: 'order_id',
      label: 'Order',
      type: 'select',
      options: orders.map((o) => ({ value: o.id, label: o.order_number })),
    },
    {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'origin_location', label: 'Origin Location', type: 'text', required: true },
    { name: 'destination_location', label: 'Destination Location', type: 'text', required: true },
    { name: 'carrier', label: 'Carrier', type: 'text', required: true },
    { name: 'tracking_number', label: 'Tracking Number', type: 'text' },
    {
      name: 'shipment_type',
      label: 'Shipment Type',
      type: 'select',
      required: true,
      options: [
        { value: 'ground', label: 'Ground' },
        { value: 'expedited', label: 'Expedited' },
        { value: 'ocean', label: 'Ocean' },
        { value: 'air', label: 'Air' },
      ],
    },
    { name: 'weight_kg', label: 'Weight (kg)', type: 'number' },
    { name: 'volume_cbm', label: 'Volume (CBM)', type: 'number' },
    { name: 'estimated_departure', label: 'Estimated Departure', type: 'datetime-local' },
    { name: 'estimated_arrival', label: 'Estimated Arrival', type: 'datetime-local' },
    {
      name: 'priority_level',
      label: 'Priority',
      type: 'select',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    { name: 'temperature_sensitive', label: 'Temperature Sensitive', type: 'checkbox' },
    { name: 'handling_instructions', label: 'Handling Instructions', type: 'textarea' },
    { name: 'cost_estimate', label: 'Estimated Cost ($)', type: 'number' },
    { name: 'insurance_value', label: 'Insurance Value ($)', type: 'number' },
  ];

  const inTransit = shipments.filter(s => s.status === 'in_transit' || s.current_status === 'in_transit').length;
  const delayed = shipments.filter(s => s.delay_days > 0).length;
  const delivered = shipments.filter(s => s.status === 'delivered').length;
  const critical = shipments.filter(s => s.priority_level === 'critical' || s.priority_level === 'high').length;

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Shipment Tracker (Manufacturing)</h1>
          <p className="text-gray-500">Real-time shipment tracking and logistics optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="shipment-tracking" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          <button
            onClick={runFleetAnalysis}
            className="btn-secondary"
            disabled={fleetLoading}
          >
            {fleetLoading ? 'Analyzing...' : 'Analyze Fleet'}
          </button>
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Shipment
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search shipments by number, carrier, or status..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <SummaryCard
          title="Total Shipments"
          value={shipments.length}
          subtitle="tracked"
          color="blue"
          icon={<TruckIcon />}
        />
        <SummaryCard
          title="In Transit"
          value={inTransit}
          subtitle="on the way"
          color="purple"
          icon={<RouteIcon />}
        />
        <SummaryCard
          title="Delivered"
          value={delivered}
          subtitle="completed"
          color="green"
          icon={<CheckIcon />}
        />
        <SummaryCard
          title="Delayed"
          value={delayed}
          subtitle="need attention"
          color="red"
          icon={<AlertIcon />}
        />
        <SummaryCard
          title="Critical/High"
          value={critical}
          subtitle="priority shipments"
          color="orange"
          icon={<PriorityIcon />}
        />
      </div>

      {/* Fleet Analysis Results */}
      {(fleetLoading || fleetAnalysis) && (
        <div className="mb-6">
          <AIResultDisplay
            data={fleetAnalysis?.analysis}
            title="AI Fleet Analysis"
            loading={fleetLoading}
            error={fleetAnalysis?.error}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={shipments}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No shipments found"
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
        title={`Shipment: ${selectedItem?.shipment_number}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => runAIAnalysis(selectedItem?.id)}
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
                  title="AI Shipment Analysis"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Current Location</label>
                  <input
                    type="text"
                    className="input"
                    value={editData.current_location || ''}
                    onChange={(e) => setEditData({ ...editData, current_location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Current Status</label>
                  <select
                    className="input"
                    value={editData.current_status || ''}
                    onChange={(e) => setEditData({ ...editData, current_status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_transit">In Transit</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="delayed">Delayed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="label">Delay Days</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.delay_days || 0}
                    onChange={(e) => setEditData({ ...editData, delay_days: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Delay Reason</label>
                  <textarea
                    className="input"
                    value={editData.delay_reason || ''}
                    onChange={(e) => setEditData({ ...editData, delay_reason: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Customs Status</label>
                  <select
                    className="input"
                    value={editData.customs_status || ''}
                    onChange={(e) => setEditData({ ...editData, customs_status: e.target.value })}
                  >
                    <option value="">N/A</option>
                    <option value="domestic">Domestic</option>
                    <option value="pending_customs">Pending Customs</option>
                    <option value="in_customs_clearance">In Customs Clearance</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Shipment Overview">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-blue-600 mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedItem.current_status)}`}>
                        {selectedItem.current_status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-purple-600 mb-1">Priority</p>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(selectedItem.priority_level)}`}>
                        {selectedItem.priority_level?.toUpperCase()}
                      </span>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${selectedItem.delay_days > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-sm mb-1 ${selectedItem.delay_days > 0 ? 'text-red-600' : 'text-green-600'}`}>Delay Status</p>
                      <p className={`text-xl font-bold ${selectedItem.delay_days > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {selectedItem.delay_days > 0 ? `+${selectedItem.delay_days} days` : 'On Time'}
                      </p>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Route Information">
                  <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Origin</p>
                      <p className="font-semibold text-gray-800">{selectedItem.origin_location}</p>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="flex items-center">
                        <div className="h-0.5 flex-1 bg-blue-200"></div>
                        <svg className="w-6 h-6 text-blue-500 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <div className="h-0.5 flex-1 bg-blue-200"></div>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Destination</p>
                      <p className="font-semibold text-gray-800">{selectedItem.destination_location}</p>
                    </div>
                  </div>
                  <DetailRow label="Current Location" value={selectedItem.current_location || 'Origin'} />
                  <DetailRow label="Carrier" value={selectedItem.carrier} />
                  <DetailRow label="Tracking Number" value={selectedItem.tracking_number || 'N/A'} />
                </DetailSection>

                <DetailSection title="Shipment Details">
                  <DetailRow
                    label="Type"
                    value={
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getShipmentTypeColor(selectedItem.shipment_type)}`}>
                        {selectedItem.shipment_type?.toUpperCase()}
                      </span>
                    }
                  />
                  <DetailRow label="Weight" value={selectedItem.weight_kg ? `${selectedItem.weight_kg} kg` : 'N/A'} />
                  <DetailRow label="Volume" value={selectedItem.volume_cbm ? `${selectedItem.volume_cbm} CBM` : 'N/A'} />
                  <DetailRow label="Supplier" value={selectedItem.supplier_name || 'N/A'} />
                  <DetailRow label="Order" value={selectedItem.order_number || 'N/A'} />
                </DetailSection>

                <DetailSection title="Timeline">
                  <div className="space-y-3">
                    <TimelineItem
                      label="Estimated Departure"
                      value={selectedItem.estimated_departure}
                      actual={selectedItem.actual_departure}
                    />
                    <TimelineItem
                      label="Estimated Arrival"
                      value={selectedItem.estimated_arrival}
                      actual={selectedItem.actual_arrival}
                    />
                    {selectedItem.ai_eta_prediction && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-600">AI Predicted ETA</p>
                        <p className="font-semibold text-blue-800">
                          {new Date(selectedItem.ai_eta_prediction).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </DetailSection>

                {selectedItem.temperature_sensitive && (
                  <DetailSection title="Temperature Monitoring">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-blue-600">Min Temp</p>
                        <p className="font-bold text-blue-700">{selectedItem.temperature_min}C</p>
                      </div>
                      <div className={`p-3 rounded-lg text-center ${
                        selectedItem.current_temperature >= selectedItem.temperature_min &&
                        selectedItem.current_temperature <= selectedItem.temperature_max
                          ? 'bg-green-50'
                          : 'bg-red-50'
                      }`}>
                        <p className="text-xs text-gray-600">Current</p>
                        <p className={`font-bold ${
                          selectedItem.current_temperature >= selectedItem.temperature_min &&
                          selectedItem.current_temperature <= selectedItem.temperature_max
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}>{selectedItem.current_temperature}C</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-orange-600">Max Temp</p>
                        <p className="font-bold text-orange-700">{selectedItem.temperature_max}C</p>
                      </div>
                    </div>
                  </DetailSection>
                )}

                <DetailSection title="Cost & Insurance">
                  <DetailRow label="Estimated Cost" value={selectedItem.cost_estimate ? `$${parseFloat(selectedItem.cost_estimate).toLocaleString()}` : 'N/A'} />
                  <DetailRow label="Actual Cost" value={selectedItem.actual_cost ? `$${parseFloat(selectedItem.actual_cost).toLocaleString()}` : 'Pending'} />
                  <DetailRow label="Insurance Value" value={selectedItem.insurance_value ? `$${parseFloat(selectedItem.insurance_value).toLocaleString()}` : 'N/A'} />
                </DetailSection>

                {selectedItem.delay_reason && (
                  <DetailSection title="Delay Information">
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-red-600 mb-1">Reason for Delay</p>
                      <p className="text-red-800">{selectedItem.delay_reason}</p>
                    </div>
                  </DetailSection>
                )}

                {selectedItem.handling_instructions && (
                  <DetailSection title="Handling Instructions">
                    <p className="text-gray-700">{selectedItem.handling_instructions}</p>
                  </DetailSection>
                )}

                {selectedItem.ai_risk_assessment && (
                  <DetailSection title="AI Risk Assessment">
                    <p className="text-gray-700">{selectedItem.ai_risk_assessment}</p>
                  </DetailSection>
                )}

                {selectedItem.ai_route_optimization && (
                  <DetailSection title="AI Route Optimization">
                    <p className="text-gray-700">{selectedItem.ai_route_optimization}</p>
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
        title="Add New Shipment"
        fields={formFields}
      />
    </div>
  );
}

function TimelineItem({ label, value, actual }) {
  const estimated = value ? new Date(value) : null;
  const actualDate = actual ? new Date(actual) : null;
  const isComplete = actualDate !== null;

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg ${isComplete ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      <div className="flex-1">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="font-medium">{estimated?.toLocaleString() || 'N/A'}</p>
      </div>
      {isComplete && (
        <div className="text-right">
          <p className="text-xs text-green-600">Actual</p>
          <p className="text-sm font-medium text-green-700">{actualDate?.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, color, icon }) {
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
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-600">{title}</p>
        <span className={textColors[color]}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function PriorityIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
}
