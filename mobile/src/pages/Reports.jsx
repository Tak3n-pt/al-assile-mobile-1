import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, BarChart2, ShoppingCart, Users, Truck,
  Package, Archive, Wallet, Receipt, Printer, RefreshCw, CheckCircle2,
  AlertTriangle, Loader2, X, TrendingUp, DollarSign, FileText,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

// ── helpers ──────────────────────────────────────────────────────────────

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function rangeFor(preset) {
  const today = new Date();
  const end = isoDate(today);
  if (preset === 'week') { const s = new Date(today); s.setDate(today.getDate() - 6); return { start: isoDate(s), end }; }
  if (preset === 'month') { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { start: isoDate(s), end }; }
  return { start: end, end };
}

const PRINT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
@page { margin: 1.5cm; }
@media print {
  body { font-family: 'Cairo','Arial',sans-serif !important; font-size: 11pt !important; background: white !important; color: black !important; }
  body * { visibility: hidden; }
  #report-print-area, #report-print-area * { visibility: visible; }
  #report-print-area { position: fixed; inset: 0; background: white !important; color: black !important; padding: 0; font-family: 'Cairo','Arial',sans-serif; direction: rtl; }
  #report-print-area * { background: white !important; color: black !important; border-color: #ccc !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  .print-header { display: block !important; text-align: center; border-bottom: 2px solid #333; padding-bottom: .5rem; margin-bottom: 1rem; }
  .print-shop-name { font-size: 16pt; font-weight: bold; }
  .print-report-title { font-size: 13pt; font-weight: 600; margin-top: .2rem; }
  .print-date { font-size: 9pt; color: #555 !important; margin-top: .15rem; }
  table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
  th, td { border: 1px solid #999 !important; padding: 5px 8px; font-size: 11pt; background: white !important; color: black !important; }
  th { background: #f0f0f0 !important; font-weight: bold; }
  tr { page-break-inside: avoid; }
  .print-total { font-weight: bold; font-size: 12pt; margin-top: .75rem; }
  .hidden { display: block !important; }
}
`;

// ── shared ui ─────────────────────────────────────────────────────────────

function PrintButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="no-print flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation"
      style={{ background: '#E8EAF6', border: '1px solid #C5CAE9', color: '#3949AB' }}>
      <Printer size={14} /> طباعة
    </button>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: '#3949AB' }} /></div>;
}

function EmptyState({ icon: Icon = CheckCircle2, color = '#10b981', text = 'لا توجد بيانات' }) {
  return (
    <div className="text-center py-12">
      <Icon size={48} className="mx-auto mb-3" style={{ color }} />
      <p className="font-semibold" style={{ color }}>{text}</p>
    </div>
  );
}

function SummaryCard({ label, value, color, bg }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: bg, border: `1px solid ${color}33` }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}

function UnavailableReport() {
  return (
    <div className="text-center py-16">
      <FileText size={48} className="mx-auto mb-4" style={{ color: '#9ca3af' }} />
      <p className="text-base font-semibold" style={{ color: '#6b7280' }}>هذا التقرير غير متاح في الإصدار الحالي</p>
      <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>سيتم إضافته في تحديث قادم</p>
    </div>
  );
}

function ErrorMsg({ text }) {
  return (
    <div className="rounded-xl p-3.5 mt-2 flex items-start gap-2" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
      <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
      <p className="text-sm" style={{ color: '#ef4444' }}>{text || 'حدث خطأ في تحميل البيانات'}</p>
    </div>
  );
}

// ── ConfirmFixModal ───────────────────────────────────────────────────────

function ConfirmFixModal({ drift, onCancel, onConfirm, isFixing }) {
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={isFixing ? undefined : onCancel} />
      <motion.div className="relative w-full max-w-sm mx-auto rounded-t-3xl flex flex-col overflow-hidden"
        style={{ background: 'white', boxShadow: '0 -8px 32px rgba(0,0,0,0.15)', paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: '#e5e7eb' }} /></div>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <h2 className="text-base font-bold" style={{ color: '#1a1a1a' }}>تأكيد إصلاح الرصيد</h2>
          <button onClick={onCancel} disabled={isFixing} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: '#F3F4F6', opacity: isFixing ? 0.4 : 1 }}>
            <X size={16} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{drift.name}</p>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#ef4444' }}>الرصيد الحالي</p>
              <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(drift.stored_balance || 0)}</p>
            </div>
            <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#10b981' }}>سيصبح</p>
              <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(drift.expected_balance || 0)}</p>
            </div>
          </div>
        </div>
        <div className="px-5 pb-4 flex gap-2">
          <button onClick={onCancel} disabled={isFixing} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#6b7280', opacity: isFixing ? 0.4 : 1 }}>إلغاء</button>
          <button onClick={onConfirm} disabled={isFixing} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', opacity: isFixing ? 0.7 : 1 }}>
            {isFixing ? <Loader2 size={14} className="animate-spin" /> : null}
            {isFixing ? 'جاري الإصلاح...' : 'تأكيد الإصلاح'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── DashboardTab ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid rgb(${tint})` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: `rgb(${tint})` }} />
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(${tint})` }}>{label}</p>
      </div>
      <p className="text-lg font-bold leading-tight" style={{ color: '#1a1a1a' }}>{value}</p>
    </div>
  );
}

function DashboardTab({ range, chartOnly = false }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/reports/summary?start=${range.start}&end=${range.end}`)
      .then(res => { if (!aborted) setData(res); })
      .catch(err => { if (!aborted) console.error('[reports] summary', err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [range.start, range.end]);

  const maxRevenue = useMemo(() => {
    const vals = (data?.daily || []).map(d => d.revenue || 0);
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [data]);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState text={t('noSalesInRange')} color="#9ca3af" />;

  if (chartOnly) return (
    <div>
      {data.daily && data.daily.length > 1 ? (
        <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #e5e7eb' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>{t('salesperDay')}</p>
          <div className="flex items-end gap-1 h-32">
            {data.daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${formatCurrency(d.revenue)}`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max(3, (d.revenue / maxRevenue) * 100)}%`, background: 'linear-gradient(to top, rgba(57,73,171,0.4), rgba(57,73,171,0.75))' }} />
                <span className="text-[9px]" style={{ color: '#9ca3af' }}>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <EmptyState text="لا توجد بيانات كافية للرسم البياني" color="#9ca3af" />}
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={TrendingUp}    label={t('netSales')}    value={formatCurrency(data.net_sales)}       tint="57,73,171" />
        <StatCard icon={Receipt}       label={t('salesCount')}  value={data.sales_count}                     tint="89,101,197" />
        <StatCard icon={DollarSign}    label={t('collected')}   value={formatCurrency(data.total_collected)} tint="16,185,129" />
        <StatCard icon={AlertTriangle} label={t('outstanding')} value={formatCurrency(data.outstanding)}     tint="239,68,68" />
        <StatCard icon={Package}       label={t('unitsSold')}   value={data.items_sold}                      tint="245,158,11" />
        <StatCard icon={ShoppingCart}  label={t('returnsTotal')}value={formatCurrency(data.returns_total)}   tint="156,163,175" />
      </div>
      {data.daily && data.daily.length > 1 && (
        <div className="rounded-xl p-3 mb-4" style={{ background: '#F9FAFB', border: '1px solid #e5e7eb' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>{t('salesperDay')}</p>
          <div className="flex items-end gap-1 h-24">
            {data.daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t" style={{ height: `${Math.max(3, (d.revenue / maxRevenue) * 100)}%`, background: 'linear-gradient(to top, rgba(57,73,171,0.4), rgba(57,73,171,0.75))' }} />
                <span className="text-[9px]" style={{ color: '#9ca3af' }}>{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.top_products && data.top_products.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>{t('topProducts')}</p>
          <div className="space-y-1.5">
            {data.top_products.map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold w-5 text-center" style={{ color: '#3949AB' }}>{i + 1}</span>
                  <p className="text-sm truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>×{p.quantity}</span>
                  <span className="text-sm font-semibold" style={{ color: '#3949AB' }}>{formatCurrency(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.sales_count === 0 && <EmptyState text={t('noSalesInRange')} color="#9ca3af" />}
    </div>
  );
}

// ── StockAlertsTab ────────────────────────────────────────────────────────

function StockAlertsTab() {
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let aborted = false;
    api.get('/api/reports/stock-alerts')
      .then(res => { if (!aborted) setRows(Array.isArray(res) ? res : []); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, []);
  if (loading) return <LoadingState />;
  if (rows.length === 0) return <EmptyState text={t('noStockAlerts')} />;
  return (
    <div className="space-y-2">
      {rows.map(p => {
        const isOut = (p.quantity || 0) <= 0;
        const tint = isOut ? '#ef4444' : '#f59e0b';
        return (
          <div key={p.id} className="flex items-center justify-between p-3.5 rounded-xl"
            style={{ background: 'white', border: `1px solid ${tint}33`, borderLeft: `3px solid ${tint}` }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>{t('minStockAlert')}: {p.min_stock_alert || 0} {p.unit || ''}</p>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-[10px] font-semibold uppercase" style={{ color: tint }}>{isOut ? t('outOfStock') : t('low')}</p>
              <p className="text-base font-bold" style={{ color: tint }}>{p.quantity || 0} {p.unit || ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ReceivablesTab ────────────────────────────────────────────────────────

function ReceivablesTab({ clients }) {
  const debtors = (clients || []).filter(c => (c.balance || 0) < 0).sort((a, b) => (a.balance || 0) - (b.balance || 0));
  const totalOwed = debtors.reduce((s, c) => s + Math.abs(c.balance || 0), 0);
  return (
    <div>
      <style>{PRINT_STYLES}</style>
      <div id="report-print-area">
        <div className="no-print flex items-center justify-between mb-4">
          <SummaryCard label={t('totalOwed')} value={formatCurrency(totalOwed)} color="#ef4444" bg="#FEF2F2" />
          <PrintButton onClick={() => window.print()} />
        </div>
        <div className="print-header" style={{ display: 'none' }}>
          <div className="print-shop-name">المتجر</div>
          <div className="print-report-title">ذمم العملاء</div>
          <div className="print-date">{new Date().toLocaleDateString()}</div>
        </div>
        {debtors.length === 0 ? <EmptyState text={t('noDebtors')} /> : (
          <>
            <div className="no-print space-y-2">
              {debtors.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{c.name}</p>
                    {c.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.phone}</p>}
                  </div>
                  <p className="text-base font-bold" style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(c.balance || 0))}</p>
                </div>
              ))}
            </div>
            <table><thead><tr><th>#</th><th>{t('clientName')}</th><th>{t('clientPhone')}</th><th>{t('totalOwed')}</th></tr></thead>
              <tbody>{debtors.map((c, i) => <tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td>{c.phone || '—'}</td><td>{formatCurrency(Math.abs(c.balance || 0))}</td></tr>)}</tbody>
            </table>
            <p className="print-total">{t('totalOwed')}: {formatCurrency(totalOwed)}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── AllBalancesTab ────────────────────────────────────────────────────────

function AllBalancesTab({ clients }) {
  const withBalance = (clients || []).filter(c => (c.balance || 0) !== 0);
  const debtors   = withBalance.filter(c => (c.balance || 0) < 0).sort((a, b) => (a.balance || 0) - (b.balance || 0));
  const creditors = withBalance.filter(c => (c.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0));
  const totalOwed   = debtors.reduce((s, c) => s + Math.abs(c.balance || 0), 0);
  const totalCredit = creditors.reduce((s, c) => s + (c.balance || 0), 0);
  return (
    <div>
      <style>{PRINT_STYLES}</style>
      <div id="report-print-area">
        <div className="no-print flex items-center justify-between mb-4 gap-2">
          <div className="flex gap-2 flex-1">
            <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[10px] font-semibold uppercase" style={{ color: '#ef4444' }}>{t('totalOwed')}</p>
              <p className="text-base font-bold" style={{ color: '#ef4444' }}>{formatCurrency(totalOwed)}</p>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <p className="text-[10px] font-semibold uppercase" style={{ color: '#10b981' }}>{t('totalCredit')}</p>
              <p className="text-base font-bold" style={{ color: '#10b981' }}>{formatCurrency(totalCredit)}</p>
            </div>
          </div>
          <PrintButton onClick={() => window.print()} />
        </div>
        <div className="print-header" style={{ display: 'none' }}>
          <div className="print-shop-name">المتجر</div>
          <div className="print-report-title">جميع أرصدة العملاء</div>
          <div className="print-date">{new Date().toLocaleDateString()}</div>
        </div>
        {withBalance.length === 0 ? <EmptyState text={t('noBalances')} color="#9ca3af" /> : (
          <>
            <div className="no-print space-y-2">
              {debtors.length > 0 && <>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#ef4444' }}>{t('owes')} ({debtors.length})</p>
                {debtors.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3.5 rounded-xl"
                    style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
                    <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{c.name}</p>{c.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.phone}</p>}</div>
                    <p className="text-base font-bold" style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(c.balance || 0))}</p>
                  </div>
                ))}
              </>}
              {creditors.length > 0 && <>
                <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-1" style={{ color: '#10b981' }}>{t('creditBalance')} ({creditors.length})</p>
                {creditors.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3.5 rounded-xl"
                    style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
                    <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{c.name}</p>{c.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.phone}</p>}</div>
                    <p className="text-base font-bold" style={{ color: '#10b981' }}>+{formatCurrency(c.balance || 0)}</p>
                  </div>
                ))}
              </>}
            </div>
            <table><thead><tr><th>#</th><th>{t('clientName')}</th><th>{t('clientPhone')}</th><th>{t('balance')}</th></tr></thead>
              <tbody>{[...debtors, ...creditors].map((c, i) => <tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td>{c.phone || '—'}</td><td style={{ color: (c.balance || 0) < 0 ? '#c00' : '#060' }}>{formatCurrency(c.balance || 0)}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ── PayablesTab ───────────────────────────────────────────────────────────

function PayablesTab() {
  const api = useApi();
  const [data, setData] = useState({ suppliers: [], total_owed: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let aborted = false;
    api.get('/api/reports/payables')
      .then(res => { if (!aborted) setData(res || { suppliers: [], total_owed: 0 }); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, []);
  if (loading) return <LoadingState />;
  const list = data.suppliers || [];
  return (
    <div>
      <div className="mb-4"><SummaryCard label="المتبقي للموردين" value={formatCurrency(data.total_owed || 0)} color="#ef4444" bg="#FEF2F2" /></div>
      {list.length === 0 ? <EmptyState text={t('noPayables')} /> : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{s.name}</p>
                {s.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.phone}</p>}
              </div>
              <p className="text-base font-bold flex-shrink-0 ml-3" style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(s.balance || 0))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AuditTab ──────────────────────────────────────────────────────────────

function AuditTab() {
  const api = useApi();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fixingId, setFixingId] = useState(null);
  const [confirmDrift, setConfirmDrift] = useState(null);
  const [repairedMap, setRepairedMap] = useState({});
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const fetchAudit = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/clients/audit');
      if (isMountedRef.current) setData(res?.data || res);
    } catch (err) {
      if (isMountedRef.current) setError(err.message || 'فشل تحميل بيانات المراجعة');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const handleFix = async () => {
    if (!confirmDrift) return;
    const d = confirmDrift;
    setFixingId(d.id);
    try {
      const res = await api.post(`/api/clients/${d.id}/repair-balance`);
      const payload = res?.data || res;
      setRepairedMap(prev => ({ ...prev, [d.id]: { old_balance: payload?.old_balance ?? d.stored_balance ?? 0, balance: payload?.balance ?? d.expected_balance ?? 0 } }));
      setConfirmDrift(null);
      await fetchAudit();
    } catch (err) { setConfirmDrift(null); alert(err.message || 'فشل إصلاح الرصيد'); }
    finally { setFixingId(null); }
  };

  if (loading) return <LoadingState />;
  if (error) return (
    <div className="rounded-xl p-4 flex items-start gap-3 mt-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
      <AlertTriangle size={18} style={{ color: '#ef4444' }} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
    </div>
  );

  const drifts = Array.isArray(data?.drifts) ? data.drifts : [];
  return (
    <div>
      <style>{PRINT_STYLES}</style>
      <div id="report-print-area">
        <div className="no-print flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={fetchAudit} className="p-2.5 rounded-xl touch-manipulation" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
              <RefreshCw size={16} style={{ color: '#3949AB' }} />
            </button>
            {drifts.length > 0 && (
              <div className="rounded-xl px-4 py-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-sm font-bold" style={{ color: '#B45309' }}>{drifts.length} انحراف موجود</p>
              </div>
            )}
          </div>
          <PrintButton onClick={() => window.print()} />
        </div>
        <div className="print-header" style={{ display: 'none' }}>
          <div className="print-shop-name">المتجر</div>
          <div className="print-report-title">فحص أرصدة العملاء</div>
          <div className="print-date">{new Date().toLocaleDateString()}</div>
        </div>
        {drifts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={56} className="mx-auto mb-4" style={{ color: '#10b981' }} />
            <p className="text-base font-semibold" style={{ color: '#10b981' }}>{t('allBalancesMatch')}</p>
          </div>
        ) : (
          <div className="no-print space-y-2">
            {drifts.map(d => {
              const repaired = repairedMap[d.id];
              const isFixed = !!repaired;
              const driftAmt = (d.stored_balance || 0) - (d.expected_balance || 0);
              return (
                <div key={d.id} className="rounded-xl p-3.5"
                  style={{ background: isFixed ? '#ECFDF5' : '#FFFBEB', border: isFixed ? '1px solid #A7F3D0' : '1px solid #FDE68A', borderLeft: isFixed ? '3px solid #10b981' : '3px solid #f59e0b' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{d.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                        <span className="text-[11px]" style={{ color: '#6b7280' }}>المخزن: <span className="font-semibold" style={{ color: '#1a1a1a' }}>{formatCurrency(d.stored_balance || 0)}</span></span>
                        <span className="text-[11px]" style={{ color: '#6b7280' }}>المتوقع: <span className="font-semibold" style={{ color: '#1a1a1a' }}>{formatCurrency(d.expected_balance || 0)}</span></span>
                        <span className="text-[11px]" style={{ color: '#6b7280' }}>الفرق: <span className="font-semibold" style={{ color: '#B45309' }}>{formatCurrency(driftAmt)}</span></span>
                      </div>
                      {isFixed && <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#10b981' }}>تم الإصلاح: {formatCurrency(repaired.old_balance)} → {formatCurrency(repaired.balance)}</p>}
                    </div>
                    {isFixed ? (
                      <div className="flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: '#10b981' }}><CheckCircle2 size={14} /> تم الإصلاح</div>
                    ) : isAdmin ? (
                      <button onClick={() => setConfirmDrift(d)} disabled={fixingId === d.id}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold touch-manipulation"
                        style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', opacity: fixingId === d.id ? 0.6 : 1 }}>
                        {fixingId === d.id ? 'جاري...' : 'إصلاح'}
                      </button>
                    ) : (
                      <button disabled className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: '#F3F4F6', border: '1px solid #e5e7eb', color: '#9ca3af', cursor: 'not-allowed' }}>
                        أدمن فقط
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <AnimatePresence>
        {confirmDrift && <ConfirmFixModal drift={confirmDrift} onCancel={() => setConfirmDrift(null)} onConfirm={handleFix} isFixing={fixingId === confirmDrift?.id} />}
      </AnimatePresence>
    </div>
  );
}

// ── SalesInvoicesTab ──────────────────────────────────────────────────────

function SalesInvoicesTab({ range }) {
  const api = useApi();
  const [date, setDate] = useState(range?.end || isoDate(new Date()));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setDate(range?.end || isoDate(new Date())); }, [range?.end]);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/sales?date=${date}`)
      .then(res => { if (!aborted) setData(Array.isArray(res) ? res : (res?.sales || res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [date]);
  const total = data.reduce((s, x) => s + (x.total || 0), 0);
  return (
    <div>
      <div className="mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a' }} />
      </div>
      {loading ? <LoadingState /> : (
        <>
          {data.length > 0 && <div className="mb-3"><SummaryCard label={`${data.length} فاتورة`} value={formatCurrency(total)} color="#2E7D32" bg="#E8F5E9" /></div>}
          {data.length === 0 ? <EmptyState text="لا توجد مبيعات في هذا اليوم" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {data.map(s => (
                <div key={s.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>فاتورة #{s.id}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.client_name || 'عميل عام'}{s.payment_method ? ` · ${s.payment_method}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#2E7D32' }}>{formatCurrency(s.total || 0)}</p>
                      {s.status && <p className="text-[10px] mt-0.5" style={{ color: s.status === 'paid' ? '#10b981' : '#f59e0b' }}>{s.status}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PurchasesReportTab ────────────────────────────────────────────────────

function PurchasesReportTab({ range }) {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/purchases?start=${range.start}&end=${range.end}`)
      .then(res => { if (!aborted) setData(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [range.start, range.end]);
  const total = data.reduce((s, p) => s + (p.total || 0), 0);
  return (
    <div>
      {loading ? <LoadingState /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${data.length} فاتورة مشتريات`} value={formatCurrency(total)} color="#6A1B9A" bg="#F3E5F5" /></div>
          {data.length === 0 ? <EmptyState text="لا توجد مشتريات في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {data.map(p => (
                <div key={p.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #6A1B9A' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{p.supplier_name || 'مورد غير محدد'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.date || p.created_at?.slice(0, 10)}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#6A1B9A' }}>{formatCurrency(p.total || 0)}</p>
                  </div>
                  {p.notes && <p className="text-xs mt-1.5 italic" style={{ color: '#9ca3af' }}>{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── InventoryReportTab ────────────────────────────────────────────────────

function InventoryReportTab({ showOnlyAvailable = false, groupByCategory = false }) {
  const api = useApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let aborted = false;
    api.get('/api/products')
      .then(res => { if (!aborted) setProducts(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = showOnlyAvailable ? products.filter(p => (p.quantity || 0) > 0) : products;
    if (search) list = list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, search, showOnlyAvailable]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = {};
    filtered.forEach(p => {
      const cat = p.category || 'غير مصنف';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupByCategory]);

  if (loading) return <LoadingState />;

  const renderProduct = (p) => {
    const isOut = (p.quantity || 0) <= 0;
    const isLow = !isOut && (p.quantity || 0) <= (p.min_stock_alert || 0);
    const qColor = isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
    return (
      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${qColor}` }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
          {!groupByCategory && p.category && <p className="text-xs" style={{ color: '#9ca3af' }}>{p.category}</p>}
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: qColor }}>{p.quantity || 0} {p.unit || ''}</p>
          {p.sale_price && <p className="text-xs" style={{ color: '#9ca3af' }}>{formatCurrency(p.sale_price)}</p>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <input type="text" placeholder="بحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      <div className="mb-3"><SummaryCard label={`${filtered.length} منتج`} value={`${filtered.reduce((s, p) => s + (p.quantity || 0), 0)} وحدة`} color="#00695C" bg="#E0F2F1" /></div>
      {filtered.length === 0 ? <EmptyState text="لا توجد منتجات" color="#9ca3af" icon={AlertTriangle} /> : (
        grouped ? (
          <div className="space-y-4">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: '#3949AB' }}>{cat} ({items.length})</p>
                <div className="space-y-2">{items.map(renderProduct)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">{filtered.map(renderProduct)}</div>
        )
      )}
    </div>
  );
}

// ── TreasuryReportTab ─────────────────────────────────────────────────────

function TreasuryReportTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/treasury/range?start=${range.start}&end=${range.end}`)
      .then(res => { if (!aborted) setData(res?.data || res); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [range.start, range.end]);
  return (
    <div>
      {loading ? <LoadingState /> : !data ? <EmptyState text="لا توجد بيانات للفترة المحددة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="إجمالي الوارد" value={formatCurrency(data.cash_in || 0)} color="#10b981" bg="#ECFDF5" />
            <SummaryCard label="إجمالي الصادر" value={formatCurrency(data.cash_out || 0)} color="#ef4444" bg="#FEF2F2" />
          </div>
          <SummaryCard label="صافي الصندوق" value={formatCurrency(data.net || 0)} color="#3949AB" bg="#E8EAF6" />
        </div>
      )}
    </div>
  );
}

// ── ExpensesReportTab ─────────────────────────────────────────────────────

function ExpensesReportTab({ range, groupBy = null }) {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/expenses?start=${range.start}&end=${range.end}`)
      .then(res => { if (!aborted) setData(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [range.start, range.end]);

  const total = data.reduce((s, e) => s + (e.amount || 0), 0);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = {};
    data.forEach(e => {
      const key = groupBy === 'category' ? (e.category || 'أخرى') : (e.payment_method || 'غير محدد');
      if (!map[key]) map[key] = { key, total: 0, count: 0 };
      map[key].total += e.amount || 0;
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data, groupBy]);

  return (
    <div>
      {loading ? <LoadingState /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${data.length} مصروف`} value={formatCurrency(total)} color="#B71C1C" bg="#FFEBEE" /></div>
          {data.length === 0 ? <EmptyState text="لا توجد مصروفات في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : grouped ? (
            <div className="space-y-2">
              {grouped.map(g => (
                <div key={g.key} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #ef4444' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{g.key}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{g.count} إدخال</p>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(g.total)}</p>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#FEE2E2' }}>
                    <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.round((g.total / total) * 100) : 0}%`, background: '#ef4444' }} />
                  </div>
                  <p className="text-[10px] mt-1 text-right" style={{ color: '#9ca3af' }}>{total > 0 ? Math.round((g.total / total) * 100) : 0}%</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.map(e => (
                <div key={e.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #ef4444' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{e.description || e.category || 'مصروف'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{e.category && `${e.category} · `}{e.date || e.created_at?.slice(0, 10)}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#ef4444' }}>{formatCurrency(e.amount || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── SalesCreditTab ────────────────────────────────────────────────────────

function SalesCreditTab({ range }) {
  const api = useApi();
  const [date, setDate] = useState(range?.end || isoDate(new Date()));
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setDate(range?.end || isoDate(new Date())); }, [range?.end]);
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/sales?date=${date}`)
      .then(res => { if (!aborted) setAllSales(Array.isArray(res) ? res : (res?.sales || res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [date]);
  const data = allSales.filter(s => s.status === 'pending' || s.status === 'partial');
  const totalRemaining = data.reduce((s, x) => s + Math.max(0, (x.total || 0) - (x.paid_amount || 0)), 0);
  return (
    <div>
      <div className="mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a' }} />
      </div>
      {loading ? <LoadingState /> : (
        <>
          {data.length > 0 && <div className="mb-3"><SummaryCard label={`${data.length} فاتورة اجل · متبقي`} value={formatCurrency(totalRemaining)} color="#E65100" bg="#FFF3E0" /></div>}
          {data.length === 0
            ? <EmptyState text="لا توجد فواتير اجل في هذا اليوم" color="#9ca3af" icon={AlertTriangle} />
            : (
              <div className="space-y-2">
                {data.map(s => {
                  const remaining = Math.max(0, (s.total || 0) - (s.paid_amount || 0));
                  const pct = s.total > 0 ? Math.round(((s.paid_amount || 0) / s.total) * 100) : 0;
                  return (
                    <div key={s.id} className="p-3.5 rounded-xl"
                      style={{ background: 'white', border: '1px solid #FED7AA', borderLeft: '3px solid #E65100' }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>فاتورة #{s.id}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.client_name || 'عميل عام'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: '#E65100' }}>{formatCurrency(remaining)}</p>
                          <p className="text-[10px]" style={{ color: '#9ca3af' }}>من {formatCurrency(s.total)}</p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#FED7AA' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#10b981' }} />
                      </div>
                      <p className="text-[10px] mt-0.5 text-left" style={{ color: '#9ca3af' }}>مدفوع {pct}%</p>
                    </div>
                  );
                })}
              </div>
            )
          }
        </>
      )}
    </div>
  );
}

// ── SalesDiscountsTab ─────────────────────────────────────────────────────

function SalesDiscountsTab({ range }) {
  const api = useApi();
  const [date, setDate] = useState(range?.end || isoDate(new Date()));
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setDate(range?.end || isoDate(new Date())); }, [range?.end]);
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    api.get(`/api/sales?date=${date}`)
      .then(res => { if (!aborted) setAllSales(Array.isArray(res) ? res : (res?.sales || res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [date]);
  const data = allSales.filter(s => (s.discount || 0) > 0);
  const totalDiscount = data.reduce((s, x) => s + (x.discount || 0), 0);
  return (
    <div>
      <div className="mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm"
          style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a' }} />
      </div>
      {loading ? <LoadingState /> : (
        <>
          {data.length > 0 && <div className="mb-3"><SummaryCard label={`${data.length} فاتورة · إجمالي الخصومات`} value={formatCurrency(totalDiscount)} color="#6A1B9A" bg="#F3E5F5" /></div>}
          {data.length === 0
            ? <EmptyState text="لا توجد خصومات في هذا اليوم" color="#9ca3af" icon={AlertTriangle} />
            : (
              <div className="space-y-2">
                {data.map(s => (
                  <div key={s.id} className="p-3.5 rounded-xl"
                    style={{ background: 'white', border: '1px solid #E9D5FF', borderLeft: '3px solid #6A1B9A' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>فاتورة #{s.id}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.client_name || 'عميل عام'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#6A1B9A' }}>خصم {formatCurrency(s.discount)}</p>
                        <p className="text-[10px]" style={{ color: '#9ca3af' }}>الإجمالي: {formatCurrency(s.total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}
    </div>
  );
}

// ── InventoryForCategoryTab ───────────────────────────────────────────────

function InventoryForCategoryTab() {
  const api = useApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let aborted = false;
    api.get('/api/products')
      .then(res => { if (!aborted) setProducts(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, []);
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category || 'غير مصنف'))].sort((a, b) => a.localeCompare(b));
    return cats.map(cat => {
      const items = products.filter(p => (p.category || 'غير مصنف') === cat);
      return { name: cat, count: items.length, totalQty: items.reduce((s, p) => s + (p.quantity || 0), 0) };
    });
  }, [products]);
  const filtered = useMemo(() => {
    if (!selectedCategory) return [];
    let list = products.filter(p => (p.category || 'غير مصنف') === selectedCategory);
    if (search) list = list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, selectedCategory, search]);
  if (loading) return <LoadingState />;
  if (!selectedCategory) return (
    <div>
      <div className="mb-3"><SummaryCard label="عدد التصنيفات" value={`${categories.length} تصنيف`} color="#00695C" bg="#E0F2F1" /></div>
      {categories.length === 0 ? <EmptyState text="لا توجد منتجات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {categories.map(cat => (
            <button key={cat.name} onClick={() => { setSelectedCategory(cat.name); setSearch(''); }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{cat.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{cat.count} منتج · {cat.totalQty} وحدة إجمالية</p>
              </div>
              <span style={{ color: '#9ca3af', flexShrink: 0 }}>{'<'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div>
      <button onClick={() => { setSelectedCategory(null); setSearch(''); }}
        className="flex items-center gap-2 mb-3 text-sm font-semibold touch-manipulation"
        style={{ color: '#3949AB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span>←</span> {selectedCategory}
      </button>
      <input type="text" placeholder="بحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      <div className="mb-3"><SummaryCard label={selectedCategory} value={`${filtered.length} منتج`} color="#00695C" bg="#E0F2F1" /></div>
      {filtered.length === 0 ? <EmptyState text="لا توجد منتجات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {filtered.map(p => {
            const isOut = (p.quantity || 0) <= 0;
            const isLow = !isOut && (p.min_stock_alert || 0) > 0 && (p.quantity || 0) <= p.min_stock_alert;
            const qColor = isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${qColor}` }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
                </div>
                <div className="text-right mr-3 flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: qColor }}>{p.quantity || 0} {p.unit || ''}</p>
                  {p.selling_price > 0 && <p className="text-xs" style={{ color: '#9ca3af' }}>{formatCurrency(p.selling_price)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ExpensesForCategoryTab ─────────────────────────────────────────────────

const EXPENSE_CAT_LABELS = {
  rent: 'إيجار', utilities: 'مرافق', salary: 'رواتب',
  transport: 'نقل', maintenance: 'صيانة', supplies: 'مستلزمات',
  food: 'طعام', other: 'أخرى',
};

function ExpensesForCategoryTab({ range }) {
  const api = useApi();
  const [cats, setCats] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [selectedCat, setSelectedCat] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let aborted = false;
    api.get('/api/expenses/categories')
      .then(res => { if (!aborted) setCats(Array.isArray(res) ? res : []); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingCats(false); });
    return () => { aborted = true; };
  }, []);
  useEffect(() => {
    if (!selectedCat) return;
    let aborted = false;
    setLoading(true);
    api.get(`/api/expenses?category=${selectedCat}&start=${range.start}&end=${range.end}`)
      .then(res => { if (!aborted) setData(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [selectedCat, range.start, range.end]);
  if (loadingCats) return <LoadingState />;
  if (!selectedCat) return (
    <div className="space-y-2">
      {cats.map(cat => (
        <button key={cat} onClick={() => setSelectedCat(cat)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl"
          style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{EXPENSE_CAT_LABELS[cat] || cat}</span>
          <span style={{ color: '#9ca3af' }}>{'<'}</span>
        </button>
      ))}
    </div>
  );
  const total = data.reduce((s, e) => s + (e.amount || 0), 0);
  return (
    <div>
      <button onClick={() => setSelectedCat(null)}
        className="flex items-center gap-2 mb-3 text-sm font-semibold touch-manipulation"
        style={{ color: '#3949AB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span>←</span> {EXPENSE_CAT_LABELS[selectedCat] || selectedCat}
      </button>
      {loading ? <LoadingState /> : (
        <>
          <div className="mb-3"><SummaryCard label={EXPENSE_CAT_LABELS[selectedCat] || selectedCat} value={formatCurrency(total)} color="#B71C1C" bg="#FFEBEE" /></div>
          {data.length === 0 ? <EmptyState text="لا توجد مصروفات في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {data.map(e => (
                <div key={e.id} className="p-3.5 rounded-xl"
                  style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #ef4444' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{e.description || EXPENSE_CAT_LABELS[e.category] || 'مصروف'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{e.date || e.created_at?.slice(0, 10)}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#ef4444' }}>{formatCurrency(e.amount || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ClientStatementTab ────────────────────────────────────────────────────

function ClientStatementTab() {
  const api = useApi();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let aborted = false;
    api.get('/api/clients')
      .then(res => { if (!aborted) setClients(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingClients(false); });
    return () => { aborted = true; };
  }, []);
  useEffect(() => {
    if (!selectedClient) return;
    let aborted = false;
    setLoadingPayments(true);
    api.get(`/api/payments?client_id=${selectedClient.id}`)
      .then(res => { if (!aborted) setPayments(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingPayments(false); });
    return () => { aborted = true; };
  }, [selectedClient?.id]);
  if (loadingClients) return <LoadingState />;
  const filteredClients = search
    ? clients.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))
    : clients;
  if (!selectedClient) return (
    <div>
      <input type="text" placeholder="بحث باسم العميل أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      {filteredClients.length === 0 ? <EmptyState text="لا يوجد عملاء" color="#9ca3af" /> : (
        <div className="space-y-2">
          {filteredClients.map(c => (
            <button key={c.id} onClick={() => setSelectedClient(c)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{c.name}</p>
                {c.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(c.balance || 0) !== 0 && (
                  <span className="text-xs font-semibold" style={{ color: (c.balance || 0) < 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(c.balance || 0))}
                  </span>
                )}
                <span style={{ color: '#9ca3af' }}>{'<'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div>
      <button onClick={() => { setSelectedClient(null); setSearch(''); }}
        className="flex items-center gap-2 mb-3 text-sm font-semibold touch-manipulation"
        style={{ color: '#3949AB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span>←</span> {selectedClient.name}
      </button>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: '#9ca3af' }}>الرصيد</p>
          <p className="text-base font-bold" style={{ color: (selectedClient.balance || 0) < 0 ? '#ef4444' : (selectedClient.balance || 0) > 0 ? '#10b981' : '#1a1a1a' }}>
            {formatCurrency(selectedClient.balance || 0)}
          </p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: '#9ca3af' }}>إجمالي المشتريات</p>
          <p className="text-base font-bold" style={{ color: '#1a1a1a' }}>{formatCurrency(selectedClient.total_purchases || 0)}</p>
        </div>
      </div>
      {loadingPayments ? <LoadingState /> : payments.length === 0
        ? <EmptyState text="لا توجد حركات لهذا العميل" color="#9ca3af" />
        : (
          <div className="space-y-2">
            {payments.map((p, i) => {
              const isSaleRow = p.synthetic === 1;
              const color = isSaleRow ? '#ef4444' : '#10b981';
              const typeLabel = isSaleRow ? `فاتورة #${p.sale_id}` : 'دفعة';
              return (
                <div key={`${p.id}-${i}`} className="flex items-start justify-between p-3 rounded-xl"
                  style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{typeLabel}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                      {p.date || p.created_at?.slice(0, 10)}{p.method ? ` · ${p.method}` : ''}
                    </p>
                    {p.notes && <p className="text-xs mt-0.5 italic truncate" style={{ color: '#9ca3af' }}>{p.notes}</p>}
                  </div>
                  <p className="text-sm font-bold flex-shrink-0 mr-2" style={{ color }}>{formatCurrency(p.amount || 0)}</p>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

// ── SupplierStatementTab ──────────────────────────────────────────────────

function SupplierStatementTab() {
  const api = useApi();
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let aborted = false;
    api.get('/api/suppliers')
      .then(res => { if (!aborted) setSuppliers(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingSuppliers(false); });
    return () => { aborted = true; };
  }, []);
  useEffect(() => {
    if (!selectedSupplier) return;
    let aborted = false;
    setLoadingPayments(true);
    api.get(`/api/suppliers/${selectedSupplier.id}/payments`)
      .then(res => { if (!aborted) setPayments(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingPayments(false); });
    return () => { aborted = true; };
  }, [selectedSupplier?.id]);
  if (loadingSuppliers) return <LoadingState />;
  const filteredSuppliers = search
    ? suppliers.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search))
    : suppliers;
  if (!selectedSupplier) return (
    <div>
      <input type="text" placeholder="بحث باسم المورد أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      {filteredSuppliers.length === 0 ? <EmptyState text="لا يوجد موردون" color="#9ca3af" /> : (
        <div className="space-y-2">
          {filteredSuppliers.map(s => (
            <button key={s.id} onClick={() => setSelectedSupplier(s)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{s.name}</p>
                {s.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(s.balance || 0) !== 0 && (
                  <span className="text-xs font-semibold" style={{ color: (s.balance || 0) < 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(s.balance || 0))}
                  </span>
                )}
                <span style={{ color: '#9ca3af' }}>{'<'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div>
      <button onClick={() => { setSelectedSupplier(null); setSearch(''); }}
        className="flex items-center gap-2 mb-3 text-sm font-semibold touch-manipulation"
        style={{ color: '#3949AB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span>←</span> {selectedSupplier.name}
      </button>
      <div className="mb-3">
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: '#9ca3af' }}>الرصيد</p>
          <p className="text-base font-bold" style={{ color: (selectedSupplier.balance || 0) < 0 ? '#ef4444' : '#1a1a1a' }}>
            {formatCurrency(selectedSupplier.balance || 0)}
          </p>
        </div>
      </div>
      {loadingPayments ? <LoadingState /> : payments.length === 0
        ? <EmptyState text="لا توجد حركات لهذا المورد" color="#9ca3af" />
        : (
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={`${p.id}-${i}`} className="flex items-start justify-between p-3 rounded-xl"
                style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #1565C0' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                    {p.method || 'دفعة'}{p.purchase_id ? ` · مشتريات #${p.purchase_id}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.date || p.created_at?.slice(0, 10)}</p>
                  {p.notes && <p className="text-xs mt-0.5 italic truncate" style={{ color: '#9ca3af' }}>{p.notes}</p>}
                </div>
                <p className="text-sm font-bold flex-shrink-0 mr-2" style={{ color: '#1565C0' }}>{formatCurrency(p.amount || 0)}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── SuppliersAllBalancesTab ───────────────────────────────────────────────

function SuppliersAllBalancesTab() {
  const api = useApi();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let aborted = false;
    api.get('/api/suppliers')
      .then(res => { if (!aborted) setSuppliers(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, []);
  if (loading) return <LoadingState />;
  const withBalance = suppliers.filter(s => (s.balance || 0) !== 0).sort((a, b) => (a.balance || 0) - (b.balance || 0));
  const totalOwed = withBalance.filter(s => (s.balance || 0) < 0).reduce((sum, s) => sum + Math.abs(s.balance || 0), 0);
  return (
    <div>
      <div className="mb-3"><SummaryCard label="إجمالي المستحق للموردين" value={formatCurrency(totalOwed)} color="#1565C0" bg="#E3F2FD" /></div>
      {withBalance.length === 0 ? <EmptyState text="لا توجد أرصدة للموردين" color="#9ca3af" /> : (
        <div className="space-y-2">
          {withBalance.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #BBDEFB', borderLeft: '3px solid #1565C0' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{s.name}</p>
                {s.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.phone}</p>}
              </div>
              <p className="text-base font-bold flex-shrink-0 mr-3"
                style={{ color: (s.balance || 0) < 0 ? '#ef4444' : '#10b981' }}>
                {formatCurrency(s.balance || 0)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared picker helpers ─────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS = {
  cash: 'نقد', نقد: 'نقد',
  card: 'بطاقة', بطاقة: 'بطاقة',
  bank_transfer: 'تحويل بنكي', bank: 'تحويل بنكي',
  check: 'شيك', cheque: 'شيك', شيك: 'شيك',
  credit: 'آجل', آجل: 'آجل',
  mobile: 'دفع إلكتروني',
  other: 'أخرى', أخرى: 'أخرى',
};
function labelMethod(m) { return PAYMENT_METHOD_LABELS[m] || m || '—'; }

function BackBtn({ onClick, label }) {
  return (
    <button onClick={onClick}
      style={{ color: '#3949AB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
      <ArrowRight size={16} />
      {label}
    </button>
  );
}

function ClientPickerList({ onSelect, search, setSearch }) {
  const api = useApi();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let a = false;
    api.get('/api/clients').then(r => { if (!a) setClients(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []); }).catch(() => {}).finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  const list = search ? clients.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)) : clients;
  return (
    <div>
      <input type="text" placeholder="بحث باسم العميل..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      {list.length === 0 ? <EmptyState text="لا يوجد عملاء" color="#9ca3af" /> : (
        <div className="space-y-2">
          {list.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{c.name}</p>
                {c.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{c.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(c.balance || 0) !== 0 && <span className="text-xs font-semibold" style={{ color: (c.balance || 0) < 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(Math.abs(c.balance || 0))}</span>}
                <span style={{ color: '#9ca3af' }}>{'<'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierPickerList({ onSelect, search, setSearch }) {
  const api = useApi();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let a = false;
    api.get('/api/suppliers').then(r => { if (!a) setSuppliers(Array.isArray(r) ? r : (r?.data || [])); }).catch(() => {}).finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  const list = search ? suppliers.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search)) : suppliers;
  return (
    <div>
      <input type="text" placeholder="بحث باسم المورد..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      {list.length === 0 ? <EmptyState text="لا يوجد موردون" color="#9ca3af" /> : (
        <div className="space-y-2">
          {list.map(s => (
            <button key={s.id} onClick={() => onSelect(s)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{s.name}</p>
                {s.phone && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(s.balance || 0) !== 0 && <span className="text-xs font-semibold" style={{ color: (s.balance || 0) < 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(Math.abs(s.balance || 0))}</span>}
                <span style={{ color: '#9ca3af' }}>{'<'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductPickerList({ onSelect, search, setSearch }) {
  const api = useApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let a = false;
    api.get('/api/products').then(r => { if (!a) setProducts(Array.isArray(r) ? r : (r?.data || [])); }).catch(() => {}).finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  const list = search ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase())) : products;
  return (
    <div>
      <input type="text" placeholder="بحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl mb-3 text-sm"
        style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', color: '#1a1a1a', outline: 'none' }} />
      {list.length === 0 ? <EmptyState text="لا توجد منتجات" color="#9ca3af" /> : (
        <div className="space-y-2">
          {list.map(p => (
            <button key={p.id} onClick={() => onSelect(p)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{p.name}</p>
                {p.category && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.category}</p>}
              </div>
              <p className="text-xs font-semibold flex-shrink-0" style={{ color: (p.quantity || 0) > 0 ? '#10b981' : '#ef4444' }}>{p.quantity || 0} {p.unit || ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SalesReturnsTab ───────────────────────────────────────────────────────────

function SalesReturnsTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/sales/returns?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="mb-3"><SummaryCard label={`${rows.length} مرتجع`} value={formatCurrency(data?.total || 0)} color="#ef4444" bg="#FEF2F2" /></div>
      {rows.length === 0 ? <EmptyState text="لا توجد مرتجعات في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map(s => (
            <div key={s.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>مرتجع #{s.id}</p><p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.client_name || 'عميل عام'} · {s.date}</p></div>
                <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(s.total || 0))}</p>
              </div>
              {s.notes && <p className="text-xs mt-1 italic" style={{ color: '#9ca3af' }}>{s.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SalesCancelledTab ─────────────────────────────────────────────────────────

function SalesCancelledTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/sales/cancelled?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="mb-3"><SummaryCard label={`${rows.length} فاتورة ملغاة`} value={formatCurrency(data?.total || 0)} color="#6b7280" bg="#F9FAFB" /></div>
      {rows.length === 0 ? <EmptyState text="لا توجد فواتير ملغاة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map(s => (
            <div key={s.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #9ca3af' }}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>فاتورة #{s.id}</p><p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.client_name || 'عميل عام'} · {s.date}</p></div>
                <p className="text-sm font-bold" style={{ color: '#9ca3af' }}>{formatCurrency(s.total || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Client sub-report tabs ────────────────────────────────────────────────────

function ClientOpeningTab() {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/opening`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : !data ? <EmptyState text="لا توجد بيانات" color="#9ca3af" /> : (
        <>
          <div className="mb-3"><SummaryCard label="الرصيد الحالي" value={formatCurrency(data.client?.balance || 0)} color="#E65100" bg="#FFF3E0" /></div>
          <div className="space-y-2">
            {(data.rows || []).length === 0 ? <EmptyState text="لا توجد حركات افتتاحية" color="#9ca3af" /> : (data.rows || []).map(r => (
              <div key={r.id} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}{r.notes ? ` · ${r.notes}` : ''}</p></div>
                <p className="text-sm font-bold" style={{ color: (r.amount || 0) >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(r.amount || 0)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClientInvoicesTab({ range, totalOnly = false }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/invoices?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <SummaryCard label={`${rows.length} فاتورة`} value={formatCurrency(data?.total_amount || 0)} color="#2E7D32" bg="#E8F5E9" />
            <SummaryCard label="مدفوع" value={formatCurrency(data?.total_paid || 0)} color="#10b981" bg="#ECFDF5" />
          </div>
          {rows.length === 0 ? <EmptyState text="لا توجد فواتير" color="#9ca3af" icon={AlertTriangle} /> : totalOnly ? (
            <div className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
              <div className="flex justify-between mb-1.5"><span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>الإجمالي</span><span className="text-sm font-bold" style={{ color: '#2E7D32' }}>{formatCurrency(data?.total_amount || 0)}</span></div>
              <div className="flex justify-between mb-1.5"><span className="text-sm" style={{ color: '#6b7280' }}>المدفوع</span><span className="text-sm" style={{ color: '#10b981' }}>{formatCurrency(data?.total_paid || 0)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#6b7280' }}>المتبقي</span><span className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency((data?.total_amount || 0) - (data?.total_paid || 0))}</span></div>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(s => (
                <div key={s.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #2E7D32' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>فاتورة #{s.id}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{s.date} · {s.status}</p></div>
                    <div className="text-right"><p className="text-sm font-bold" style={{ color: '#2E7D32' }}>{formatCurrency(s.total || 0)}</p><p className="text-xs" style={{ color: '#9ca3af' }}>مدفوع: {formatCurrency(s.paid_amount || 0)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientReturnsTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/returns?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} مرتجع`} value={formatCurrency(data?.total || 0)} color="#ef4444" bg="#FEF2F2" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد مرتجعات" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
                  <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>مرتجع #{s.id}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{s.date}</p></div>
                  <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(s.total || 0))}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientReceiptsTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/receipts?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} سند قبض`} value={formatCurrency(data?.total || 0)} color="#10b981" bg="#ECFDF5" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد سندات قبض" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-start justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
                  <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method || 'نقد'}{r.sale_id ? ` · فاتورة #${r.sale_id}` : ''}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}{r.notes ? ` · ${r.notes}` : ''}</p></div>
                  <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(r.amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientPaymentsOutTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/payments-out?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} سند صرف`} value={formatCurrency(data?.total || 0)} color="#E65100" bg="#FFF3E0" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد سندات صرف" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-start justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #FED7AA', borderLeft: '3px solid #E65100' }}>
                  <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method || 'صرف'}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}{r.notes ? ` · ${r.notes}` : ''}</p></div>
                  <p className="text-sm font-bold" style={{ color: '#E65100' }}>{formatCurrency(r.amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientSettlementTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/settlement?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {!loading && data && <div className="mb-3"><SummaryCard label="الرصيد الحالي" value={formatCurrency(data?.client?.balance || 0)} color="#3949AB" bg="#E8EAF6" /></div>}
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : rows.length === 0 ? <EmptyState text="لا توجد حركات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isInv = r.type === 'invoice';
            const color = isInv ? '#ef4444' : '#10b981';
            return (
              <div key={i} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}` }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{isInv ? `فاتورة #${r.ref_id}` : `دفعة · ${r.detail || ''}`}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}</p>
                </div>
                <p className="text-sm font-bold flex-shrink-0" style={{ color }}>{isInv ? '-' : '+'}{formatCurrency(Math.abs(r.amount || 0))}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientProductTotalTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/${selected.id}/products?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ClientPickerList onSelect={c => setSelected(c)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} صنف`} value={formatCurrency(data?.grand_total || 0)} color="#E65100" bg="#FFF3E0" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد بيانات" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.product_id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #E65100' }}>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{r.product_name}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.total_qty} {r.unit}</p></div>
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: '#E65100' }}>{formatCurrency(r.total_amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientPaymentMethodTab({ range }) {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/clients/payment-methods?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const total = data.reduce((s, r) => s + (r.total || 0), 0);
  return (
    <div>
      <div className="mb-3"><SummaryCard label="إجمالي المدفوعات" value={formatCurrency(total)} color="#E65100" bg="#FFF3E0" /></div>
      {data.length === 0 ? <EmptyState text="لا توجد مدفوعات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {data.map(r => (
            <div key={r.method} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #E65100' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{labelMethod(r.method)}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.count} حركة</p></div>
                <p className="text-sm font-bold" style={{ color: '#E65100' }}>{formatCurrency(r.total || 0)}</p>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: '#FED7AA' }}>
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.round((r.total / total) * 100) : 0}%`, background: '#E65100' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Supplier sub-report tabs ──────────────────────────────────────────────────

function SupplierOpeningTab() {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/opening`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : !data ? <EmptyState text="لا توجد بيانات" color="#9ca3af" /> : (
        <>
          <div className="mb-3"><SummaryCard label="الرصيد الحالي" value={formatCurrency(data.supplier?.balance || 0)} color="#1565C0" bg="#E3F2FD" /></div>
          <div className="space-y-2">
            {(data.rows || []).length === 0 ? <EmptyState text="لا توجد حركات افتتاحية" color="#9ca3af" /> : (data.rows || []).map(r => (
              <div key={r.id} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}</p></div>
                <p className="text-sm font-bold" style={{ color: '#1565C0' }}>{formatCurrency(r.amount || 0)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SupplierInvoicesTab({ range, totalOnly = false }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/invoices?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <SummaryCard label={`${rows.length} فاتورة`} value={formatCurrency(data?.total_amount || 0)} color="#6A1B9A" bg="#F3E5F5" />
            <SummaryCard label="مدفوع" value={formatCurrency(data?.total_paid || 0)} color="#10b981" bg="#ECFDF5" />
          </div>
          {rows.length === 0 ? <EmptyState text="لا توجد فواتير" color="#9ca3af" icon={AlertTriangle} /> : totalOnly ? (
            <div className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
              <div className="flex justify-between mb-1.5"><span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>الإجمالي</span><span className="text-sm font-bold" style={{ color: '#6A1B9A' }}>{formatCurrency(data?.total_amount || 0)}</span></div>
              <div className="flex justify-between mb-1.5"><span className="text-sm" style={{ color: '#6b7280' }}>المدفوع</span><span className="text-sm" style={{ color: '#10b981' }}>{formatCurrency(data?.total_paid || 0)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#6b7280' }}>المتبقي</span><span className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency((data?.total_amount || 0) - (data?.total_paid || 0))}</span></div>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(p => (
                <div key={p.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #6A1B9A' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>مشتريات #{p.id}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{p.date} · {p.status}</p></div>
                    <div className="text-right"><p className="text-sm font-bold" style={{ color: '#6A1B9A' }}>{formatCurrency(p.total || 0)}</p><p className="text-xs" style={{ color: '#9ca3af' }}>مدفوع: {formatCurrency(p.paid_amount || 0)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierPaymentsOutTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/payments-out?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} دفعة`} value={formatCurrency(data?.total || 0)} color="#1565C0" bg="#E3F2FD" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد دفعات" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-start justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #BBDEFB', borderLeft: '3px solid #1565C0' }}>
                  <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method || 'نقد'}{r.purchase_id ? ` · مشتريات #${r.purchase_id}` : ''}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}{r.notes ? ` · ${r.notes}` : ''}</p></div>
                  <p className="text-sm font-bold" style={{ color: '#1565C0' }}>{formatCurrency(r.amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierReceiptsTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/receipts?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} سند قبض`} value={formatCurrency(data?.total || 0)} color="#10b981" bg="#ECFDF5" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد سندات قبض" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-start justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
                  <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.method || 'استرداد'}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}</p></div>
                  <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(r.amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierSettlementTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/settlement?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {!loading && data && <div className="mb-3"><SummaryCard label="الرصيد الحالي" value={formatCurrency(data?.supplier?.balance || 0)} color="#1565C0" bg="#E3F2FD" /></div>}
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : rows.length === 0 ? <EmptyState text="لا توجد حركات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isInv = r.type === 'invoice';
            const color = isInv ? '#6A1B9A' : '#1565C0';
            return (
              <div key={i} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}` }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{isInv ? `مشتريات #${r.ref_id}` : `دفعة · ${r.detail || ''}`}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}</p>
                </div>
                <p className="text-sm font-bold flex-shrink-0" style={{ color }}>{formatCurrency(Math.abs(r.amount || 0))}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SupplierProductTotalTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/${selected.id}/products?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <SupplierPickerList onSelect={s => setSelected(s)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="mb-3"><SummaryCard label={`${rows.length} صنف`} value={formatCurrency(data?.grand_total || 0)} color="#6A1B9A" bg="#F3E5F5" /></div>
          {rows.length === 0 ? <EmptyState text="لا توجد بيانات" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.product_id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #6A1B9A' }}>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{r.product_name}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.total_qty} {r.unit}</p></div>
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: '#6A1B9A' }}>{formatCurrency(r.total_amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierPaymentMethodTab({ range }) {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/suppliers/payment-methods?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const total = data.reduce((s, r) => s + (r.total || 0), 0);
  return (
    <div>
      <div className="mb-3"><SummaryCard label="إجمالي المدفوعات" value={formatCurrency(total)} color="#1565C0" bg="#E3F2FD" /></div>
      {data.length === 0 ? <EmptyState text="لا توجد مدفوعات" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {data.map(r => (
            <div key={r.method} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #1565C0' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{labelMethod(r.method)}</p><p className="text-xs" style={{ color: '#9ca3af' }}>{r.count} حركة</p></div>
                <p className="text-sm font-bold" style={{ color: '#1565C0' }}>{formatCurrency(r.total || 0)}</p>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: '#BBDEFB' }}>
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.round((r.total / total) * 100) : 0}%`, background: '#1565C0' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PurchasesCancelledTab ─────────────────────────────────────────────────────

function PurchasesCancelledTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/purchases/cancelled?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="mb-3"><SummaryCard label={`${rows.length} فاتورة ملغاة`} value={formatCurrency(data?.total || 0)} color="#6b7280" bg="#F9FAFB" /></div>
      {rows.length === 0 ? <EmptyState text="لا توجد مشتريات ملغاة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map(p => (
            <div key={p.id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #9ca3af' }}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>مشتريات #{p.id}</p><p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.supplier_name || 'مورد غير محدد'} · {p.date}</p></div>
                <p className="text-sm font-bold" style={{ color: '#9ca3af' }}>{formatCurrency(p.total || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InventoryMovementTab ──────────────────────────────────────────────────────

function InventoryMovementTab({ range }) {
  const api = useApi();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!selected) return;
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/inventory/${selected.id}/movement?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [selected?.id, range.start, range.end]);
  if (!selected) return <ProductPickerList onSelect={p => setSelected(p)} search={search} setSearch={setSearch} />;
  const rows = data?.rows || [];
  return (
    <div>
      <BackBtn onClick={() => { setSelected(null); setSearch(''); }} label={selected.name} />
      {loading ? <LoadingState /> : error ? <ErrorMsg text={error} /> : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <SummaryCard label="صافي المباع" value={String(data?.total_sold || 0)} color="#ef4444" bg="#FEF2F2" />
            <SummaryCard label={`مشترى${data?.total_return ? ` · مرتجع: ${data.total_return}` : ''}`} value={String(data?.total_bought || 0)} color="#10b981" bg="#ECFDF5" />
            <SummaryCard label="المخزن" value={String(selected.quantity || 0)} color="#3949AB" bg="#E8EAF6" />
          </div>
          {rows.length === 0 ? <EmptyState text="لا توجد حركات في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
            <div className="space-y-2">
              {rows.map((r, i) => {
                const isReturn = r.type === 'sale' && r.status === 'return';
                const isSale   = r.type === 'sale' && !isReturn;
                const color    = isSale ? '#ef4444' : isReturn ? '#f59e0b' : '#10b981';
                const rowLabel = isSale ? `بيع · ${r.party}` : isReturn ? `مرتجع · ${r.party}` : `شراء · ${r.party}`;
                return (
                  <div key={i} className="flex items-start justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}` }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{rowLabel}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>{r.date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color }}>{r.qty} {selected.unit || ''}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>{formatCurrency(r.total || 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── SalesTaxByProductTab ──────────────────────────────────────────────────

function SalesTaxByProductTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/sales/tax-by-product?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="mb-3"><SummaryCard label="إجمالي الضرائب" value={formatCurrency(data?.grand_tax || 0)} color="#B71C1C" bg="#FFEBEE" /></div>
      {rows.length === 0 ? <EmptyState text="لا توجد مبيعات خاضعة للضريبة في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.product_id} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #B71C1C' }}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{r.product_name}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{r.total_qty} {r.unit} · ضريبة {r.tax_rate}%</p>
                </div>
                <p className="text-sm font-bold flex-shrink-0" style={{ color: '#B71C1C' }}>{formatCurrency(r.total_tax || 0)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: '#9ca3af' }}>مبيعات: {formatCurrency(r.total_sales || 0)}</p>
                <p className="text-xs" style={{ color: '#B71C1C' }}>وعاء ضريبي: {formatCurrency(r.total_sales || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SalesTaxByClientTab ───────────────────────────────────────────────────

function SalesTaxByClientTab({ range }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/sales/tax-by-client?start=${range.start}&end=${range.end}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="mb-3"><SummaryCard label="إجمالي الضرائب" value={formatCurrency(data?.grand_tax || 0)} color="#B71C1C" bg="#FFEBEE" /></div>
      {rows.length === 0 ? <EmptyState text="لا توجد مبيعات خاضعة للضريبة في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.client_id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #B71C1C' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{r.client_name}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{r.invoice_count} فاتورة · مبيعات: {formatCurrency(r.total_sales || 0)}</p>
              </div>
              <p className="text-sm font-bold flex-shrink-0 mr-3" style={{ color: '#B71C1C' }}>{formatCurrency(r.total_tax || 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SalesQuotesTab ────────────────────────────────────────────────────────

function SalesQuotesTab() {
  return <EmptyState icon={FileText} color="#9ca3af" text="لا توجد عروض أسعار مسجلة" />;
}

// ── PurchasesReturnsTab ───────────────────────────────────────────────────

function PurchasesReturnsTab() {
  return <EmptyState icon={Package} color="#9ca3af" text="لا توجد مرتجعات مشتريات مسجلة" />;
}

// ── PurchasesOrdersTab ────────────────────────────────────────────────────

function PurchasesOrdersTab() {
  return <EmptyState icon={ShoppingCart} color="#9ca3af" text="لا توجد طلبات شراء مسجلة" />;
}

// ── InventoryExpiryTab ────────────────────────────────────────────────────

function InventoryExpiryTab() {
  const api = useApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let a = false;
    api.get('/api/products')
      .then(r => { if (!a) setProducts(Array.isArray(r) ? r : (r?.data || [])); })
      .catch(() => {})
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  const today = new Date().toISOString().slice(0, 10);
  const withExpiry = products
    .filter(p => p.expiry_date)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  if (withExpiry.length === 0) return <EmptyState icon={Archive} color="#9ca3af" text="لا توجد منتجات بتاريخ انتهاء مسجل" />;
  const expired = withExpiry.filter(p => p.expiry_date < today);
  const nearExpiry = withExpiry.filter(p => {
    if (p.expiry_date < today) return false;
    const diff = Math.floor((new Date(p.expiry_date) - new Date(today)) / 86400000);
    return diff <= 30;
  });
  const ok = withExpiry.filter(p => {
    if (p.expiry_date < today) return false;
    const diff = Math.floor((new Date(p.expiry_date) - new Date(today)) / 86400000);
    return diff > 30;
  });
  const renderRow = (p) => {
    const isExpired = p.expiry_date < today;
    const diff = Math.floor((new Date(p.expiry_date) - new Date(today)) / 86400000);
    const color = isExpired ? '#ef4444' : diff <= 7 ? '#ef4444' : diff <= 30 ? '#f59e0b' : '#10b981';
    const label = isExpired ? 'منتهي الصلاحية' : diff === 0 ? 'ينتهي اليوم' : `${diff} يوم`;
    return (
      <div key={p.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}` }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.expiry_date} · {p.quantity || 0} {p.unit || ''}</p>
        </div>
        <p className="text-xs font-bold flex-shrink-0 mr-3" style={{ color }}>{label}</p>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {expired.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: '#ef4444' }}>منتهي الصلاحية ({expired.length})</p>
          <div className="space-y-2">{expired.map(renderRow)}</div>
        </div>
      )}
      {nearExpiry.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: '#f59e0b' }}>قريب الانتهاء - خلال 30 يوم ({nearExpiry.length})</p>
          <div className="space-y-2">{nearExpiry.map(renderRow)}</div>
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: '#10b981' }}>صالح ({ok.length})</p>
          <div className="space-y-2">{ok.map(renderRow)}</div>
        </div>
      )}
    </div>
  );
}

// ── InventoryDamagedTab ───────────────────────────────────────────────────

function InventoryDamagedTab() {
  return <EmptyState icon={AlertTriangle} color="#9ca3af" text="لا توجد منتجات تالفة مسجلة" />;
}

// ── TreasuryCapitalTab ────────────────────────────────────────────────────

function TreasuryCapitalTab() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get('/api/reports/treasury/capital')
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  if (!data) return <EmptyState text="لا توجد بيانات" color="#9ca3af" />;
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>الأصول</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
          <div><p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>قيمة المخزون</p><p className="text-xs" style={{ color: '#9ca3af' }}>{data.product_count} منتج · {data.total_units} وحدة</p></div>
          <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(data.stock_value || 0)}</p>
        </div>
        <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>ذمم العملاء (مستحقة لنا)</p>
          <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(data.receivables || 0)}</p>
        </div>
        <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #A7F3D0', borderLeft: '3px solid #10b981' }}>
          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>رصيد الصندوق</p>
          <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(data.treasury || 0)}</p>
        </div>
        <SummaryCard label="إجمالي الأصول" value={formatCurrency(data.total_assets || 0)} color="#10b981" bg="#ECFDF5" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide mt-2" style={{ color: '#ef4444' }}>الالتزامات</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>المستحق للموردين</p>
          <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(data.payables || 0)}</p>
        </div>
        {(data.credit_balance || 0) > 0 && (
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #FECACA', borderLeft: '3px solid #ef4444' }}>
            <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>أرصدة دائنة للعملاء</p>
            <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{formatCurrency(data.credit_balance || 0)}</p>
          </div>
        )}
      </div>
      <SummaryCard label="رأس المال الصافي" value={formatCurrency(data.net_capital || 0)} color="#3949AB" bg="#E8EAF6" />
    </div>
  );
}

// ── TreasuryZakatTab ──────────────────────────────────────────────────────

function TreasuryZakatTab() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get('/api/reports/treasury/capital')
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  if (!data) return <EmptyState text="لا توجد بيانات" color="#9ca3af" />;
  const netAssets = data.net_capital || 0;
  const zakatAmount = netAssets > 0 ? netAssets * 0.025 : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#B45309' }}>ملاحظة: يجب استشارة عالم شرعي لحساب الزكاة بدقة.</p>
        <p className="text-xs" style={{ color: '#92400E' }}>هذا حساب تقريبي بنسبة 2.5% من صافي الأصول.</p>
      </div>
      <SummaryCard label="صافي الأصول" value={formatCurrency(netAssets)} color="#3949AB" bg="#E8EAF6" />
      <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>نسبة الزكاة</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>2.5% من صافي الأصول</p>
        </div>
        <p className="text-sm font-bold" style={{ color: '#B45309' }}>2.5%</p>
      </div>
      {netAssets > 0 ? (
        <SummaryCard label="مقدار الزكاة المستحقة (تقريبي)" value={formatCurrency(zakatAmount)} color="#B45309" bg="#FFFBEB" />
      ) : (
        <EmptyState icon={CheckCircle2} color="#10b981" text="لا تستحق زكاة (الأصول الصافية صفر أو أقل)" />
      )}
    </div>
  );
}

// ── TreasuryTaxTab ────────────────────────────────────────────────────────

function TreasuryTaxTab({ range, includeReturns = false }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let a = false; setLoading(true); setError(null);
    api.get(`/api/reports/treasury/tax?start=${range.start}&end=${range.end}&include_returns=${includeReturns ? 1 : 0}`)
      .then(r => { if (!a) setData(r?.data || r); })
      .catch(err => { if (!a) setError(err?.message || 'خطأ في التحميل'); })
      .finally(() => { if (!a) setLoading(false); });
    return () => { a = true; };
  }, [range.start, range.end, includeReturns]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorMsg text={error} />;
  const rows = data?.rows || [];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SummaryCard label="إجمالي المبيعات" value={formatCurrency(data?.grand_sales || 0)} color="#2E7D32" bg="#E8F5E9" />
        <SummaryCard label="إجمالي الضريبة" value={formatCurrency(data?.grand_tax || 0)} color="#B71C1C" bg="#FFEBEE" />
      </div>
      {rows.length === 0 ? <EmptyState text="لا توجد مبيعات خاضعة للضريبة في هذه الفترة" color="#9ca3af" icon={AlertTriangle} /> : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="p-3.5 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '3px solid #B71C1C' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{r.date}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{r.invoice_count} فاتورة · ضريبة {r.tax_rate}%</p>
                </div>
                <p className="text-sm font-bold" style={{ color: '#B71C1C' }}>{formatCurrency(r.tax_amount || 0)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: '#9ca3af' }}>مبيعات: {formatCurrency(r.sales_amount || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report catalog ────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'store', label: 'المتجر', color: '#3949AB',
    reports: [
      { id: 'store_movement',   label: 'عرض حركه المتجر' },
      { id: 'store_chart',      label: 'عرض حركه المتجر - رسم بياني' },
    ],
  },
  {
    id: 'sales', label: 'المبيعات', color: '#2E7D32',
    reports: [
      { id: 'sales_summary',      label: 'تقرير بالمبيعات' },
      { id: 'sales_profits',      label: 'تقارير الارباح' },
      { id: 'sales_invoices',     label: 'عرض فواتير المبيعات' },
      { id: 'sales_discounts',    label: 'تقرير بالخصومات' },
      { id: 'sales_credit',       label: 'تقرير بالفواتير الاجل' },
      { id: 'sales_returns',      label: 'تقرير بالفواتير المرتجع-مبيعات'         },
      { id: 'sales_cancelled',    label: 'تقرير بفواتير المبيعات التي تم الغائها' },
      { id: 'sales_quotes',       label: 'تقرير بعروض الاسعار' },
      { id: 'sales_tax_product',  label: 'إجمالي الضرائب حسب الصنف' },
      { id: 'sales_tax_client',   label: 'إجمالي الضرائب حسب العميل' },
    ],
  },
  {
    id: 'clients', label: 'العملاء', color: '#E65100',
    reports: [
      { id: 'client_receivables',     label: 'ذمم العملاء' },
      { id: 'client_statement',       label: 'كشف حساب عميل' },
      { id: 'client_audit_confirm',   label: 'تقرير مصادقة حساب العميل'                          },
      { id: 'client_opening',         label: 'تقرير بحركه الرصيد الافتتاحي والنقد للعميل'        },
      { id: 'client_invoices',        label: 'تقرير بالفواتير لعميل'                             },
      { id: 'client_invoices_total',  label: 'تقرير بالفواتير لعميل - إجمالي'                   },
      { id: 'client_returns',         label: 'تقرير بالفواتير المرتجع لعميل'                    },
      { id: 'client_receipts',        label: 'تقرير بسندات القبض لعميل'                         },
      { id: 'client_payments_out',    label: 'تقرير بسندات الصرف لعميل'                        },
      { id: 'client_settlement',      label: 'تقرير بحركة التسديد لعميل'                        },
      { id: 'client_product_total',   label: 'تقرير إجمالي حسب الصنف لعميل'                    },
      { id: 'client_all_balances',    label: 'تقرير بحركه السداد للعملاء' },
      { id: 'client_payment_method',  label: 'تقرير بحركه السداد للعملاء حسب طريقه الدفع'       },
    ],
  },
  {
    id: 'suppliers', label: 'الموردين', color: '#1565C0',
    reports: [
      { id: 'supplier_payables',        label: 'تقرير بالمتبقي للموردين' },
      { id: 'supplier_statement',       label: 'كشف حساب مورد' },
      { id: 'supplier_opening',         label: 'تقرير بحركه الرصيد الافتتاحي والنقد للمورد'        },
      { id: 'supplier_invoices',        label: 'تقرير بالفواتير لمورد'                             },
      { id: 'supplier_invoices_total',  label: 'تقرير بالفواتير لمورد - إجمالي'                   },
      { id: 'supplier_payments_out',    label: 'تقرير بسندات الصرف لمورد'                        },
      { id: 'supplier_receipts',        label: 'تقرير بسندات القبض لمورد'                         },
      { id: 'supplier_settlement',      label: 'تقرير بحركة التسديد لمورد'                        },
      { id: 'supplier_product_total',   label: 'تقرير إجمالي حسب الصنف لمورد'                    },
      { id: 'supplier_all_payments',    label: 'تقرير بحركه السداد للموردين' },
      { id: 'supplier_payment_method',  label: 'تقرير بحركه السداد للموردين حسب طريقه الدفع'      },
    ],
  },
  {
    id: 'purchases', label: 'المشتريات', color: '#6A1B9A',
    reports: [
      { id: 'purchases_report',     label: 'تقرير بالمشتريات' },
      { id: 'purchases_invoices',   label: 'عرض فواتير المشتريات' },
      { id: 'purchases_returns',    label: 'تقرير بالفواتير المرتجع-مشتريات' },
      { id: 'purchases_cancelled',  label: 'تقرير بفواتير المشتريات التي تم الغائها' },
      { id: 'purchases_orders',     label: 'تقرير بطلبات الشراء' },
    ],
  },
  {
    id: 'inventory', label: 'المخازن', color: '#00695C',
    reports: [
      { id: 'inventory_all',         label: 'جرد مخزني' },
      { id: 'inventory_by_category', label: 'جرد مخزني حسب التصنيف' },
      { id: 'inventory_for_category',label: 'جرد مخزني لتصنيف' },
      { id: 'inventory_expiry',      label: 'تقرير بالمنتجات حسب تاريخ الانتهاء' },
      { id: 'inventory_movement',    label: 'تقرير بحركه منتج' },
      { id: 'inventory_damaged',     label: 'تقرير بالمنتجات التالفة' },
    ],
  },
  {
    id: 'treasury', label: 'الصندوق', color: '#B71C1C',
    reports: [
      { id: 'treasury_report',       label: 'تقرير بحركة الصندوق' },
      { id: 'treasury_capital',      label: 'تقرير رأس المال' },
      { id: 'treasury_zakat',        label: 'حساب الزكاة' },
      { id: 'treasury_tax',          label: 'تقرير بالاقرار الضريبي' },
      { id: 'treasury_tax_returns',  label: 'تقرير بالاقرار الضريبي معا المرتجع' },
    ],
  },
  {
    id: 'expenses', label: 'المصروفات', color: '#4E342E',
    reports: [
      { id: 'expenses_report',       label: 'تقرير بالمصروفات' },
      { id: 'expenses_by_category',  label: 'تقرير بالمصروفات حسب الحساب' },
      { id: 'expenses_for_category', label: 'تقرير بالمصروفات لحساب' },
      { id: 'expenses_by_payment',   label: 'تقرير بالمصروفات حسب طريقة الدفع' },
    ],
  },
];

const CLIENT_REPORTS_NEEDING_LIST = new Set(['client_receivables', 'client_all_balances']);

// ── Main Reports component ────────────────────────────────────────────────

export default function Reports() {
  const api = useApi();
  const [range, setRange] = useState(rangeFor('today'));
  const [activeReport, setActiveReport] = useState(null); // { id, label, sectionColor }
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    if (!activeReport || !CLIENT_REPORTS_NEEDING_LIST.has(activeReport.id)) return;
    let aborted = false;
    api.get('/api/clients')
      .then(res => { if (!aborted) setClients(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])); })
      .catch(err => { if (!aborted) console.error(err); })
      .finally(() => { if (!aborted) setLoadingClients(false); });
    return () => { aborted = true; };
  }, [activeReport?.id]);

  const handleOpenReport = (report, sectionColor) => {
    if (CLIENT_REPORTS_NEEDING_LIST.has(report.id)) {
      setClients([]);
      setLoadingClients(true);
    }
    setActiveReport({ ...report, sectionColor });
  };

  const renderReportContent = () => {
    if (!activeReport) return null;
    if (activeReport.unavailable) return <UnavailableReport />;
    if (CLIENT_REPORTS_NEEDING_LIST.has(activeReport.id) && loadingClients) return <LoadingState />;
    switch (activeReport.id) {
      case 'store_movement':      return <DashboardTab range={range} />;
      case 'store_chart':         return <DashboardTab range={range} chartOnly />;
      case 'sales_summary':       return <DashboardTab range={range} />;
      case 'sales_profits':       return <DashboardTab range={range} />;
      case 'sales_invoices':      return <SalesInvoicesTab range={range} />;
      case 'client_receivables':  return <ReceivablesTab clients={clients} />;
      case 'client_all_balances': return <AllBalancesTab clients={clients} />;
      case 'supplier_payables':   return <PayablesTab />;
      case 'purchases_report':
      case 'purchases_invoices':  return <PurchasesReportTab range={range} />;
      case 'inventory_all':       return <InventoryReportTab />;
      case 'inventory_by_category': return <InventoryReportTab groupByCategory />;
      case 'treasury_report':     return <TreasuryReportTab range={range} />;
      case 'expenses_report':          return <ExpensesReportTab range={range} />;
      case 'expenses_by_category':     return <ExpensesReportTab range={range} groupBy="category" />;
      case 'expenses_by_payment':      return <ExpensesReportTab range={range} groupBy="payment" />;
      case 'expenses_for_category':    return <ExpensesForCategoryTab range={range} />;
      case 'sales_credit':             return <SalesCreditTab range={range} />;
      case 'sales_discounts':          return <SalesDiscountsTab range={range} />;
      case 'client_statement':         return <ClientStatementTab />;
      case 'supplier_statement':       return <SupplierStatementTab />;
      case 'supplier_all_payments':    return <SuppliersAllBalancesTab />;
      case 'inventory_for_category':   return <InventoryForCategoryTab />;
      case 'sales_returns':            return <SalesReturnsTab range={range} />;
      case 'sales_cancelled':          return <SalesCancelledTab range={range} />;
      case 'client_audit_confirm':     return <AuditTab />;
      case 'client_opening':           return <ClientOpeningTab />;
      case 'client_invoices':          return <ClientInvoicesTab range={range} />;
      case 'client_invoices_total':    return <ClientInvoicesTab range={range} totalOnly />;
      case 'client_returns':           return <ClientReturnsTab range={range} />;
      case 'client_receipts':          return <ClientReceiptsTab range={range} />;
      case 'client_payments_out':      return <ClientPaymentsOutTab range={range} />;
      case 'client_settlement':        return <ClientSettlementTab range={range} />;
      case 'client_product_total':     return <ClientProductTotalTab range={range} />;
      case 'client_payment_method':    return <ClientPaymentMethodTab range={range} />;
      case 'supplier_opening':         return <SupplierOpeningTab />;
      case 'supplier_invoices':        return <SupplierInvoicesTab range={range} />;
      case 'supplier_invoices_total':  return <SupplierInvoicesTab range={range} totalOnly />;
      case 'supplier_payments_out':    return <SupplierPaymentsOutTab range={range} />;
      case 'supplier_receipts':        return <SupplierReceiptsTab range={range} />;
      case 'supplier_settlement':      return <SupplierSettlementTab range={range} />;
      case 'supplier_product_total':   return <SupplierProductTotalTab range={range} />;
      case 'supplier_payment_method':  return <SupplierPaymentMethodTab range={range} />;
      case 'purchases_cancelled':      return <PurchasesCancelledTab range={range} />;
      case 'purchases_returns':        return <PurchasesReturnsTab />;
      case 'purchases_orders':         return <PurchasesOrdersTab />;
      case 'inventory_movement':       return <InventoryMovementTab range={range} />;
      case 'inventory_expiry':         return <InventoryExpiryTab />;
      case 'inventory_damaged':        return <InventoryDamagedTab />;
      case 'sales_quotes':             return <SalesQuotesTab />;
      case 'sales_tax_product':        return <SalesTaxByProductTab range={range} />;
      case 'sales_tax_client':         return <SalesTaxByClientTab range={range} />;
      case 'treasury_capital':         return <TreasuryCapitalTab />;
      case 'treasury_zakat':           return <TreasuryZakatTab />;
      case 'treasury_tax':             return <TreasuryTaxTab range={range} />;
      case 'treasury_tax_returns':     return <TreasuryTaxTab range={range} includeReturns />;
      default:                         return <UnavailableReport />;
    }
  };

  // ── REPORT DETAIL VIEW ────────────────────────────────────────────────
  if (activeReport) {
    return (
      <div dir="rtl" style={{ height: '100%', background: '#F0F2F5', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif", overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 3px 12px rgba(57,73,171,0.4)', flexShrink: 0 }}>
          <button onClick={() => setActiveReport(null)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowRight size={20} color="white" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontSize: '0.95rem', fontWeight: '700', margin: 0, lineHeight: 1.3 }}>{activeReport.label}</h1>
          </div>
          <div style={{ width: '36px' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 1.5rem' }}>
          {renderReportContent()}
        </div>
      </div>
    );
  }

  // ── MAIN LIST VIEW ────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ height: '100%', background: '#F0F2F5', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif", overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.75rem 1.25rem', boxShadow: '0 3px 12px rgba(57,73,171,0.4)', flexShrink: 0 }}>
        <h1 style={{ color: 'white', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.6rem' }}>الاستعلامات</h1>
        {/* Date range bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>للفترة من</span>
          <input type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
            style={{ flex: 1, padding: '0.35rem 0.6rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.75rem', minWidth: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>الي</span>
          <input type="date" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
            style={{ flex: 1, padding: '0.35rem 0.6rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.75rem', minWidth: 0 }} />
          <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
            {[['اليوم', 'today'], ['أسبوع', 'week'], ['شهر', 'month']].map(([lbl, p]) => (
              <button key={p} onClick={() => setRange(rangeFor(p))}
                style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flat scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 1.5rem' }}>
        {SECTIONS.map(section => (
          <div key={section.id}>
            {/* Section header */}
            <div style={{ background: '#F0F2F5', padding: '0.75rem 0.25rem 0.35rem', position: 'sticky', top: 0, zIndex: 1 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: section.color }}>{section.label}</span>
            </div>
            {/* Report rows */}
            {section.reports.map(report => (
              <button
                key={report.id}
                onClick={() => handleOpenReport(report, section.color)}
                style={{
                  width: '100%', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6',
                  padding: '0.85rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.875rem', color: report.unavailable ? '#9ca3af' : '#1a1a1a', textAlign: 'right', lineHeight: 1.4, flex: 1 }}>{report.label}</span>
                <span style={{ color: report.unavailable ? '#d1d5db' : '#9ca3af', flexShrink: 0, fontSize: '1rem' }}>{'<'}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
