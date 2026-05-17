import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, ScanBarcode, LogOut, ChevronRight, Upload, Save, Plus, Play, Image as ImageIcon, Trash2, Tag, FileSpreadsheet, ArrowLeftRight, PlusCircle, Globe } from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi.jsx';
import { useCart } from '../hooks/useCart.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { t, getLanguage, setLanguage } from '../utils/i18n.js';

export default function ProductsList() {
  const api = useApi();
  const { addItem } = useCart();
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
    if (act === 'add')            setShowAddProduct(true);
    else if (act === 'edit-prices')  setShowEditPrices(true);
    else if (act === 'add-category') setShowAddCategory(true);
    else if (act === 'import')       setShowImport(true);
  }, []);

  const filtered = products.filter(p => {
    if (!query) return true;
    return (p.name || '').toLowerCase().includes(query.toLowerCase());
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
                <div style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>{formatCurrency(p.selling_price)}</div>
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
        onClose={() => setShowAddProduct(false)}
        onSaved={() => fetchProducts(true)}
        products={products}
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

const HIGHER_PACKAGE_CHOICES = ['علبة', 'كرتون', 'كيس', 'جراب', 'دزينة'];
const DEFAULT_UNITS         = ['قطعة', 'كغ', 'غ', 'لتر', 'علبة', 'متر'];

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
          padding: '0.35rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: "'Cairo','Tajawal',sans-serif",
        }}>
        <ChevronRight size={18} color="#9ca3af" style={{ transform: 'rotate(90deg)' }} />
        <span style={{ color: display ? '#1a1a1a' : '#9ca3af', fontSize: '1rem', fontWeight: display ? '600' : '400' }}>{display || placeholder}</span>
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

function AddProductSheet({ visible, onClose, onSaved, products }) {
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
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(EMPTY);
    setError('');
    // Categories come from the API now; fall back to product.category values
    // while the request is in flight so the dropdown is never empty.
    const fromDB = [...new Set(products.map(p => p.category).filter(Boolean))];
    setCats(fromDB);
    api.get('/api/categories')
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        const names = list.map(c => c.name);
        setCats([...new Set([...names, ...fromDB])]);
      })
      .catch(() => {});
    const customUnits = JSON.parse(localStorage.getItem('product_units') || '[]');
    setUnits([...new Set([...DEFAULT_UNITS, ...customUnits])]);
  }, [visible]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddUnit = () => {
    const name = (window.prompt('اسم الوحدة الجديدة') || '').trim();
    if (!name) return;
    const next = [...new Set([...units, name])];
    setUnits(next);
    const customUnits = JSON.parse(localStorage.getItem('product_units') || '[]');
    if (!customUnits.includes(name)) {
      localStorage.setItem('product_units', JSON.stringify([...customUnits, name]));
    }
    set('unit', name);
  };

  const handleHigherPackageHelp = () => {
    // Custom action for the red play icon — opens an inline help popup.
    window.alert('العبوة الأعلى\n\nاختر العبوة الأكبر التي تحتوي على هذا المنتج\n(مثال: كرتون يحتوي 12 علبة).');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('اسم المنتج مطلوب'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/products', {
        name:            form.name.trim(),
        description:     form.description || null,
        barcode:         form.barcode     || null,
        selling_price:   parseFloat(form.selling_price)  || 0,
        selling_price2:  parseFloat(form.selling_price2) || 0,
        selling_price3:  parseFloat(form.selling_price3) || 0,
        purchase_price:  parseFloat(form.purchase_price) || 0,
        quantity:        parseFloat(form.quantity)        || 0,
        min_stock_alert: parseFloat(form.min_stock_alert) || 0,
        expiry_date:     form.expiry_date || null,
        tax_rate:        parseFloat(form.tax_rate) || 0,
        category:        form.category || null,
        unit:            form.unit || 'pcs',
        unit_package:    parseFloat(form.unit_package) || 0,
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
                  <input type="number" inputMode="decimal" value={form[p.key]} onChange={e => set(p.key, e.target.value)}
                    placeholder="0.0" style={apfNumberInput} />
                </div>
              ))}
            </div>

            {/* Cost */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>سعر الشراء - التكلفة</label>
              <input type="number" inputMode="decimal" value={form.purchase_price}
                onChange={e => set('purchase_price', e.target.value)} placeholder="0.0" style={apfNumberInput} />
            </div>

            {/* Quantity */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>الكمية</label>
              <input type="number" inputMode="decimal" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} placeholder="0" style={apfNumberInput} />
            </div>

            {/* Reorder threshold */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={apfLabel}>حد الطلب(التنبية عند وصول المنتج للكمية)</label>
              <input type="number" inputMode="decimal" value={form.min_stock_alert}
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
                <input type="number" inputMode="decimal" value={form.unit_package}
                  onChange={e => set('unit_package', e.target.value)} placeholder="0" style={apfNumberInput} />
              </div>

              {/* Higher package row with red play on the LEFT — dropdown first (right) then red play (left) */}
              <div style={{ marginTop: '0.85rem' }}>
                <label style={apfLabel}>العبوة الاعلى</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <APFDropdown value={form.higher_package} onChange={v => set('higher_package', v)}
                      options={HIGHER_PACKAGE_CHOICES.map(h => ({ value: h, label: h }))} />
                  </div>
                  <button type="button" onClick={handleHigherPackageHelp}
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
        </motion.div>
      )}
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
        selling_price:  parseFloat(edits[id]?.sell) || 0,
        purchase_price: parseFloat(edits[id]?.buy)  || 0,
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
          className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl flex flex-col"
          style={{ background: '#0d1120', maxHeight: '92vh' }}
          dir="rtl"
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white">تعديل أسعار المنتجات</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X size={16} color="white" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
            {products.length === 0 && (
              <p className="text-center py-10 text-sm" style={{ color: '#4a5568' }}>لا توجد منتجات</p>
            )}
            {products.map(p => (
              <div key={p.id} className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-semibold text-white mb-2 truncate">{p.name}</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[11px]" style={{ color: '#6b7280' }}>سعر البيع</label>
                    <input type="number" inputMode="decimal"
                      value={edits[p.id]?.sell ?? ''}
                      onChange={e => setField(p.id, 'sell', e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-2 rounded-lg outline-none text-white text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: '#6b7280' }}>سعر الشراء</label>
                    <input type="number" inputMode="decimal"
                      value={edits[p.id]?.buy ?? ''}
                      onChange={e => setField(p.id, 'buy', e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-2 rounded-lg outline-none text-white text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>
                </div>
                <button onClick={() => saveOne(p)} disabled={saving[p.id]}
                  className="w-full py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: saved[p.id]  ? 'rgba(16,185,129,0.12)'
                              : saving[p.id] ? 'rgba(255,255,255,0.03)'
                              : 'rgba(57,73,171,0.2)',
                    border: saved[p.id]  ? '1px solid rgba(16,185,129,0.3)'
                          : saving[p.id] ? '1px solid rgba(255,255,255,0.07)'
                          : '1px solid rgba(57,73,171,0.3)',
                    color: saved[p.id]  ? '#34d399'
                         : saving[p.id] ? '#4a5568'
                         : '#818cf8',
                  }}>
                  {saved[p.id] ? '✓ تم الحفظ' : saving[p.id] ? '...' : 'حفظ'}
                </button>
              </div>
            ))}
          </div>
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
// ImportSheet  (CSV import)
// ─────────────────────────────────────────────────────────────
function ImportSheet({ visible, onClose, onImported }) {
  const api = useApi();
  const fileRef = useRef(null);
  const [rows,      setRows]      = useState([]);
  const [importing, setImporting] = useState(false);
  const [done,      setDone]      = useState(null);

  useEffect(() => {
    if (!visible) { setRows([]); setDone(null); }
  }, [visible]);

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
      return row;
    }).filter(r => (r['name'] || r['اسم المنتج'] || '').trim());
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRows(parseCSV(ev.target.result));
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const doImport = async () => {
    setImporting(true);
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        await api.post('/api/products', {
          name:            (row['name'] || row['اسم المنتج'] || '').trim(),
          description:     row['description']    || row['الوصف']        || null,
          selling_price:   parseFloat(row['selling_price']  || row['سعر البيع'])   || 0,
          purchase_price:  parseFloat(row['purchase_price'] || row['سعر الشراء'])  || 0,
          unit:            row['unit']            || row['الوحدة']       || 'pcs',
          barcode:         row['barcode']         || row['الباركود']     || null,
          category:        row['category']        || row['التصنيف']      || null,
          quantity:        parseFloat(row['quantity'] || row['الكمية'])  || 0,
        });
        ok++;
      } catch { fail++; }
    }
    setDone({ ok, fail });
    setImporting(false);
    onImported();
  };

  const COLS = ['name', 'selling_price', 'purchase_price', 'unit', 'category'];

  return (
    <AnimatePresence>
      {visible && <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={!importing ? onClose : undefined} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl flex flex-col"
          style={{ background: '#0d1120', maxHeight: '92vh' }}
          dir="rtl"
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white">استيراد المنتجات (CSV)</h2>
            <button onClick={onClose} disabled={importing}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X size={16} color="white" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4">
            {done ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <span className="text-3xl">✅</span>
                </div>
                <p className="text-base font-bold text-white">اكتمل الاستيراد</p>
                <p className="text-sm" style={{ color: '#10b981' }}>تم استيراد: {done.ok} منتج</p>
                {done.fail > 0 && (
                  <p className="text-sm" style={{ color: '#f87171' }}>فشل: {done.fail} منتج</p>
                )}
                <button onClick={onClose}
                  className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(57,73,171,0.2)', border: '1px solid rgba(57,73,171,0.3)', color: '#818cf8' }}>
                  إغلاق
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-xl p-4 mb-4"
                  style={{ background: 'rgba(57,73,171,0.07)', border: '1px solid rgba(57,73,171,0.15)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#818cf8' }}>تنسيق CSV المطلوب:</p>
                  <p className="text-[11px] leading-relaxed font-mono" style={{ color: '#6b7280' }}>
                    name, selling_price, purchase_price, unit, barcode, category, description, quantity
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#4a5568' }}>
                    يدعم الأسماء العربية: اسم المنتج، سعر البيع، سعر الشراء، الوحدة، الباركود، التصنيف
                  </p>
                </div>

                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 mb-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '2px dashed rgba(255,255,255,0.12)', color: '#9ca3af' }}>
                  <Upload size={20} />
                  <span className="text-sm font-semibold">اختر ملف CSV</span>
                </button>

                {rows.length > 0 && (
                  <>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>
                      معاينة — {rows.length} منتج
                    </p>
                    <div className="rounded-xl overflow-hidden mb-4"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                              {COLS.map(c => (
                                <th key={c} className="px-3 py-2 text-right font-semibold whitespace-nowrap"
                                  style={{ color: '#6b7280' }}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                {COLS.map(c => (
                                  <td key={c} className="px-3 py-2 text-white"
                                    style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r[c] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {rows.length > 5 && (
                              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td colSpan={5} className="px-3 py-2 text-center"
                                  style={{ color: '#4a5568' }}>
                                  +{rows.length - 5} منتج آخر
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {!done && rows.length > 0 && (
            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={doImport} disabled={importing}
                className="w-full py-3.5 rounded-2xl font-bold text-sm"
                style={{
                  background: importing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#3949AB,#5C6BC0)',
                  color: importing ? '#4a5568' : 'white',
                  border: importing ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}>
                {importing ? 'جارٍ الاستيراد...' : `استيراد ${rows.length} منتج`}
              </button>
            </div>
          )}
        </motion.div>
      </>}
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
