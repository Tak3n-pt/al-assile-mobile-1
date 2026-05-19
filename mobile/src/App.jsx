import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CartProvider } from './hooks/useCart.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Sales from './pages/Sales.jsx';
import Clients from './pages/Clients.jsx';
import ClientsList from './pages/ClientsList.jsx';
import Suppliers from './pages/Suppliers.jsx';
import SuppliersList from './pages/SuppliersList.jsx';
import ProductsList from './pages/ProductsList.jsx';
import Reports from './pages/Reports.jsx';
import Notifications from './pages/Notifications.jsx';
import Purchases from './pages/Purchases.jsx';
import Expenses from './pages/Expenses.jsx';
import Treasury from './pages/Treasury.jsx';
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
