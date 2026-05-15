import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowRight, X, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Barcode icon (vertical lines) ──────────────────────────────────────────
function BarcodeIcon({ size = 26 }) {
  const bars = [
    { x: 1,  w: 2 }, { x: 5,  w: 1 }, { x: 8,  w: 3 }, { x: 13, w: 1 },
    { x: 16, w: 2 }, { x: 20, w: 1 }, { x: 23, w: 3 }, { x: 28, w: 1 },
    { x: 31, w: 2 },
  ];
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 34 22" fill="none">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={22} fill="#444" />)}
    </svg>
  );
}

// ── Floppy/Save icon (blue button) ─────────────────────────────────────────
// Hamburger menu lines
function HamburgerIcon() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '2px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 22, height: 2, background: 'white', borderRadius: 2 }} />
      ))}
    </div>
  );
}

// ── Dots grid FAB icon ──────────────────────────────────────────────────────
function DotsGrid() {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {[4,11,18].flatMap(x => [4,11,18].map(y => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} fill="#555" />
      )))}
    </svg>
  );
}

// ── Editable cell ───────────────────────────────────────────────────────────
function EditCell({ value, onChange, type = 'number', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        style={{
          width: '100%', border: 'none', borderBottom: '2px solid #2b5be8',
          outline: 'none', textAlign: 'center', fontSize: '0.85rem', fontWeight: '600',
          background: '#eef2ff', borderRadius: 4, padding: '2px 4px', ...style,
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{ cursor: 'pointer', display: 'block', textAlign: 'center',
               fontSize: '0.85rem', fontWeight: '600', color: '#1a1a1a', ...style }}
    >
      {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
    </span>
  );
}

// ── Purchase item row ───────────────────────────────────────────────────────
function ItemRow({ item, onQtyChange, onPriceChange, onRemove }) {
  const lineTotal = (item.unit_price * item.quantity).toFixed(2);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0',
      background: 'white', minHeight: 44,
    }}>
      {/* Total */}
      <div style={{ width: '23%', textAlign: 'center', padding: '0.4rem 0.25rem', fontSize: '0.82rem', color: '#444' }}>
        {lineTotal}
      </div>
      {/* Qty */}
      <div style={{ width: '18%', padding: '0.4rem 0.25rem' }}>
        <EditCell value={item.quantity} onChange={v => v > 0 ? onQtyChange(v) : onRemove()} />
      </div>
      {/* Price */}
      <div style={{ width: '22%', padding: '0.4rem 0.25rem' }}>
        <EditCell value={item.unit_price} onChange={onPriceChange} />
      </div>
      {/* Name + remove */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0.4rem 0.5rem 0.4rem 0.25rem', gap: '0.5rem' }}>
        <span style={{ flex: 1, fontSize: '0.85rem', color: '#1a1a1a', textAlign: 'right' }}>
          {item.name}
        </span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1 }}>
          <X size={14} color="#dc2626" />
        </button>
      </div>
    </div>
  );
}

// ── Edit-purchase bottom sheet ──────────────────────────────────────────────
function EditPurchaseSheet({ onClose, onLoad, api }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/purchases')
      .then(d => setPurchases(Array.isArray(d) ? d : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
      <div dir="rtl" style={{ background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#666" /></button>
          <span style={{ fontWeight: '700', fontSize: '1rem' }}>تعديل فاتورة مشتريات</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>جارٍ التحميل...</p>
          ) : purchases.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا توجد فواتير</p>
          ) : purchases.map(p => (
            <button key={p.id} onClick={() => onLoad(p.id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', textAlign: 'right' }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>{p.total?.toFixed(2)} ريال</span>
              <span style={{ color: '#1a1a1a', fontSize: '0.9rem' }}>#{p.id} · {p.date}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Import-from-purchase bottom sheet ──────────────────────────────────────
function ImportSheet({ onClose, onImport, api }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/purchases')
      .then(d => setPurchases(Array.isArray(d) ? d : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
      <div dir="rtl" style={{ background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#666" /></button>
          <span style={{ fontWeight: '700', fontSize: '1rem' }}>استيراد من طلب شراء</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>جارٍ التحميل...</p>
          ) : purchases.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا توجد فواتير سابقة</p>
          ) : purchases.map(p => (
            <button key={p.id} onClick={() => onImport(p.id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', textAlign: 'right' }}>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>{p.total?.toFixed(2)} ريال · {p.supplier_name || 'بدون مورد'}</span>
              <span style={{ color: '#1a1a1a', fontSize: '0.9rem' }}>#{p.id} · {p.date}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Purchases() {
  const navigate = useNavigate();
  const api = useApi();

  // Invoice state
  const [editingId, setEditingId]   = useState(null); // null = new, N = editing
  const [date, setDate]             = useState(todayStr());
  const [items, setItems]           = useState([]);
  const [saving, setSaving]         = useState(false);
  const [savedId, setSavedId]       = useState(null);
  const [error, setError]           = useState('');

  // Products catalogue
  const [products, setProducts]     = useState([]);

  // Search
  const [search, setSearch]         = useState('');
  const [showDrop, setShowDrop]     = useState(false);
  const searchRef                   = useRef(null);

  // UI toggles
  const [showMenu, setShowMenu]     = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const dateRef                     = useRef(null);

  // Load products
  useEffect(() => {
    api.get('/api/products')
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Filtered search results
  const searchResults = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search))
      ).slice(0, 8)
    : [];

  // ── Add product to invoice ────────────────────────────────────────────────
  const addProduct = useCallback((product) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        product_id:  product.id,
        name:        product.name,
        unit_price:  product.purchase_price || 0,
        quantity:    1,
      }];
    });
    setSearch('');
    setShowDrop(false);
  }, []);

  function updateQty(idx, qty)    { setItems(p => { const n=[...p]; n[idx]={...n[idx],quantity:qty}; return n; }); }
  function updatePrice(idx, price){ setItems(p => { const n=[...p]; n[idx]={...n[idx],unit_price:price}; return n; }); }
  function removeItem(idx)         { setItems(p => p.filter((_,i) => i!==idx)); }

  // ── Barcode scan ──────────────────────────────────────────────────────────
  function handleScan(barcode) {
    const found = products.find(p => p.barcode === barcode);
    if (found) addProduct(found);
    else setSearch(barcode);
    setShowScanner(false);
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const total     = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  // ── Save / Update ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (items.length === 0) { setError('أضف منتجاً واحداً على الأقل'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        date,
        paid_amount: 0,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      };
      let result;
      if (editingId) {
        result = await api.patch(`/api/purchases/${editingId}`, payload);
      } else {
        result = await api.post('/api/purchases', payload);
      }
      setSavedId(editingId || result?.id || result);
      setItems([]);
      setDate(todayStr());
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'خطأ في الحفظ');
    }
    setSaving(false);
  }

  // ── Load existing purchase for editing ───────────────────────────────────
  async function loadForEdit(id) {
    setShowEditSheet(false);
    try {
      const data = await api.get(`/api/purchases/${id}`);
      setEditingId(data.id);
      setDate(data.date);
      setItems((data.items || []).map(it => ({
        product_id: it.product_id,
        name:       it.product_name,
        unit_price: it.unit_price,
        quantity:   it.quantity,
      })));
      setSavedId(null);
      setError('');
    } catch (err) {
      setError(err.message || 'تعذّر تحميل الفاتورة');
    }
  }

  // ── Import items from existing purchase ──────────────────────────────────
  async function importFromPurchase(id) {
    setShowImport(false);
    try {
      const data = await api.get(`/api/purchases/${id}`);
      const imported = (data.items || []).map(it => ({
        product_id: it.product_id,
        name:       it.product_name,
        unit_price: it.unit_price,
        quantity:   it.quantity,
      }));
      setItems(prev => {
        const next = [...prev];
        for (const imp of imported) {
          const idx = next.findIndex(i => i.product_id === imp.product_id);
          if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + imp.quantity };
          else next.push(imp);
        }
        return next;
      });
    } catch (err) {
      setError(err.message || 'تعذّر الاستيراد');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#f5f5f5', fontFamily: "'Cairo','Tajawal',sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#2b5be8', display: 'flex', alignItems: 'center',
        padding: '0.55rem 0.75rem', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(43,91,232,0.4)',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', lineHeight: 1 }}>
          <ArrowRight size={22} color="white" />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', color: 'white', fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
          {editingId ? `تعديل فاتورة #${editingId}` : 'المشتريات'}
        </h1>
        <button onClick={() => setShowMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', lineHeight: 1 }}>
          <HamburgerIcon />
        </button>
      </div>

      {/* ── HAMBURGER DROPDOWN ─────────────────────────────────────────── */}
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 52, right: 0, zIndex: 50,
            background: 'white', minWidth: 230,
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          }}>
            {[
              { label: 'اضافه منتج جديد',               action: () => navigate('/products/list', { state: { action: 'add' } }) },
              { label: 'اعاده طباعه الفاتورة',           action: () => { if (!savedId) setError('لا توجد فاتورة محفوظة'); } },
              { label: 'تعديل فاتورة مشتريات',           action: () => setShowEditSheet(true) },
              { label: 'استيراد البيانات من طلب شراء',   action: () => setShowImport(true) },
            ].map((item, i, arr) => (
              <button key={i}
                onClick={() => { setShowMenu(false); item.action(); }}
                style={{
                  display: 'block', width: '100%', padding: '0.95rem 1.25rem',
                  background: 'none', border: 'none', textAlign: 'right',
                  fontSize: '0.95rem', color: '#1a1a1a', cursor: 'pointer',
                  borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── DATE ROW ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#e0e0e0', flexShrink: 0, borderBottom: '1px solid #ccc' }}>
        <button onClick={() => dateRef.current?.showPicker?.() || dateRef.current?.click()}
          style={{ flex: 1, padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: '1px solid #ccc', fontSize: '0.9rem', color: '#444', fontWeight: '500' }}>
          {date}
        </button>
        <div style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', color: '#333', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
          تاريخ الفاتورة
        </div>
        <input ref={dateRef} type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      </div>

      {/* ── SAVE / SEARCH / SCAN ROW ────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', background: 'white',
        padding: '0.45rem 0.5rem', gap: '0.5rem', flexShrink: 0,
        borderBottom: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* Save button */}
        <button onClick={handleSave} disabled={saving} style={{
          background: saving ? '#9ab4f5' : '#2b5be8', border: 'none', borderRadius: 6,
          padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
          cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0,
        }}>
          <Save size={17} color="white" />
          <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '700' }}>حفظ</span>
        </button>

        {/* Search */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={searchRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
            onFocus={() => search && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="ابحث عن منتج أو استخدم الكاميرا"
            style={{
              width: '100%', border: 'none', borderBottom: '1px solid #bbb',
              padding: '0.35rem 0', fontSize: '0.83rem', outline: 'none',
              background: 'transparent', textAlign: 'right', color: '#333',
              boxSizing: 'border-box',
            }}
          />
          {/* Dropdown */}
          {showDrop && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 35,
              background: 'white', boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
              borderRadius: '0 0 8px 8px', maxHeight: 260, overflowY: 'auto',
            }}>
              {searchResults.map(p => (
                <button key={p.id}
                  onMouseDown={() => addProduct(p)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '0.65rem 0.9rem', background: 'none', border: 'none',
                    borderBottom: '1px solid #f5f5f5', cursor: 'pointer', textAlign: 'right',
                  }}>
                  <span style={{ color: '#888', fontSize: '0.78rem' }}>{(p.purchase_price||0).toFixed(2)} ريال</span>
                  <span style={{ color: '#1a1a1a', fontSize: '0.9rem', fontWeight: '500' }}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Barcode button */}
        <button onClick={() => setShowScanner(true)} style={{
          background: 'none', border: '1px solid #ccc', borderRadius: 6,
          padding: '0.3rem 0.4rem', cursor: 'pointer', flexShrink: 0, lineHeight: 1,
        }}>
          <BarcodeIcon size={26} />
        </button>
      </div>

      {/* ── ERROR / SUCCESS BANNERS ─────────────────────────────────────── */}
      {error && (
        <div style={{ background: '#fef2f2', padding: '0.4rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fca5a5', flexShrink: 0 }}>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="#dc2626" /></button>
          <span style={{ color: '#dc2626', fontSize: '0.83rem' }}>{error}</span>
        </div>
      )}
      {savedId && (
        <div style={{ background: '#f0fdf4', padding: '0.4rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #86efac', flexShrink: 0 }}>
          <button onClick={() => setSavedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="#16a34a" /></button>
          <span style={{ color: '#16a34a', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Check size={14} /> تم الحفظ بنجاح — فاتورة #{savedId}
          </span>
        </div>
      )}

      {/* ── TABLE HEADER ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', background: '#ebebeb', borderBottom: '1px solid #ddd',
        flexShrink: 0, padding: '0.35rem 0.5rem',
      }}>
        <span style={{ width: '23%', textAlign: 'center', fontSize: '0.78rem', color: '#555', fontWeight: '700' }}>الإجمالي</span>
        <span style={{ width: '18%', textAlign: 'center', fontSize: '0.78rem', color: '#555', fontWeight: '700' }}>الكمية</span>
        <span style={{ width: '22%', textAlign: 'center', fontSize: '0.78rem', color: '#555', fontWeight: '700' }}>التكلفه</span>
        <span style={{ flex: 1, textAlign: 'right',  fontSize: '0.78rem', color: '#555', fontWeight: '700', paddingRight: '0.5rem' }}>المنتج</span>
      </div>

      {/* ── ITEMS LIST ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fafafa' }}>
        {items.map((item, idx) => (
          <ItemRow
            key={`${item.product_id}-${idx}`}
            item={item}
            onQtyChange={v => updateQty(idx, v)}
            onPriceChange={v => updatePrice(idx, v)}
            onRemove={() => removeItem(idx)}
          />
        ))}
      </div>

      {/* ── FLOATING DOTS FAB ──────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/products/list')}
        style={{
          position: 'absolute', bottom: 66, left: 16,
          background: '#e0e0e0', border: 'none', borderRadius: '50%',
          width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
          zIndex: 10,
        }}>
        <DotsGrid />
      </button>

      {/* ── BOTTOM BAR ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', background: 'white',
        borderTop: '1px solid #e0e0e0', padding: '0.5rem 0.75rem',
        flexShrink: 0, gap: '0.5rem',
      }}>
        {/* Item/qty count (left white box) */}
        <div style={{
          background: 'white', border: '1px solid #e0e0e0', borderRadius: 20,
          padding: '0.28rem 0.7rem', minWidth: 52, textAlign: 'center',
          fontSize: '0.9rem', fontWeight: '700', color: '#222',
        }}>
          {itemCount % 1 === 0 ? itemCount.toFixed(1) : itemCount.toFixed(2)}
        </div>

        {/* Currency */}
        <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: '500', flexShrink: 0 }}>ريال ع.ق</span>

        {/* Total (green area, red text) */}
        <div style={{
          flex: 1, background: '#c8efc8', borderRadius: 20,
          padding: '0.4rem 0.75rem', textAlign: 'center',
        }}>
          <span style={{ color: '#c0392b', fontWeight: '700', fontSize: '1rem' }}>
            {total.toFixed(2)}
          </span>
        </div>

        {/* إجمالي label */}
        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#222', flexShrink: 0 }}>إجمالي</span>
      </div>

      {/* ── BARCODE SCANNER ────────────────────────────────────────────── */}
      <BarcodeScanner isOpen={showScanner} onScan={handleScan} onClose={() => setShowScanner(false)} />

      {/* ── EDIT PURCHASE SHEET ────────────────────────────────────────── */}
      {showEditSheet && (
        <EditPurchaseSheet api={api} onClose={() => setShowEditSheet(false)} onLoad={loadForEdit} />
      )}

      {/* ── IMPORT SHEET ───────────────────────────────────────────────── */}
      {showImport && (
        <ImportSheet api={api} onClose={() => setShowImport(false)} onImport={importFromPurchase} />
      )}
    </div>
  );
}
