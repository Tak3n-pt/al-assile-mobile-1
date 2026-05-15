import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Users, Truck, Package,
  BarChart2, Bell, Menu, X, LogOut, ChevronLeft,
  Wallet, Archive, Vault,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

function useNotifCount() {
  const [count, setCount] = useState(0);
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCount(json.total || 0);
      } catch {}
    }

    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isAuthenticated, token]);

  return count;
}

// Tiles in same order as the MicroPOS reference image:
// Row 1: المشتريات | المبيعات
// Row 2: الموردين  | العملاء
// Row 3: المصروفات | الصندوق
// Row 4: الاستعلامات | المخزون
const TILES = [
  {
    path: '/purchases',
    icon: Archive,
    label: 'المشتريات',
    sub: 'فواتير الشراء',
    iconBg: '#E8EAF6',
    iconColor: '#3949AB',
  },
  {
    path: '/sales',
    icon: ShoppingCart,
    label: 'المبيعات',
    sub: 'بيع جديد',
    iconBg: '#E3F2FD',
    iconColor: '#1565C0',
  },
  {
    path: '/suppliers',
    icon: Truck,
    label: 'الموردين',
    sub: 'إدارة الموردين',
    iconBg: '#F3E5F5',
    iconColor: '#6A1B9A',
  },
  {
    path: '/clients',
    icon: Users,
    label: 'العملاء',
    sub: 'إدارة العملاء',
    iconBg: '#E8F5E9',
    iconColor: '#2E7D32',
  },
  {
    path: '/expenses',
    icon: Wallet,
    label: 'المصروفات',
    sub: 'تتبع النفقات',
    iconBg: '#FFF8E1',
    iconColor: '#E65100',
  },
  {
    path: '/treasury',
    icon: Vault,
    label: 'الصندوق',
    sub: 'الرصيد اليومي',
    iconBg: '#E0F2F1',
    iconColor: '#00695C',
  },
  {
    path: '/reports',
    icon: BarChart2,
    label: 'الاستعلامات',
    sub: 'التقارير والإحصاء',
    iconBg: '#FFEBEE',
    iconColor: '#B71C1C',
  },
  {
    path: '/products',
    icon: Package,
    label: 'المخزون',
    sub: 'المنتجات',
    iconBg: '#E0F7FA',
    iconColor: '#006064',
  },
];

function TileButton({ onClick, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: 'white',
        border: 'none',
        borderRadius: '16px',
        padding: '1.25rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: pressed
          ? '0 1px 2px rgba(0,0,0,0.06)'
          : '0 2px 8px rgba(0,0,0,0.09)',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s, box-shadow 0.1s',
        minHeight: '140px',
      }}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const notifCount = useNotifCount();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    setMenuOpen(false);
  }

  const roleLabel =
    user?.role === 'admin'
      ? 'مدير'
      : user?.role === 'manager'
      ? 'مشرف'
      : 'مندوب مبيعات';

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        background: '#F0F2F5',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ===== HEADER ===== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Notification bell — right side in RTL */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            padding: '4px',
            lineHeight: 0,
          }}
        >
          <Bell size={24} color="white" />
          {notifCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: '#FF5722',
                color: 'white',
                borderRadius: '50%',
                width: '17px',
                height: '17px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold',
                border: '1.5px solid rgba(57,73,171,0.9)',
              }}
            >
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* App title */}
        <span
          style={{
            color: 'white',
            fontSize: '1.2rem',
            fontWeight: '700',
            letterSpacing: '0.5px',
          }}
        >
          Al Assile
        </span>

        {/* Hamburger — left side in RTL */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'white',
            lineHeight: 0,
          }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* ===== DROPDOWN MENU ===== */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 15 }}
          />
          {/* Menu panel */}
          <div
            style={{
              position: 'fixed',
              top: '60px',
              left: '1rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
              zIndex: 20,
              minWidth: '200px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.9rem 1rem',
                borderBottom: '1px solid #f0f0f0',
                background: '#FAFAFA',
              }}
            >
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: '#1a1a1a',
                }}
              >
                {user?.name || user?.username || 'المستخدم'}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  marginTop: '2px',
                }}
              >
                {roleLabel}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#E53935',
                fontSize: '0.9rem',
                fontWeight: '600',
                direction: 'rtl',
              }}
            >
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          </div>
        </>
      )}

      {/* ===== MODULE GRID ===== */}
      <div
        style={{
          flex: 1,
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          overflowY: 'auto',
          alignContent: 'start',
        }}
      >
        {TILES.map(({ path, icon: Icon, label, iconColor }) => (
          <TileButton key={path} onClick={() => navigate(path)}>
            <Icon
              size={56}
              color={iconColor}
              strokeWidth={1.4}
              style={{ marginBottom: '0.75rem' }}
            />
            <span
              style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1a1a1a',
                textAlign: 'center',
              }}
            >
              {label}
            </span>
          </TileButton>
        ))}

        {/* Notifications — full-width last row */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            gridColumn: '1 / -1',
            background: notifCount > 0
              ? 'linear-gradient(135deg, #FFF8E1 0%, #FFFDE7 100%)'
              : 'white',
            border: `1.5px solid ${notifCount > 0 ? '#FFC107' : 'transparent'}`,
            borderRadius: '16px',
            padding: '0.85rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: '#FFF3E0',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Bell size={26} color="#E65100" strokeWidth={1.8} />
            {notifCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  left: '-5px',
                  background: '#FF5722',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                }}
              >
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: '700',
                color: '#1a1a1a',
              }}
            >
              التنبيهات
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: notifCount > 0 ? '#E65100' : '#999',
                marginTop: '2px',
              }}
            >
              {notifCount > 0
                ? `${notifCount} تنبيه نشط`
                : 'ديون متأخرة وتسليمات'}
            </div>
          </div>

          <ChevronLeft size={18} color="#ccc" />
        </button>
      </div>
    </div>
  );
}
