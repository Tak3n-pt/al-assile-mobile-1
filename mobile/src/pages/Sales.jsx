import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, getPriceForTarif, resolveTarifForProduct } from '../hooks/useCart.jsx';
import { useApi } from '../hooks/useApi.jsx';

const imageCache = new Map();

// ── helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y,m,dy] = iso.split('-');
  return `${dy}/${m}/${y}`;
}

// ── ProductImage ───────────────────────────────────────────────────────────────

function ProductImage({ productId, hasImage, name }) {
  const [src, setSrc] = useState(() => imageCache.get(productId) || null);

  useEffect(() => {
    if (!hasImage || src) return;
    const token = localStorage.getItem('mobile_token');
    let cancelled = false;
    fetch(`/api/products/${productId}/image`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => {
        if (!cancelled && json?.data) {
          imageCache.set(productId, json.data);
          setSrc(json.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [productId, hasImage]);

  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (!src) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
      }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3949AB', opacity: 0.5 }}>
          {initials}
        </span>
      </div>
    );
  }
  return <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

// ── ProductCard ────────────────────────────────────────────────────────────────

function ProductCard({ product, cartQty, price, selectedTarif, effectiveTarif, onTap }) {
  const [pressed, setPressed] = useState(false);
  const outOfStock = (product.quantity || 0) <= 0;
  const usesFallbackTarif = selectedTarif !== effectiveTarif;

  const handleTap = () => {
    if (outOfStock) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    onTap(product);
  };

  return (
    <div
      onPointerDown={handleTap}
      style={{
        borderRadius: 16, overflow: 'hidden', background: 'white',
        border: cartQty > 0 ? '2px solid #3949AB' : '1px solid #e5e7eb',
        boxShadow: cartQty > 0
          ? '0 0 0 3px rgba(57,73,171,0.1), 0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.07)',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        userSelect: 'none', WebkitUserSelect: 'none',
        opacity: outOfStock ? 0.5 : 1,
      }}
    >
      <div style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
        <ProductImage productId={product.id} hasImage={product.has_image} name={product.name} />

        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: usesFallbackTarif ? 'rgba(17,24,39,0.72)' : 'rgba(57,73,171,0.9)',
          borderRadius: 8, padding: '2px 7px',
          border: '1px solid rgba(255,255,255,0.35)',
        }}>
          <span style={{ color: 'white', fontSize: '0.62rem', fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
            T{effectiveTarif}
          </span>
        </div>

        {cartQty > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: '#3949AB', borderRadius: 20,
            minWidth: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.65rem', padding: '0 3px' }}>
              ×{cartQty}
            </span>
          </div>
        )}

        {outOfStock && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(239,68,68,0.9)', borderRadius: 6, padding: '2px 6px',
          }}>
            <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              نفذت
            </span>
          </div>
        )}

        {!outOfStock && (product.quantity || 0) > 0 && (product.quantity || 0) <= (product.min_stock_alert || 3) && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(234,179,8,0.9)', borderRadius: 6, padding: '2px 6px',
          }}>
            <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              {product.quantity} متبقي
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          color: '#1a1a1a', fontSize: '0.78rem', fontWeight: 600,
          fontFamily: 'Cairo, Tajawal, sans-serif', textAlign: 'right',
          lineHeight: 1.3, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: '2.1em',
        }}>
          {product.name}
        </span>
        <span style={{
          color: '#2e7d32', fontSize: '0.88rem', fontWeight: 800,
          textAlign: 'right', fontFamily: 'Cairo, sans-serif',
        }}>
          {price > 0 ? price.toFixed(2) : '—'}
          <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#4caf50', marginRight: 3 }}>دج</span>
        </span>
      </div>
    </div>
  );
}

// ── SaleCard ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  paid:    { label: 'مدفوع',   bg: '#dcfce7', color: '#16a34a', dot: '#16a34a' },
  partial: { label: 'جزئي',    bg: '#fef9c3', color: '#ca8a04', dot: '#eab308' },
  pending: { label: 'آجل',     bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
};

function SaleCard({ sale, onTap }) {
  const cfg = STATUS_CFG[sale.status] || STATUS_CFG.pending;
  const remaining = (sale.total || 0) - (sale.paid_amount || 0);

  return (
    <div
      onClick={() => onTap(sale)}
      style={{
        background: 'white', borderRadius: 14,
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '12px 14px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      {/* Row 1: client + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          background: cfg.bg, color: cfg.color,
          borderRadius: 20, padding: '2px 10px',
          fontSize: '0.7rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
          {cfg.label}
        </span>
        <span style={{ color: '#374151', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Cairo, sans-serif', textAlign: 'right' }}>
          {sale.client_name || 'بدون عميل'}
        </span>
      </div>

      {/* Row 2: total + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>
          {fmtTime(sale.created_at)} · {sale.item_count} صنف
          {sale.origin === 'desktop' && (
            <span style={{ marginRight: 5, color: '#6366f1', fontWeight: 600 }}>• ديسكتوب</span>
          )}
        </span>
        <span style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
          {(sale.total || 0).toFixed(2)}
          <span style={{ fontSize: '0.65rem', color: '#6b7280', marginRight: 2 }}>دج</span>
        </span>
      </div>

      {/* Row 3: remaining (only if not fully paid) */}
      {sale.status !== 'paid' && remaining > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          borderTop: '1px solid #f3f4f6', paddingTop: 6, marginTop: 2,
        }}>
          <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Cairo, sans-serif' }}>
            متبقي: {remaining.toFixed(2)} دج
          </span>
        </div>
      )}
    </div>
  );
}

// ── SaleDetailDrawer ───────────────────────────────────────────────────────────

function SaleDetailDrawer({ sale, onClose, api }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sale) return;
    setLoading(true);
    api.get(`/api/sales/${sale.id}`)
      .then(res => setDetail(res?.data || res))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [sale?.id]);

  const cfg = STATUS_CFG[sale?.status] || STATUS_CFG.pending;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: 'white',
          borderRadius: '20px 20px 0 0',
          padding: '0 0 32px',
          maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
          fontFamily: 'Cairo, Tajawal, sans-serif', direction: 'rtl',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        {/* Title row */}
        <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
              {sale?.client_name || 'بدون عميل'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {fmtDate(sale?.date)} · {fmtTime(sale?.created_at)}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#3949AB', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Status + totals */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{cfg.label}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>الحالة</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{(sale?.total || 0).toFixed(2)} دج</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>الإجمالي</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{(sale?.paid_amount || 0).toFixed(2)} دج</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>المدفوع</span>
                </div>
                {sale?.status !== 'paid' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>{((sale?.total||0)-(sale?.paid_amount||0)).toFixed(2)} دج</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>المتبقي</span>
                  </div>
                )}
                {sale?.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>{(sale?.discount||0).toFixed(2)} دج</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>الخصم</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#374151', fontSize: '0.82rem' }}>{sale?.payment_method || 'نقداً'}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>طريقة الدفع</span>
                </div>
              </div>

              {/* Items */}
              <div style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'right', marginBottom: 8, fontWeight: 600 }}>
                الأصناف ({detail?.items?.length || 0})
              </div>
              {(detail?.items || []).map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                }}>
                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.85rem' }}>
                    {(item.unit_price * item.quantity).toFixed(2)} دج
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', color: '#1f2937', fontWeight: 600 }}>{item.product_name || item.name || `#${item.product_id}`}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{item.quantity} × {item.unit_price?.toFixed(2)} دج</div>
                  </div>
                </div>
              ))}

              {sale?.notes && (
                <div style={{ marginTop: 12, background: '#fffbeb', borderRadius: 10, padding: '8px 12px', fontSize: '0.8rem', color: '#92400e', textAlign: 'right' }}>
                  {sale.notes}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HistoryTab ─────────────────────────────────────────────────────────────────

function HistoryTab() {
  const api = useApi();
  const [date, setDate] = useState(todayISO());
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback((d) => {
    setLoading(true);
    setError(false);
    api.get(`/api/sales?date=${d}`)
      .then(res => setSales(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [date]);

  const totalRevenue = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalCollected = sales.reduce((s, x) => s + (x.paid_amount || 0), 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Date picker */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 14px', background: 'white',
              border: '1px solid #e5e7eb', borderRadius: 12,
              color: '#1a1a1a', fontSize: '0.88rem', outline: 'none',
              fontFamily: 'Cairo, sans-serif', textAlign: 'right',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          />
        </div>
      </div>

      {/* Summary strip */}
      {!loading && !error && sales.length > 0 && (
        <div style={{
          margin: '10px 12px 0',
          background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-around',
          flexShrink: 0,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem', fontWeight: 600 }}>عدد المبيعات</div>
            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800 }}>{sales.length}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem', fontWeight: 600 }}>الإجمالي</div>
            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800 }}>{totalRevenue.toFixed(2)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem', fontWeight: 600 }}>المحصّل</div>
            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800 }}>{totalCollected.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(57,73,171,0.2)', borderTopColor: '#3949AB', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>جاري التحميل...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 }}>
            <span style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>تعذر التحميل</span>
            <button onClick={() => load(date)} style={{ padding: '8px 20px', background: '#3949AB', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
              إعادة المحاولة
            </button>
          </div>
        ) : sales.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>لا توجد مبيعات في هذا اليوم</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sales.map(sale => (
              <SaleCard key={sale.id} sale={sale} onTap={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <SaleDetailDrawer
          sale={selected}
          onClose={() => setSelected(null)}
          api={api}
        />
      )}
    </div>
  );
}

// ── ProductsTab ────────────────────────────────────────────────────────────────

function ProductsTab({ itemCount }) {
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem, saleTarif, items } = useCart();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    get('/api/products')
      .then(data => { if (!cancelled) setProducts(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
        p.barcode?.includes(search.trim()))
    : products;

  return (
    <>
      {/* Search */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0, background: '#F0F2F5' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن منتج..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 40px 10px 12px',
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 12, color: '#1a1a1a',
              fontSize: '0.85rem', outline: 'none',
              fontFamily: 'Cairo, sans-serif', textAlign: 'right',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          />
          <div style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', paddingBottom: itemCount > 0 ? 90 : 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(57,73,171,0.2)', borderTopColor: '#3949AB', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>جاري التحميل...</span>
          </div>
        ) : loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            <span style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>تعذر تحميل المنتجات</span>
            <button
              onClick={() => { setLoading(true); setLoadError(false); get('/api/products').then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => setLoadError(true)).finally(() => setLoading(false)); }}
              style={{ marginTop: 4, padding: '8px 20px', background: '#3949AB', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round">
              <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
            </svg>
            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              {search ? 'لا توجد نتائج' : 'لا توجد منتجات'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {filtered.map(product => {
              const cartLine = items.get(product.id);
              const cartQty = cartLine ? cartLine.quantity : 0;
              const effectiveTarif = resolveTarifForProduct(product, saleTarif);
              const price = getPriceForTarif(product, saleTarif);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={cartQty}
                  price={price}
                  selectedTarif={saleTarif}
                  effectiveTarif={effectiveTarif}
                  onTap={addItem}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      {itemCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '10px 16px 20px',
          background: 'linear-gradient(to top, rgba(240,242,245,1) 60%, transparent)',
          zIndex: 40,
        }}>
          <button
            onClick={() => navigate('/cart')}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
              border: 'none', borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', boxShadow: '0 8px 24px rgba(57,73,171,0.4)',
              fontFamily: 'Cairo, sans-serif',
            }}
          >
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '3px 12px', color: 'white', fontSize: '0.85rem', fontWeight: 700 }}>
              {itemCount}
            </span>
            <span style={{ color: 'white', fontSize: '0.95rem', fontWeight: 700 }}>عرض السلة</span>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

// ── Main Sales page ────────────────────────────────────────────────────────────

export default function Sales() {
  const navigate = useNavigate();
  const { getItemCount } = useCart();
  const [tab, setTab] = useState('products');

  const itemCount = getItemCount();

  return (
    <div style={{
      height: '100dvh',
      background: '#F0F2F5',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Cairo, Tajawal, sans-serif',
      direction: 'rtl',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
        padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
        position: 'sticky', top: 0, zIndex: 30,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, flex: 1, textAlign: 'center' }}>
          نقطة البيع
        </span>
        {itemCount > 0 && (
          <button
            onClick={() => navigate('/cart')}
            style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 10, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{itemCount}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', background: 'white',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
      }}>
        {[
          { id: 'products', label: 'المنتجات' },
          { id: 'history', label: 'السجل' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '11px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.88rem', fontWeight: 700,
              fontFamily: 'Cairo, Tajawal, sans-serif',
              color: tab === t.id ? '#3949AB' : '#9ca3af',
              borderBottom: tab === t.id ? '2.5px solid #3949AB' : '2.5px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'products'
        ? <ProductsTab itemCount={itemCount} />
        : <HistoryTab />
      }

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #9ca3af; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
