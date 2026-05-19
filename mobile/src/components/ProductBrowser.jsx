import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

/* ─── Image with graceful fallback ─────────────────────────────────────── */
function ProductImage({ path, name }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || '?').slice(0, 2).toUpperCase();

  if (!path || broken) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e2a4a 0%, #2d3561 100%)',
        gap: 4,
      }}>
        <span style={{
          fontSize: '1.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.18)',
          letterSpacing: 2, fontFamily: 'Cairo, sans-serif',
        }}>{initials}</span>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" opacity={0.2}>
          <rect x={3} y={3} width={18} height={18} rx={3} stroke="white" strokeWidth={1.5}/>
          <circle cx={8.5} cy={8.5} r={2} stroke="white" strokeWidth={1.5}/>
          <path d="M21 15l-5-5L5 21" stroke="white" strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  return (
    <img
      src={`/api/products/image/${path}`}
      alt={name}
      onError={() => setBroken(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

/* ─── Single product card ───────────────────────────────────────────────── */
function ProductCard({ product, cartQty, onAdd, onRemove, price }) {
  const [pressed, setPressed] = useState(false);
  const [pulse, setPulse] = useState(false);
  const outOfStock = (product.quantity || 0) <= 0;

  const handleTap = useCallback(() => {
    if (outOfStock) return;
    setPressed(true);
    setPulse(true);
    onAdd(product);
    setTimeout(() => setPressed(false), 200);
    setTimeout(() => setPulse(false), 600);
  }, [product, onAdd, outOfStock]);

  const handleLongPress = useCallback(() => {
    if (cartQty > 0) onRemove(product);
  }, [cartQty, product, onRemove]);

  const pressTimer = useRef(null);

  return (
    <div
      onPointerDown={() => { pressTimer.current = setTimeout(handleLongPress, 600); }}
      onPointerUp={() => { clearTimeout(pressTimer.current); handleTap(); }}
      onPointerLeave={() => clearTimeout(pressTimer.current)}
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
        border: cartQty > 0
          ? '1.5px solid rgba(99,169,255,0.5)'
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: cartQty > 0
          ? '0 0 0 3px rgba(79,142,255,0.15), 0 8px 24px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.35)',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.2s ease',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative',
        opacity: outOfStock ? 0.55 : 1,
      }}
    >
      {/* Image area */}
      <div style={{ height: 130, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <ProductImage path={product.image_path} name={product.name} />

        {/* Gradient overlay at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to top, rgba(10,10,25,0.85) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Cart quantity badge */}
        {cartQty > 0 && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'linear-gradient(135deg, #4f8eff, #667eea)',
            borderRadius: 20, minWidth: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(79,142,255,0.5)',
            border: '2px solid rgba(255,255,255,0.2)',
            animation: pulse ? 'cartBadgePulse 0.5s ease' : 'none',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.72rem', lineHeight: 1, padding: '0 3px' }}>
              ×{cartQty}
            </span>
          </div>
        )}

        {/* Out-of-stock ribbon */}
        {outOfStock && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(239,68,68,0.9)', borderRadius: 8,
            padding: '2px 8px', backdropFilter: 'blur(4px)',
          }}>
            <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              نفذت الكمية
            </span>
          </div>
        )}

        {/* Low stock warning */}
        {!outOfStock && (product.quantity || 0) <= (product.min_stock_alert || 3) && (product.quantity || 0) > 0 && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(234,179,8,0.85)', borderRadius: 8,
            padding: '2px 8px', backdropFilter: 'blur(4px)',
          }}>
            <span style={{ color: 'white', fontSize: '0.63rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              {product.quantity} متبقي
            </span>
          </div>
        )}

        {/* Add ripple visual */}
        {pressed && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(79,142,255,0.2)',
            pointerEvents: 'none',
          }}/>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Product name */}
        <span style={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: 'Cairo, Tajawal, sans-serif',
          textAlign: 'right',
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.4em',
        }}>
          {product.name}
        </span>

        {/* Price */}
        <span style={{
          color: '#4ade80',
          fontSize: '0.88rem',
          fontWeight: 800,
          textAlign: 'right',
          fontFamily: 'Cairo, sans-serif',
          letterSpacing: -0.3,
        }}>
          {price > 0 ? price.toFixed(2) : '—'}{' '}
          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'rgba(74,222,128,0.7)' }}>دج</span>
        </span>

        {/* Unit + quantity row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {product.unit && (
            <span style={{
              background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 7px',
              fontSize: '0.63rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'Cairo, sans-serif',
            }}>
              {product.unit}
            </span>
          )}
          {/* + indicator */}
          {!outOfStock && (
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: cartQty > 0
                ? 'linear-gradient(135deg,#4f8eff,#667eea)'
                : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'background 0.2s ease',
            }}>
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="white" strokeWidth={1.8} strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Category pill ──────────────────────────────────────────────────────── */
function CategoryPill({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 16px',
        borderRadius: 30,
        border: active ? '1.5px solid rgba(99,169,255,0.7)' : '1px solid rgba(255,255,255,0.12)',
        background: active
          ? 'linear-gradient(135deg, rgba(79,142,255,0.35), rgba(102,126,234,0.25))'
          : 'rgba(255,255,255,0.06)',
        color: active ? 'white' : 'rgba(255,255,255,0.5)',
        fontSize: '0.78rem',
        fontWeight: active ? 700 : 500,
        fontFamily: 'Cairo, Tajawal, sans-serif',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
        boxShadow: active ? '0 2px 12px rgba(79,142,255,0.3)' : 'none',
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Main ProductBrowser ───────────────────────────────────────────────── */
export default function ProductBrowser({ isOpen, onClose, products, items, onAddProduct, onRemoveProduct, getPriceForTier }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [visible, setVisible] = useState(false);
  const searchRef = useRef(null);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats;
  }, [products]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts = { all: products.length };
    categories.forEach(c => {
      counts[c] = products.filter(p => p.category === c).length;
    });
    return counts;
  }, [products, categories]);

  // Filtered products
  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      );
    }
    // Sort: in-stock first, then by name
    return [...list].sort((a, b) => {
      const aStock = (a.quantity || 0) > 0 ? 0 : 1;
      const bStock = (b.quantity || 0) > 0 ? 0 : 1;
      return aStock - bStock || a.name.localeCompare(b.name, 'ar');
    });
  }, [products, activeCategory, search]);

  // Cart helpers
  const getCartQty = useCallback((productId) => {
    const item = items.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  const cartTotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const cartCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  if (!isOpen) return null;

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes cartBadgePulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .pb-scroll::-webkit-scrollbar { display: none; }
        .pb-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 91,
          height: '93vh',
          background: 'linear-gradient(180deg, #0d1128 0%, #0b0f1f 50%, #080c18 100%)',
          borderRadius: '22px 22px 0 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}/>
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px 10px',
          gap: 12, flexShrink: 0,
        }}>
          {/* Cart summary chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(79,142,255,0.15)', border: '1px solid rgba(79,142,255,0.35)',
            borderRadius: 20, padding: '5px 12px 5px 8px',
            flexShrink: 0,
          }}>
            <div style={{
              background: 'linear-gradient(135deg,#4f8eff,#667eea)',
              borderRadius: 12, width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 800, color: 'white',
            }}>
              {cartCount}
            </div>
            <span style={{ color: '#4f8eff', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
              {cartTotal > 0 ? `${cartTotal.toFixed(2)} دج` : 'السلة'}
            </span>
          </div>

          {/* Title */}
          <h2 style={{
            flex: 1, margin: 0, textAlign: 'center',
            color: 'white', fontSize: '1.1rem', fontWeight: 800,
            fontFamily: 'Cairo, Tajawal, sans-serif',
            letterSpacing: -0.3,
          }}>
            المنتجات
          </h2>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '10px 14px',
            backdropFilter: 'blur(10px)',
          }}>
            <svg width={16} height={16} viewBox="0 0 20 20" fill="none" opacity={0.4} style={{ flexShrink: 0 }}>
              <circle cx={9} cy={9} r={7} stroke="white" strokeWidth={2}/>
              <path d="M14 14l4 4" stroke="white" strokeWidth={2} strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن منتج..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'white', fontSize: '0.88rem', fontFamily: 'Cairo, Tajawal, sans-serif',
                textAlign: 'right', caretColor: '#4f8eff',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
              >
                <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div
            className="pb-scroll"
            style={{
              display: 'flex', gap: 8, padding: '0 16px 14px',
              overflowX: 'auto', flexShrink: 0, flexDirection: 'row-reverse',
            }}
          >
            <CategoryPill
              label="الكل"
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              count={categoryCounts.all}
            />
            {categories.map(cat => (
              <CategoryPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                count={categoryCounts[cat]}
              />
            ))}
          </div>
        )}

        {/* Results count */}
        <div style={{
          padding: '0 16px 10px', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem',
            fontFamily: 'Cairo, sans-serif',
          }}>
            {filtered.length} منتج
          </span>
          {search && (
            <span style={{
              color: 'rgba(79,142,255,0.8)', fontSize: '0.72rem',
              fontFamily: 'Cairo, sans-serif',
            }}>
              نتائج البحث: "{search}"
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0, margin: '0 0 4px' }}/>

        {/* Product Grid */}
        <div
          className="pb-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 80px' }}
        >
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: 260, gap: 14,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24,
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" opacity={0.3}>
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="white" strokeWidth={1.5} strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.3)', fontFamily: 'Cairo, sans-serif',
                fontSize: '0.9rem', margin: 0, textAlign: 'center',
              }}>
                لا توجد منتجات مطابقة
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}>
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={getCartQty(product.id)}
                  price={getPriceForTier(product)}
                  onAdd={onAddProduct}
                  onRemove={onRemoveProduct}
                />
              ))}
            </div>
          )}
        </div>

        {/* Floating Done button */}
        {cartCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 16px 20px',
            background: 'linear-gradient(to top, rgba(8,12,24,1) 70%, transparent)',
            pointerEvents: 'none',
          }}>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '14px 0',
                background: 'linear-gradient(135deg, #4f8eff 0%, #667eea 100%)',
                border: 'none', borderRadius: 16, cursor: 'pointer',
                color: 'white', fontWeight: 800, fontSize: '1rem',
                fontFamily: 'Cairo, Tajawal, sans-serif',
                boxShadow: '0 4px 20px rgba(79,142,255,0.45)',
                pointerEvents: 'all',
                letterSpacing: -0.3,
              }}
            >
              تأكيد الاختيار — {cartCount} منتج — {cartTotal.toFixed(2)} دج
            </button>
          </div>
        )}
      </div>
    </>
  );
}
