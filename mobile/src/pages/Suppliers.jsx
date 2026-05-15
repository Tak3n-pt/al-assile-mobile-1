import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Search, Plus, X, Truck, Phone,
  Wallet, History, Trash2, AlertTriangle, Loader2, Edit2,
  Save, ChevronLeft,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency } from '../utils/currency.js';

// ─── SupplierForm — light full-screen overlay ─────────────────────────────────

function SupplierForm({ supplier, onClose, onSaved }) {
  const api    = useApi();
  const isEdit = !!supplier;

  const [f, setF] = useState({
    supplier_code:  supplier?.supplier_code  || '',
    name:           supplier?.name           || '',
    address:        supplier?.address        || '',
    phone:          supplier?.phone          || '',
    tax_number:     supplier?.tax_number     || '',
    commercial_reg: supplier?.commercial_reg || '',
    notes:          supplier?.notes          || '',
    initial_balance: '',
    balance_sign:   'none',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const upd = k => e => setF(prev => ({ ...prev, [k]: e.target.value }));

  const computeBalance = () => {
    if (f.balance_sign === 'none') return 0;
    const amt = parseFloat(f.initial_balance) || 0;
    return f.balance_sign === 'credit' ? amt : -amt;
  };

  const save = async () => {
    if (!f.name.trim() || submitting) return;
    setSubmitting(true); setError('');
    try {
      const body = {
        supplier_code:  f.supplier_code.trim()  || null,
        name:           f.name.trim(),
        address:        f.address.trim()        || null,
        phone:          f.phone.trim()          || null,
        tax_number:     f.tax_number.trim()     || null,
        commercial_reg: f.commercial_reg.trim() || null,
        notes:          f.notes.trim()          || null,
      };
      if (!isEdit) body.initial_balance = computeBalance();
      const res = isEdit
        ? await api.patch(`/api/suppliers/${supplier.id}`, body)
        : await api.post('/api/suppliers', body);
      onSaved(res);
    } catch (err) {
      setError(err?.message || 'فشل الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const canSave = f.name.trim().length > 0 && !submitting;

  const inp = {
    border: '1.5px solid #90caf9',
    borderRadius: '8px',
    background: 'white',
    textAlign: 'right',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    width: '100%',
    fontFamily: "'Cairo','Tajawal',sans-serif",
    outline: 'none',
    color: '#1a1a1a',
    boxSizing: 'border-box',
  };

  const lbl = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#555',
    marginBottom: '4px',
  };

  const fieldGroups = [
    { key: 'supplier_code',  label: 'رمز المورد',             type: 'input' },
    { key: 'name',           label: 'اسم المورد',             type: 'textarea', minH: 65, required: true },
    { key: 'address',        label: 'العنوان',                type: 'textarea', minH: 85 },
    { key: 'phone',          label: 'رقم الهاتف',             type: 'input',   inputType: 'tel' },
    { key: 'tax_number',     label: 'الرقم الضريبي',          type: 'input' },
    { key: 'commercial_reg', label: 'رقم السجل التجاري',      type: 'input' },
    { key: 'notes',          label: 'ملاحظات',                type: 'textarea', minH: 110 },
  ];

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#f5f5f5',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        background: '#2b5be8',
        padding: '0.7rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(43,91,232,0.4)',
      }}>
        {/* حفظ — first DOM = visual RIGHT in RTL */}
        <button onClick={save} disabled={!canSave} style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '8px',
          color: 'white',
          padding: '0.35rem 0.85rem',
          cursor: canSave ? 'pointer' : 'not-allowed',
          fontSize: '0.85rem',
          fontWeight: '700',
          display: 'flex', alignItems: 'center', gap: '5px',
          opacity: canSave ? 1 : 0.5,
          fontFamily: "'Cairo','Tajawal',sans-serif",
          flexShrink: 0,
        }}>
          {submitting
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Save size={14} />}
          حفظ
        </button>

        {/* Title */}
        <span style={{
          flex: 1, color: 'white', fontSize: '1rem', fontWeight: '700',
          textAlign: 'center',
        }}>
          {isEdit ? 'تعديل المورد' : 'إضافة مورد جديد'}
        </span>

        {/* Close — last DOM = visual LEFT */}
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: '50%',
          width: '34px', height: '34px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <X size={18} color="white" />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem 1rem' }}>
        {fieldGroups.map(({ key, label, type, minH, required, inputType }) => (
          <div key={key} style={{ marginBottom: '0.8rem' }}>
            <label style={lbl}>
              {label}
              {required && <span style={{ color: '#e53935' }}> *</span>}
            </label>
            {type === 'textarea' ? (
              <textarea
                value={f[key]}
                onChange={upd(key)}
                rows={2}
                style={{ ...inp, minHeight: minH, resize: 'vertical' }}
              />
            ) : (
              <input
                type={inputType || 'text'}
                value={f[key]}
                onChange={upd(key)}
                style={inp}
              />
            )}
          </div>
        ))}

        {/* Initial balance — only for new supplier */}
        {!isEdit && (
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={lbl}>الرصيد الافتتاحي</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {[
                { id: 'none',   label: 'لا يوجد' },
                { id: 'credit', label: 'دائن' },
                { id: 'owes',   label: 'مدين' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setF(prev => ({ ...prev, balance_sign: id }))}
                  style={{
                    flex: 1, padding: '0.4rem', borderRadius: '8px',
                    border: `1.5px solid ${f.balance_sign === id ? '#2b5be8' : '#ccc'}`,
                    background: f.balance_sign === id ? '#e8eaf6' : 'white',
                    color: f.balance_sign === id ? '#2b5be8' : '#666',
                    fontWeight: '600', fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {f.balance_sign !== 'none' && (
              <input
                type="number"
                inputMode="decimal"
                value={f.initial_balance}
                onChange={upd('initial_balance')}
                placeholder="0.00"
                style={{
                  ...inp,
                  border: `1.5px solid ${f.balance_sign === 'credit' ? '#4caf50' : '#e53935'}`,
                  color: f.balance_sign === 'credit' ? '#2e7d32' : '#c62828',
                }}
              />
            )}
          </div>
        )}

        {error && (
          <div style={{
            background: '#ffebee', border: '1px solid #ef9a9a',
            borderRadius: '8px', padding: '0.6rem 0.75rem',
            color: '#c62828', fontSize: '0.85rem',
            marginBottom: '0.75rem',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────

function OverviewTab({ supplier }) {
  if (!supplier) return null;
  const b = supplier.balance || 0;
  const fields = [
    { label: 'العنوان',            value: supplier.address },
    { label: 'البريد الإلكتروني', value: supplier.email },
    { label: 'رمز المورد',         value: supplier.supplier_code },
    { label: 'الرقم الضريبي',      value: supplier.tax_number },
    { label: 'رقم السجل التجاري', value: supplier.commercial_reg },
    { label: 'ملاحظات',            value: supplier.notes },
  ].filter(x => x.value);

  return (
    <div style={{ paddingTop: '4px' }}>
      <div style={{
        borderRadius: '16px', padding: '1rem',
        background: b < 0 ? 'rgba(239,68,68,0.08)' : b > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
        border:     b < 0 ? '1px solid rgba(239,68,68,0.18)' : b > 0 ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,255,255,0.08)',
        marginBottom: '12px',
      }}>
        <p style={{
          fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
          letterSpacing: '0.5px', marginBottom: '4px',
          color: b < 0 ? '#f87171' : b > 0 ? '#34d399' : '#6b7280',
        }}>
          {b < 0 ? 'مستحق للمورد' : b > 0 ? 'رصيد دائن' : 'الرصيد'}
        </p>
        <p style={{
          fontSize: '28px', fontWeight: '700',
          color: b < 0 ? '#f87171' : b > 0 ? '#34d399' : '#e5e7eb',
          margin: 0,
        }}>
          {formatCurrency(Math.abs(b))}
        </p>
      </div>
      {fields.length > 0 && (
        <div style={{
          borderRadius: '12px', padding: '12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', margin: 0 }}>{label}</p>
              <p style={{ fontSize: '14px', color: 'white', margin: '2px 0 0 0' }}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({ payments, onDelete, onEdit, isAdmin }) {
  if (payments.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '32px' }}>
        <History size={40} style={{ color: '#2a3a52', display: 'block', margin: '0 auto 12px' }} />
        <p style={{ color: '#6b7280', margin: 0 }}>لا توجد حركات مالية</p>
      </div>
    );
  }

  const methodLabel = p => {
    if (p.method === 'balance_correction') return 'تصحيح رصيد';
    if (p.method === 'opening_balance')    return 'رصيد افتتاحي';
    if (p.purchase_id) return `دفعة مقابل فاتورة #${p.purchase_id}`;
    return 'دفعة للمورد';
  };

  return (
    <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {payments.map(p => {
        const isOpening    = p.method === 'opening_balance';
        const isCorrection = p.method === 'balance_correction';
        const isReadOnly   = isCorrection;
        return (
          <div key={p.id} style={{
            borderRadius: '12px', padding: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
            background: isOpening ? 'rgba(245,158,11,0.06)' : isCorrection ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.04)',
            border:     isOpening ? '1px solid rgba(245,158,11,0.15)' : isCorrection ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodLabel(p)}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0' }}>
                {new Date(p.date).toLocaleDateString('ar-DZ')}
                {p.created_by_name && ` · ${p.created_by_name}`}
              </p>
              {p.notes && <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px', color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</p>}
            </div>
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: p.amount < 0 ? '#f87171' : isCorrection ? '#60a5fa' : '#34d399' }}>
                {p.amount >= 0 ? '+' : ''}{formatCurrency(p.amount)}
              </p>
            </div>
            {!isReadOnly && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => onEdit(p)} style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  <Edit2 size={13} />
                </button>
                <button onClick={() => onDelete(p)} style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SupplierPaymentModal ─────────────────────────────────────────────────────

function SupplierPaymentModal({ supplier, onClose, onDone }) {
  const api = useApi();
  const [amount,     setAmount]     = useState('');
  const [method,     setMethod]     = useState('cash');
  const [purchaseId, setPurchaseId] = useState('');
  const [notes,      setNotes]      = useState('');
  const [applyMode,  setApplyMode]  = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const numeric = parseFloat((amount || '').replace(',', '.')) || 0;
  const debt    = Math.max(0, -(supplier.balance || 0));

  const handleDigit = d => setAmount(prev => {
    if (d === '.' && prev.includes('.')) return prev;
    if (d === '.' && !prev) return '0.';
    return prev + d;
  });

  const submit = async () => {
    if (numeric <= 0) return;
    setSubmitting(true); setError('');
    try {
      const body = { amount: numeric, method, notes: notes.trim() || null };
      if (applyMode === 'purchase' && purchaseId.trim()) body.purchase_id = parseInt(purchaseId.trim(), 10);
      await api.post(`/api/suppliers/${supplier.id}/payments`, body);
      onDone();
    } catch (err) { setError(err.message || 'فشل تسجيل الدفعة'); }
    finally { setSubmitting(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(16,185,129,0.2)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /></div>
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-bold text-white">تسجيل دفعة للمورد</h2>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', opacity: submitting ? 0.4 : 1 }}>
            <X size={18} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3 space-y-3">
          <div className="rounded-xl p-3" style={{ background: debt > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)', border: debt > 0 ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: '#6b7280' }}>{supplier.name} — {debt > 0 ? 'مستحق للمورد' : 'لا يوجد مستحقات'}</p>
            <p className="text-xl font-bold" style={{ color: debt > 0 ? '#f87171' : '#34d399' }}>{formatCurrency(debt)}</p>
          </div>
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[{ id: 'general', label: 'دفعة عامة' }, { id: 'purchase', label: 'فاتورة شراء' }].map(({ id, label }) => (
              <button key={id} onClick={() => setApplyMode(id)} className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all touch-manipulation"
                style={{ background: applyMode === id ? 'rgba(212,165,116,0.15)' : 'transparent', color: applyMode === id ? '#D4A574' : '#4a5568', border: applyMode === id ? '1px solid rgba(212,165,116,0.25)' : '1px solid transparent' }}>
                {label}
              </button>
            ))}
          </div>
          {applyMode === 'purchase' && (
            <input type="number" inputMode="numeric" value={purchaseId} onChange={e => setPurchaseId(e.target.value)} placeholder="رقم فاتورة الشراء (اختياري)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.25)', fontSize: '15px' }} />
          )}
          <div className="rounded-xl px-4 py-3 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-medium" style={{ color: '#4a5568' }}>المبلغ المدفوع</p>
            <p className="text-3xl font-bold text-white mt-1">
              {amount ? formatCurrency(numeric) : <span style={{ color: '#2a3a52' }}>0.00 DA</span>}
            </p>
          </div>
          {debt > 0 && (
            <div className="flex gap-2">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setAmount(String(Math.round(debt * pct / 100)))} className="flex-1 py-2 rounded-lg text-xs font-semibold touch-manipulation"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#D4A574' }}>
                  {pct === 100 ? 'الكل' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
              <button key={key} onClick={() => key === '⌫' ? setAmount(p => p.slice(0, -1)) : handleDigit(key)}
                className="py-3 rounded-xl text-base font-semibold touch-manipulation active:scale-95"
                style={{ background: key === '⌫' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: key === '⌫' ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(255,255,255,0.06)', color: key === '⌫' ? '#f87171' : '#fff' }}>
                {key}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {['cash', 'bank'].map(m => (
              <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all touch-manipulation"
                style={{ background: method === m ? 'rgba(212,165,116,0.15)' : 'transparent', color: method === m ? '#D4A574' : '#4a5568', border: method === m ? '1px solid rgba(212,165,116,0.25)' : '1px solid transparent' }}>
                {m === 'cash' ? 'نقدي' : 'بنك'}
              </button>
            ))}
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
            className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '15px' }} />
          {error && (
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <AlertTriangle size={16} style={{ color: '#f87171' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={submit} disabled={submitting || numeric <= 0} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{ background: numeric > 0 && !submitting ? 'linear-gradient(135deg,#065f46 0%,#10b981 100%)' : 'rgba(255,255,255,0.04)', border: numeric > 0 && !submitting ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)', opacity: numeric > 0 && !submitting ? 1 : 0.4 }}>
            <Wallet size={18} />
            {submitting ? 'جارٍ المعالجة...' : 'تسجيل الدفعة'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── EditSupplierPaymentSheet ─────────────────────────────────────────────────

function EditSupplierPaymentSheet({ payment, onClose, onDone }) {
  const api = useApi();
  const [amount,     setAmount]     = useState(String(payment.amount));
  const [date,       setDate]       = useState((payment.date || '').slice(0, 10));
  const [notes,      setNotes]      = useState(payment.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const numeric  = parseFloat((amount || '').replace(',', '.')) || 0;
  const canSubmit = numeric > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      await api.patch(`/api/suppliers/payments/${payment.id}`, { amount: numeric, date, notes: notes.trim() });
      onDone();
    } catch (err) { setError(err?.message || 'فشل التعديل'); }
    finally { setSubmitting(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /></div>
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-bold text-white">تعديل الدفعة</h2>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', opacity: submitting ? 0.4 : 1 }}>
            <X size={18} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>المبلغ</label>
            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white outline-none text-2xl font-bold text-right"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>التاريخ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '16px' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>ملاحظات</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '16px' }} />
          </div>
          {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={submit} disabled={!canSubmit} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{ background: canSubmit ? 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)' : 'rgba(255,255,255,0.04)', border: canSubmit ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)', opacity: canSubmit ? 1 : 0.5 }}>
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Edit2 size={16} />}
            {submitting ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── SupplierDetailSheet ──────────────────────────────────────────────────────

function SupplierDetailSheet({ supplierId, onClose, onChanged, isAdmin, onEditRequest }) {
  const api = useApi();
  const [tab,            setTab]            = useState('overview');
  const [supplier,       setSupplier]       = useState(null);
  const [payments,       setPayments]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showPayment,    setShowPayment]    = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, payRes] = await Promise.all([
        api.get(`/api/suppliers/${supplierId}`),
        api.get(`/api/suppliers/${supplierId}/payments`),
      ]);
      setSupplier(supRes);
      setPayments(Array.isArray(payRes) ? payRes : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [supplierId]);

  useEffect(() => { reload(); }, [reload]);

  const onDeletePayment = async p => {
    if (!window.confirm('هل تريد حذف هذه الدفعة؟')) return;
    try { await api.delete(`/api/suppliers/payments/${p.id}`); await reload(); onChanged(); }
    catch (err) { alert(err.message || 'فشل الحذف'); }
  };

  const onDeleteSupplier = async () => {
    if (!window.confirm('هل تريد حذف هذا المورد نهائياً؟')) return;
    try { await api.delete(`/api/suppliers/${supplierId}`); onClose(); onChanged(); }
    catch (err) { alert(err.message || 'فشل الحذف'); }
  };

  return (
    <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}>

        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Supplier header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(212,165,116,0.12)', border: '1px solid rgba(212,165,116,0.25)' }}>
              <Truck size={18} style={{ color: '#D4A574' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">{supplier?.name || '...'}</h2>
              {supplier?.phone && <p className="text-xs truncate" style={{ color: '#6b7280' }}>{supplier.phone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {supplier && (
              <button onClick={() => onEditRequest(supplier)}
                className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Edit2 size={15} style={{ color: '#9ca3af' }} />
              </button>
            )}
            {isAdmin && supplier && (
              <button onClick={onDeleteSupplier}
                className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <Trash2 size={15} style={{ color: '#f87171' }} />
              </button>
            )}
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X size={18} style={{ color: '#9ca3af' }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pb-3">
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[{ id: 'overview', label: 'نظرة عامة' }, { id: 'history', label: 'السجل المالي' }].map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all touch-manipulation"
                style={{
                  background: tab === id ? 'rgba(212,165,116,0.15)' : 'transparent',
                  color:      tab === id ? '#D4A574' : '#4a5568',
                  border:     tab === id ? '1px solid rgba(212,165,116,0.25)' : '1px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3">
          {loading ? (
            <div className="text-center py-8" style={{ color: '#6b7280' }}>جارٍ التحميل...</div>
          ) : tab === 'overview' ? (
            <OverviewTab supplier={supplier} />
          ) : (
            <HistoryTab payments={payments} onDelete={onDeletePayment} onEdit={p => setEditingPayment(p)} isAdmin={isAdmin} />
          )}
        </div>

        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(13,17,32,0.96)' }}>
          <button onClick={() => setShowPayment(true)} disabled={!supplier}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{ background: 'linear-gradient(135deg,#065f46 0%,#10b981 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Wallet size={18} />
            تسجيل دفعة للمورد
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showPayment && supplier && (
          <SupplierPaymentModal supplier={supplier} onClose={() => setShowPayment(false)}
            onDone={async () => { setShowPayment(false); await reload(); onChanged(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingPayment && (
          <EditSupplierPaymentSheet payment={editingPayment} onClose={() => setEditingPayment(null)}
            onDone={async () => { setEditingPayment(null); await reload(); onChanged(); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEWS = ['list', 'balances', 'remaining'];
const VIEW_TITLES = {
  list:      'عرض الموردين',
  balances:  'الارصدة الافتتاحيه والمبالغ النقدية للموردين',
  remaining: 'المبالغ المتبقية للموردين',
};

export default function Suppliers() {
  const api      = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [viewIdx,    setViewIdx]    = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pressedId,  setPressedId]  = useState(null);
  const [formState,  setFormState]  = useState(null); // null | {supplier?}

  const view = VIEWS[viewIdx];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/suppliers');
      setSuppliers(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(query);
  });

  const colStyle = (flex, textAlign = 'right') => ({
    flex,
    minWidth: 0,
    fontSize: '0.82rem',
    padding: '0.55rem 0.5rem',
    textAlign,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const headerCol = (flex, label, textAlign = 'right', color = '#555') => (
    <div style={{ ...colStyle(flex, textAlign), fontWeight: '700', color, background: '#e8e8e8' }}>
      {label}
    </div>
  );

  const renderHeaderRow = () => (
    <div style={{ display: 'flex', borderBottom: '1.5px solid #ccc', background: '#e8e8e8' }}>
      {view === 'list' && (
        <>
          {headerCol(2.5, 'بيانات المورد')}
          {headerCol(1.5, 'رقم الهاتف', 'center')}
          <div style={{ width: '24px', flexShrink: 0 }} />
        </>
      )}
      {view === 'balances' && (
        <>
          {headerCol(2, 'بيانات المورد')}
          {headerCol(1, 'له', 'center', '#c62828')}
          {headerCol(1, 'عليه', 'center', '#2e7d32')}
          <div style={{ width: '24px', flexShrink: 0 }} />
        </>
      )}
      {view === 'remaining' && (
        <>
          {headerCol(2, 'بيانات المورد')}
          {headerCol(1.5, 'المبلغ الباقي', 'center')}
          <div style={{ width: '24px', flexShrink: 0 }} />
        </>
      )}
    </div>
  );

  const rowHandlers = id => ({
    onClick:      () => setSelectedId(id),
    onMouseDown:  () => setPressedId(id),
    onMouseUp:    () => setPressedId(null),
    onMouseLeave: () => setPressedId(null),
    onTouchStart: () => setPressedId(id),
    onTouchEnd:   () => setPressedId(null),
  });

  const chevronCell = (
    <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <ChevronLeft size={13} style={{ color: '#bbb' }} />
    </div>
  );

  const renderRow = s => {
    const b = s.balance || 0;
    const isPressed = pressedId === s.id;
    const rowStyle = {
      display: 'flex',
      borderBottom: '1px solid #ececec',
      background: isPressed ? '#f0f4ff' : 'white',
      cursor: 'pointer',
      transition: 'background 0.08s',
      alignItems: 'center',
    };
    const nameCell = (
      <div style={{ ...colStyle(view === 'list' ? 2.5 : 2), fontWeight: '600', color: '#1a1a1a' }}>
        {s.name}
      </div>
    );

    if (view === 'list') {
      return (
        <div key={s.id} style={rowStyle} {...rowHandlers(s.id)}>
          {nameCell}
          <div style={{ ...colStyle(1.5, 'center'), color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            {s.phone ? (
              <><Phone size={10} style={{ flexShrink: 0, color: '#888' }} />{s.phone}</>
            ) : <span style={{ color: '#ccc' }}>—</span>}
          </div>
          {chevronCell}
        </div>
      );
    }

    if (view === 'balances') {
      const heOwes = b < 0 ? Math.abs(b).toFixed(2) : '0.00';
      const weOwes = b > 0 ? b.toFixed(2)           : '0.00';
      return (
        <div key={s.id} style={rowStyle} {...rowHandlers(s.id)}>
          {nameCell}
          <div style={{ ...colStyle(1, 'center'), color: b < 0 ? '#c62828' : '#bbb', fontWeight: b < 0 ? '700' : '400' }}>
            {heOwes}
          </div>
          <div style={{ ...colStyle(1, 'center'), color: b > 0 ? '#2e7d32' : '#bbb', fontWeight: b > 0 ? '700' : '400' }}>
            {weOwes}
          </div>
          {chevronCell}
        </div>
      );
    }

    // remaining
    const remaining = Math.abs(b).toFixed(2);
    return (
      <div key={s.id} style={rowStyle} {...rowHandlers(s.id)}>
        {nameCell}
        <div style={{ ...colStyle(1.5, 'center'), color: b < 0 ? '#c62828' : b > 0 ? '#2e7d32' : '#bbb', fontWeight: b !== 0 ? '700' : '400' }}>
          {remaining}
        </div>
        {chevronCell}
      </div>
    );
  };

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* ===== HEADER ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
      }}>
        {/* Back — first DOM = visual RIGHT in RTL */}
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: '50%', width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowRight size={20} color="white" />
        </button>
        <span style={{
          flex: 1, color: 'white', fontSize: '0.95rem', fontWeight: '700',
          textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          padding: '0 0.5rem',
        }}>
          {VIEW_TITLES[view]}
        </span>
        <div style={{ width: '36px', flexShrink: 0 }} />
      </div>

      {/* ===== SEARCH + CONTROLS ===== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 0.75rem',
        background: '#f5f5f5',
        flexShrink: 0,
      }}>
        {/* Orange add button — first DOM = visual RIGHT in RTL */}
        {view === 'list' && (
          <button
            onClick={() => setFormState({})}
            style={{
              background: '#FF6B00',
              border: 'none',
              borderRadius: '50%',
              width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 2px 6px rgba(255,107,0,0.4)',
            }}
          >
            <Plus size={20} color="white" />
          </button>
        )}

        {/* Search input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث..."
            style={{
              width: '100%',
              paddingRight: '30px',
              paddingLeft: query ? '28px' : '10px',
              paddingTop: '0.45rem',
              paddingBottom: '0.45rem',
              border: '1.5px solid #ddd',
              borderRadius: '8px',
              fontSize: '0.85rem',
              background: 'white',
              outline: 'none',
              fontFamily: "'Cairo','Tajawal',sans-serif",
              color: '#1a1a1a',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            >
              <X size={13} style={{ color: '#999' }} />
            </button>
          )}
        </div>

        {/* تقرير button — last DOM = visual LEFT */}
        <button
          onClick={() => setViewIdx(i => (i + 1) % VIEWS.length)}
          style={{
            background: 'white',
            border: '1.5px solid #3949AB',
            borderRadius: '8px',
            color: '#3949AB',
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: "'Cairo','Tajawal',sans-serif",
          }}
        >
          تقرير
        </button>
      </div>

      {/* ===== TABLE ===== */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
            <Loader2 size={28} style={{ color: '#3949AB', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ background: 'white', margin: '0 0.75rem', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            {renderHeaderRow()}
            {filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                <Truck size={36} style={{ display: 'block', margin: '0 auto 8px', color: '#ccc' }} />
                لا يوجد موردون
              </div>
            ) : (
              filtered.map(renderRow)
            )}
          </div>
        )}
      </div>

      {/* ===== BLUE INFO TOAST ===== */}
      <div style={{
        background: '#1565C0',
        color: 'white',
        padding: '0.55rem 1rem',
        fontSize: '0.78rem',
        textAlign: 'center',
        flexShrink: 0,
        fontWeight: '500',
      }}>
        تنبيه / انقر على اسم المورد لتفاصيل اكثر
      </div>

      {/* ===== DETAIL SHEET ===== */}
      <AnimatePresence>
        {selectedId !== null && (
          <SupplierDetailSheet
            supplierId={selectedId}
            onClose={() => setSelectedId(null)}
            onChanged={() => load()}
            isAdmin={isAdmin}
            onEditRequest={supplier => {
              setSelectedId(null);
              setFormState({ supplier });
            }}
          />
        )}
      </AnimatePresence>

      {/* ===== SUPPLIER FORM ===== */}
      <AnimatePresence>
        {formState !== null && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SupplierForm
              supplier={formState.supplier || null}
              onClose={() => setFormState(null)}
              onSaved={() => {
                setFormState(null);
                setSelectedId(null);
                load();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
