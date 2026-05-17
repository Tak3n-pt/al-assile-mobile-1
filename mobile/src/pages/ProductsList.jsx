import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ShoppingCart, RefreshCw, Package, ScanBarcode, LogOut, ChevronRight, ArrowRight, Upload, Save, Plus, Play, Image as ImageIcon, Camera } from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi.jsx';
import { useCart } from '../hooks/useCart.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import ProductCard from '../components/ProductCard.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { t, getLanguage, setLanguage } from '../utils/i18n.js';

export default function ProductsList() {
  const api = useApi();
  const { addItem, isInCart, getItemCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanNotification, setScanNotification] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lang, setLang] = useState(getLanguage());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [debtors, setDebtors] = useState([]);
  const [showAddProduct,  setShowAddProduct]  = useState(false);
  const [showEditPrices,  setShowEditPrices]  = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showImport,      setShowImport]      = useState(false);
  const userMenuRef = useRef(null);

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const data = await api.get('/api/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('failedToLoadProducts'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    api.get('/api/clients')
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setDebtors(list.filter(c => (c.balance || 0) < 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const act = location.state?.action;
    if (act === 'add')            setShowAddProduct(true);
    else if (act === 'edit-prices')  setShowEditPrices(true);
    else if (act === 'add-category') setShowAddCategory(true);
    else if (act === 'import')       setShowImport(true);
  }, []);

  const filtered = products.filter(p => {
    if (filter === 'favorites' && !p.is_favorite) return false;
    if (!query) return true;
    return (p.name || '').toLowerCase().includes(query.toLowerCase());
  });

  const cartCount = getItemCount();

  const handleAddToCart = (product) => {
    addItem(product, 1);
  };

  const showScanFeedback = (type, message) => {
    setScanNotification({ type, message });
    setTimeout(() => setScanNotification(null), 3000);
  };

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showUserMenu]);

  const handleLogout = () => {
    setShowUserMenu(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
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

  return (
    <div className="h-full flex flex-col" style={{ background: '#080c14' }}>
      {/* Back header */}
      <div
        className="flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
        }}
      >
        <button
          onClick={() => navigate('/products')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowRight size={20} color="white" />
        </button>
        <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
          المنتجات
        </span>

        {/* Right-side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* User avatar */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm"
              style={{
                background: showUserMenu ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
              }}
            >
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 rounded-2xl overflow-hidden"
                  style={{
                    background: '#0d1120',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minWidth: '180px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-sm font-semibold text-white truncate">
                      {user?.username || t('defaultUserLabel')}
                    </p>
                    <p className="text-xs mt-0.5 truncate capitalize" style={{ color: '#4a5568' }}>
                      {user?.role || t('salesperson')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = lang === 'en' ? 'ar' : 'en';
                      setLanguage(next);
                      setLang(next);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                    style={{ color: '#D4A574', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span className="text-base">{lang === 'en' ? '🇩🇿' : '🇬🇧'}</span>
                    {lang === 'en' ? 'العربية' : 'English'}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                    style={{ color: '#f87171' }}
                  >
                    <LogOut size={16} />
                    {t('logOut')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowScanner(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <ScanBarcode size={18} color="white" />
          </button>

          <button
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) setQuery(''); }}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: searchOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {searchOpen ? <X size={18} color="white" /> : <Search size={18} color="white" />}
          </button>

          <button
            onClick={() => fetchProducts(true)}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <RefreshCw size={17} color="white" className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ background: '#080c14', flexShrink: 0 }}>
        {/* Debt reminder */}
        {debtors.length > 0 && (() => {
          const isRTL = lang === 'ar';
          const totalOwed = debtors.reduce((sum, d) => sum + Math.max(0, -(d.balance || 0)), 0);
          const topDebtor = [...debtors].sort((a, b) => (a.balance || 0) - (b.balance || 0))[0];
          const topOwed = Math.max(0, -(topDebtor.balance || 0));
          return (
            <motion.button
              type="button"
              onClick={() => navigate('/clients')}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="mx-4 mt-3 w-[calc(100%-2rem)] overflow-hidden rounded-2xl touch-manipulation text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(239,68,68,0.10))',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.2)' }}
                >
                  <span className="text-xl">💰</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#d97706' }}>
                    {t('debtsToCollect')}
                  </p>
                  <p className="text-xl font-bold" style={{ color: '#fbbf24' }} dir="ltr">
                    {formatCurrency(totalOwed)}
                  </p>
                </div>
                <ChevronRight size={18} style={{ color: '#fbbf24', transform: isRTL ? 'scaleX(-1)' : 'none' }} />
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 border-t"
                style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(0,0,0,0.15)' }}
              >
                <span className="text-xs" style={{ color: '#a16207' }}>
                  {debtors.length === 1 ? `${t('clientOwesLabel')}:` : `${t('biggestDebtor')}:`}
                </span>
                <span className="text-xs font-semibold truncate flex-1" style={{ color: '#fbbf24' }}>
                  {topDebtor.name}
                </span>
                <span className="text-xs font-bold" style={{ color: '#f87171' }} dir="ltr">
                  {formatCurrency(topOwed)}
                </span>
                {debtors.length > 1 && (
                  <span className="text-[10px]" style={{ color: '#a16207' }}>+{debtors.length - 1}</span>
                )}
              </div>
            </motion.button>
          );
        })()}

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden px-4 pt-3 pb-2"
            >
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4a5568' }} />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('searchProducts')}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '16px',
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter pills */}
        <div className="flex gap-2 px-4 py-3">
          {['all', 'favorites'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filter === f ? 'rgba(212,165,116,0.15)' : 'rgba(255,255,255,0.04)',
                border: filter === f ? '1px solid rgba(212,165,116,0.3)' : '1px solid rgba(255,255,255,0.07)',
                color: filter === f ? '#D4A574' : '#4a5568',
              }}
            >
              {f === 'all' ? t('allProducts') : t('favorites')}
            </button>
          ))}
        </div>
      </div>

      {/* Scan notification banner */}
      <AnimatePresence>
        {scanNotification && (
          <motion.div
            role={scanNotification.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            aria-atomic="true"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 mx-4 mt-2 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{
              background: scanNotification.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: scanNotification.type === 'success' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: scanNotification.type === 'success' ? '#34d399' : '#f87171' }}
            />
            <p
              className="text-sm font-medium flex-1"
              style={{ color: scanNotification.type === 'success' ? '#34d399' : '#f87171' }}
            >
              {scanNotification.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto scroll-touch content-with-nav">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(212,165,116,0.15)', borderTopColor: '#D4A574' }}
            />
            <p className="text-sm" style={{ color: '#3d5068' }}>{t('loadingProducts')}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Package size={28} style={{ color: '#f87171' }} />
            </div>
            <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>
            <button
              onClick={() => fetchProducts()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(212,165,116,0.1)', border: '1px solid rgba(212,165,116,0.2)', color: '#D4A574' }}
            >
              {t('tryAgain')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(212,165,116,0.07)' }}>
              <Package size={28} style={{ color: '#D4A574', opacity: 0.5 }} />
            </div>
            <p className="text-base font-semibold text-white">{t('noProductsFound')}</p>
            <p className="text-sm text-center" style={{ color: '#3d5068' }}>
              {query ? `${t('noResultsFor')} "${query}"` : t('noProductsInCategory')}
            </p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-3">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={handleAddToCart}
                isInCart={isInCart(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barcode scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => setShowScanner(false)}
      />

      {/* Logout confirm dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22 }}
              className="w-full max-w-xs rounded-2xl p-6"
              style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <h3 className="text-base font-bold text-white mb-2">{t('logOut')}?</h3>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>{t('logOutConfirm')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >
                  {t('logOut')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating cart button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate('/cart')}
            className="fixed right-5 touch-manipulation"
            style={{
              bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
              zIndex: 40,
              background: 'linear-gradient(135deg, #8B6914 0%, #D4A574 100%)',
              border: '1px solid rgba(212,165,116,0.4)',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(212,165,116,0.25)',
            }}
            aria-label={`View cart, ${cartCount} items`}
          >
            <ShoppingCart size={22} className="text-white" />
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: '#ef4444' }}
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

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
    const fromLS    = JSON.parse(localStorage.getItem('product_categories') || '[]');
    const fromDB    = [...new Set(products.map(p => p.category).filter(Boolean))];
    setCats([...new Set([...fromLS, ...fromDB])]);
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
        const prev = JSON.parse(localStorage.getItem('product_categories') || '[]');
        if (!prev.includes(form.category)) {
          localStorage.setItem('product_categories', JSON.stringify([...prev, form.category]));
        }
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
// AddCategorySheet
// ─────────────────────────────────────────────────────────────
function AddCategorySheet({ visible, onClose, products }) {
  const [cats,  setCats]  = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    setInput('');
    const fromLS = JSON.parse(localStorage.getItem('product_categories') || '[]');
    const fromDB = [...new Set(products.map(p => p.category).filter(Boolean))];
    setCats([...new Set([...fromLS, ...fromDB])]);
  }, [visible, products]);

  const persist = (list) => {
    setCats(list);
    localStorage.setItem('product_categories', JSON.stringify(list));
  };

  const addCat = () => {
    const name = input.trim();
    if (!name || cats.includes(name)) { setInput(''); return; }
    persist([...cats, name]);
    setInput('');
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
          style={{ background: '#0d1120', maxHeight: '80vh' }}
          dir="rtl"
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white">إدارة التصنيفات</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X size={16} color="white" />
            </button>
          </div>

          <div className="flex-shrink-0 px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCat()}
                placeholder="اسم التصنيف الجديد"
                className="flex-1 px-3 py-2.5 rounded-xl outline-none text-white placeholder-gray-600"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '15px' }} />
              <button onClick={addCat}
                className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(57,73,171,0.2)', border: '1px solid rgba(57,73,171,0.3)', color: '#818cf8' }}>
                إضافة
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
            {cats.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: '#4a5568' }}>لا توجد تصنيفات بعد</p>
            ) : cats.map(c => (
              <div key={c} className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-sm font-semibold text-white">{c}</span>
                <button onClick={() => persist(cats.filter(x => x !== c))}
                  className="w-7 h-7 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <X size={13} color="#f87171" />
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
