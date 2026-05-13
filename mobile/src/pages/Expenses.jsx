import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, X, Wallet, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

const CATEGORIES = [
  { value: 'rent',        label: 'الإيجار',        color: '#8b5cf6' },
  { value: 'utilities',   label: 'فواتير',          color: '#3b82f6' },
  { value: 'salary',      label: 'الرواتب',         color: '#10b981' },
  { value: 'transport',   label: 'النقل',            color: '#f59e0b' },
  { value: 'maintenance', label: 'الصيانة',         color: '#ef4444' },
  { value: 'supplies',    label: 'مستلزمات',        color: '#06b6d4' },
  { value: 'food',        label: 'طعام وشراب',      color: '#84cc16' },
  { value: 'other',       label: 'أخرى',            color: '#6b7280' },
];

function fmt(n) {
  return (n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

export default function Expenses() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const [form, setForm] = useState({
    amount: '', category: 'other', description: '',
    date: todayStr(), payment_method: 'cash', notes: '',
  });

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res  = await fetch('/api/expenses', { headers });
      const json = await res.json();
      if (json.success) setExpenses(json.data || []);
    } catch { setLoadError('تعذّر تحميل البيانات'); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return setError('أدخل مبلغاً صحيحاً');

    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers,
        body: JSON.stringify({ amount, category: form.category, description: form.description || null, date: form.date, payment_method: form.payment_method, notes: form.notes || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'خطأ');
      setShowForm(false);
      setForm({ amount: '', category: 'other', description: '', date: todayStr(), payment_method: 'cash', notes: '' });
      load();
    } catch (err) { setError(err.message); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('حذف هذا المصروف؟')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('server');
      setExpenses(ex => ex.filter(e => e.id !== id));
    } catch { setLoadError('تعذّر الحذف، حاول مجدداً'); }
  }

  const totalToday = expenses
    .filter(e => e.date === todayStr())
    .reduce((s, e) => s + (e.amount || 0), 0);

  const filtered = activeCategory ? expenses.filter(e => e.category === activeCategory) : expenses;

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: '#080c14', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, boxShadow: '0 3px 12px rgba(57,73,171,0.4)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={20} color="white" />
        </button>
        <h1 style={{ flex: 1, fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: 0 }}>المصروفات</h1>
        <button onClick={() => setShowForm(true)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '0.5rem 1rem', color: 'white', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> جديد
        </button>
      </div>

      {/* Today summary bar */}
      <div style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>مجموع اليوم</span>
        <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.95rem' }}>{fmt(totalToday)} دج</span>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', overflowX: 'auto', flexShrink: 0 }}>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setActiveCategory(v => v === c.value ? '' : c.value)} style={{ background: activeCategory === c.value ? `${c.color}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${activeCategory === c.value ? c.color : c.color + '40'}`, borderRadius: '20px', padding: '0.3rem 0.75rem', color: c.color, fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.75rem 0.75rem' }}>
        {loading ? (
          <p style={{ color: '#4a5568', textAlign: 'center', marginTop: '3rem' }}>جارٍ التحميل...</p>
        ) : loadError ? (
          <p style={{ color: '#f87171', textAlign: 'center', marginTop: '3rem', fontSize: '0.9rem' }}>{loadError}</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <Wallet size={48} color="#1e293b" />
            <p style={{ color: '#3d5068', marginTop: '1rem' }}>لا توجد مصروفات بعد</p>
          </div>
        ) : filtered.map(exp => {
          const cat = CATEGORIES.find(c => c.value === exp.category) || CATEGORIES[7];
          return (
            <div key={exp.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.85rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wallet size={18} color={cat.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: cat.color, fontSize: '0.78rem', fontWeight: '600' }}>{cat.label}</span>
                  <span style={{ color: '#f87171', fontWeight: '700' }}>{fmt(exp.amount)} دج</span>
                </div>
                {exp.description && <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.1rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</p>}
                <span style={{ color: '#3d5068', fontSize: '0.72rem' }}>{exp.date} · {{ cash: 'نقداً', check: 'شيك', transfer: 'تحويل' }[exp.payment_method] || exp.payment_method}</span>
              </div>
              <button onClick={() => handleDelete(exp.id)} style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={15} color="#f87171" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div dir="rtl" style={{ background: '#0f172a', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: '700', margin: 0 }}>مصروف جديد</h2>
              <button onClick={() => { setShowForm(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#9ca3af" /></button>
            </div>

            {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}

            <form onSubmit={handleSubmit}>
              {/* Amount */}
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>المبلغ (دج) *</label>
              <input type="number" min="0.01" step="any" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" autoFocus
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', color: 'white', fontSize: '1.1rem', fontWeight: '700', boxSizing: 'border-box', marginBottom: '0.9rem' }} />

              {/* Category */}
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>التصنيف</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.9rem' }}>
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, category: c.value }))}
                    style={{ background: form.category === c.value ? `${c.color}25` : 'rgba(255,255,255,0.04)', border: `1px solid ${form.category === c.value ? c.color : 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', padding: '0.45rem 0.25rem', color: form.category === c.value ? c.color : '#6b7280', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer' }}>
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Description */}
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>الوصف</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف مختصر..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.9rem' }} />

              {/* Date + Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>التاريخ</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>طريقة الدفع</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem' }}>
                    <option value="cash" style={{ background: '#1e293b' }}>نقداً</option>
                    <option value="check" style={{ background: '#1e293b' }}>شيك</option>
                    <option value="transfer" style={{ background: '#1e293b' }}>تحويل</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', background: saving ? '#374151' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: '12px', padding: '0.9rem', color: 'white', fontWeight: '700', fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'جارٍ الحفظ...' : 'تسجيل المصروف'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
