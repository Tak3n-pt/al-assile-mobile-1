import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, getPriceForTarif } from '../hooks/useCart.jsx';
import { useApi } from '../hooks/useApi.jsx';

/* ── Product image with fallback ──────────────────────────────────────────── */
function ProductImage({ path, name }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (!path || broken) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e2a4a 0%, #2d3561 100%)',
      }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.18)' }}>
          {initials}
        </span>
      </div>
    );
  }
  return (
    <img
      src={`/api/products/image/${path}`}
      alt={name}
      onError={() => setBroken(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

/* ── Single product card ──────────────────────────────────────────────────── */
function ProductCard({ product, cartQty, price, onTap }) {
  const [pressed, setPressed] = useState(false);
  const outOfStock = (product.quantity || 0) <= 0;

  const handleTap = () => {
    if (outOfStock) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 180);
    onTap(product);
  };

  return (
    <div
      onPointerDown={handleTap}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
        border: cartQty > 0
          ? '1.5px solid rgba(99,169,255,0.55)'
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: cartQty > 0
          ? '0 0 0 3px rgba(79,142,255,0.13), 0 6px 18px rgba(0,0,0,0.4)'
          : '0 3px 12px rgba(0,0,0,0.3)',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: outOfStock ? 0.5 : 1,
      }}
    >
      {/* Image */}
      <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
        <ProductImage path={product.image_path} name={product.name} />

        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
          background: 'linear-gradient(to top, rgba(10,10,25,0.85), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Cart qty badge */}
        {cartQty > 0 && (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: 'linear-gradient(135deg, #4f8eff, #667eea)',
            borderRadius: 20, minWidth: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(79,142,255,0.5)',
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.7rem', padding: '0 3px' }}>
              ×{cartQty}
            </span>
          </div>
        )}

        {/* Out-of-stock ribbon */}
        {outOfStock && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(239,68,68,0.9)', borderRadius: 6,
            padding: '2px 7px',
          }}>
            <span style={{ color: 'white', fontSize: '0.62rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              نفذت
            </span>
          </div>
        )}

        {/* Low stock */}
        {!outOfStock && (product.quantity || 0) > 0 && (product.quantity || 0) <= (product.min_stock_alert || 3) && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(234,179,8,0.85)', borderRadius: 6,
            padding: '2px 7px',
          }}>
            <span style={{ color: 'white', fontSize: '0.62rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              {product.quantity} متبقي
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '9px 10px 11px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600,
          fontFamily: 'Cairo, Tajawal, sans-serif', textAlign: 'right',
          lineHeight: 1.35, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: '2.3em',
        }}>
          {product.name}
        </span>
        <span style={{
          color: '#4ade80', fontSize: '0.88rem', fontWeight: 800,
          textAlign: 'right', fontFamily: 'Cairo, sans-serif',
        }}>
          {price > 0 ? price.toFixed(2) : '—'}
          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'rgba(74,222,128,0.65)', marginRight: 3 }}>دج</span>
        </span>
      </div>
    </div>
  );
}

/* ── Main POS Sales page ──────────────────────────────────────────────────── */
export default function Sales() {
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem, saleTarif, setSaleTarif, getItemCount, items } = useCart();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get('/api/products')
      .then(data => {
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
        p.barcode?.includes(search.trim())
      )
    : products;

  const itemCount = getItemCount();

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0a0a19 0%, #0d1128 60%, #0a0f22 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Cairo, Tajawal, sans-serif',
      direction: 'rtl',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(10,10,25,0.97)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px 0',
      }}>
        {/* Top row: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, flex: 1, textAlign: 'right' }}>
            نقطة البيع
          </span>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', flexShrink: 0,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Tarif selector — always visible */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 10, justifyContent: 'flex-end',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>السعر:</span>
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setSaleTarif(n)}
              style={{
                padding: '6px 18px', borderRadius: 10,
                border: saleTarif === n
                  ? '1.5px solid rgba(99,169,255,0.7)'
                  : '1.5px solid rgba(255,255,255,0.12)',
                background: saleTarif === n
                  ? 'linear-gradient(135deg,rgba(79,142,255,0.25),rgba(102,126,234,0.2))'
                  : 'rgba(255,255,255,0.05)',
                color: saleTarif === n ? '#82b4ff' : 'rgba(255,255,255,0.5)',
                fontSize: '0.82rem', fontWeight: saleTarif === n ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.18s ease',
                fontFamily: 'Cairo, sans-serif',
              }}
            >
              {n === 1 ? 'سعر 1' : n === 2 ? 'سعر 2' : 'سعر 3'}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{
          position: 'relative', marginBottom: 10,
        }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن منتج..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 42px 10px 12px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, color: 'white',
              fontSize: '0.85rem', outline: 'none',
              fontFamily: 'Cairo, sans-serif',
              textAlign: 'right',
            }}
          />
          <div style={{
            position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Product grid ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 12px', paddingBottom: itemCount > 0 ? 90 : 16,
      }}>
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 80, gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, border: '3px solid rgba(79,142,255,0.3)',
              borderTopColor: '#4f8eff', borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>جاري التحميل...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 80, gap: 8,
          }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round">
              <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
              {search ? 'لا توجد نتائج' : 'لا توجد منتجات'}
            </span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}>
            {filtered.map(product => {
              const cartLine = items.get(product.id);
              const cartQty = cartLine ? cartLine.quantity : 0;
              const price = getPriceForTarif(product, saleTarif);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={cartQty}
                  price={price}
                  onTap={addItem}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cart FAB bar ───────────────────────────────────────────────────── */}
      {itemCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '10px 16px 20px',
          background: 'linear-gradient(to top, rgba(10,10,25,1) 60%, transparent)',
          zIndex: 40,
        }}>
          <button
            onClick={() => navigate('/cart')}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'linear-gradient(135deg, #4f8eff 0%, #667eea 100%)',
              border: 'none', borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', boxShadow: '0 8px 24px rgba(79,142,255,0.4)',
            }}
          >
            <span style={{
              background: 'rgba(255,255,255,0.25)', borderRadius: 10,
              padding: '3px 12px', color: 'white',
              fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif',
            }}>
              {itemCount}
            </span>
            <span style={{ color: 'white', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              عرض السلة
            </span>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.25); }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
