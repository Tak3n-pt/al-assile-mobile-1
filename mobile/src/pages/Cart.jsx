import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Trash2, Plus, Minus, X, ShoppingBag, ChevronRight,
  User, CheckCircle2, PartyPopper, AlertTriangle, Tag, XCircle, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart.jsx';
import { useApi } from '../hooks/useApi.jsx';
import { formatCurrency } from '../utils/currency.js';
import ClientSelector from '../components/ClientSelector.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import ReceiptPrinter from '../components/ReceiptPrinter.jsx';
import { t } from '../utils/i18n.js';
import BarcodeScanner from '../components/BarcodeScanner.jsx';

export default function Cart() {
  const navigate = useNavigate();
  const api = useApi();
  const {
    getItemsArray, updateQuantity, removeItem, addItem,
    client, setClient, clear, getTotal,
    saleTarif, setSaleTarif, setLineTarif, getLineUnitPrice,
  } = useCart();

  const [showClientModal, setShowClientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({});
  const [discountInput, setDiscountInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const [scanProducts, setScanProducts] = useState([]);
  const scanProductsRef = useRef([]);
  const scanProductsLoaded = useRef(false);

  useEffect(() => {
    api.get('/api/settings').then(setSettings).catch(() => {});
  }, []);

  const openScanner = useCallback(async () => {
    if (!scanProductsLoaded.current) {
      try {
        const data = await api.get('/api/products');
        const list = Array.isArray(data) ? data : [];
        setScanProducts(list);
        scanProductsRef.current = list;
        scanProductsLoaded.current = true;
      } catch {}
    }
    setShowScanner(true);
  }, [api]);

  const showScanToast = useCallback((type, msg) => {
    setScanToast({ type, msg });
    setTimeout(() => setScanToast(null), 2200);
  }, []);

  const handleCartScan = useCallback((raw) => {
    const barcode = String(raw || '').replace(/[\r\n\t]/g, '').trim();
    if (!barcode) return;
    const list = scanProductsRef.current;
    let found = list.find(p => p.barcode === barcode);
    if (!found) {
      const stripped = barcode.replace(/^0+/, '');
      if (stripped) found = list.find(p => p.barcode && String(p.barcode).replace(/^0+/, '') === stripped);
    }
    if (!found) { showScanToast('error', 'لم يُعثر على المنتج'); return; }
    if ((found.quantity || 0) <= 0) { showScanToast('error', 'نفذت الكمية'); return; }
    addItem(found);
    showScanToast('success', found.name);
  }, [addItem, showScanToast]);

  const items = getItemsArray();
  const subtotal = getTotal();
  const discount = Math.min(
    Math.max(parseFloat(discountInput.replace(',', '.') || '0') || 0, 0),
    subtotal
  );
  const total = subtotal - discount;
  const isEmpty = items.length === 0;

  const handleCompleteSale = async (paymentData) => {
    setShowPaymentModal(false);
    setCompleting(true);
    setError('');

    try {
      const payload = {
        client_id: client?.id || null,
        date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
        paid_amount: paymentData.amount_paid || 0,
        payment_method: paymentData.payment_method || 'cash',
        notes: paymentData.notes || null,
        discount: discount > 0 ? discount : undefined,
        items: items.map((line) => ({
          product_id: line.product.id,
          quantity:   line.quantity,
          unit_price: getLineUnitPrice(line),
        })),
      };

      const sale = await api.post('/api/sales', payload);
      setCompletedSale({ ...sale, client_name: client?.name || null });
      clear();
    } catch (err) {
      setError(err.message || t('failedToCreateSale'));
    } finally {
      setCompleting(false);
    }
  };

  // Cancel a sale that was JUST completed. Server restores stock, reverses
  // balance, deletes sale + items, and logs a 'delete' sync_log entry so
  // the desktop mirrors the cancellation on its next pull.
  const handleCancelSale = async () => {
    if (!completedSale?.id || cancelling) return;
    setCancelling(true);
    setError('');
    try {
      await api.delete(`/api/sales/${completedSale.id}`);
      setCompletedSale(null);
      setCancelConfirm(false);
      navigate('/products/list');
    } catch (err) {
      setError(err.message || t('cancelSaleFailed'));
      setCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  // Post-sale success screen
  if (completedSale) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center safe-top"
        style={{ background: 'white' }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="flex flex-col items-center gap-5 w-full max-w-sm"
        >
          {/* Success icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(46,125,50,0.1)', border: '2px solid rgba(46,125,50,0.3)' }}
          >
            <CheckCircle2 size={40} style={{ color: '#2e7d32' }} />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a1a1a' }}>{t('saleComplete')}</h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              {completedSale.client_name
                ? `${t('soldTo')} ${completedSale.client_name}`
                : t('walkinSaleRecorded')}
            </p>
            <p className="text-3xl font-bold mt-3" style={{ color: '#e91e63' }}>
              {formatCurrency(completedSale.total || 0)}
            </p>
          </div>

          {/* Receipt / Cancel / new sale buttons */}
          <div className="w-full flex flex-col gap-3 mt-2">
            {/* Row 1: Receipt + Cancel side by side */}
            <div className="w-full flex gap-2">
              <div className="flex-1">
                <ReceiptPrinter sale={completedSale} settings={settings} />
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setCancelConfirm(true)}
                disabled={cancelling}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                           font-semibold text-sm touch-manipulation"
                style={{
                  background: 'rgba(211,47,47,0.08)',
                  border: '1px solid rgba(211,47,47,0.25)',
                  color: '#d32f2f',
                  opacity: cancelling ? 0.5 : 1,
                }}
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                <span>{t('cancelSale')}</span>
              </motion.button>
            </div>

            {error && (
              <p className="text-xs text-center" style={{ color: '#d32f2f' }}>{error}</p>
            )}

            <button
              onClick={() => { setCompletedSale(null); navigate('/products/list'); }}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                         font-bold text-white text-base touch-manipulation"
              style={{
                background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
                border: '1px solid rgba(46,125,50,0.4)',
              }}
            >
              <ShoppingBag size={20} />
              {t('newSale')}
            </button>

            <button
              onClick={() => navigate('/sales')}
              className="py-3 text-sm font-medium touch-manipulation"
              style={{ color: '#6b7280' }}
            >
              {t('viewTodaysSales')}
            </button>
          </div>
        </motion.div>

        {/* Cancel confirmation — non-destructive default; user must explicitly tap confirm */}
        <AnimatePresence>
          {cancelConfirm && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cancelling && setCancelConfirm(false)}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl p-5"
                style={{ background: 'white', border: '1px solid rgba(211,47,47,0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(211,47,47,0.12)' }}>
                    <AlertTriangle size={20} style={{ color: '#d32f2f' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold mb-1" style={{ color: '#1a1a1a' }}>{t('cancelSaleConfirm')}</h3>
                    <p className="text-sm" style={{ color: '#6b7280' }}>{t('cancelSaleConfirmDesc')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCancelConfirm(false)}
                    disabled={cancelling}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm touch-manipulation"
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e5e7eb',
                      color: '#1a1a1a',
                    }}
                  >
                    {t('keepSale')}
                  </button>
                  <button
                    onClick={handleCancelSale}
                    disabled={cancelling}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm touch-manipulation"
                    style={{
                      background: 'rgba(211,47,47,0.12)',
                      border: '1px solid rgba(211,47,47,0.4)',
                      color: '#d32f2f',
                    }}
                  >
                    {cancelling && <Loader2 size={16} className="animate-spin" />}
                    {t('confirmCancel')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'white' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 safe-top"
        style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', boxShadow: '0 3px 12px rgba(57,73,171,0.4)' }}
      >
        <div className="flex items-center gap-3 px-4 pt-2 pb-3">
          <button
            onClick={() => navigate('/products/list')}
            className="w-10 h-10 flex items-center justify-center rounded-full touch-manipulation"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            aria-label={t('backToProducts')}
          >
            <ArrowLeft size={20} color="white" />
          </button>

          <h1 className="text-xl font-bold text-white flex-1">{t('cart')}</h1>

          <button
            onClick={openScanner}
            style={{
              background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="مسح الباركود"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="17" y1="12" x2="17" y2="12.01"/>
            </svg>
          </button>

          {!isEmpty && (
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
              aria-label={t('clearCart')}
            >
              <Trash2 size={14} />
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      {/* Tarif Selector — always visible so user can set price tier before adding items */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: '#e5e7eb', background: '#fafafa' }}>
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{t('tarif')}</span>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => setSaleTarif(n)}
            className="flex-1 py-2 rounded-xl text-xs font-bold touch-manipulation"
            style={{
              background: saleTarif === n ? '#3949AB' : '#f1f5f9',
              color:      saleTarif === n ? '#fff'    : '#6b7280',
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(57,73,171,0.08)', border: '1px solid rgba(57,73,171,0.15)' }}
          >
            <ShoppingBag size={36} style={{ color: '#3949AB', opacity: 0.6 }} />
          </div>
          <div>
            <p className="text-xl font-bold mb-1" style={{ color: '#1a1a1a' }}>{t('cartEmpty')}</p>
            <p className="text-sm" style={{ color: '#6b7280' }}>{t('addProductsToStart')}</p>
          </div>
          <button
            onClick={() => navigate('/products/list')}
            className="px-6 py-3 rounded-xl text-sm font-semibold touch-manipulation"
            style={{
              background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
              color: '#fff',
              border: '1px solid rgba(57,73,171,0.3)',
            }}
          >
            {t('browseProducts')}
          </button>
        </div>
      )}

      {/* Cart content */}
      {!isEmpty && (
        <>
          <div className="flex-1 overflow-y-auto scroll-touch px-4 py-4 space-y-3">
            {/* Cart items */}
            <AnimatePresence initial={false}>
              {items.map((line) => {
                const { product, quantity } = line;
                const lineTarif = line.tarif || saleTarif;
                const unitPrice = getLineUnitPrice(line);
                const lineTotal = unitPrice * quantity;
                const maxQty = product.quantity ?? 999;

                const cycleTarif = () => {
                  // Cycle 1 → 2 → 3 → 1, skipping tiers the product doesn't offer.
                  const candidates = [1, 2, 3].filter(n =>
                    n === 1 ||
                    (n === 2 && (product.selling_price2 || 0) > 0) ||
                    (n === 3 && (product.selling_price3 || 0) > 0)
                  );
                  if (candidates.length < 2) return;  // only tarif 1 available
                  const idx = candidates.indexOf(lineTarif);
                  const next = candidates[(idx + 1) % candidates.length];
                  setLineTarif(product.id, next);
                };

                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    {/* Remove */}
                    <button
                      onClick={() => removeItem(product.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 touch-manipulation"
                      style={{ background: 'rgba(211,47,47,0.08)' }}
                      aria-label={`Remove ${product.name}`}
                    >
                      <X size={14} style={{ color: '#d32f2f' }} />
                    </button>

                    {/* Name & price + per-line tarif chip */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button
                          onClick={cycleTarif}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold touch-manipulation"
                          style={{
                            background: 'rgba(57,73,171,0.1)',
                            color: '#3949AB',
                            border: '1px solid rgba(57,73,171,0.2)',
                          }}
                          aria-label={`Tarif ${lineTarif}`}
                        >
                          T{lineTarif}
                        </button>
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          {formatCurrency(unitPrice)} {t('each')}
                        </p>
                      </div>
                    </div>

                    {/* Qty stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg touch-manipulation"
                        style={{ background: '#f1f5f9' }}
                        aria-label={t('decreaseQty')}
                      >
                        <Minus size={14} style={{ color: '#6b7280' }} />
                      </button>
                      <span className="w-7 text-center text-sm font-bold" style={{ color: '#1a1a1a' }}>{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= maxQty}
                        className="w-8 h-8 flex items-center justify-center rounded-lg touch-manipulation"
                        style={{
                          background: '#f1f5f9',
                          opacity: quantity >= maxQty ? 0.4 : 1,
                        }}
                        aria-label={t('increaseQty')}
                      >
                        <Plus size={14} style={{ color: '#6b7280' }} />
                      </button>
                    </div>

                    {/* Line total */}
                    <p className="text-sm font-bold text-right" style={{ color: '#e91e63', minWidth: '72px' }}>
                      {formatCurrency(lineTotal)}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Client selector */}
            <button
              onClick={() => setShowClientModal(true)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl touch-manipulation"
              style={{
                background: client ? 'rgba(57,73,171,0.06)' : 'white',
                border: client ? '1.5px solid rgba(57,73,171,0.3)' : '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: client ? 'rgba(57,73,171,0.12)' : '#f1f5f9' }}
              >
                <User size={18} style={{ color: client ? '#3949AB' : '#6b7280' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: '#6b7280' }}>
                  {t('client')}
                </p>
                <p className="text-sm font-semibold" style={{ color: client ? '#1a1a1a' : '#6b7280' }}>
                  {client ? client.name : t('walkinCustomer')}
                </p>
              </div>
              <ChevronRight size={18} style={{ color: '#9ca3af' }} />
            </button>

            {/* Client debt warning */}
            {client && typeof client.balance === 'number' && client.balance > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'rgba(211,47,47,0.06)',
                  border: '1px solid rgba(211,47,47,0.2)',
                }}
              >
                <AlertTriangle size={16} className="flex-shrink-0" style={{ color: '#d32f2f' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: '#d32f2f' }}>
                    {t('clientOwes')} {formatCurrency(client.balance)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                    {t('existingBalance')}
                  </p>
                </div>
              </div>
            )}

            {/* Discount input */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: 'white',
                border: discount > 0
                  ? '1.5px solid rgba(233,30,99,0.35)'
                  : '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: discount > 0 ? 'rgba(233,30,99,0.1)' : '#f1f5f9',
                }}
              >
                <Tag size={16} style={{ color: discount > 0 ? '#e91e63' : '#6b7280' }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>
                  {t('discount')}
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full bg-transparent outline-none text-sm font-semibold placeholder-gray-400"
                  style={{ fontSize: '14px', color: '#1a1a1a' }}
                />
              </div>
              {discount > 0 && (
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#e91e63' }}>
                  -{formatCurrency(discount)}
                </span>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)', color: '#d32f2f' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Summary + checkout */}
          <div
            className="flex-shrink-0 px-4 py-4 space-y-3"
            style={{
              background: 'white',
              borderTop: '1px solid #e5e7eb',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)',
            }}
          >
            {/* Total summary */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#6b7280' }}>
                  {items.reduce((s, { quantity }) => s + quantity, 0)} {t('items')}
                </span>
                <span className="text-sm font-medium" style={{ color: '#6b7280' }}>
                  {formatCurrency(subtotal)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#e91e63' }}>{t('discount')}</span>
                  <span className="text-sm font-semibold" style={{ color: '#e91e63' }}>
                    -{formatCurrency(discount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid #e5e7eb' }}>
                <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{t('total')}</span>
                <p className="text-2xl font-bold" style={{ color: '#e91e63' }}>{formatCurrency(total)}</p>
              </div>
            </div>

            {/* Checkout button */}
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={completing}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                         font-bold text-white text-base touch-manipulation"
              style={{
                background: completing
                  ? '#f1f5f9'
                  : 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
                border: completing ? '1px solid #e5e7eb' : '1px solid rgba(46,125,50,0.4)',
                color: completing ? '#6b7280' : 'white',
                opacity: completing ? 0.6 : 1,
              }}
            >
              {completing ? (
                <>
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#6b7280' }} />
                  {t('processing')}
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  {t('checkout')} — {formatCurrency(total)}
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Client selector modal */}
      {showClientModal && (
        <ClientSelector
          selected={client}
          onSelect={setClient}
          onClose={() => setShowClientModal(false)}
        />
      )}

      {/* Payment modal */}
      {showPaymentModal && (
        <PaymentModal
          total={total}
          hasClient={!!client}
          clientName={client?.name || null}
          clientCreditBlocked={!!client?.credit_blocked}
          onConfirm={handleCompleteSale}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Barcode scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleCartScan}
        onClose={() => setShowScanner(false)}
      />

      {/* Scan toast */}
      {scanToast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, pointerEvents: 'none',
          background: scanToast.type === 'success' ? '#22c55e' : '#ef4444',
          color: 'white', borderRadius: 12, padding: '9px 18px',
          fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          maxWidth: '80vw', textAlign: 'center',
        }}>
          {scanToast.type === 'success' ? `✓ تمت إضافة: ${scanToast.msg}` : `✗ ${scanToast.msg}`}
        </div>
      )}
    </div>
  );
}
