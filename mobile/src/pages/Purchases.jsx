import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, X, Package, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

const STATUS_COLORS = {
  paid:      { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  partial:   { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  pending:   { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
  cancelled: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
};
const STATUS_LABELS = { paid: 'مدفوع', partial: 'جزئي', pending: 'معلق', cancelled: 'ملغى' };

function fmt(n) {
  return (n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

export default function Purchases() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({
    supplier_id: '',
    date: todayStr(),
    payment_method: 'cash',
    discount: '',
    paid_amount: '',
    notes: '',
    items: [{ product_id: '', quantity: '1', unit_price: '' }],
  });

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [pRes, sRes, prRes] = await Promise.all([
        fetch('/api/purchases', { headers }),
        fetch('/api/suppliers',  { headers }),
        fetch('/api/products',   { headers }),
      ]);
      const [p, s, pr] = await Promise.all([pRes.json(), sRes.json(), prRes.json()]);
      if (p.success)  setPurchases(p.data || []);
      if (s.success)  setSuppliers(s.data || s.suppliers || []);
      if (pr.success) setProducts(pr.data  || pr.products || []);
    } catch { setLoadError('تعذّر تحميل البيانات'); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { product_id: '', quantity: '1', unit_price: '' }] }));
  }
  function removeItem(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  function updateItem(i, field, val) {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: val };
      // auto-fill purchase price from product
      if (field === 'product_id' && val) {
        const prod = products.find(p => p.id === parseInt(val, 10));
        if (prod && prod.purchase_price) items[i].unit_price = String(prod.purchase_price);
      }
      return { ...f, items };
    });
  }

  const subtotal = form.items.reduce((s, it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return s + q * p;
  }, 0);
  const total = Math.max(0, subtotal - (parseFloat(form.discount) || 0));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const items = form.items
      .filter(it => it.product_id && parseFloat(it.quantity) > 0)
      .map(it => ({
        product_id: parseInt(it.product_id, 10),
        quantity:   parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price) || 0,
      }));
    if (items.length === 0) return setError('أضف منتجاً واحداً على الأقل');

    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          supplier_id:    form.supplier_id ? parseInt(form.supplier_id, 10) : null,
          date:           form.date,
          payment_method: form.payment_method,
          discount:       parseFloat(form.discount) || 0,
          paid_amount:    parseFloat(form.paid_amount) || 0,
          notes:          form.notes || null,
          items,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'خطأ');
      setShowForm(false);
      setForm({ supplier_id: '', date: todayStr(), payment_method: 'cash', discount: '', paid_amount: '', notes: '', items: [{ product_id: '', quantity: '1', unit_price: '' }] });
      load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: '#080c14', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, boxShadow: '0 3px 12px rgba(57,73,171,0.4)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={20} color="white" />
        </button>
        <h1 style={{ flex: 1, fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: 0 }}>المشتريات</h1>
        <button onClick={() => setShowForm(true)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '0.5rem 1rem', color: 'white', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> جديد
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {loading ? (
          <p style={{ color: '#4a5568', textAlign: 'center', marginTop: '3rem' }}>جارٍ التحميل...</p>
        ) : loadError ? (
          <p style={{ color: '#f87171', textAlign: 'center', marginTop: '3rem', fontSize: '0.9rem' }}>{loadError}</p>
        ) : purchases.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <Package size={48} color="#1e293b" />
            <p style={{ color: '#3d5068', marginTop: '1rem' }}>لا توجد مشتريات بعد</p>
          </div>
        ) : purchases.map(p => {
          const sc = STATUS_COLORS[p.status] || STATUS_COLORS.pending;
          return (
            <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.9rem', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>#{p.id} · {p.date}</span>
                  {p.supplier_name && <p style={{ color: 'white', fontWeight: '600', margin: '0.2rem 0 0' }}>{p.supplier_name}</p>}
                </div>
                <span style={{ background: sc.bg, color: sc.text, borderRadius: '8px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: '600' }}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem' }}>
                <span style={{ color: '#4a5568', fontSize: '0.8rem' }}>{{ cash: 'نقداً', check: 'شيك', transfer: 'تحويل' }[p.payment_method] || p.payment_method}</span>
                <span style={{ color: '#D4A574', fontWeight: '700' }}>{fmt(p.total)} دج</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div dir="rtl" style={{ background: '#0f172a', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: '700', margin: 0 }}>فاتورة شراء جديدة</h2>
              <button onClick={() => { setShowForm(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#9ca3af" /></button>
            </div>

            {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}

            <form onSubmit={handleSubmit}>
              {/* Supplier */}
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>المورد</label>
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', marginBottom: '0.9rem', fontSize: '0.9rem' }}>
                <option value="">بدون مورد</option>
                {suppliers.map(s => <option key={s.id} value={s.id} style={{ background: '#1e293b' }}>{s.name}</option>)}
              </select>

              {/* Date + Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>التاريخ</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>الدفع</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem' }}>
                    <option value="cash" style={{ background: '#1e293b' }}>نقداً</option>
                    <option value="check" style={{ background: '#1e293b' }}>شيك</option>
                    <option value="transfer" style={{ background: '#1e293b' }}>تحويل</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>المنتجات</label>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select value={it.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.55rem 0.4rem', color: 'white', fontSize: '0.8rem' }}>
                    <option value="" style={{ background: '#1e293b' }}>اختر</option>
                    {products.map(p => <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="الكمية" min="0.01" step="any" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.55rem 0.4rem', color: 'white', fontSize: '0.8rem', textAlign: 'center' }} />
                  <input type="number" placeholder="السعر" min="0" step="any" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.55rem 0.4rem', color: 'white', fontSize: '0.8rem', textAlign: 'center' }} />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer' }}>
                      <X size={14} color="#f87171" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} style={{ background: 'rgba(79,70,229,0.1)', border: '1px dashed rgba(79,70,229,0.4)', borderRadius: '8px', padding: '0.5rem', width: '100%', color: '#818cf8', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.9rem' }}>
                + إضافة منتج
              </button>

              {/* Discount + Paid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>الخصم</label>
                  <input type="number" min="0" step="any" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} placeholder="0"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>المدفوع</label>
                  <input type="number" min="0" step="any" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} placeholder="0"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.65rem', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Total preview */}
              <div style={{ background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>المجموع</span>
                <span style={{ color: '#D4A574', fontWeight: '700', fontSize: '1rem' }}>{fmt(total)} دج</span>
              </div>

              <button type="submit" disabled={saving}
                style={{ width: '100%', background: saving ? '#374151' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', borderRadius: '12px', padding: '0.9rem', color: 'white', fontWeight: '700', fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'جارٍ الحفظ...' : 'تسجيل الفاتورة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
