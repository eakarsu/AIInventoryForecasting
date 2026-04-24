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

export default function SupplierRisk() {
  const [risks, setRisks] = useState([]);
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
      const [risksRes, suppliersData] = await Promise.all([
        api.get(`/supplier-risk?${params}`),
        api.get('/suppliers'),
      ]);
      // Handle both paginated and non-paginated responses
      if (risksRes.data) {
        setRisks(risksRes.data);
        setPagination(risksRes.pagination);
      } else {
        setRisks(Array.isArray(risksRes) ? risksRes : []);
        setPagination(null);
      }
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/supplier-risk', {
      ...data,
      risk_factors: data.risk_factors ? data.risk_factors.split(',').map(s => s.trim()) : [],
      mitigation_strategies: data.mitigation_strategies ? data.mitigation_strategies.split(',').map(s => s.trim()) : [],
    });
    toast.success('Risk assessment created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    await api.put(`/supplier-risk/${selectedItem.id}`, editData);
    toast.success('Risk assessment updated successfully');
    setEditMode(false);
    setSelectedItem(null);
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Risk Assessment', 'Are you sure you want to delete this risk assessment? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/supplier-risk/${id}`);
        toast.success('Risk assessment deleted successfully');
        setSelectedItem(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete risk assessment: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} risk assessments?`);
    if (confirmed) {
      try {
        await api.delete('/supplier-risk/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} risk assessments deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const runAIAnalysis = async (supplierId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.post(`/supplier-risk/analyze/${supplierId}`);
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

  const getRiskColor = (level) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      critical: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    {
      key: 'risk_level',
      label: 'Risk Level',
      sortable: true,
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getRiskColor(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'overall_risk_score',
      label: 'Risk Score',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <div className="w-20 bg-gray-200 rounded-full h-3 mr-2">
            <div
              className={`h-3 rounded-full ${
                value <= 25 ? 'bg-green-500' : value <= 50 ? 'bg-yellow-500' : value <= 75 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="font-semibold">{value}</span>
        </div>
      ),
    },
    {
      key: 'financial_risk_score',
      label: 'Financial',
      sortable: true,
      render: (value) => <span className={value > 50 ? 'text-red-600' : 'text-green-600'}>{value}</span>,
    },
    {
      key: 'delivery_risk_score',
      label: 'Delivery',
      sortable: true,
      render: (value) => <span className={value > 50 ? 'text-red-600' : 'text-green-600'}>{value}</span>,
    },
    {
      key: 'review_date',
      label: 'Review Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const formFields = [
    {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      required: true,
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'risk_level', label: 'Risk Level', type: 'select', required: true, options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ]},
    { name: 'overall_risk_score', label: 'Overall Risk Score (0-100)', type: 'number', required: true },
    { name: 'financial_risk_score', label: 'Financial Risk Score', type: 'number' },
    { name: 'delivery_risk_score', label: 'Delivery Risk Score', type: 'number' },
    { name: 'quality_risk_score', label: 'Quality Risk Score', type: 'number' },
    { name: 'risk_factors', label: 'Risk Factors (comma-separated)', type: 'text' },
    { name: 'mitigation_strategies', label: 'Mitigation Strategies (comma-separated)', type: 'text' },
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
          <h1 className="text-2xl font-bold text-gray-900">AI Supplier Risk Analyzer</h1>
          <p className="text-gray-500">Supply chain vulnerability assessment</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="supplier-risks" />
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
              New Assessment
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search risk assessments by supplier, risk level..." />
      </div>

      <DataTable
        columns={columns}
        data={risks}
        loading={loading}
        onRowClick={setSelectedItem}
        emptyMessage="No supplier risk assessments found"
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
        title={`Risk Assessment: ${selectedItem?.supplier_name}`}
        size="lg"
        actions={
          <>
            <button
              onClick={() => runAIAnalysis(selectedItem?.supplier_id)}
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
                  title="AI Risk Analysis"
                  loading={aiLoading}
                  error={aiResult?.error}
                />
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Risk Level</label>
                  <select
                    className="input"
                    value={editData.risk_level || ''}
                    onChange={(e) => setEditData({ ...editData, risk_level: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="label">Overall Risk Score</label>
                  <input
                    type="number"
                    className="input"
                    value={editData.overall_risk_score || ''}
                    onChange={(e) => setEditData({ ...editData, overall_risk_score: e.target.value })}
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
                    <option value="resolved">Resolved</option>
                    <option value="monitoring">Monitoring</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <DetailSection title="Supplier Information">
                  <DetailRow label="Supplier" value={selectedItem.supplier_name} />
                  <DetailRow label="Email" value={selectedItem.supplier_email} />
                  <DetailRow label="Rating" value={`${selectedItem.rating}/5.0`} />
                  <DetailRow label="Reliability Score" value={`${selectedItem.reliability_score}%`} />
                  <DetailRow label="On-Time Delivery" value={`${selectedItem.on_time_delivery_rate}%`} />
                </DetailSection>

                <DetailSection title="Risk Assessment">
                  <DetailRow
                    label="Risk Level"
                    value={
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRiskColor(selectedItem.risk_level)}`}>
                        {selectedItem.risk_level?.toUpperCase()}
                      </span>
                    }
                  />
                  <DetailRow label="Overall Risk Score" value={<span className="text-2xl font-bold">{selectedItem.overall_risk_score}/100</span>} />
                </DetailSection>

                <DetailSection title="Risk Breakdown">
                  <div className="grid grid-cols-2 gap-4">
                    <RiskMeter label="Financial" value={selectedItem.financial_risk_score} />
                    <RiskMeter label="Delivery" value={selectedItem.delivery_risk_score} />
                    <RiskMeter label="Quality" value={selectedItem.quality_risk_score} />
                    <RiskMeter label="Geopolitical" value={selectedItem.geopolitical_risk_score} />
                    <RiskMeter label="Concentration" value={selectedItem.concentration_risk_score} />
                  </div>
                </DetailSection>

                {selectedItem.risk_factors && selectedItem.risk_factors.length > 0 && (
                  <DetailSection title="Risk Factors">
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.risk_factors.map((factor, i) => (
                        <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {selectedItem.mitigation_strategies && selectedItem.mitigation_strategies.length > 0 && (
                  <DetailSection title="Mitigation Strategies">
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.mitigation_strategies.map((strategy, i) => (
                        <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                          {strategy}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}

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
        title="Create New Risk Assessment"
        fields={formFields}
      />
    </div>
  );
}

function RiskMeter({ label, value }) {
  const getColor = (v) => {
    if (v <= 25) return 'bg-green-500';
    if (v <= 50) return 'bg-yellow-500';
    if (v <= 75) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gray-50 p-3 rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="font-semibold">{value || 0}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getColor(value)}`}
          style={{ width: `${value || 0}%` }}
        />
      </div>
    </div>
  );
}
