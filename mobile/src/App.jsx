import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CartProvider } from './hooks/useCart.jsx';
import Login from './pages/Login.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const ProductsList = lazy(() => import('./pages/ProductsList.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Sales = lazy(() => import('./pages/Sales.jsx'));
const Clients = lazy(() => import('./pages/Clients.jsx'));
const ClientsList = lazy(() => import('./pages/ClientsList.jsx'));
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'));
const SuppliersList = lazy(() => import('./pages/SuppliersList.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Purchases = lazy(() => import('./pages/Purchases.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Treasury = lazy(() => import('./pages/Treasury.jsx'));

function AppBootFallback() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0d1108 0%, #080c14 60%)',
      }}
    >
      <div style={{ textAlign: 'center', color: '#D4A574' }}>
        <div
          style={{
            width: 42,
            height: 42,
            margin: '0 auto 14px',
            borderRadius: '9999px',
            border: '3px solid rgba(212,165,116,0.18)',
            borderTopColor: '#D4A574',
            animation: 'boot-spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}>
          Loading workspace
        </div>
      </div>
    </div>
  );
}
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'white' }}>
      {!isOnline && (
        <div style={{ background: '#ef4444', color: '#fff', textAlign: 'center', padding: '7px 12px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em', flexShrink: 0 }}>
          No connection — working offline
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<AppBootFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/list"
              element={
                <ProtectedRoute>
                  <ProductsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/list"
              element={
                <ProtectedRoute>
                  <ClientsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/list"
              element={
                <ProtectedRoute>
                  <SuppliersList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={<ProtectedRoute><Purchases /></ProtectedRoute>}
            />
            <Route
              path="/expenses"
              element={<ProtectedRoute><Expenses /></ProtectedRoute>}
            />
            <Route
              path="/treasury"
              element={<ProtectedRoute><Treasury /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppLayout />
      </CartProvider>
    </AuthProvider>
  );
}
