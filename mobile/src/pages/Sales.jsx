import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, getPriceForTarif, resolveTarifForProduct } from '../hooks/useCart.jsx';
import { useApi } from '../hooks/useApi.jsx';

const imageCache = new Map();

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
        borderRadius: 16,
        overflow: 'hidden',
        background: 'white',
        border: cartQty > 0 ? '2px solid #3949AB' : '1px solid #e5e7eb',
        boxShadow: cartQty > 0
          ? '0 0 0 3px rgba(57,73,171,0.1), 0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.07)',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: outOfStock ? 0.5 : 1,
      }}
    >
      <div style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
        <ProductImage productId={product.id} hasImage={product.has_image} name={product.name} />

        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: usesFallbackTarif ? 'rgba(17,24,39,0.72)' : 'rgba(57,73,171,0.9)',
          borderRadius: 8,
          padding: '2px 7px',
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

export default function Sales() {
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem, saleTarif, setSaleTarif, getItemCount, items } = useCart();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    get('/api/products')
      .then(data => {
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
        p.barcode?.includes(search.trim()))
    : products;

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

      {/* Tarif */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px 0',
        background: '#F0F2F5',
      }}>
        <span style={{
          color: '#6b7280',
          fontSize: '0.72rem',
          fontWeight: 700,
          fontFamily: 'Cairo, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          التعريفة
        </span>
        {[1, 2, 3].map(n => (
          <button
            key={n}
            onClick={() => setSaleTarif(n)}
            style={{
              flex: 1,
              minHeight: 38,
              border: saleTarif === n ? '1px solid #3949AB' : '1px solid #e5e7eb',
              borderRadius: 12,
              background: saleTarif === n ? '#3949AB' : 'white',
              color: saleTarif === n ? 'white' : '#4b5563',
              fontWeight: 800,
              fontSize: '0.82rem',
              fontFamily: 'Cairo, sans-serif',
              cursor: 'pointer',
              boxShadow: saleTarif === n ? '0 4px 12px rgba(57,73,171,0.22)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}
            aria-label={`Tarif ${n}`}
          >
            T{n}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '10px 12px',
        paddingBottom: itemCount > 0 ? 90 : 16,
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid rgba(57,73,171,0.2)',
              borderTopColor: '#3949AB',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }} />
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
            <span style={{
              background: 'rgba(255,255,255,0.25)', borderRadius: 10,
              padding: '3px 12px', color: 'white',
              fontSize: '0.85rem', fontWeight: 700,
            }}>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #9ca3af; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
