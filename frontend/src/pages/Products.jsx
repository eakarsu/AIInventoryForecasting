import { useState, useEffect } from 'react';
import DataTable, { StatusBadge } from '../components/DataTable';
import DetailModal, { DetailSection, DetailRow } from '../components/DetailModal';
import NewItemForm, { productFields } from '../components/NewItemForm';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api, useAuth } from '../App';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);
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
      const [productsRes, suppliersData] = await Promise.all([
        api.get(`/products?${params}`),
        api.get('/suppliers'),
      ]);
      // Handle both paginated and non-paginated responses
      if (productsRes.data) {
        setProducts(productsRes.data);
        setPagination(productsRes.pagination);
      } else {
        setProducts(Array.isArray(productsRes) ? productsRes : []);
        setPagination(null);
      }
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/products', data);
    toast.success('Product created successfully');
    loadData();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/products/${id}`);
        toast.success('Product deleted successfully');
        setSelectedProduct(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete product: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} products?`);
    if (confirmed) {
      try {
        await api.delete('/products/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} products deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/products/${selectedProduct.id}`, editData);
      toast.success('Product updated successfully');
      setEditMode(false);
      setSelectedProduct(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update product: ' + err.message);
    }
  };

  const getAIRecommendation = async (productId) => {
    setAiLoading(true);
    setAiRecommendation(null);
    try {
      const data = await api.post('/ai/forecast', { product_id: productId });
      if (typeof data.forecast === 'string') {
        try { data.forecast = JSON.parse(data.forecast); } catch (e) { /* ignore */ }
      }
      setAiRecommendation(data);
    } catch (error) {
      toast.error('Failed to get AI forecast: ' + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const columns = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Product Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'current_stock',
      label: 'Stock',
      sortable: true,
      render: (value, row) => (
        <span className={`font-medium ${value <= row.reorder_point ? 'text-red-600' : 'text-gray-900'}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'unit_price',
      label: 'Price',
      sortable: true,
      render: (value) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const formFields = [
    ...productFields.slice(0, 3),
    {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    ...productFields.slice(3),
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
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your inventory catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="products" />
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
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search products by name, SKU, or category..." />
      </div>

      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        onRowClick={setSelectedProduct}
        emptyMessage="No products found"
        selectable={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Product Detail Modal */}
      <DetailModal
        isOpen={!!selectedProduct}
        onClose={() => { setSelectedProduct(null); setAiRecommendation(null); setEditMode(false); }}
        title={selectedProduct?.name}
        size="lg"
        actions={
          <>
            <button
              onClick={() => getAIRecommendation(selectedProduct?.id)}
              className="btn-secondary"
              disabled={aiLoading}
            >
              {aiLoading ? 'Loading...' : 'Get AI Forecast'}
            </button>
            {canWrite && (
              <>
                {editMode ? (
                  <>
                    <button onClick={handleUpdate} className="btn-secondary">Save</button>
                    <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditMode(true); setEditData(selectedProduct); }} className="btn-secondary">
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(selectedProduct?.id)} className="btn-danger">
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {selectedProduct && (
          <>
            {aiLoading && (
              <div className="mb-4 bg-blue-100 border-2 border-blue-500 rounded-lg p-4 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-blue-700 font-bold">Generating AI forecast...</span>
              </div>
            )}

            {aiRecommendation && (
              <div className="mb-4 bg-green-100 border-2 border-green-500 rounded-lg p-4">
                <h3 className="text-lg font-bold text-green-800 mb-3">AI Forecast Result</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded">
                    <p className="text-sm text-gray-500">Predicted Demand</p>
                    <p className="text-2xl font-bold text-green-700">{aiRecommendation.forecast?.predicted_demand || '-'} units</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-sm text-gray-500">Confidence</p>
                    <p className="text-2xl font-bold text-green-700">{aiRecommendation.forecast?.confidence_level || '-'}%</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-sm text-gray-500">Trend</p>
                    <p className="text-2xl font-bold text-green-700 capitalize">{aiRecommendation.forecast?.trend_direction || '-'}</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-sm text-gray-500">Seasonality</p>
                    <p className="text-2xl font-bold text-green-700">{aiRecommendation.forecast?.seasonality_factor || '-'}x</p>
                  </div>
                </div>
                <div className="mt-4 bg-white p-3 rounded">
                  <p className="text-sm font-bold text-gray-700">Recommendation:</p>
                  <p className="text-sm text-gray-600 mt-1">{aiRecommendation.forecast?.recommended_action || '-'}</p>
                </div>
              </div>
            )}

            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Name</label>
                    <input type="text" className="input" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">SKU</label>
                    <input type="text" className="input" value={editData.sku || ''} onChange={(e) => setEditData({ ...editData, sku: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input type="text" className="input" value={editData.category || ''} onChange={(e) => setEditData({ ...editData, category: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Unit Price</label>
                    <input type="number" className="input" value={editData.unit_price || ''} onChange={(e) => setEditData({ ...editData, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Cost Price</label>
                    <input type="number" className="input" value={editData.cost_price || ''} onChange={(e) => setEditData({ ...editData, cost_price: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Current Stock</label>
                    <input type="number" className="input" value={editData.current_stock || ''} onChange={(e) => setEditData({ ...editData, current_stock: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Min Stock Level</label>
                    <input type="number" className="input" value={editData.min_stock_level || ''} onChange={(e) => setEditData({ ...editData, min_stock_level: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Max Stock Level</label>
                    <input type="number" className="input" value={editData.max_stock_level || ''} onChange={(e) => setEditData({ ...editData, max_stock_level: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Reorder Point</label>
                    <input type="number" className="input" value={editData.reorder_point || ''} onChange={(e) => setEditData({ ...editData, reorder_point: e.target.value })} />
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
                  <label className="label">Description</label>
                  <textarea className="input" value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
                </div>
              </div>
            ) : (
            <>
            <DetailSection title="Product Information">
              <DetailRow label="SKU" value={selectedProduct.sku} />
              <DetailRow label="Name" value={selectedProduct.name} />
              <DetailRow label="Category" value={selectedProduct.category} />
              <DetailRow label="Description" value={selectedProduct.description} />
              <DetailRow label="Location" value={selectedProduct.location} />
              <DetailRow label="Status" value={<StatusBadge status={selectedProduct.status} />} />
            </DetailSection>

            <DetailSection title="Stock Information">
              <DetailRow label="Current Stock" value={selectedProduct.current_stock} />
              <DetailRow label="Min Stock Level" value={selectedProduct.min_stock_level} />
              <DetailRow label="Max Stock Level" value={selectedProduct.max_stock_level} />
              <DetailRow label="Reorder Point" value={selectedProduct.reorder_point} />
              <DetailRow label="Reorder Quantity" value={selectedProduct.reorder_quantity} />
            </DetailSection>

            <DetailSection title="Pricing">
              <DetailRow label="Unit Price" value={`$${parseFloat(selectedProduct.unit_price).toFixed(2)}`} />
              <DetailRow label="Cost Price" value={selectedProduct.cost_price ? `$${parseFloat(selectedProduct.cost_price).toFixed(2)}` : '-'} />
              <DetailRow
                label="Margin"
                value={
                  selectedProduct.cost_price
                    ? `${(((selectedProduct.unit_price - selectedProduct.cost_price) / selectedProduct.unit_price) * 100).toFixed(1)}%`
                    : '-'
                }
              />
            </DetailSection>

            <DetailSection title="Supplier">
              <DetailRow label="Supplier" value={selectedProduct.supplier_name} />
              <DetailRow label="Lead Time" value={selectedProduct.lead_time_days ? `${selectedProduct.lead_time_days} days` : '-'} />
            </DetailSection>
            </>
            )}
          </>
        )}
      </DetailModal>

      <NewItemForm
        isOpen={showNewForm}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleCreate}
        title="Add New Product"
        fields={formFields}
      />
    </div>
  );
}
