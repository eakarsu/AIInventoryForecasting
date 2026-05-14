import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Forecasts from './pages/Forecasts';
import Suppliers from './pages/Suppliers';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';

// New AI Feature Pages
import DemandPredictor from './pages/DemandPredictor';
import SupplierRisk from './pages/SupplierRisk';
import ReorderOptimizer from './pages/ReorderOptimizer';
import DeadStock from './pages/DeadStock';
import WarehouseOptimizer from './pages/WarehouseOptimizer';
import InventoryOptimizer from './pages/InventoryOptimizer';
import ShipmentTracker from './pages/ShipmentTracker';
import PromotionSimulator from './pages/PromotionSimulator';
import AdvancedAITools from './pages/AdvancedAITools';
import Pass5Tools from './pages/Pass5Tools';

// === Batch 04 Gaps & Frontend Mounts ===
import CfAgenticInventoryManagerAutonomouslyP from './pages/CfAgenticInventoryManagerAutonomouslyP';
import CfDemandSupplyFusionIntegratingCustome from './pages/CfDemandSupplyFusionIntegratingCustome';
import CfMultiWarehouseNetworkOptimizationRec from './pages/CfMultiWarehouseNetworkOptimizationRec';
import CfMarkdownClearanceOptimizerBalancingD from './pages/CfMarkdownClearanceOptimizerBalancingD';
import CfSupplierPerformanceReliabilityTrackin from './pages/CfSupplierPerformanceReliabilityTrackin';
import CfSeasonalPromotionalPlanningCoordinate from './pages/CfSeasonalPromotionalPlanningCoordinate';
import GapNoMarkdownTimingAi from './pages/GapNoMarkdownTimingAi';
import GapNoSupplierDisruptionSimulator from './pages/GapNoSupplierDisruptionSimulator';
import GapNoMultiWarehouseBalancingAi from './pages/GapNoMultiWarehouseBalancingAi';
import GapNoSkuRationalizationWhichSkusTo from './pages/GapNoSkuRationalizationWhichSkusTo';
import GapLiveErpSapNetsuiteIntegrationsStill from './pages/GapLiveErpSapNetsuiteIntegrationsStill';
import GapNoFinancialPlModule from './pages/GapNoFinancialPlModule';
import GapNoNotificationsModule0References from './pages/GapNoNotificationsModule0References';
import GapNoWebhookSurface from './pages/GapNoWebhookSurface';
import GapNoFileUploadForSupplierDocs from './pages/GapNoFileUploadForSupplierDocs';
import GapNoRealTimeWebsocketInventoryUpdates from './pages/GapNoRealTimeWebsocketInventoryUpdates';

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// API helper
const API_BASE = '/api';

export const api = {
  async fetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (response.status === 429) {
      throw new Error('429: ' + (data.error || 'Rate limit reached. Please wait before making more requests.'));
    }

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  get: (endpoint) => api.fetch(endpoint),
  post: (endpoint, body) => api.fetch(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => api.fetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, body) =>
    api.fetch(endpoint, {
      method: 'DELETE',
      ...(body && { body: JSON.stringify(body) }),
    }),
};

// Protected Route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, login, logout, loading }}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/forecasts" element={<Forecasts />} />
                          <Route path="/suppliers" element={<Suppliers />} />
                          <Route path="/orders" element={<Orders />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/profile" element={<Profile />} />
                          {/* AI Feature Routes */}
                          <Route path="/demand-predictor" element={<DemandPredictor />} />
                          <Route path="/supplier-risk" element={<SupplierRisk />} />
                          <Route path="/reorder-optimizer" element={<ReorderOptimizer />} />
                          <Route path="/dead-stock" element={<DeadStock />} />
                          <Route path="/warehouse-optimizer" element={<WarehouseOptimizer />} />
                          <Route path="/inventory-optimizer" element={<InventoryOptimizer />} />
                          <Route path="/shipment-tracker" element={<ShipmentTracker />} />
                          <Route path="/promotion-simulator" element={<PromotionSimulator />} />
                          <Route path="/advanced-ai" element={<AdvancedAITools />} />
                          <Route path="/pass5-tools" element={<Pass5Tools />} />
                        
          {/* // === Batch 04 Gaps & Frontend Mounts === */}
          <Route path="/cf-agentic-inventory-manager-autonomously-p" element={<CfAgenticInventoryManagerAutonomouslyP />} />
          <Route path="/cf-demand-supply-fusion-integrating-custome" element={<CfDemandSupplyFusionIntegratingCustome />} />
          <Route path="/cf-multi-warehouse-network-optimization-rec" element={<CfMultiWarehouseNetworkOptimizationRec />} />
          <Route path="/cf-markdown-clearance-optimizer-balancing-d" element={<CfMarkdownClearanceOptimizerBalancingD />} />
          <Route path="/cf-supplier-performance-reliability-trackin" element={<CfSupplierPerformanceReliabilityTrackin />} />
          <Route path="/cf-seasonal-promotional-planning-coordinate" element={<CfSeasonalPromotionalPlanningCoordinate />} />
          <Route path="/gap-no-markdown-timing-ai" element={<GapNoMarkdownTimingAi />} />
          <Route path="/gap-no-supplier-disruption-simulator" element={<GapNoSupplierDisruptionSimulator />} />
          <Route path="/gap-no-multi-warehouse-balancing-ai" element={<GapNoMultiWarehouseBalancingAi />} />
          <Route path="/gap-no-sku-rationalization-which-skus-to" element={<GapNoSkuRationalizationWhichSkusTo />} />
          <Route path="/gap-live-erp-sap-netsuite-integrations-still" element={<GapLiveErpSapNetsuiteIntegrationsStill />} />
          <Route path="/gap-no-financial-pl-module" element={<GapNoFinancialPlModule />} />
          <Route path="/gap-no-notifications-module-0-references" element={<GapNoNotificationsModule0References />} />
          <Route path="/gap-no-webhook-surface" element={<GapNoWebhookSurface />} />
          <Route path="/gap-no-file-upload-for-supplier-docs" element={<GapNoFileUploadForSupplierDocs />} />
          <Route path="/gap-no-real-time-websocket-inventory-updates" element={<GapNoRealTimeWebsocketInventoryUpdates />} />
</Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
