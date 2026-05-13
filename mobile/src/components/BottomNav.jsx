import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Receipt, Users, Truck, FileBarChart, Bell } from 'lucide-react';
import { useCart } from '../hooks/useCart.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { t } from '../utils/i18n.js';

function useNotificationCount() {
  const [count, setCount] = useState(0);
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let cancelled = false;
    const BASE_URL = window.location.origin;

    async function fetchCount() {
      try {
        const res = await fetch(`${BASE_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCount(json.total || 0);
      } catch {}
    }

    fetchCount();
    const timer = setInterval(fetchCount, 60000); // refresh every minute
    return () => { cancelled = true; clearInterval(timer); };
  }, [isAuthenticated, token]);

  return count;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getItemCount } = useCart();
  const itemCount      = getItemCount();
  const notifCount     = useNotificationCount();

  const tabs = [
    { path: '/',              icon: Home,       label: 'الرئيسية' },
    { path: '/cart',          icon: ShoppingCart, label: t('cart'),          cartBadge: true },
    { path: '/sales',         icon: Receipt,    label: t('sales') },
    { path: '/clients',       icon: Users,      label: t('clients') },
    { path: '/suppliers',     icon: Truck,      label: t('suppliers') },
    { path: '/reports',       icon: FileBarChart, label: t('reports') },
    { path: '/notifications', icon: Bell,       label: t('notifications'), notifBadge: true },
  ];

  return (
    <nav
      className="flex-shrink-0 flex items-stretch"
      style={{
        background: 'linear-gradient(to top, rgba(8,12,20,0.99), rgba(8,12,20,0.95))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(({ path, icon: Icon, label, cartBadge, notifBadge }) => {
        const isActive = location.pathname === path;
        const count    = cartBadge ? itemCount : notifBadge ? notifCount : 0;
        const badgeColor = notifBadge ? '#f59e0b' : '#ef4444';

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-1 touch-manipulation relative transition-all"
            style={{ minHeight: '4rem', padding: '0.5rem 0' }}
          >
            {isActive && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{
                  width: '3rem', height: '2px',
                  background: 'linear-gradient(90deg, transparent, #D4A574, transparent)',
                  borderRadius: '2px',
                }}
              />
            )}

            <div className="relative">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.3 : 1.7}
                style={{ color: isActive ? '#D4A574' : '#3d5068', transition: 'color 0.15s' }}
              />
              {count > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-0.5"
                  style={{
                    background: badgeColor,
                    boxShadow: `0 1px 4px ${badgeColor}60`,
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>

            <span
              className="text-[10px] font-semibold"
              style={{ color: isActive ? '#D4A574' : '#3d5068', transition: 'color 0.15s' }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
