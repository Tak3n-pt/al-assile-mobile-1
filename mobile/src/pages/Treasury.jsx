import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

function fmt(n) {
  return (n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

const CAT_LABELS = {
  rent: 'الإيجار', utilities: 'فواتير', salary: 'الرواتب',
  transport: 'النقل', maintenance: 'الصيانة', supplies: 'مستلزمات',
  food: 'طعام', other: 'أخرى',
};

export default function Treasury() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [date,     setDate]     = useState(todayStr());
  const [error,    setError]    = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/treasury?date=${date}`, { headers });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'خطأ');
    } catch { setError('تعذّر تحميل بيانات الصندوق'); }
    setLoading(false);
  }, [token, date]);

  useEffect(() => { load(); }, [load]);

  const net = data?.net || 0;
  const netColor = net >= 0 ? '#10b981' : '#ef4444';

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: '#080c14', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, boxShadow: '0 3px 12px rgba(57,73,171,0.4)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={20} color="white" />
        </button>
        <h1 style={{ flex: 1, fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: 0 }}>الصندوق</h1>
        <button onClick={load} disabled={loading} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={18} color="white" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date picker */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label style={{ color: '#9ca3af', fontSize: '0.82rem', flexShrink: 0 }}>التاريخ:</label>
        <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.45rem 0.75rem', color: 'white', fontSize: '0.9rem' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {loading ? (
          <p style={{ color: '#4a5568', textAlign: 'center', marginTop: '3rem' }}>جارٍ التحميل...</p>
        ) : error ? (
          <p style={{ color: '#f87171', textAlign: 'center', marginTop: '3rem' }}>{error}</p>
        ) : data ? (
          <>
            {/* Net balance card */}
            <div style={{ background: `${netColor}12`, border: `1.5px solid ${netColor}30`, borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>الرصيد الصافي</div>
              <div style={{ color: netColor, fontSize: '2rem', fontWeight: '800' }}>{fmt(net)}</div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>دج</div>
            </div>

            {/* Cash In */}
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px', padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <TrendingUp size={20} color="#10b981" />
                <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.95rem' }}>الواردات</span>
                <span style={{ marginRight: 'auto', color: '#10b981', fontWeight: '800', fontSize: '1.1rem' }}>{fmt(data.cash_in?.total)} دج</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'نقداً',    val: data.cash_in?.cash },
                  { label: 'شيك',      val: data.cash_in?.check },
                  { label: 'تحويل',    val: data.cash_in?.transfer },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>{label}</div>
                    <div style={{ color: '#10b981', fontWeight: '700', fontSize: '0.88rem', marginTop: '2px' }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
              <div style={{ color: '#4a5568', fontSize: '0.78rem', marginTop: '0.6rem', textAlign: 'center' }}>
                {data.cash_in?.sales_count || 0} فاتورة مبيعات
              </div>
            </div>

            {/* Cash Out */}
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '14px', padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <TrendingDown size={20} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.95rem' }}>الصادرات</span>
                <span style={{ marginRight: 'auto', color: '#ef4444', fontWeight: '800', fontSize: '1.1rem' }}>{fmt(data.cash_out?.total)} دج</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>مشتريات ({data.cash_out?.purchases_count || 0})</div>
                  <div style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.88rem', marginTop: '2px' }}>{fmt(data.cash_out?.purchases)}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>مصروفات ({data.cash_out?.expenses_count || 0})</div>
                  <div style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.88rem', marginTop: '2px' }}>{fmt(data.cash_out?.expenses)}</div>
                </div>
              </div>

              {/* Expense breakdown by category */}
              {data.cash_out?.by_category?.length > 0 && (
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.4rem' }}>تفصيل المصروفات:</div>
                  {data.cash_out.by_category.map(c => (
                    <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{CAT_LABELS[c.category] || c.category}</span>
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600' }}>{fmt(c.total)} دج</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <button onClick={() => navigate('/purchases')} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '0.75rem', color: '#818cf8', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                عرض المشتريات
              </button>
              <button onClick={() => navigate('/expenses')} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '0.75rem', color: '#f59e0b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                عرض المصروفات
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
