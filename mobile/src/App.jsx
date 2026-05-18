import React from 'react';
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

  return (
    <div className="flex flex-col h-full" style={{ background: 'white' }}>
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
