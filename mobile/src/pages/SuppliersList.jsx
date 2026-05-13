import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Truck, Phone, RefreshCw, ChevronRight,
  Wallet, History, Trash2, AlertTriangle, Loader2, Edit2, ArrowRight,
  TrendingDown, TrendingUp, CheckCircle2, Wrench,
  ClipboardList, CreditCard,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function BalanceBadge({ balance }) {
  const b = balance || 0;
  if (b < 0) return <span className="text-xs font-bold" style={{ color: '#f87171' }}>{t('shopOwes')} {formatCurrency(Math.abs(b))}</span>;
  if (b > 0) return <span className="text-xs font-bold" style={{ color: '#34d399' }}>+{formatCurrency(b)} {t('supplierHasCredit')}</span>;
  return <span className="text-xs" style={{ color: '#6b7280' }}>{t('clear')}</span>;
}

// ─── main component ──────────────────────────────────────────────────────────

export default function SuppliersList() {
  const api      = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const s       = location.state || {};
  const autoAdd = s.action === 'add';
  const mode    = useMemo(() => {
    if (s.action === 'opening-balances') return 'balances';
    if (s.action === 'audit')            return 'audit';
    if (s.filter === 'owes'   && s.report) return 'owes-report';
    if (s.filter === 'credit' && s.report) return 'credit-report';
    if (s.filter === 'owes')             return 'owes';
    if (s.filter === 'credit')           return 'credit';
    return 'all';
  }, []); // eslint-disable-line

  const [suppliers,  setSuppliers]  = useState([]);
  const [auditData,  setAuditData]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState('');
  const [query,      setQuery]      = useState('');
  const [filter,     setFilter]     = useState(s.filter || 'all');
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd,    setShowAdd]    = useState(autoAdd);
  const [repairing,  setRepairing]  = useState(null);

  const fetchSuppliers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setLoadError('');
    try {
      const res = await api.get('/api/suppliers');
      setSuppliers(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (err) { console.error(err); setLoadError('تعذّر تحميل الموردين'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchAudit = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setLoadError('');
    try {
      const res = await api.get('/api/suppliers/audit');
      setAuditData(res?.data || res);
    } catch (err) { console.error(err); setLoadError('تعذّر تحميل بيانات التدقيق'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (mode === 'audit') fetchAudit();
    else fetchSuppliers();
  }, []);

  const filtered = useMemo(() => {
    const activeFilter = (mode === 'owes' || mode === 'owes-report') ? 'owes'
                       : (mode === 'credit' || mode === 'credit-report') ? 'credit'
                       : filter;
    return suppliers
      .filter(s => {
        if (activeFilter === 'owes'   && !(s.balance < 0)) return false;
        if (activeFilter === 'credit' && !(s.balance > 0)) return false;
        if (!query) return true;
        const q = query.toLowerCase();
        return (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(query);
      })
      .sort((a, b) => {
        const ba = a.balance || 0, bb = b.balance || 0;
        if (ba < 0 && bb >= 0) return -1;
        if (ba >= 0 && bb < 0) return 1;
        if (ba < 0 && bb < 0) return ba - bb;
        return bb - ba;
      });
  }, [suppliers, filter, query, mode]);

  const totalOwed   = suppliers.reduce((s, c) => s + Math.max(0, -(c.balance || 0)), 0);
  const totalCredit = suppliers.reduce((s, c) => s + Math.max(0,   c.balance || 0),  0);

  const headerTitle = {
    all:            'الموردين',
    balances:       'الارصدة والمبالغ النقدية',
    owes:           'ذمم الموردين',
    'owes-report':  'تقرير الذمم',
    'credit-report':'تقرير الأرصدة',
    credit:         'الموردون الدائنون',
    audit:          'فحص ارصدة الموردين',
  }[mode] || 'الموردين';

  const doRepair = async (supplierId) => {
    setRepairing(supplierId);
    try {
      await api.post(`/api/suppliers/${supplierId}/repair-balance`);
      await fetchAudit(true);
    } catch (err) { alert(err.message || 'فشل الإصلاح'); }
    finally { setRepairing(null); }
  };

  const refresh = () => mode === 'audit' ? fetchAudit(true) : fetchSuppliers(true);

  return (
    <div dir="rtl" className="h-full flex flex-col" style={{ background: '#080c14', fontFamily: "'Cairo','Tajawal',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
        padding: '0.9rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexShrink: 0,
        boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
      }}>
        <button onClick={() => navigate('/suppliers')}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={20} color="white" />
        </button>
        <h1 style={{ flex: 1, fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: 0 }}>
          {headerTitle}
        </h1>
        <button onClick={refresh}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={18} color="white" className={refreshing ? 'animate-spin' : ''} />
        </button>
        {(mode === 'all' || mode === 'owes' || mode === 'credit' || mode === 'balances') && (
          <button onClick={() => setShowAdd(true)}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Truck size={18} color="white" />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(57,73,171,0.2)', borderTopColor: '#5C6BC0' }} />
        </div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center px-8">
          <p style={{ color: '#f87171', textAlign: 'center', fontSize: '0.9rem' }}>{loadError}</p>
        </div>
      ) : mode === 'audit' ? (
        <AuditView auditData={auditData} isAdmin={isAdmin} repairing={repairing} onRepair={doRepair} refreshing={refreshing} />
      ) : mode === 'owes-report' ? (
        <OwesReport suppliers={filtered} total={totalOwed} onSelect={setSelectedId} />
      ) : mode === 'credit-report' ? (
        <CreditReport suppliers={filtered} total={totalCredit} onSelect={setSelectedId} />
      ) : mode === 'balances' ? (
        <BalancesView suppliers={suppliers} onSelect={setSelectedId} />
      ) : (
        <SupplierListView
          suppliers={filtered}
          mode={mode}
          filter={filter}
          query={query}
          totalOwed={totalOwed}
          totalCredit={totalCredit}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
        />
      )}

      {/* ── Sheets ── */}
      <AnimatePresence>
        {selectedId !== null && (
          <SupplierDetailSheet
            supplierId={selectedId}
            onClose={() => setSelectedId(null)}
            onChanged={() => (mode === 'audit' ? fetchAudit(true) : fetchSuppliers(true))}
            isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAdd && (
          <AddSupplierSheet
            onClose={() => setShowAdd(false)}
            onCreated={(ns) => { setShowAdd(false); fetchSuppliers(true); if (ns?.id) setSelectedId(ns.id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Standard list view (modes: all / owes / credit) ────────────────────────

function SupplierListView({ suppliers, mode, filter, query, totalOwed, totalCredit, onFilterChange, onQueryChange, onSelect }) {
  return (
    <>
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#f87171' }}>نحن مدينون</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#f87171' }}>{formatCurrency(totalOwed)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#34d399' }}>أرصدة دائنة</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#34d399' }}>{formatCurrency(totalCredit)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#4a5568' }} />
          <input
            type="text" value={query} onChange={e => onQueryChange(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full pr-9 pl-8 py-2.5 rounded-xl text-white placeholder-gray-600 outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '14px' }}
          />
          {query && (
            <button onClick={() => onQueryChange('')} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full" style={{ color: '#9ca3af' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter pills — only on 'all' mode */}
        {mode === 'all' && (
          <div className="flex gap-2">
            {[{ id: 'all', label: 'الكل' }, { id: 'owes', label: 'نحن مدينون' }, { id: 'credit', label: 'دائنون' }].map(({ id, label }) => (
              <button key={id} onClick={() => onFilterChange(id)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: filter === id ? 'rgba(212,165,116,0.15)' : 'rgba(255,255,255,0.04)',
                  border:     filter === id ? '1px solid rgba(212,165,116,0.3)'  : '1px solid rgba(255,255,255,0.07)',
                  color:      filter === id ? '#D4A574' : '#6b7280',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-4">
        {suppliers.length === 0 ? (
          <div className="text-center py-16">
            <Truck size={44} className="mx-auto mb-3" style={{ color: '#2a3a52' }} />
            <p style={{ color: '#6b7280' }}>لا يوجد موردون</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suppliers.map(s => (
              <motion.button
                key={s.id} whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(s.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left touch-manipulation"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,165,116,0.12)', border: '1px solid rgba(212,165,116,0.2)' }}>
                  <Truck size={17} style={{ color: '#D4A574' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.phone && <span className="text-xs flex items-center gap-1" style={{ color: '#6b7280' }}><Phone size={10} />{s.phone}</span>}
                    <BalanceBadge balance={s.balance} />
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: '#4a5568' }} />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Balances view ───────────────────────────────────────────────────────────

function BalancesView({ suppliers, onSelect }) {
  const sorted      = [...suppliers].sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0));
  const totalDebt   = suppliers.reduce((s, c) => s + Math.max(0, -(c.balance || 0)), 0);
  const totalCredit = suppliers.reduce((s, c) => s + Math.max(0,   c.balance || 0),  0);
  const countDebt   = suppliers.filter(c => (c.balance || 0) < 0).length;
  const countCredit = suppliers.filter(c => (c.balance || 0) > 0).length;

  return (
    <>
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] font-semibold uppercase" style={{ color: '#f87171' }}>نحن مدينون ({countDebt})</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: '#f87171' }}>{formatCurrency(totalDebt)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <p className="text-[10px] font-semibold uppercase" style={{ color: '#34d399' }}>أرصدة دائنة ({countCredit})</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: '#34d399' }}>{formatCurrency(totalCredit)}</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: '#4a5568' }}>مرتبة حسب الرصيد | {suppliers.length} مورد</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-4 space-y-2">
        {sorted.map(s => {
          const b = s.balance || 0;
          const isDebt   = b < 0;
          const isCredit = b > 0;
          return (
            <motion.button
              key={s.id} whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(s.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left touch-manipulation"
              style={{
                background: isDebt ? 'rgba(239,68,68,0.05)' : isCredit ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.04)',
                border: isDebt ? '1px solid rgba(239,68,68,0.12)' : isCredit ? '1px solid rgba(16,185,129,0.12)' : '1px solid rgba(255,255,255,0.07)',
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: isDebt ? 'rgba(239,68,68,0.12)' : isCredit ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)' }}>
                {isDebt ? <TrendingDown size={17} style={{ color: '#f87171' }} />
                        : isCredit ? <TrendingUp size={17} style={{ color: '#34d399' }} />
                        : <Truck size={17} style={{ color: '#6b7280' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                {s.phone && <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{s.phone}</p>}
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-base font-bold" style={{ color: isDebt ? '#f87171' : isCredit ? '#34d399' : '#6b7280' }}>
                  {b === 0 ? '0' : isDebt ? `-${formatCurrency(Math.abs(b))}` : `+${formatCurrency(b)}`}
                </p>
                <p className="text-[10px]" style={{ color: '#4a5568' }}>
                  {isDebt ? 'مدين' : isCredit ? 'دائن' : 'صفر'}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// ─── Owes report ─────────────────────────────────────────────────────────────

function OwesReport({ suppliers, total, onSelect }) {
  const sorted = [...suppliers].sort((a, b) => (a.balance || 0) - (b.balance || 0));
  return (
    <>
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <ClipboardList size={22} style={{ color: '#f87171' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#f87171' }}>إجمالي ما ندين به</p>
              <p className="text-2xl font-bold" style={{ color: '#f87171' }}>{formatCurrency(total)}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{sorted.length} مورد</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-4 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: '#34d399' }} />
            <p className="font-semibold" style={{ color: '#34d399' }}>لا توجد ذمم</p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>جميع الموردين تمت تسويتهم</p>
          </div>
        ) : sorted.map((s, idx) => {
          const owed = Math.abs(s.balance || 0);
          const pct  = total > 0 ? (owed / total) * 100 : 0;
          return (
            <motion.button
              key={s.id} whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(s.id)}
              className="w-full p-3.5 rounded-xl text-left touch-manipulation"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                  {idx + 1}
                </div>
                <p className="flex-1 text-sm font-semibold text-white truncate">{s.name}</p>
                <p className="text-base font-bold flex-shrink-0" style={{ color: '#f87171' }}>{formatCurrency(owed)}</p>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#6b7280' }}>{pct.toFixed(1)}% من إجمالي الذمم</p>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// ─── Credit report ────────────────────────────────────────────────────────────

function CreditReport({ suppliers, total, onSelect }) {
  const sorted = [...suppliers].sort((a, b) => (b.balance || 0) - (a.balance || 0));
  return (
    <>
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <CreditCard size={22} style={{ color: '#34d399' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>إجمالي الأرصدة الدائنة</p>
              <p className="text-2xl font-bold" style={{ color: '#34d399' }}>{formatCurrency(total)}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{sorted.length} مورد دائن</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-4 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <Truck size={44} className="mx-auto mb-3" style={{ color: '#2a3a52' }} />
            <p style={{ color: '#6b7280' }}>لا يوجد موردون دائنون</p>
          </div>
        ) : sorted.map((s, idx) => {
          const credit = s.balance || 0;
          const pct    = total > 0 ? (credit / total) * 100 : 0;
          return (
            <motion.button
              key={s.id} whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(s.id)}
              className="w-full p-3.5 rounded-xl text-left touch-manipulation"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  {idx + 1}
                </div>
                <p className="flex-1 text-sm font-semibold text-white truncate">{s.name}</p>
                <p className="text-base font-bold flex-shrink-0" style={{ color: '#34d399' }}>+{formatCurrency(credit)}</p>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#6b7280' }}>{pct.toFixed(1)}% من إجمالي الأرصدة</p>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// ─── Audit view ───────────────────────────────────────────────────────────────

function AuditView({ auditData, isAdmin, repairing, onRepair }) {
  if (!auditData) return (
    <div className="flex-1 flex items-center justify-center">
      <p style={{ color: '#6b7280' }}>جارٍ تحميل بيانات التدقيق...</p>
    </div>
  );

  const all    = auditData.all || [];
  const drifts = auditData.drifts || [];
  const ok     = all.filter(a => !a.has_drift);

  return (
    <div className="flex-1 overflow-y-auto scroll-touch px-4 pt-3 pb-4">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: '#34d399' }}>صحيح</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: '#34d399' }}>{ok.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: drifts.length > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)', border: drifts.length > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: drifts.length > 0 ? '#f87171' : '#34d399' }}>فروق</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: drifts.length > 0 ? '#f87171' : '#34d399' }}>{drifts.length}</p>
        </div>
      </div>

      {drifts.length === 0 ? (
        <div className="rounded-2xl p-6 text-center mb-4" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle2 size={40} className="mx-auto mb-2" style={{ color: '#34d399' }} />
          <p className="font-bold text-white">جميع الأرصدة صحيحة</p>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>لا توجد أي فروق في {all.length} مورد</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>الموردون ذوو الفروق ({drifts.length})</p>
          <div className="space-y-2 mb-4">
            {drifts.map(row => (
              <div key={row.id} className="rounded-xl p-3.5"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{row.name}</p>
                    {row.phone && <p className="text-xs" style={{ color: '#6b7280' }}>{row.phone}</p>}
                    <div className="flex gap-3 mt-2">
                      <div>
                        <p className="text-[10px]" style={{ color: '#6b7280' }}>مخزن</p>
                        <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>{formatCurrency(row.stored_balance)}</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: '#6b7280' }}>متوقع</p>
                        <p className="text-xs font-bold" style={{ color: '#60a5fa' }}>{formatCurrency(row.expected_balance)}</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: '#6b7280' }}>الفرق</p>
                        <p className="text-xs font-bold" style={{ color: '#f87171' }}>{formatCurrency(row.drift)}</p>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => onRepair(row.id)}
                      disabled={repairing === row.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold touch-manipulation flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', opacity: repairing === row.id ? 0.5 : 1 }}>
                      {repairing === row.id ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />}
                      إصلاح
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {ok.length > 0 && (
        <>
          <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>الأرصدة الصحيحة ({ok.length})</p>
          <div className="space-y-1.5">
            {ok.map(row => (
              <div key={row.id} className="rounded-xl px-3.5 py-2.5 flex items-center gap-3"
                style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                <p className="flex-1 text-sm text-white truncate">{row.name}</p>
                <p className="text-xs font-semibold" style={{ color: '#34d399' }}>{formatCurrency(row.stored_balance)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SupplierDetailSheet ──────────────────────────────────────────────────────

function SupplierDetailSheet({ supplierId, onClose, onChanged, isAdmin }) {
  const api = useApi();
  const [tab,            setTab]            = useState('overview');
  const [supplier,       setSupplier]       = useState(null);
  const [payments,       setPayments]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showPayment,    setShowPayment]    = useState(false);
  const [showEdit,       setShowEdit]       = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, payRes] = await Promise.all([
        api.get(`/api/suppliers/${supplierId}`),
        api.get(`/api/suppliers/${supplierId}/payments`),
      ]);
      setSupplier(supRes?.data || supRes);
      setPayments(Array.isArray(payRes?.data) ? payRes.data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [supplierId]);

  useEffect(() => { reload(); }, [reload]);

  const onDeletePayment = async (p) => {
    if (!window.confirm(t('confirmDeletePayment'))) return;
    try { await api.delete(`/api/suppliers/payments/${p.id}`); await reload(); onChanged(); }
    catch (err) { alert(err.message || t('failedToDelete')); }
  };

  const onDeleteSupplier = async () => {
    if (!window.confirm(t('confirmDeleteSupplier'))) return;
    try { await api.delete(`/api/suppliers/${supplierId}`); onClose(); onChanged(); }
    catch (err) { alert(err.message || t('failedToDelete')); }
  };

  return (
    <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
              <button onClick={() => setShowEdit(true)}
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

        {/* Action bar */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(13,17,32,0.96)' }}>
          <button onClick={() => setShowPayment(true)} disabled={!supplier}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
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
        {showEdit && supplier && (
          <EditSupplierSheet supplier={supplier} onClose={() => setShowEdit(false)}
            onDone={async () => { setShowEdit(false); await reload(); onChanged(); }} />
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

// ─── OverviewTab ──────────────────────────────────────────────────────────────

function OverviewTab({ supplier }) {
  if (!supplier) return null;
  const b = supplier.balance || 0;
  return (
    <div className="space-y-3 pt-1">
      <div className="rounded-2xl p-4"
        style={{
          background: b < 0 ? 'rgba(239,68,68,0.08)' : b > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
          border:     b < 0 ? '1px solid rgba(239,68,68,0.18)' : b > 0 ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,255,255,0.08)',
        }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1"
          style={{ color: b < 0 ? '#f87171' : b > 0 ? '#34d399' : '#6b7280' }}>
          {b < 0 ? 'مستحق للمورد' : b > 0 ? 'رصيد دائن' : 'الرصيد'}
        </p>
        <p className="text-3xl font-bold" style={{ color: b < 0 ? '#f87171' : b > 0 ? '#34d399' : '#e5e7eb' }}>
          {formatCurrency(Math.abs(b))}
        </p>
      </div>
      {(supplier.address || supplier.email || supplier.notes) && (
        <div className="rounded-xl p-3 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {supplier.address && (
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6b7280' }}>العنوان</p>
              <p className="text-sm text-white">{supplier.address}</p>
            </div>
          )}
          {supplier.email && (
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6b7280' }}>البريد الإلكتروني</p>
              <p className="text-sm text-white">{supplier.email}</p>
            </div>
          )}
          {supplier.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6b7280' }}>ملاحظات</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>{supplier.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({ payments, onDelete, onEdit, isAdmin }) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-8">
        <History size={40} className="mx-auto mb-3" style={{ color: '#2a3a52' }} />
        <p style={{ color: '#6b7280' }}>لا توجد حركات مالية</p>
      </div>
    );
  }
  const methodLabel = (p) => {
    if (p.method === 'balance_correction') return 'تصحيح رصيد';
    if (p.method === 'opening_balance')    return 'رصيد افتتاحي';
    if (p.purchase_id) return `دفعة مقابل فاتورة #${p.purchase_id}`;
    return 'دفعة للمورد';
  };

  return (
    <div className="space-y-2 pt-1">
      {payments.map(p => {
        const isOpening    = p.method === 'opening_balance';
        const isCorrection = p.method === 'balance_correction';
        const isReadOnly   = isCorrection;
        return (
          <div key={p.id} className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: isOpening ? 'rgba(245,158,11,0.06)' : isCorrection ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.04)',
              border: isOpening ? '1px solid rgba(245,158,11,0.15)' : isCorrection ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(255,255,255,0.07)',
            }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{methodLabel(p)}</p>
              <p className="text-[11px]" style={{ color: '#6b7280' }}>
                {new Date(p.date).toLocaleDateString('ar-DZ')}
                {p.created_by_name && ` · ${p.created_by_name}`}
              </p>
              {p.notes && <p className="text-[11px] italic mt-0.5 truncate" style={{ color: '#4a5568' }}>{p.notes}</p>}
            </div>
            <div className="flex-shrink-0 text-left ml-2">
              <p className="text-base font-bold" style={{ color: p.amount < 0 ? '#f87171' : isCorrection ? '#60a5fa' : '#34d399' }}>
                {p.amount >= 0 ? '+' : ''}{formatCurrency(p.amount)}
              </p>
            </div>
            {!isReadOnly && isAdmin && (
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => onEdit(p)}
                  className="p-1.5 rounded-lg touch-manipulation"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                  <Edit2 size={13} />
                </button>
                <button onClick={() => onDelete(p)}
                  className="p-1.5 rounded-lg touch-manipulation"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
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

  const handleDigit = (d) => setAmount(prev => {
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
        style={{ background: '#0d1120', border: '1px solid rgba(16,185,129,0.2)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /></div>
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-bold text-white">تسجيل دفعة للمورد</h2>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', opacity: submitting ? 0.4 : 1 }}>
            <X size={18} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3 space-y-3">
          <div className="rounded-xl p-3"
            style={{ background: debt > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)', border: debt > 0 ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: '#6b7280' }}>{supplier.name} — {debt > 0 ? 'مستحق للمورد' : 'لا يوجد مستحقات'}</p>
            <p className="text-xl font-bold" style={{ color: debt > 0 ? '#f87171' : '#34d399' }}>{formatCurrency(debt)}</p>
          </div>
          {/* Apply mode toggle */}
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[{ id: 'general', label: 'دفعة عامة' }, { id: 'purchase', label: 'فاتورة شراء' }].map(({ id, label }) => (
              <button key={id} onClick={() => setApplyMode(id)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all touch-manipulation"
                style={{
                  background: applyMode === id ? 'rgba(212,165,116,0.15)' : 'transparent',
                  color:      applyMode === id ? '#D4A574' : '#4a5568',
                  border:     applyMode === id ? '1px solid rgba(212,165,116,0.25)' : '1px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
          {applyMode === 'purchase' && (
            <input type="number" inputMode="numeric" value={purchaseId} onChange={e => setPurchaseId(e.target.value)}
              placeholder="رقم فاتورة الشراء (اختياري)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-gray-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.25)', fontSize: '15px' }} />
          )}
          {/* Amount display */}
          <div className="rounded-xl px-4 py-3 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-medium" style={{ color: '#4a5568' }}>المبلغ المدفوع</p>
            <p className="text-3xl font-bold text-white mt-1">
              {amount ? formatCurrency(numeric) : <span style={{ color: '#2a3a52' }}>0.00 DA</span>}
            </p>
          </div>
          {debt > 0 && (
            <div className="flex gap-2">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setAmount(String(Math.round(debt * pct / 100)))}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold touch-manipulation"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#D4A574' }}>
                  {pct === 100 ? 'الكل' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
              <button key={key}
                onClick={() => key === '⌫' ? setAmount(p => p.slice(0, -1)) : handleDigit(key)}
                className="py-3 rounded-xl text-base font-semibold touch-manipulation active:scale-95"
                style={{ background: key === '⌫' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: key === '⌫' ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(255,255,255,0.06)', color: key === '⌫' ? '#f87171' : '#fff' }}>
                {key}
              </button>
            ))}
          </div>
          {/* Method */}
          <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {['cash', 'bank'].map(m => (
              <button key={m} onClick={() => setMethod(m)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all touch-manipulation"
                style={{
                  background: method === m ? 'rgba(212,165,116,0.15)' : 'transparent',
                  color:      method === m ? '#D4A574' : '#4a5568',
                  border:     method === m ? '1px solid rgba(212,165,116,0.25)' : '1px solid transparent',
                }}>
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
          <button onClick={submit} disabled={submitting || numeric <= 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{
              background: numeric > 0 && !submitting ? 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' : 'rgba(255,255,255,0.04)',
              border: numeric > 0 && !submitting ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
              opacity: numeric > 0 && !submitting ? 1 : 0.4,
            }}>
            <Wallet size={18} />
            {submitting ? 'جارٍ المعالجة...' : 'تسجيل الدفعة'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── AddSupplierSheet ─────────────────────────────────────────────────────────

function AddSupplierSheet({ onClose, onCreated }) {
  const api = useApi();
  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [address,       setAddress]       = useState('');
  const [notes,         setNotes]         = useState('');
  const [balanceSign,   setBalanceSign]   = useState('none');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]        = useState('');

  const parsedAmount = parseFloat(balanceAmount);
  const amountValid  = balanceSign === 'none' || (Number.isFinite(parsedAmount) && parsedAmount > 0);
  const canSubmit    = name.trim().length > 0 && !submitting && amountValid;

  const computeBalance = () => {
    if (balanceSign === 'none') return 0;
    const amt = parseFloat(balanceAmount) || 0;
    return balanceSign === 'credit' ? amt : -amt;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/api/suppliers', {
        name: name.trim(), phone: phone.trim() || null,
        address: address.trim() || null, notes: notes.trim() || null,
        initial_balance: computeBalance(),
      });
      onCreated(res?.data || res);
    } catch (err) { setError(err?.message || 'فشل إنشاء المورد'); }
    finally { setSubmitting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /></div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Truck size={16} style={{ color: '#34d399' }} />
            </div>
            <h2 className="text-base font-bold text-white">إضافة مورد جديد</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={18} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3 space-y-3">
          {[
            { v: name,    set: setName,    label: 'اسم المورد',  required: true, type: 'text' },
            { v: phone,   set: setPhone,   label: 'رقم الهاتف',               type: 'tel' },
            { v: address, set: setAddress, label: 'العنوان',                  type: 'text' },
            { v: notes,   set: setNotes,   label: 'ملاحظات',                  type: 'text' },
          ].map((f, i) => (
            <div key={i}>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                {f.label}{f.required ? <span style={{ color: '#f87171' }}> *</span> : null}
              </label>
              <input type={f.type} value={f.v} onChange={e => f.set(e.target.value)} autoFocus={i === 0}
                placeholder={f.label}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '16px' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>الرصيد الافتتاحي</label>
            <div className="flex rounded-xl p-1 mb-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { id: 'none',   label: 'لا يوجد', activeColor: '#9ca3af', activeBg: 'rgba(156,163,175,0.12)', activeBorder: 'rgba(156,163,175,0.3)' },
                { id: 'credit', label: 'دائن',    activeColor: '#34d399', activeBg: 'rgba(16,185,129,0.12)',   activeBorder: 'rgba(16,185,129,0.3)'  },
                { id: 'owes',   label: 'مدين',    activeColor: '#f87171', activeBg: 'rgba(239,68,68,0.12)',    activeBorder: 'rgba(239,68,68,0.3)'   },
              ].map(({ id, label, activeColor, activeBg, activeBorder }) => (
                <button key={id} type="button" onClick={() => setBalanceSign(id)}
                  className="flex-1 py-2 px-1 rounded-lg text-[11px] font-semibold transition-all touch-manipulation leading-tight"
                  style={{
                    background: balanceSign === id ? activeBg : 'transparent',
                    color:      balanceSign === id ? activeColor : '#4a5568',
                    border:     balanceSign === id ? `1px solid ${activeBorder}` : '1px solid transparent',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {balanceSign !== 'none' && (
              <input type="number" inputMode="decimal" min="0" value={balanceAmount}
                onChange={e => setBalanceAmount(e.target.value)} placeholder="0"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${balanceSign === 'credit' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  fontSize: '16px',
                  color: balanceSign === 'credit' ? '#34d399' : '#f87171',
                }} />
            )}
          </div>
          {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
        <div className="px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(13,17,32,0.96)' }}>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{
              background: canSubmit ? 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' : 'rgba(255,255,255,0.04)',
              border: canSubmit ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
              opacity: canSubmit ? 1 : 0.5,
            }}>
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
            إضافة المورد
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── EditSupplierSheet ────────────────────────────────────────────────────────

function EditSupplierSheet({ supplier, onClose, onDone }) {
  const api = useApi();
  const [name,    setName]    = useState(supplier.name    || '');
  const [phone,   setPhone]   = useState(supplier.phone   || '');
  const [email,   setEmail]   = useState(supplier.email   || '');
  const [address, setAddress] = useState(supplier.address || '');
  const [notes,   setNotes]   = useState(supplier.notes   || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = name.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      await api.patch(`/api/suppliers/${supplier.id}`, {
        name: name.trim(), phone: phone.trim() || null,
        email: email.trim() || null, address: address.trim() || null,
        notes: notes.trim() || null,
      });
      onDone();
    } catch (err) { setError(err?.message || 'فشل التحديث'); }
    finally { setSubmitting(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /></div>
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-bold text-white">تعديل بيانات المورد</h2>
          <button onClick={onClose} disabled={submitting} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', opacity: submitting ? 0.4 : 1 }}>
            <X size={18} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-3 space-y-3">
          {[
            { v: name,    set: setName,    label: 'اسم المورد',          required: true, type: 'text' },
            { v: phone,   set: setPhone,   label: 'رقم الهاتف',                          type: 'tel' },
            { v: email,   set: setEmail,   label: 'البريد الإلكتروني',                   type: 'email' },
            { v: address, set: setAddress, label: 'العنوان',                              type: 'text' },
            { v: notes,   set: setNotes,   label: 'ملاحظات',                              type: 'text' },
          ].map((f, i) => (
            <div key={i}>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                {f.label}{f.required ? <span style={{ color: '#f87171' }}> *</span> : null}
              </label>
              <input type={f.type} value={f.v} onChange={e => f.set(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '16px' }} />
            </div>
          ))}
          {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={submit} disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{
              background: canSubmit ? 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' : 'rgba(255,255,255,0.04)',
              border: canSubmit ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)',
              opacity: canSubmit ? 1 : 0.5,
            }}>
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Edit2 size={16} />}
            {submitting ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── EditSupplierPaymentSheet ─────────────────────────────────────────────────

function EditSupplierPaymentSheet({ payment, onClose, onDone }) {
  const api = useApi();
  const [amount, setAmount] = useState(String(payment.amount));
  const [date,   setDate]   = useState((payment.date || '').slice(0, 10));
  const [notes,  setNotes]  = useState(payment.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const numeric = parseFloat((amount || '').replace(',', '.')) || 0;
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
        style={{ background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>المبلغ (DZD)</label>
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
          <button onClick={submit} disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-base touch-manipulation"
            style={{
              background: canSubmit ? 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' : 'rgba(255,255,255,0.04)',
              border: canSubmit ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)',
              opacity: canSubmit ? 1 : 0.5,
            }}>
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Edit2 size={16} />}
            {submitting ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
