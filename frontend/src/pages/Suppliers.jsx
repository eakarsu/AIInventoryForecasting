import { useState, useEffect } from 'react';
import DataTable, { StatusBadge, Rating } from '../components/DataTable';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import NewItemForm, { supplierFields } from '../components/NewItemForm';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api, useAuth } from '../App';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [aiScoring, setAiScoring] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [diversification, setDiversification] = useState(null);
  const [divLoading, setDivLoading] = useState(false);
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
      const data = await api.get(`/suppliers?${params}`);
      // Handle both paginated and non-paginated responses
      if (data.data) {
        setSuppliers(data.data);
        setPagination(data.pagination);
      } else {
        setSuppliers(Array.isArray(data) ? data : []);
        setPagination(null);
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/suppliers', data);
    toast.success('Supplier created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/suppliers/${selectedSupplier.id}`, editData);
      toast.success('Supplier updated successfully');
      setEditMode(false);
      setSelectedSupplier(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update supplier: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Supplier', 'Are you sure you want to delete this supplier? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/suppliers/${id}`);
        toast.success('Supplier deleted successfully');
        setSelectedSupplier(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete supplier: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} suppliers?`);
    if (confirmed) {
      try {
        await api.delete('/suppliers/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} suppliers deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const getAIScoring = async () => {
    setAiLoading(true);
    setAiScoring(null);
    try {
      const data = await api.post('/ai/supplier-scoring');
      console.log('AI Scoring raw response:', data);

      // If scoring is a string, try to parse it
      if (typeof data.scoring === 'string') {
        try {
          data.scoring = JSON.parse(data.scoring);
          console.log('Parsed scoring from string:', data.scoring);
        } catch (e) {
          console.error('Failed to parse scoring string:', e);
        }
      }

      setAiScoring(data);
    } catch (error) {
      console.error('Failed to get AI scoring:', error);
      toast.error('Failed to get AI scoring: ' + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDiversificationAnalysis = async () => {
    setDivLoading(true);
    setDiversification(null);
    try {
      const data = await api.post('/ai/supplier-diversification', {});
      setDiversification(data);
      toast.success('Diversification analysis complete');
    } catch (err) {
      if (err.message && err.message.includes('429')) {
        toast.error('AI rate limit reached. Please wait before making more requests.');
      } else {
        toast.error('Diversification analysis failed: ' + err.message);
      }
    } finally {
      setDivLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const columns = [
    { key: 'name', label: 'Supplier Name', sortable: true },
    { key: 'email', label: 'Email' },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (value) => <Rating value={parseFloat(value)} />,
    },
    {
      key: 'lead_time_days',
      label: 'Lead Time',
      sortable: true,
      render: (value) => `${value} days`,
    },
    {
      key: 'on_time_delivery_rate',
      label: 'On-Time Rate',
      sortable: true,
      render: (value) => (
        <span className={`font-medium ${parseFloat(value) >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
          {parseFloat(value).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
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
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500">Manage your supplier relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="suppliers" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          <button onClick={getAIScoring} className="btn-secondary" disabled={aiLoading}>
            {aiLoading ? 'Analyzing...' : 'AI Supplier Scoring'}
          </button>
          <button onClick={handleDiversificationAnalysis} className="btn-secondary" disabled={divLoading}>
            {divLoading ? 'Analyzing...' : 'Diversification Analysis'}
          </button>
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Supplier
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search suppliers by name, email, or status..." />
      </div>

      {/* AI Loading Indicator */}
      {aiLoading && (
        <div className="mb-6 bg-blue-100 border-2 border-blue-500 rounded-xl p-6 flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-blue-700 font-bold text-lg">Analyzing suppliers with AI... (20-30 seconds)</span>
        </div>
      )}

      {/* AI Scoring Results */}
      {aiScoring && !aiLoading && (
        <div className="mb-6 bg-primary-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Supplier Analysis</h3>
            <button onClick={() => setAiScoring(null)} className="text-gray-400 hover:text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiScoring.scoring?.scores?.map((score, index) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{score.supplier_name}</h4>
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      score.reliability_grade === 'A'
                        ? 'bg-green-100 text-green-800'
                        : score.reliability_grade === 'B'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    Grade {score.reliability_grade}
                  </span>
                </div>
                <p className="text-2xl font-bold text-primary-600 mb-2">{score.overall_score}/100</p>
                <div className="text-sm text-gray-600">
                  <p className="mb-1">
                    <span className="text-green-600">+</span> {score.strengths?.[0]}
                  </p>
                  {score.weaknesses?.[0] && (
                    <p>
                      <span className="text-red-600">-</span> {score.weaknesses[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {aiScoring.scoring?.top_performer && (
            <p className="mt-4 text-sm text-gray-600">
              <strong>Top Performer:</strong> {aiScoring.scoring.top_performer}
            </p>
          )}
        </div>
      )}

      {/* Supplier Diversification Results */}
      {divLoading && (
        <div className="mb-6 bg-orange-50 border-2 border-orange-400 rounded-xl p-6 flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-orange-500 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-orange-700 font-bold">Running diversification analysis...</span>
        </div>
      )}

      {diversification && !divLoading && (
        <div className="mb-6 bg-orange-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Supplier Diversification Analysis</h3>
            <button onClick={() => setDiversification(null)} className="text-gray-400 hover:text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Overall Risk Score Gauge */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={diversification.overall_risk_score > 70 ? '#ef4444' : diversification.overall_risk_score > 40 ? '#f97316' : '#10b981'}
                    strokeWidth="3"
                    strokeDasharray={`${diversification.overall_risk_score} ${100 - diversification.overall_risk_score}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-800">{diversification.overall_risk_score ?? '?'}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Overall Risk Score</p>
              <p className="text-xs text-gray-500">0 = low risk, 100 = high risk</p>
              {diversification.message && <p className="text-sm text-green-700 mt-1">{diversification.message}</p>}
            </div>
          </div>
          {/* High-risk products */}
          {diversification.high_risk_products && diversification.high_risk_products.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-red-700 mb-2">High-Risk Products (Single Source)</h4>
              <div className="flex flex-wrap gap-2">
                {diversification.high_risk_products.map((p, i) => (
                  <span key={i} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">{p}</span>
                ))}
              </div>
            </div>
          )}
          {/* Recommendations */}
          {diversification.diversification_recommendations && diversification.diversification_recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h4>
              <div className="space-y-3">
                {diversification.diversification_recommendations.map((rec, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="font-medium text-gray-800 text-sm">{rec.product}</p>
                    <p className="text-xs text-gray-500 mt-1">Alternative suppliers: {(rec.alternative_suppliers || []).join(', ')}</p>
                    <p className="text-xs text-gray-500">Lead time impact: {rec.lead_time_impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        onRowClick={setSelectedSupplier}
        emptyMessage="No suppliers found"
        selectable={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Supplier Detail Modal */}
      <DetailModal
        isOpen={!!selectedSupplier}
        onClose={() => { setSelectedSupplier(null); setEditMode(false); }}
        title={selectedSupplier?.name}
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
                  <button onClick={() => { setEditMode(true); setEditData(selectedSupplier); }} className="btn-secondary">
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(selectedSupplier?.id)} className="btn-danger">
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {selectedSupplier && (
          <>
            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Name</label>
                    <input type="text" className="input" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input type="text" className="input" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Rating (0-5)</label>
                    <input type="number" step="0.1" min="0" max="5" className="input" value={editData.rating || ''} onChange={(e) => setEditData({ ...editData, rating: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Lead Time (days)</label>
                    <input type="number" className="input" value={editData.lead_time_days || ''} onChange={(e) => setEditData({ ...editData, lead_time_days: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={editData.status || ''} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Address</label>
                  <textarea className="input" value={editData.address || ''} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                </div>
              </div>
            ) : (
            <>
            <DetailSection title="Contact Information">
              <DetailRow label="Name" value={selectedSupplier.name} />
              <DetailRow label="Email" value={selectedSupplier.email} />
              <DetailRow label="Phone" value={selectedSupplier.phone} />
              <DetailRow label="Address" value={selectedSupplier.address} />
            </DetailSection>

            <DetailSection title="Performance Metrics">
              <DetailRow label="Rating" value={<Rating value={parseFloat(selectedSupplier.rating)} />} />
              <DetailRow label="Lead Time" value={`${selectedSupplier.lead_time_days} days`} />
              <DetailRow label="Reliability Score" value={`${parseFloat(selectedSupplier.reliability_score).toFixed(1)}%`} />
              <DetailRow label="On-Time Delivery" value={`${parseFloat(selectedSupplier.on_time_delivery_rate).toFixed(1)}%`} />
              <DetailRow label="Total Orders" value={selectedSupplier.total_orders} />
            </DetailSection>

            <DetailSection title="Status">
              <DetailRow label="Status" value={<StatusBadge status={selectedSupplier.status} />} />
              <DetailRow label="Products Supplied" value={selectedSupplier.product_count || 0} />
            </DetailSection>

            {selectedSupplier.notes && (
              <DetailSection title="Notes">
                <p className="text-gray-600">{selectedSupplier.notes}</p>
              </DetailSection>
            )}

            {selectedSupplier.products?.length > 0 && (
              <DetailSection title="Products">
                <div className="space-y-2">
                  {selectedSupplier.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-gray-500">{product.sku}</span>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}
            </>
            )}
          </>
        )}
      </DetailModal>

      {/* New Supplier Form */}
      <NewItemForm
        isOpen={showNewForm}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleCreate}
        title="Add New Supplier"
        fields={supplierFields}
      />
    </div>
  );
}
