import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, ScanBarcode, LogOut, ChevronRight, Upload, Save, Plus, Play, Image as ImageIcon, Trash2, Tag, FileSpreadsheet, ArrowLeftRight, PlusCircle, Globe } from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi.jsx';
import { getPriceForTarif, useCart } from '../hooks/useCart.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { t, getLanguage, setLanguage } from '../utils/i18n.js';
import { parseInputNumber } from '../utils/numberInput.js';

export default function ProductsList() {
  const api = useApi();
  const { addItem, saleTarif, setSaleTarif } = useCart();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanNotification, setScanNotification] = useState(null);
  const [lang, setLang] = useState(getLanguage());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAddProduct,  setShowAddProduct]  = useState(false);
  const [showEditPrices,  setShowEditPrices]  = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showImport,      setShowImport]      = useState(false);
  const [showMore,        setShowMore]        = useState(false);
  const [showBarcodeMaker, setShowBarcodeMaker] = useState(false);
  const [initBarcode, setInitBarcode] = useState('');
  const [productAction,   setProductAction]   = useState(null);
  const [hintHidden,      setHintHidden]      = useState(() => localStorage.getItem('pl_hint_hidden') === '1');
  const [selectedIds,     setSelectedIds]     = useState(new Set());

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const act = location.state?.action;
    const bc  = location.state?.barcode || '';
    if (act === 'add')               { setInitBarcode(bc); setShowAddProduct(true); }
    else if (act === 'edit-prices')  setShowEditPrices(true);
    else if (act === 'add-category') setShowAddCategory(true);
    else if (act === 'import')       setShowImport(true);
  }, []);

  useEffect(() => {
    const barcode = query.trim();
    if (!barcode) return;

    const hasLocalMatch = products.some(p => {
      const stored = String(p.barcode || '');
      return stored === barcode || (stored && stored.replace(/^0+/, '') === barcode.replace(/^0+/, ''));
    });
    if (hasLocalMatch) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const remote = await api.get('/api/products/barcode/' + encodeURIComponent(barcode));
        if (!cancelled && remote?.id) {
          setProducts(prev => prev.some(p => p.id === remote.id)
            ? prev.map(p => (p.id === remote.id ? remote : p))
            : [remote, ...prev]);
        }
      } catch {
        // No exact barcode match on the server.
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, products, api]);

  const filtered = products.filter(p => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  });

  const showScanFeedback = (type, message) => {
    setScanNotification({ type, message });
    setTimeout(() => setScanNotification(null), 3000);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  const dismissHint = () => {
    setHintHidden(true);
    localStorage.setItem('pl_hint_hidden', '1');
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`حذف "${product.name}"؟`)) return;
    try {
      await api.delete(`/api/products/${product.id}`);
    } catch (err) {
      alert(err?.message || 'تعذّر الحذف');
      return;
    }
    setProductAction(null);
    fetchProducts(true);
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBarcodeScan = useCallback(async (raw) => {
    const barcode = String(raw || '').replace(/[\r\n\t]/g, '').trim();
    if (!barcode) return;

    let found = products.find(p => p.barcode === barcode);

    if (!found) {
      const scannedStripped = barcode.replace(/^0+/, '');
      if (scannedStripped) {
        found = products.find(p => {
          if (!p.barcode) return false;
          const storedStripped = String(p.barcode).replace(/^0+/, '');
          return storedStripped === scannedStripped;
        });
      }
    }

    if (!found) {
      try {
        const remote = await api.get('/api/products/barcode/' + encodeURIComponent(barcode));
        if (remote && remote.data && remote.data.id) {
          found = remote.data;
        }
      } catch {
        // 404 = not found
      }
    }

    if (!found) {
      showScanFeedback('error', `${t('noProductForBarcode')}: ${barcode}`);
      return;
    }

    if ((found.quantity ?? 0) <= 0) {
      showScanFeedback('error', `${found.name}: ${t('outOfStock')}`);
      return;
    }

    addItem(found, 1);
    showScanFeedback('success', `${t('added')}: ${found.name}`);
  }, [products, addItem, api]);

  const greyBtn = {
    flex: 1, background: '#dadada', border: 'none', borderRadius: '4px',
    padding: '0.6rem 0.4rem', fontSize: '0.95rem', color: '#1a1a1a',
    fontFamily: "'Cairo','Tajawal',sans-serif", cursor: 'pointer', textAlign: 'center',
  };
  const allVisibleIds = filtered.map(p => p.id);
  const allChecked   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

  return (
    <div style={{ height: '100%', background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">
      {/* Centered title */}
      <div style={{ padding: '0.9rem 1rem 0.65rem' }}>
        <h1 style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>
          المنتجات المتوفرة في المخزن
        </h1>
      </div>

      {/* Search row — DOM order matters in RTL: input first → right, barcode icon second → left */}
      <div style={{ padding: '0 1rem' }}>
        <div style={{ border: '1.5px solid #90caf9', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', padding: '0.35rem 0.55rem', gap: '0.5rem' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث"
            style={{ flex: 1, border: 'none', borderBottom: '1px solid #9ca3af', outline: 'none', background: 'transparent', textAlign: 'right', padding: '0.35rem 0', fontSize: '1rem', color: '#1a1a1a', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          />
          <button type="button" onClick={() => setShowScanner(true)}
            style={{ background: 'white', border: '1.5px solid #1a1a1a', borderRadius: '4px', padding: '0.2rem 0.35rem', cursor: 'pointer', display: 'inline-flex', flexShrink: 0 }}
            aria-label="مسح الباركود">
            <ScanBarcode size={26} color="#1a1a1a" />
          </button>
        </div>
      </div>

      {/* Three grey action buttons — DOM order = visual RTL right-to-left:
          first child → right (تقرير), middle (صناعه الباركود), last → left (المزيد) */}
      <div style={{ padding: '0.6rem 1rem 0.5rem', display: 'flex', gap: '0.4rem' }}>
        <button type="button" onClick={() => navigate('/reports')}      style={greyBtn}>تقرير</button>
        <button type="button" onClick={() => setShowBarcodeMaker(true)} style={greyBtn}>صناعه الباركود</button>
        <button type="button" onClick={() => setShowMore(true)}         style={greyBtn}>المزيد</button>
      </div>

      {/* Sale tariff selector — shared with the cart, so products added from this
          list inherit the selected sale tariff immediately. */}
      <div style={{ padding: '0 1rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'white' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#6b7280', whiteSpace: 'nowrap' }}>{t('tarif')}</span>
        {[1, 2, 3].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setSaleTarif(n)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0',
              fontSize: '0.84rem',
              fontWeight: '800',
              cursor: 'pointer',
              background: saleTarif === n ? '#3949AB' : '#f1f5f9',
              color: saleTarif === n ? 'white' : '#6b7280',
              fontFamily: "'Cairo','Tajawal',sans-serif",
            }}
          >
            T{n}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 1rem', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', color: '#1a1a1a', fontSize: '0.92rem', background: 'white' }}>
        <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={allChecked}
            onChange={() => setSelectedIds(allChecked ? new Set() : new Set(allVisibleIds))}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <span>المنتج</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>السعر</div>
        <div style={{ flex: 1, textAlign: 'center' }}>الكمية</div>
      </div>

      {/* Product rows */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', fontSize: '0.9rem' }}>{t('loadingProducts')}</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: '#d32f2f', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
            <button onClick={() => fetchProducts()} style={greyBtn}>{t('tryAgain')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', fontSize: '0.9rem' }}>
            {query ? `${t('noResultsFor')} "${query}"` : t('noProductsFound')}
          </div>
        ) : (
          filtered.map(p => {
            const checked = selectedIds.has(p.id);
            return (
              <div key={p.id}
                onClick={() => setProductAction(p)}
                style={{ display: 'flex', alignItems: 'center', padding: '0.7rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', color: '#1a1a1a', fontSize: '0.92rem' }}>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <input type="checkbox" checked={checked}
                    onChange={() => toggleSelected(p.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>
                  <div>{formatCurrency(getPriceForTarif(p, saleTarif))}</div>
                  <div style={{ fontSize: '0.66rem', color: '#3949AB', fontWeight: '800' }}>T{saleTarif}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: '600', color: (p.quantity || 0) <= (p.min_stock_alert || 0) && (p.min_stock_alert || 0) > 0 ? '#d32f2f' : '#1a1a1a' }}>{p.quantity ?? 0}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Yellow help footer — DOM: اخفاء first (right) then hint text (center/left) */}
      {!hintHidden && (
        <div style={{ background: '#fde047', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <button onClick={dismissHint} style={{ background: 'transparent', border: 'none', color: '#d32f2f', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', padding: 0, fontFamily: "'Cairo','Tajawal',sans-serif" }}>
            اخفاء
          </button>
          <span style={{ flex: 1, textAlign: 'center', color: '#d32f2f', fontSize: '0.85rem', fontWeight: '600' }}>
            اضغط على المنتج لمزيد من الخيارات
          </span>
        </div>
      )}

      {/* Scan notification toast (success/error from scanner) */}
      <AnimatePresence>
        {scanNotification && (
          <motion.div
            role="status" aria-live="polite"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            style={{
              position: 'fixed', top: '4rem', insetInline: '1rem',
              padding: '0.6rem 1rem', borderRadius: '8px', textAlign: 'center', zIndex: 60,
              background: scanNotification.type === 'success' ? '#16a34a' : '#dc2626',
              color: 'white', fontSize: '0.9rem', fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
            {scanNotification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout confirm — triggered from المزيد sheet */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              style={{ width: '100%', maxWidth: '320px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.4rem' }}>{t('logOut')}؟</h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.2rem' }}>{t('logOutConfirm')}</p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '0.6rem', color: '#1a1a1a', fontWeight: '600', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  {t('cancel')}
                </button>
                <button onClick={confirmLogout}
                  style={{ flex: 1, background: '#d32f2f', border: 'none', borderRadius: '6px', padding: '0.6rem', color: 'white', fontWeight: '700', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  {t('logOut')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & sheets */}
      <BarcodeScanner isOpen={showScanner} onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      <AddProductSheet
        visible={showAddProduct}
        onClose={() => { setShowAddProduct(false); setInitBarcode(''); }}
        onSaved={() => fetchProducts(true)}
        products={products}
        initialBarcode={initBarcode}
      />
      <EditPricesSheet
        visible={showEditPrices}
        onClose={() => setShowEditPrices(false)}
        products={products}
        onUpdated={() => fetchProducts(true)}
      />
      <AddCategorySheet
        visible={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        products={products}
      />
      <ImportSheet
        visible={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => fetchProducts(true)}
      />
      <MoreSheet
        visible={showMore}
        onClose={() => setShowMore(false)}
        currentLang={lang}
        onAction={(action) => {
          setShowMore(false);
          if      (action === 'add')        setShowAddProduct(true);
          else if (action === 'category')   setShowAddCategory(true);
          else if (action === 'editPrices') setShowEditPrices(true);
          else if (action === 'import')     setShowImport(true);
          else if (action === 'lang') {
            const next = lang === 'en' ? 'ar' : 'en';
            setLanguage(next); setLang(next);
          }
          else if (action === 'logout')     setShowLogoutConfirm(true);
        }}
      />
      <BarcodeMakerSheet
        visible={showBarcodeMaker}
        onClose={() => setShowBarcodeMaker(false)}
        products={products}
      />
      <ProductActionSheet
        product={productAction}
        onClose={() => setProductAction(null)}
        onAddToCart={(p) => { addItem(p, 1); setProductAction(null); showScanFeedback('success', `${t('added')}: ${p.name}`); }}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AddProductSheet — full-screen light form matching the screenshot:
//   black header bar with floppy save icon (right), barcode + scan,
//   name, description, 3 selling prices row, cost, qty, reorder
//   threshold, expiry date, tax, category, unit card (+, package,
//   higher package), display-box color, image upload.
// ─────────────────────────────────────────────────────────────
const COLOR_CHOICES = [
  { value: 'yellow', label: 'أصفر',     hex: '#fde047' },
  { value: 'red',    label: 'أحمر',     hex: '#f87171' },
  { value: 'green',  label: 'أخضر',     hex: '#86efac' },
  { value: 'blue',   label: 'أزرق',     hex: '#93c5fd' },
  { value: 'orange', label: 'برتقالي',  hex: '#fdba74' },
  { value: 'gray',   label: 'رمادي',    hex: '#d1d5db' },
];

const TAX_CHOICES = [
  { value: '0',  label: 'معفى' },
  { value: '9',  label: '9 %' },
  { value: '19', label: '19 %' },
];

// Fallback values used until the API responds (or if it fails).
// The server seeds these exact strings into the DB on first run.
const DEFAULT_UNITS            = ['قطعة', 'كغ', 'غ', 'لتر', 'مل', 'قارورة', 'علبة', 'متر'];
const DEFAULT_HIGHER_PACKAGES  = ['علبة', 'كرتون', 'كيس', 'جراب', 'دزينة'];

const APF_FIELD_BORDER = '1.5px solid #90caf9';

const apfLabel = { display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '4px', fontWeight: '600', textAlign: 'right' };
const apfInput = {
  width: '100%', border: APF_FIELD_BORDER, borderRadius: '8px', background: 'white',
  textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.95rem',
  fontFamily: "'Cairo','Tajawal',sans-serif", outline: 'none', color: '#1a1a1a', boxSizing: 'border-box',
};
const apfNumberInput = { ...apfInput, textAlign: 'center', color: '#e91e63', fontWeight: '700' };

// Lightweight dropdown shown as a "---" placeholder when nothing is picked.
function APFDropdown({ value, onChange, options, placeholder = '---' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const display = options.find(o => o.value === value)?.label;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          padding: '0.35rem 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem',
          cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif",
        }}>
        {/* DOM order matters in RTL: span first → right of cluster, chevron second → left of cluster.
            justify-content: flex-end pushes the cluster to the visual LEFT of the row, matching the screenshot. */}
        <span style={{ color: display ? '#1a1a1a' : '#9ca3af', fontSize: '1rem', fontWeight: display ? '600' : '400' }}>{display || placeholder}</span>
        <ChevronRight size={18} color="#9ca3af" style={{ transform: 'rotate(90deg)' }} />
      </button>
      <div style={{ borderBottom: '1px solid #9ca3af' }} />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', insetInlineStart: 0, insetInlineEnd: 0,
          background: 'white', border: '1px solid #cfd8dc', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 20, maxHeight: '220px', overflowY: 'auto',
        }}>
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'right',
                background: opt.value === value ? '#e3f2fd' : 'white', border: 'none',
                borderBottom: '1px solid #f1f5f9', padding: '0.5rem 0.8rem',
                fontSize: '0.92rem', color: '#1a1a1a', cursor: 'pointer',
                fontFamily: "'Cairo','Tajawal',sans-serif",
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Bordered date row used for expiry — label right (white), date button left (grey).
function APFDateRow({ label, value, onChange }) {
  return (
    <div style={{ border: APF_FIELD_BORDER, borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <span style={{ flex: 1, textAlign: 'right', padding: '0.65rem 0.85rem', fontSize: '0.95rem', color: '#1a1a1a', fontWeight: '600' }}>{label}</span>
      <label style={{ background: '#e0e0e0', padding: '0.65rem 0.95rem', cursor: 'pointer', fontSize: '0.95rem', color: '#1a1a1a', position: 'relative', minWidth: '7rem', textAlign: 'center' }}>
        {value || '----'}
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
    </div>
  );
}

// Image upload widget: gallery button on the right, image preview in the middle,
// camera button on the left. Cancel below. DOM order honors the RTL layout
// (first child = visual right).
function APFImageUpload({ value, onChange }) {
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  function readFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
    e.target.value = ''; // allow re-pick of the same file
  }
  const btn = {
    background: '#e0e0e0', border: 'none', borderRadius: '6px',
    padding: '0.55rem 0.85rem', fontSize: '0.88rem', color: '#1a1a1a',
    fontFamily: "'Cairo','Tajawal',sans-serif", cursor: 'pointer', whiteSpace: 'nowrap',
  };
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '0.5rem' }}>
        <button type="button" onClick={() => galleryRef.current?.click()} style={btn}>من الاستديو</button>
        <div style={{ width: '120px', height: '150px', border: '1px solid #d1d5db', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', overflow: 'hidden' }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <ImageIcon size={60} color="#9ca3af" />}
        </div>
        <button type="button" onClick={() => cameraRef.current?.click()} style={btn}>من الكامرا</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
        <button type="button" onClick={() => onChange(null)} style={{ ...btn, padding: '0.5rem 1.5rem' }}>
          إلغاء الصورة
        </button>
      </div>
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={readFile} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*"                         onChange={readFile} style={{ display: 'none' }} />
    </div>
  );
}

function AddProductSheet({ visible, onClose, onSaved, products, initialBarcode = '' }) {
  const api = useApi();
  const EMPTY = {
    name: '', description: '', barcode: '',
    selling_price: '', selling_price2: '', selling_price3: '',
    purchase_price: '',
    quantity: '', min_stock_alert: '',
    expiry_date: '',
    tax_rate: '', category: '',
    unit: '', unit_package: '', higher_package: '',
    box_color: '',
    image_data: null,
  };
  const [form,   setForm]   = useState(EMPTY);
  const [cats,   setCats]   = useState([]);
  const [units,  setUnits]  = useState([]);
  const [higherPackages, setHigherPackages] = useState([]);
  const [showHpManager, setShowHpManager]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({ ...EMPTY, barcode: initialBarcode || '' });
    setError('');

    // Synchronous fallbacks so the dropdowns are never empty while the
    // server requests are in flight.
    const fromDB = [...new Set(products.map(p => p.category).filter(Boolean))];
    setCats(fromDB);
    setUnits(DEFAULT_UNITS);
    setHigherPackages(DEFAULT_HIGHER_PACKAGES);

    api.get('/api/categories').then(data => {
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCats([...new Set([...list.map(c => c.name), ...fromDB])]);
    }).catch(() => {});

    api.get('/api/units').then(data => {
      const list = Array.isArray(data) ? data : (data?.data || []);
      setUnits(list.map(u => u.name));
    }).catch(() => {});

    api.get('/api/higher-packages').then(data => {
      const list = Array.isArray(data) ? data : (data?.data || []);
      setHigherPackages(list.map(h => h.name));
    }).catch(() => {});

    // One-time migration of any leftover localStorage units, then drop the key.
    const legacyUnits = JSON.parse(localStorage.getItem('product_units') || '[]');
    if (legacyUnits.length > 0) {
      api.post('/api/units', { names: legacyUnits })
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.data || []);
          if (list.length > 0) setUnits(list.map(u => u.name));
          localStorage.removeItem('product_units');
        })
        .catch(() => {});
    }
  }, [visible]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddUnit = async () => {
    const name = (window.prompt('اسم الوحدة الجديدة') || '').trim();
    if (!name) return;
    setUnits(prev => [...new Set([...prev, name])]); // optimistic
    set('unit', name);
    try {
      const data = await api.post('/api/units', { name });
      const list = Array.isArray(data) ? data : (data?.data || []);
      if (list.length > 0) setUnits(list.map(u => u.name));
    } catch {}
  };

  // Red play icon now opens a manage sheet (replaces the old help-only popup)
  // so the user can add/delete higher-package values without leaving the form.
  const openHigherPackageManager = () => setShowHpManager(true);

  // Called when the manager sheet closes to refresh the dropdown options.
  const refreshHigherPackages = async () => {
    try {
      const data = await api.get('/api/higher-packages');
      const list = Array.isArray(data) ? data : (data?.data || []);
      setHigherPackages(list.map(h => h.name));
    } catch {}
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('اسم المنتج مطلوب'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/products', {
        name:            form.name.trim(),
        description:     form.description || null,
        barcode:         form.barcode     || null,
        selling_price:   parseInputNumber(form.selling_price),
        selling_price2:  parseInputNumber(form.selling_price2),
        selling_price3:  parseInputNumber(form.selling_price3),
        purchase_price:  parseInputNumber(form.purchase_price),
        quantity:        parseInputNumber(form.quantity),
        min_stock_alert: parseInputNumber(form.min_stock_alert),
        expiry_date:     form.expiry_date || null,
        tax_rate:        parseInputNumber(form.tax_rate),
        category:        form.category || null,
        unit:            form.unit || 'pcs',
        unit_package:    parseInputNumber(form.unit_package),
        higher_package:  form.higher_package || null,
        box_color:       form.box_color || null,
        image_data:      form.image_data || null,
      });
      if (form.category) {
        // Best-effort: register the typed category in the shared list.
        // Server is idempotent (INSERT OR IGNORE), so duplicates are no-ops.
        api.post('/api/categories', { name: form.category }).catch(() => {});
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'تعذّر حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl"
        >
          {/* Black header — save floppy on the right, small close on the left.
              DOM order matters in RTL: first child renders RIGHT, last LEFT. */}
          <div style={{ background: '#000', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={handleSave} disabled={saving}
              style={{
                background: '#cfe9ff', border: 'none', borderRadius: '6px',
                padding: '0.35rem 0.55rem', display: 'flex', alignItems: 'center', gap: '4px',
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
              <span style={{ color: '#0d47a1', fontWeight: '700', fontSize: '0.9rem' }}>حفظ</span>
              <Save size={18} color="#0d47a1" />
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={22} color="rgba(255,255,255,0.55)" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 2rem' }}>
            {/* Barcode + scan button */}
            <div>
              <label style={apfLabel}>رقم المنتج (Barcode)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="text" value={form.barcode} onChange={e => set('barcode', e.target.value)}
                  style={{ ...apfInput, textAlign: 'center', color: '#e91e63', fontWeight: '700', flex: 1 }} />
                <button type="button" onClick={() => setShowScanner(true)}
                  style={{ background: '#e0e0e0', border: 'none', borderRadius: '8px', padding: '0.65rem 1rem', cursor: 'pointer', fontSize: '0.95rem', color: '#1a1a1a', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  قراءة
                </button>
              </div>
            </div>

            {/* Name */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>اسم المنتج</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} style={apfInput} />
            </div>

            {/* Description */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>الوصف</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                style={{ ...apfInput, resize: 'vertical', minHeight: '72px' }} />
            </div>

            {/* 3 selling prices row */}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              {[
                { key: 'selling_price',  label: 'سعر البيع' },
                { key: 'selling_price2', label: 'سعر البيع2' },
                { key: 'selling_price3', label: 'سعر البيع3' },
              ].map(p => (
                <div key={p.key} style={{ flex: 1 }}>
                  <label style={{ ...apfLabel, textAlign: 'center', fontSize: '0.78rem' }}>{p.label}</label>
                  <input type="text" inputMode="decimal" value={form[p.key]} onChange={e => set(p.key, e.target.value)}
                    placeholder="0.0" style={apfNumberInput} />
                </div>
              ))}
            </div>

            {/* Cost */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>سعر الشراء - التكلفة</label>
              <input type="text" inputMode="decimal" value={form.purchase_price}
                onChange={e => set('purchase_price', e.target.value)} placeholder="0.0" style={apfNumberInput} />
            </div>

            {/* Quantity */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>الكمية</label>
              <input type="text" inputMode="decimal" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} placeholder="0" style={apfNumberInput} />
            </div>

            {/* Reorder threshold */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>حد الطلب(التنبية عند وصول المنتج للكمية)</label>
              <input type="text" inputMode="decimal" value={form.min_stock_alert}
                onChange={e => set('min_stock_alert', e.target.value)} placeholder="0" style={apfNumberInput} />
            </div>

            {/* Expiry date */}
            <div style={{ marginTop: '0.75rem' }}>
              <APFDateRow label="تاريخ الانتهاء" value={form.expiry_date} onChange={v => set('expiry_date', v)} />
            </div>

            {/* Tax */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>الضريبة TAX</label>
              <APFDropdown value={form.tax_rate} onChange={v => set('tax_rate', v)} options={TAX_CHOICES} />
            </div>

            {/* Category */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>التصنيف</label>
              <APFDropdown value={form.category} onChange={v => set('category', v)}
                options={cats.map(c => ({ value: c, label: c }))} />
            </div>

            {/* Unit card */}
            <div style={{ marginTop: '0.85rem', border: APF_FIELD_BORDER, borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
              {/* Unit row with + on the LEFT — dropdown first (right) then + (left) */}
              <label style={apfLabel}>الوحده</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <APFDropdown value={form.unit} onChange={v => set('unit', v)}
                    options={units.map(u => ({ value: u, label: u }))} />
                </div>
                <button type="button" onClick={handleAddUnit}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex' }}>
                  <Plus size={24} color="#22c55e" strokeWidth={3} />
                </button>
              </div>

              {/* Unit package */}
              <div style={{ marginTop: '0.85rem' }}>
                <label style={apfLabel}>عبوه الوحده</label>
                <input type="text" inputMode="decimal" value={form.unit_package}
                  onChange={e => set('unit_package', e.target.value)} placeholder="0" style={apfNumberInput} />
              </div>

              {/* Higher package row with red play on the LEFT — dropdown first (right) then red play (left) */}
              <div style={{ marginTop: '0.85rem' }}>
                <label style={apfLabel}>العبوة الاعلى</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <APFDropdown value={form.higher_package} onChange={v => set('higher_package', v)}
                      options={higherPackages.map(h => ({ value: h, label: h }))} />
                  </div>
                  <button type="button" onClick={openHigherPackageManager}
                    style={{ background: '#dc2626', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', display: 'inline-flex' }}>
                    <Play size={16} color="white" fill="white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Display box color */}
            <div style={{ marginTop: '0.85rem' }}>
              <label style={apfLabel}>لون المربع في قائمه العرض</label>
              <APFDropdown value={form.box_color} onChange={v => set('box_color', v)}
                options={COLOR_CHOICES.map(c => ({ value: c.value, label: c.label }))} />
            </div>

            {/* Image */}
            <div style={{ marginTop: '0.85rem' }}>
              <label style={apfLabel}>صوره المنتج اختياري</label>
              <APFImageUpload value={form.image_data} onChange={v => set('image_data', v)} />
            </div>

            {error && <p style={{ color: '#d32f2f', textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          </div>

          <BarcodeScanner
            isOpen={showScanner}
            onScan={(code) => { set('barcode', code); setShowScanner(false); }}
            onClose={() => setShowScanner(false)}
          />
          <ManageLookupSheet
            visible={showHpManager}
            onClose={() => { setShowHpManager(false); refreshHigherPackages(); }}
            title="إدارة العبوة الأعلى"
            placeholder="اكتب اسم عبوة جديدة"
            endpoint="/api/higher-packages"
            icon="📦"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// ManageLookupSheet — generic light bottom sheet that lists a
// name-keyed table (categories / units / higher packages) and lets
// the user add or delete entries via the matching REST endpoint.
// ─────────────────────────────────────────────────────────────
function ManageLookupSheet({ visible, onClose, title, placeholder, endpoint, icon }) {
  const api = useApi();
  const [items,   setItems]   = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get(endpoint);
      setItems(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      setError(err.message || 'تعذّر التحميل');
    } finally {
      setLoading(false);
    }
  }, [api, endpoint]);

  useEffect(() => {
    if (!visible) return;
    setInput(''); setError('');
    refresh();
  }, [visible, refresh]);

  const addOne = async () => {
    const name = input.trim();
    if (!name || saving) return;
    setSaving(true); setError('');
    try {
      const data = await api.post(endpoint, { name });
      setItems(Array.isArray(data) ? data : (data?.data || []));
      setInput('');
    } catch (err) {
      setError(err.message || 'تعذّر الإضافة');
    } finally {
      setSaving(false);
    }
  };

  const removeOne = async (it) => {
    if (!window.confirm(`حذف "${it.name}"؟`)) return;
    setItems(prev => prev.filter(x => x.id !== it.id));
    try {
      await api.delete(`${endpoint}/${it.id}`);
    } catch (err) {
      setError(err.message || 'تعذّر الحذف');
      refresh();
    }
  };

  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 66, background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0', flexShrink: 0 }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>

          <div style={{ position: 'relative', padding: '0.5rem 1rem 0.6rem', flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ position: 'absolute', top: '0.4rem', insetInlineStart: '0.6rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={20} color="#9ca3af" />
            </button>
            <h2 style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>{title}</h2>
            {icon && <span style={{ position: 'absolute', top: '0.35rem', insetInlineEnd: '0.85rem', fontSize: '1.4rem' }}>{icon}</span>}
          </div>

          <div style={{ padding: '0.5rem 1rem 0.85rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOne()}
                placeholder={placeholder}
                style={{
                  flex: 1, border: '1.5px solid #90caf9', borderRadius: '8px', background: 'white',
                  textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.95rem',
                  fontFamily: "'Cairo','Tajawal',sans-serif", outline: 'none', color: '#1a1a1a', boxSizing: 'border-box',
                }} />
              <button onClick={addOne} disabled={!input.trim() || saving}
                style={{
                  background: !input.trim() || saving ? '#cfd8dc' : '#3949AB',
                  color: !input.trim() || saving ? '#546e7a' : 'white',
                  border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem',
                  fontWeight: '700', fontSize: '0.95rem',
                  cursor: !input.trim() || saving ? 'not-allowed' : 'pointer',
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                }}>
                {saving ? '...' : 'إضافة'}
              </button>
            </div>
            {error && <p style={{ color: '#d32f2f', fontSize: '0.85rem', marginTop: '0.6rem', textAlign: 'center' }}>{error}</p>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #f1f5f9', padding: '0.4rem 0 1rem' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem', fontSize: '0.9rem' }}>جارٍ التحميل...</p>
            ) : items.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem', fontSize: '0.9rem' }}>لا توجد عناصر بعد</p>
            ) : (
              items.map(it => (
                <div key={it.id}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 1rem', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontSize: '0.95rem', fontWeight: '500' }}>{it.name}</span>
                  <button onClick={() => removeOne(it)}
                    style={{ background: 'rgba(211,47,47,0.08)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'inline-flex' }}
                    aria-label="حذف">
                    <Trash2 size={16} color="#d32f2f" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// EditPricesSheet
// ─────────────────────────────────────────────────────────────
function EditPricesSheet({ visible, onClose, products, onUpdated }) {
  const api = useApi();
  const [edits,  setEdits]  = useState({});
  const [saving, setSaving] = useState({});
  const [saved,  setSaved]  = useState({});

  useEffect(() => {
    if (!visible) return;
    const init = {};
    products.forEach(p => {
      init[p.id] = { sell: String(p.selling_price ?? ''), buy: String(p.purchase_price ?? '') };
    });
    setEdits(init);
    setSaving({});
    setSaved({});
  }, [visible, products]);

  const setField = (id, field, val) =>
    setEdits(e => ({ ...e, [id]: { ...e[id], [field]: val } }));

  const saveOne = async (p) => {
    const id = p.id;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await api.patch(`/api/products/${id}`, {
        selling_price:  parseInputNumber(edits[id]?.sell),
        purchase_price: parseInputNumber(edits[id]?.buy),
      });
      onUpdated();
      setSaved(s => ({ ...s, [id]: true }));
      setTimeout(() => setSaved(s => { const n = { ...s }; delete n[id]; return n; }), 2000);
    } catch (err) {
      alert(err.message || 'تعذّر الحفظ');
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 56, background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0', flexShrink: 0 }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>

          <div style={{ position: 'relative', padding: '0.5rem 1rem 0.6rem', flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ position: 'absolute', top: '0.4rem', insetInlineStart: '0.6rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={20} color="#9ca3af" />
            </button>
            <h2 style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>
              تعديل أسعار المنتجات
            </h2>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 1rem' }}>
            {products.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem', fontSize: '0.9rem' }}>لا توجد منتجات</p>
            )}
            {products.map(p => (
              <div key={p.id}
                style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem', marginBottom: '0.6rem', background: 'white' }}>
                <p style={{ color: '#1a1a1a', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.55rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: '600' }}>سعر البيع</label>
                    <input type="text" inputMode="decimal"
                      value={edits[p.id]?.sell ?? ''}
                      onChange={e => setField(p.id, 'sell', e.target.value)}
                      style={{
                        width: '100%', marginTop: '4px', border: '1.5px solid #90caf9', borderRadius: '6px',
                        background: 'white', textAlign: 'center', padding: '0.45rem', fontSize: '0.95rem',
                        color: '#e91e63', fontWeight: '700', outline: 'none', boxSizing: 'border-box',
                        fontFamily: "'Cairo','Tajawal',sans-serif",
                      }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: '600' }}>سعر الشراء</label>
                    <input type="text" inputMode="decimal"
                      value={edits[p.id]?.buy ?? ''}
                      onChange={e => setField(p.id, 'buy', e.target.value)}
                      style={{
                        width: '100%', marginTop: '4px', border: '1.5px solid #90caf9', borderRadius: '6px',
                        background: 'white', textAlign: 'center', padding: '0.45rem', fontSize: '0.95rem',
                        color: '#e91e63', fontWeight: '700', outline: 'none', boxSizing: 'border-box',
                        fontFamily: "'Cairo','Tajawal',sans-serif",
                      }} />
                  </div>
                </div>
                <button onClick={() => saveOne(p)} disabled={saving[p.id]}
                  style={{
                    width: '100%', padding: '0.55rem', borderRadius: '6px', border: 'none',
                    fontWeight: '700', fontSize: '0.88rem',
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                    cursor: saving[p.id] ? 'wait' : 'pointer',
                    background: saved[p.id]  ? '#c8e6c9'
                              : saving[p.id] ? '#cfd8dc'
                              : '#3949AB',
                    color:      saved[p.id]  ? '#1b5e20'
                              : saving[p.id] ? '#546e7a'
                              : 'white',
                  }}>
                  {saved[p.id] ? '✓ تم الحفظ' : saving[p.id] ? '...' : 'حفظ'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// AddCategorySheet — light bottom sheet, backed by /api/categories.
// Migrates any leftover localStorage entries on first open (one-time)
// so users coming from the old build don't lose their list.
// ─────────────────────────────────────────────────────────────
function AddCategorySheet({ visible, onClose, products }) {
  const api = useApi();
  const [cats,    setCats]    = useState([]); // [{id, name}]
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get('/api/categories');
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCats(list);
      return list;
    } catch (err) {
      setError(err.message || 'تعذّر تحميل التصنيفات');
      return [];
    } finally {
      setLoading(false);
    }
  }, [api]);

  // One-time migration: push any localStorage names + any unique product.category
  // values up to the server so the new DB-backed list starts populated.
  useEffect(() => {
    if (!visible) return;
    setInput(''); setError('');
    (async () => {
      const list = await refresh();
      const known = new Set(list.map(c => c.name));
      const fromLS = JSON.parse(localStorage.getItem('product_categories') || '[]');
      const fromDB = (products || []).map(p => p.category).filter(Boolean);
      const newOnes = [...new Set([...fromLS, ...fromDB])].filter(n => n && !known.has(n));
      if (newOnes.length > 0) {
        try {
          const seeded = await api.post('/api/categories', { names: newOnes });
          if (seeded?.data || Array.isArray(seeded)) {
            setCats(Array.isArray(seeded) ? seeded : seeded.data);
          }
          localStorage.removeItem('product_categories');
        } catch {}
      }
    })();
  }, [visible, refresh, products, api]);

  const addCat = async () => {
    const name = input.trim();
    if (!name || saving) return;
    setSaving(true); setError('');
    try {
      const data = await api.post('/api/categories', { name });
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCats(list);
      setInput('');
    } catch (err) {
      setError(err.message || 'تعذّر الإضافة');
    } finally {
      setSaving(false);
    }
  };

  const removeCat = async (cat) => {
    if (!window.confirm(`حذف "${cat.name}"؟`)) return;
    setCats(prev => prev.filter(c => c.id !== cat.id)); // optimistic
    try {
      await api.delete(`/api/categories/${cat.id}`);
    } catch (err) {
      setError(err.message || 'تعذّر الحذف');
      refresh(); // roll back to server truth
    }
  };

  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 56, background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0', flexShrink: 0 }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>

          {/* Header */}
          <div style={{ position: 'relative', padding: '0.5rem 1rem 0.6rem', flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ position: 'absolute', top: '0.4rem', insetInlineStart: '0.6rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={20} color="#9ca3af" />
            </button>
            <h2 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>
              اضافة تصنيف جديد
            </h2>
            <span style={{ position: 'absolute', top: '0.35rem', insetInlineEnd: '0.85rem', fontSize: '1.4rem' }}>🏷️</span>
          </div>

          {/* Add input + button */}
          <div style={{ padding: '0.5rem 1rem 0.85rem', flexShrink: 0 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: '600' }}>
              اسم التصنيف
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCat()}
                placeholder="اكتب اسم التصنيف الجديد"
                style={{
                  flex: 1, border: '1.5px solid #90caf9', borderRadius: '8px', background: 'white',
                  textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.95rem',
                  fontFamily: "'Cairo','Tajawal',sans-serif", outline: 'none', color: '#1a1a1a', boxSizing: 'border-box',
                }} />
              <button onClick={addCat} disabled={!input.trim() || saving}
                style={{
                  background: !input.trim() || saving ? '#cfd8dc' : '#3949AB',
                  color: !input.trim() || saving ? '#546e7a' : 'white',
                  border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem',
                  fontWeight: '700', fontSize: '0.95rem',
                  cursor: !input.trim() || saving ? 'not-allowed' : 'pointer',
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                }}>
                {saving ? '...' : 'إضافة'}
              </button>
            </div>
            {error && <p style={{ color: '#d32f2f', fontSize: '0.85rem', marginTop: '0.6rem', textAlign: 'center' }}>{error}</p>}
          </div>

          {/* Categories list */}
          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #f1f5f9', padding: '0.4rem 0 1rem' }}>
            <div style={{ padding: '0.5rem 1rem 0.4rem', color: '#6b7280', fontSize: '0.8rem', fontWeight: '600' }}>
              التصنيفات الحالية ({cats.length})
            </div>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem', fontSize: '0.9rem' }}>جارٍ التحميل...</p>
            ) : cats.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem', fontSize: '0.9rem' }}>لا توجد تصنيفات بعد</p>
            ) : (
              cats.map(c => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 1rem', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontSize: '0.95rem', fontWeight: '500' }}>{c.name}</span>
                  <button onClick={() => removeCat(c)}
                    style={{ background: 'rgba(211,47,47,0.08)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'inline-flex' }}
                    aria-label="حذف">
                    <Trash2 size={16} color="#d32f2f" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// ImportSheet — light full-screen page matching the screenshot:
//   centered helper title, file picker row (input + بحث button),
//   two-step red instructions with stylized save-as illustration
//   and a sample-data Excel-style table, footer with help and
//   mint استيراد buttons. Parses .xls / .xlsx / .csv via SheetJS.
// ─────────────────────────────────────────────────────────────
function ImportSheet({ visible, onClose, onImported }) {
  const api = useApi();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows,     setRows]     = useState([]);
  const [importing, setImporting] = useState(false);
  const [done,     setDone]     = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!visible) { setFileName(''); setRows([]); setDone(null); setError(''); }
  }, [visible]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(''); setDone(null);
    try {
      const XLSX = await import('xlsx'); // keeps parser out of initial bundle
      const buf = await f.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const cleaned = parsed.filter(r => {
        const name = String(r['اسم المنتج'] || r['name'] || '').trim();
        return name.length > 0;
      });
      if (cleaned.length === 0) {
        setError('لم يتم العثور على منتجات صالحة في الملف');
        return;
      }
      setFileName(f.name);
      setRows(cleaned);
    } catch {
      setError('تعذّر قراءة الملف. تأكد من الصيغة (xls / xlsx).');
    }
  };

  const doImport = async () => {
    if (rows.length === 0 || importing) return;
    setImporting(true); setError('');
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        await api.post('/api/products', {
          name:           String(row['اسم المنتج']  || row['name']           || '').trim(),
          barcode:        String(row['رقم المنتج']  || row['barcode']        || '').trim() || null,
          selling_price:  parseInputNumber(row['سعر البيع']   || row['selling_price']),
          purchase_price: parseInputNumber(row['سعر الشراء']  || row['purchase_price']),
          quantity:       parseInputNumber(row['الكمية']      || row['quantity']),
          category:       row['التصنيف'] || row['category'] || null,
          unit:           row['الوحدة']  || row['unit']     || 'pcs',
          description:    row['الوصف']   || row['description'] || null,
        });
        ok++;
      } catch { fail++; }
    }
    setImporting(false);
    setDone({ ok, fail });
    onImported();
  };

  const openHelpVideo = () => {
    // Placeholder — wire to a real YouTube tutorial URL later.
    window.alert('سيتم إضافة فيديو شرح قريباً.');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">

          {/* Subtle dismiss — screenshot has no close button, this stays low-contrast */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.3rem 0.6rem', flexShrink: 0 }}>
            <button onClick={!importing ? onClose : undefined} disabled={importing}
              style={{ background: 'transparent', border: 'none', cursor: importing ? 'wait' : 'pointer', padding: '4px', opacity: importing ? 0.4 : 0.55 }}
              aria-label="إغلاق">
              <X size={20} color="#1a1a1a" />
            </button>
          </div>

          {/* Centered helper title */}
          <div style={{ padding: '0 1rem 0.75rem', flexShrink: 0 }}>
            <h1 style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: '700', color: '#1a1a1a', margin: 0, lineHeight: 1.55 }}>
              ستمكنك هذه الشاشة من نقل بيانات المنتجات من ملف اكسل الى قاعدة البيانات
            </h1>
          </div>

          {/* File picker row — input on right, بحث button on left (DOM order honors RTL) */}
          <div style={{ padding: '0 1rem 0.85rem', flexShrink: 0, display: 'flex', gap: '0.5rem' }}>
            <input readOnly value={fileName}
              placeholder="ابحث عن الملف المراد معالجته"
              onClick={() => fileRef.current?.click()}
              style={{
                flex: 1, border: '1.5px solid #90caf9', borderRadius: '6px', background: 'white',
                textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.95rem',
                fontFamily: "'Cairo','Tajawal',sans-serif", outline: 'none', color: '#1a1a1a',
                boxSizing: 'border-box', cursor: 'pointer',
              }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ background: '#dadada', border: 'none', borderRadius: '4px', padding: '0.55rem 1.5rem', fontSize: '0.95rem', color: '#1a1a1a', fontFamily: "'Cairo','Tajawal',sans-serif", cursor: 'pointer', flexShrink: 0 }}>
              بحث
            </button>
            <input ref={fileRef} type="file"
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={handleFile} />
          </div>

          {/* Scrollable instructions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 1rem 1rem' }}>
            <p style={{ color: '#d32f2f', fontWeight: '700', fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
              قبل البدء يحب اتباع التالي:
            </p>

            <p style={{ color: '#1a1a1a', fontSize: '0.9rem', margin: '0.4rem 0 0.5rem' }}>
              1- يجب حفظ ملف الاكسل بالصيغة التالية
            </p>

            {/* Stylized save-as callout (replaces the screenshot screenshot) */}
            <div style={{ border: '1px solid #cfd8dc', borderRadius: '6px', background: '#f8fafc', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ background: 'white', border: '2px solid #ff7043', borderRadius: '3px', padding: '0.35rem 0.6rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#1a1a1a', fontWeight: '600' }}>
                  Excel 97-2003 Workbook (*.xls)
                </span>
                <span style={{ color: '#ff7043', fontSize: '1.3rem', lineHeight: 1 }}>⇐</span>
                <span style={{ color: '#d32f2f', fontWeight: '700', fontSize: '0.9rem' }}>بالصيغة التالية</span>
              </div>
            </div>

            <p style={{ color: '#1a1a1a', fontSize: '0.9rem', margin: '0.4rem 0 0.5rem' }}>
              2- يجب ان يكون شكل الملف مشابة للشكل التالي
            </p>

            {/* Sample data table (Excel-look). DOM column order is E,D,C,B,A so that
                in dir="rtl" the visual order reads A | B | C | D | E from right to left. */}
            <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#e0e7ef' }}>
                    {['E', 'D', 'C', 'B', 'A'].map(L => (
                      <th key={L} style={{ border: '1px solid #c0c0c0', padding: '0.25rem', color: '#1a1a1a', fontWeight: '600', fontSize: '0.8rem' }}>{L}</th>
                    ))}
                  </tr>
                  <tr style={{ background: 'white' }}>
                    <th style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', color: '#1a1a1a', fontWeight: '600' }}>الكمية</th>
                    <th style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', color: '#1a1a1a', fontWeight: '600' }}>سعر الشراء</th>
                    <th style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', color: '#1a1a1a', fontWeight: '600' }}>سعر البيع</th>
                    <th style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', color: '#1a1a1a', fontWeight: '600' }}>اسم المنتج</th>
                    <th style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', color: '#1a1a1a', fontWeight: '600', background: '#fff3c4' }}>رقم المنتج</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { a: '232132113', b: 'ماء',    c: '10', d: '8',  e: '100' },
                    { a: '432432432', b: 'عصير',   c: '20', d: '18', e: '100' },
                    { a: '434343434', b: 'كيك',    c: '30', d: '29', e: '50'  },
                    { a: '545454335', b: 'بيبسي',  c: '40', d: '30', e: '100' },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', textAlign: 'center', color: '#1a1a1a' }}>{r.e}</td>
                      <td style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', textAlign: 'center', color: '#1a1a1a' }}>{r.d}</td>
                      <td style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', textAlign: 'center', color: '#1a1a1a' }}>{r.c}</td>
                      <td style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', textAlign: 'center', color: '#1a1a1a' }}>{r.b}</td>
                      <td style={{ border: '1px solid #c0c0c0', padding: '0.45rem 0.3rem', textAlign: 'center', color: '#1a1a1a' }}>{r.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fileName && !done && (
              <p style={{ color: '#2e7d32', fontSize: '0.88rem', textAlign: 'center', margin: '0.6rem 0', fontWeight: '600' }}>
                ✓ تم اختيار: {fileName} ({rows.length} منتج)
              </p>
            )}
            {error && <p style={{ color: '#d32f2f', fontSize: '0.88rem', textAlign: 'center', margin: '0.6rem 0', fontWeight: '600' }}>{error}</p>}
            {done && (
              <p style={{ color: done.fail > 0 ? '#f59e0b' : '#2e7d32', fontSize: '0.9rem', textAlign: 'center', margin: '0.6rem 0', fontWeight: '700' }}>
                اكتمل الاستيراد — نجح: {done.ok}{done.fail > 0 ? `، فشل: ${done.fail}` : ''}
              </p>
            )}
          </div>

          {/* Footer: استيراد on the right (first child in RTL), help on the left */}
          <div style={{ padding: '0.6rem 1rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <button onClick={doImport} disabled={importing || rows.length === 0}
              style={{
                flex: 1,
                background: rows.length === 0 || importing ? '#cfd8dc' : '#c8e6c9',
                color: rows.length === 0 || importing ? '#546e7a' : '#1a1a1a',
                border: 'none', borderRadius: '6px', padding: '0.85rem',
                fontSize: '1rem', fontWeight: '700',
                cursor: rows.length === 0 || importing ? 'not-allowed' : 'pointer',
                fontFamily: "'Cairo','Tajawal',sans-serif",
              }}>
              {importing ? 'جارٍ الاستيراد...' : 'استيراد'}
            </button>
            <button type="button" onClick={openHelpVideo} aria-label="فيديو شرح"
              style={{ background: '#dadada', border: 'none', borderRadius: '8px', padding: '0.5rem 0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <Play size={18} color="#d32f2f" fill="#d32f2f" />
              <span style={{ background: 'white', border: '1px solid #9e9e9e', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontSize: '0.9rem', fontWeight: '700' }}>؟</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// MoreSheet — bottom sheet surfacing the management actions that
// used to live in the dark header user-menu (add/category/prices/
// import, language toggle, logout).
// ─────────────────────────────────────────────────────────────
function MoreSheet({ visible, onClose, onAction, currentLang }) {
  const items = [
    { key: 'add',        label: 'اضافة منتج جديد',           icon: PlusCircle,      color: '#2E7D32' },
    { key: 'category',   label: 'اضافة تصنيف جديد',          icon: Tag,             color: '#2E7D32' },
    { key: 'editPrices', label: 'تعديل اسعار المنتجات',       icon: ArrowLeftRight,  color: '#E65100' },
    { key: 'import',     label: 'استيراد منتجات من اكسل',     icon: FileSpreadsheet, color: '#1565C0' },
    { key: 'lang',       label: currentLang === 'en' ? 'العربية' : 'English', icon: Globe, color: '#3949AB' },
    { key: 'logout',     label: 'تسجيل الخروج',              icon: LogOut,          color: '#d32f2f' },
  ];
  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 56, background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '80vh', overflowY: 'auto', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>
          <h3 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.5rem' }}>المزيد</h3>
          <div>
            {items.map(it => {
              const Icon = it.icon;
              return (
                <button key={it.key} onClick={() => onAction(it.key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', borderTop: '1px solid #f1f5f9', padding: '0.95rem 1rem', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  <Icon size={20} color={it.color} />
                  <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontSize: '0.95rem', fontWeight: '600' }}>{it.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// BarcodeMakerSheet — pick a product and display its barcode value
// in large text. Real barcode-image rendering is a v2; for now this
// makes "صناعه الباركود" a meaningful action instead of a dead button.
// ─────────────────────────────────────────────────────────────
function BarcodeMakerSheet({ visible, onClose, products }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => { if (!visible) setPicked(null); }, [visible]);
  const withBarcode = products.filter(p => p.barcode);
  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 56, background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '85vh', overflowY: 'auto', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>
          <h3 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.5rem' }}>صناعه الباركود</h3>

          {picked ? (
            <div style={{ padding: '1rem 1rem 2rem' }}>
              <p style={{ textAlign: 'center', color: '#1a1a1a', fontWeight: '700', fontSize: '1rem', margin: '0 0 0.75rem' }}>{picked.name}</p>
              <div style={{ border: '1.5px solid #90caf9', borderRadius: '8px', padding: '1.5rem 1rem', textAlign: 'center', background: 'white' }}>
                <div style={{ fontFamily: 'monospace', letterSpacing: '0.15rem', fontSize: '1.4rem', color: '#1a1a1a', fontWeight: '700' }}>{picked.barcode}</div>
                <div style={{ marginTop: '0.5rem', color: '#9ca3af', fontSize: '0.78rem' }}>قيمة الباركود</div>
              </div>
              <button onClick={() => setPicked(null)}
                style={{ marginTop: '1rem', width: '100%', background: '#3949AB', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem', fontWeight: '700', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                اختيار منتج آخر
              </button>
            </div>
          ) : withBarcode.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 1rem', fontSize: '0.9rem' }}>لا توجد منتجات تحتوي على باركود</p>
          ) : (
            <div>
              {withBarcode.map(p => (
                <button key={p.id} onClick={() => setPicked(p)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', borderTop: '1px solid #f1f5f9', padding: '0.85rem 1rem', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.85rem', fontFamily: 'monospace' }}>{p.barcode}</span>
                  <span style={{ color: '#1a1a1a', fontSize: '0.95rem', fontWeight: '600' }}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// ProductActionSheet — opened when a product row is tapped.
// Wires the yellow footer hint ("اضغط على المنتج لمزيد من الخيارات").
// ─────────────────────────────────────────────────────────────
function ProductActionSheet({ product, onClose, onAddToCart, onDelete }) {
  return (
    <AnimatePresence>
      {product && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.35)' }}
          onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 290 }}
          style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 56, background: 'white', borderRadius: '16px 16px 0 0', overflow: 'hidden', fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '4px' }} />
          </div>
          <h3 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.5rem', padding: '0 1rem' }}>
            {product.name}
          </h3>
          <button onClick={() => onAddToCart(product)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', borderTop: '1px solid #f1f5f9', padding: '0.95rem 1rem', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
            <ShoppingCart size={20} color="#3949AB" />
            <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontSize: '0.95rem', fontWeight: '600' }}>اضافة الى السلة</span>
          </button>
          <button onClick={() => onDelete(product)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', borderTop: '1px solid #f1f5f9', padding: '0.95rem 1rem', cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
            <Trash2 size={20} color="#d32f2f" />
            <span style={{ flex: 1, textAlign: 'right', color: '#d32f2f', fontSize: '0.95rem', fontWeight: '600' }}>حذف</span>
          </button>
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </motion.div>
      </>}
    </AnimatePresence>
  );
}
