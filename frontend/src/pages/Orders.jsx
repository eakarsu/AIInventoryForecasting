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

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [restockSuggestions, setRestockSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
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
      const [ordersRes, suppliersData, productsData] = await Promise.all([
        api.get(`/orders?${params}`),
        api.get('/suppliers'),
        api.get('/products'),
      ]);
      // Handle both paginated and non-paginated responses
      if (ordersRes.data) {
        setOrders(ordersRes.data);
        setPagination(ordersRes.pagination);
      } else {
        setOrders(Array.isArray(ordersRes) ? ordersRes : []);
        setPagination(null);
      }
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.data || []);
      setProducts(Array.isArray(productsData) ? productsData : productsData.data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (order) => {
    try {
      const details = await api.get(`/orders/${order.id}`);
      setSelectedOrder(details);
    } catch (error) {
      console.error('Failed to load order details:', error);
      toast.error('Failed to load order details: ' + error.message);
    }
  };

  const handleCreate = async (data) => {
    await api.post('/orders', {
      ...data,
      items: data.items ? JSON.parse(data.items) : [],
    });
    toast.success('Order created successfully');
    loadData();
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/orders/${selectedOrder.id}`, editData);
      toast.success('Order updated successfully');
      setEditMode(false);
      setSelectedOrder(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update order: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm('Delete Order', 'Are you sure you want to delete this order? This action cannot be undone.');
    if (confirmed) {
      try {
        await api.delete(`/orders/${id}`);
        toast.success('Order deleted successfully');
        setSelectedOrder(null);
        loadData();
      } catch (err) {
        toast.error('Failed to delete order: ' + err.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm('Bulk Delete', `Are you sure you want to delete ${selectedIds.length} orders?`);
    if (confirmed) {
      try {
        await api.delete('/orders/bulk', { ids: selectedIds });
        toast.success(`${selectedIds.length} orders deleted`);
        setSelectedIds([]);
        loadData();
      } catch (err) {
        toast.error('Failed to bulk delete: ' + err.message);
      }
    }
  };

  const getRestockSuggestions = async () => {
    setAiLoading(true);
    try {
      const data = await api.post('/ai/restock');
      setRestockSuggestions(data);
    } catch (error) {
      console.error('Failed to get restock suggestions:', error);
      toast.error('Failed to get restock suggestions: ' + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearch(term);
    setPage(1);
  };

  const columns = [
    { key: 'order_number', label: 'Order #', sortable: true },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    {
      key: 'order_date',
      label: 'Order Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'expected_delivery',
      label: 'Expected Delivery',
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value) => `$${parseFloat(value).toLocaleString()}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const orderFields = [
    {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      required: true,
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'expected_delivery', label: 'Expected Delivery', type: 'date' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'processing', label: 'Processing' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'delivered', label: 'Delivered' },
      ],
    },
    { name: 'shipping_cost', label: 'Shipping Cost', type: 'number', min: 0, step: 0.01 },
    { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500';
      case 'in_transit':
        return 'bg-purple-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500">Manage and track your orders</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons resource="orders" />
          {selectedIds.length > 0 && canWrite && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm">
              Delete ({selectedIds.length})
            </button>
          )}
          <button onClick={getRestockSuggestions} className="btn-secondary" disabled={aiLoading}>
            {aiLoading ? 'Analyzing...' : 'AI Restock Suggestions'}
          </button>
          {canWrite && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Order
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder="Search orders by order number, supplier, or status..." />
      </div>

      {/* Order Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['pending', 'processing', 'in_transit', 'delivered'].map((status) => {
          const count = orders.filter((o) => o.status === status).length;
          return (
            <div key={status} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} mr-2`} />
                <span className="text-sm text-gray-500 capitalize">{status.replace('_', ' ')}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* AI Restock Suggestions */}
      {restockSuggestions && (
        <div className="mb-6 bg-primary-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Restock Recommendations</h3>
            <button onClick={() => setRestockSuggestions(null)} className="text-gray-400 hover:text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {restockSuggestions.recommendations?.length > 0 ? (
            <div className="space-y-3">
              {restockSuggestions.recommendations.map((rec, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center">
                      <StatusBadge status={rec.priority} />
                      <span className="ml-2 font-medium text-gray-900">{rec.product_sku}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rec.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-600">{rec.recommended_quantity} units</p>
                    <p className="text-xs text-gray-500">
                      {rec.estimated_days_until_stockout} days until stockout
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">{restockSuggestions.message || 'No restocking needed at this time.'}</p>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        onRowClick={loadOrderDetails}
        emptyMessage="No orders found"
        selectable={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Order Detail Modal */}
      <DetailModal
        isOpen={!!selectedOrder}
        onClose={() => { setSelectedOrder(null); setEditMode(false); }}
        title={`Order ${selectedOrder?.order_number}`}
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
                  <button onClick={() => { setEditMode(true); setEditData(selectedOrder); }} className="btn-secondary">
                    Edit
                  </button>
                )}
                <button onClick={() => handleDelete(selectedOrder?.id)} className="btn-danger">
                  Delete
                </button>
              </>
            )}
          </>
        }
      >
        {selectedOrder && (
          <>
            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={editData.status || ''} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Expected Delivery</label>
                    <input type="date" className="input" value={editData.expected_delivery?.split('T')[0] || ''} onChange={(e) => setEditData({ ...editData, expected_delivery: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Actual Delivery</label>
                    <input type="date" className="input" value={editData.actual_delivery?.split('T')[0] || ''} onChange={(e) => setEditData({ ...editData, actual_delivery: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Shipping Cost</label>
                    <input type="number" className="input" value={editData.shipping_cost || ''} onChange={(e) => setEditData({ ...editData, shipping_cost: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                </div>
              </div>
            ) : (
            <>
            <DetailSection title="Order Information">
              <DetailRow label="Order Number" value={selectedOrder.order_number} />
              <DetailRow label="Supplier" value={selectedOrder.supplier_name} />
              <DetailRow label="Status" value={<StatusBadge status={selectedOrder.status} />} />
              <DetailRow label="Order Date" value={new Date(selectedOrder.order_date).toLocaleDateString()} />
              <DetailRow
                label="Expected Delivery"
                value={selectedOrder.expected_delivery ? new Date(selectedOrder.expected_delivery).toLocaleDateString() : '-'}
              />
              <DetailRow
                label="Actual Delivery"
                value={selectedOrder.actual_delivery ? new Date(selectedOrder.actual_delivery).toLocaleDateString() : '-'}
              />
            </DetailSection>

            <DetailSection title="Financial">
              <DetailRow label="Total Amount" value={`$${parseFloat(selectedOrder.total_amount).toLocaleString()}`} />
              <DetailRow label="Shipping Cost" value={`$${parseFloat(selectedOrder.shipping_cost || 0).toFixed(2)}`} />
            </DetailSection>

            {selectedOrder.items?.length > 0 && (
              <DetailSection title="Order Items">
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-500">{item.product_sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{item.quantity} x ${parseFloat(item.unit_price).toFixed(2)}</p>
                        <p className="text-sm text-gray-500">${parseFloat(item.total_price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            {selectedOrder.notes && (
              <DetailSection title="Notes">
                <p className="text-gray-600">{selectedOrder.notes}</p>
              </DetailSection>
            )}

            <DetailSection title="Tracking">
              <DetailRow label="Created By" value={selectedOrder.created_by_name} />
              <DetailRow label="Created At" value={new Date(selectedOrder.created_at).toLocaleString()} />
            </DetailSection>
            </>
            )}
          </>
        )}
      </DetailModal>

      {/* New Order Form */}
      <NewItemForm
        isOpen={showNewForm}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleCreate}
        title="Create New Order"
        fields={orderFields}
      />
    </div>
  );
}
