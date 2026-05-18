import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Package, Minus, Plus, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

/*
  Usage:
    <ReturnModal
      sale={sale}                          // full sale object with items
      onConfirm={(returnData) => ...}      // returnData = { items, notes }
      onClose={() => ...}
    />

  onConfirm receives:
    {
      items: [{ product_id, quantity, unit_price }],
      notes: string
    }
*/

export default function ReturnModal({ sale, onConfirm, onClose }) {
  const items = useMemo(() => sale?.items || sale?.sale_items || [], [sale]);

  // State: { [index]: { checked, qty } }
  const [selections, setSelections] = useState(() =>
    items.reduce((acc, _, i) => {
      acc[i] = { checked: false, qty: 1 };
      return acc;
    }, {})
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleCheck = (i) => {
    setSelections(prev => ({
      ...prev,
      [i]: { ...prev[i], checked: !prev[i].checked },
    }));
  };

  const setQty = (i, delta) => {
    const item = items[i];
    const maxQty = item.quantity || 1;
    setSelections(prev => {
      const current = prev[i].qty;
      const next = Math.max(1, Math.min(maxQty, current + delta));
      return { ...prev, [i]: { ...prev[i], qty: next } };
    });
  };

  const returnTotal = useMemo(() => {
    return items.reduce((sum, item, i) => {
      const sel = selections[i];
      if (!sel?.checked) return sum;
      return sum + (item.unit_price || 0) * sel.qty;
    }, 0);
  }, [selections, items]);

  const checkedCount = Object.values(selections).filter(s => s.checked).length;
  const canSubmit = checkedCount > 0 && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const returnItems = items
      .map((item, i) => {
        const sel = selections[i];
        if (!sel?.checked) return null;
        return {
          product_id: item.product_id || item.id,
          quantity: sel.qty,
          unit_price: item.unit_price || 0,
        };
      })
      .filter(Boolean);

    await onConfirm({ items: returnItems, notes: notes.trim() });
    setSubmitting(false);
  };

  const saleDate = sale?.created_at
    ? new Date(sale.created_at).toLocaleDateString('fr-DZ', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            maxHeight: '90vh',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            fontFamily: "'Cairo','Tajawal',sans-serif",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(211,47,47,0.1)' }}
              >
                <RotateCcw size={16} style={{ color: '#d32f2f' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#1a1a1a' }}>{t('returnSale')}</h2>
                <p className="text-xs" style={{ color: '#6b7280' }}>{t('saleLabel')} #{sale?.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full touch-manipulation"
              style={{ background: '#f1f5f9' }}
              aria-label={t('closeLabel')}
            >
              <X size={18} style={{ color: '#6b7280' }} />
            </button>
          </div>

          {/* Sale summary */}
          <div className="px-5 pb-3 flex-shrink-0">
            <div
              className="rounded-xl px-4 py-3 grid grid-cols-3 gap-3"
              style={{ background: '#f1f5f9', border: '1px solid #e5e7eb' }}
            >
              {[
                { label: t('date'), value: saleDate },
                { label: t('client'), value: sale?.client_name || t('walkin') },
                { label: t('total'), value: formatCurrency(sale?.total || 0) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#6b7280' }}>{label}</p>
                  <p className="text-xs font-semibold truncate" style={{ color: '#1a1a1a' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#6b7280' }}>
              {t('selectItemsToReturn')}
            </p>

            {items.length === 0 ? (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Package size={20} style={{ color: '#9ca3af' }} />
                <p className="text-sm" style={{ color: '#6b7280' }}>{t('noItemDetailsAvailable')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const sel = selections[i];
                  const maxQty = item.quantity || 1;
                  const lineReturn = sel.checked ? (item.unit_price || 0) * sel.qty : 0;

                  return (
                    <motion.div
                      key={i}
                      layout
                      className="rounded-xl p-3"
                      style={{
                        background: sel.checked ? 'rgba(211,47,47,0.05)' : 'white',
                        border: sel.checked ? '1px solid rgba(211,47,47,0.25)' : '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleCheck(i)}
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 touch-manipulation"
                          style={{
                            background: sel.checked ? 'rgba(211,47,47,0.12)' : 'white',
                            border: sel.checked ? '1.5px solid rgba(211,47,47,0.5)' : '1.5px solid #cbd5e1',
                          }}
                          aria-label={sel.checked ? t('deselectItem') : t('selectItem')}
                        >
                          {sel.checked && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>
                            {item.product_name || item.name || t('products')}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                            {formatCurrency(item.unit_price || 0)} × {maxQty} {t('sold')}
                          </p>
                        </div>

                        {/* Return total */}
                        {sel.checked && (
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: '#d32f2f' }}>
                            -{formatCurrency(lineReturn)}
                          </p>
                        )}
                      </div>

                      {/* Qty stepper — only when checked */}
                      <AnimatePresence>
                        {sel.checked && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #e5e7eb' }}>
                              <p className="text-xs flex-1" style={{ color: '#6b7280' }}>
                                {t('returnQtyMax').replace('{n}', maxQty)}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setQty(i, -1)}
                                  disabled={sel.qty <= 1}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg touch-manipulation"
                                  style={{
                                    background: '#f1f5f9',
                                    opacity: sel.qty <= 1 ? 0.3 : 1,
                                  }}
                                  aria-label={t('decreaseReturnQty')}
                                >
                                  <Minus size={13} style={{ color: '#6b7280' }} />
                                </button>
                                <span className="w-7 text-center text-sm font-bold" style={{ color: '#1a1a1a' }}>{sel.qty}</span>
                                <button
                                  onClick={() => setQty(i, 1)}
                                  disabled={sel.qty >= maxQty}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg touch-manipulation"
                                  style={{
                                    background: '#f1f5f9',
                                    opacity: sel.qty >= maxQty ? 0.3 : 1,
                                  }}
                                  aria-label={t('increaseReturnQty')}
                                >
                                  <Plus size={13} style={{ color: '#6b7280' }} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom: reason + total + button */}
          <div className="flex-shrink-0 px-5 pt-3 pb-3 space-y-3" style={{ borderTop: '1px solid #e5e7eb', background: 'white' }}>
            {/* Reason */}
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('returnReason')}
              className="w-full px-4 py-3 rounded-xl placeholder-gray-400 outline-none"
              style={{
                background: 'white',
                border: '1.5px solid #90caf9',
                fontSize: '16px',
                color: '#1a1a1a',
              }}
            />

            {/* Return total */}
            {checkedCount > 0 && (
              <div
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)' }}
              >
                <div>
                  <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
                    {t('returnTotal')} ({checkedCount} {checkedCount === 1 ? t('itemSingular') : t('itemPlural')})
                  </p>
                </div>
                <p className="text-lg font-bold" style={{ color: '#d32f2f' }}>
                  -{formatCurrency(returnTotal)}
                </p>
              </div>
            )}

            {/* Warning if nothing selected */}
            {checkedCount === 0 && (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-2.5"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                <p className="text-xs" style={{ color: '#b45309' }}>{t('selectAtLeastOne')}</p>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                         font-bold text-base touch-manipulation transition-all"
              style={{
                background: canSubmit
                  ? 'linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)'
                  : '#f1f5f9',
                border: canSubmit ? '1px solid rgba(211,47,47,0.4)' : '1px solid #e5e7eb',
                color: canSubmit ? 'white' : '#9ca3af',
                opacity: canSubmit ? 1 : 0.7,
              }}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  {t('returning')}
                </>
              ) : (
                <>
                  <RotateCcw size={18} />
                  {t('processReturn')}
                  {returnTotal > 0 && ` — ${formatCurrency(returnTotal)}`}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
