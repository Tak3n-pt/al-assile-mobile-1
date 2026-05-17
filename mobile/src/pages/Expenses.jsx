import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// Free-form input with a suggestion dropdown drawn from `options`.
// The user can pick a past value OR type a brand-new one.
function Autocomplete({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = (options || [])
    .filter(o => !value || o.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: '1.5px solid #90caf9',
          borderRadius: '8px',
          background: 'white',
          textAlign: 'right',
          padding: '0.65rem 0.75rem',
          fontSize: '0.95rem',
          fontFamily: "'Cairo','Tajawal',sans-serif",
          outline: 'none',
          color: '#1a1a1a',
          boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', insetInlineStart: 0, insetInlineEnd: 0,
          background: 'white', border: '1px solid #cfd8dc', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: '180px', overflowY: 'auto',
        }}>
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'right',
                background: 'white', border: 'none', borderBottom: '1px solid #f1f5f9',
                padding: '0.55rem 0.8rem', fontSize: '0.9rem',
                color: '#1a1a1a', cursor: 'pointer',
                fontFamily: "'Cairo','Tajawal',sans-serif",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: 'cash',  label: 'من الصندوق', color: '#10b981' },
  { value: 'card',  label: 'بطاقة',       color: '#6b7280' },
  { value: 'check', label: 'شيك',         color: '#6b7280' },
];

export default function Expenses() {
  const { token } = useAuth();

  const [account, setAccount]         = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [paymentMethod, setPM]        = useState('cash');
  const [date, setDate]               = useState(todayStr());

  const [accountOptions, setAccountOptions]         = useState([]);
  const [descriptionOptions, setDescriptionOptions] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [okMsg,  setOkMsg]  = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadOptions = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        fetch('/api/expenses/accounts',     { headers }).then(r => r.json()),
        fetch('/api/expenses/descriptions', { headers }).then(r => r.json()),
      ]);
      if (a.success) setAccountOptions(a.data || []);
      if (d.success) setDescriptionOptions(d.data || []);
    } catch {}
  }, [token]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const amt = parseFloat(amount) || 0;
  const canSave = amt > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(''); setOkMsg(''); setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers,
        body: JSON.stringify({
          amount: amt,
          category:       account.trim() || null,
          description:    description.trim() || null,
          date,
          payment_method: paymentMethod,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'فشل الحفظ');
      setOkMsg('تم حفظ المصروف');
      setAccount(''); setDescription(''); setAmount(''); setPM('cash'); setDate(todayStr());
      loadOptions();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  const labelStyle = { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '6px', fontWeight: '600' };

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header — centered title + icon on the right, no back arrow, no border */}
      <div style={{ position: 'relative', padding: '1.1rem 1rem 0.5rem' }}>
        <h1 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>المصروفات</h1>
        <span style={{ position: 'absolute', top: '0.85rem', insetInlineEnd: '0.85rem', fontSize: '1.6rem' }}>💼</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* Account */}
        <label style={labelStyle}>الحساب</label>
        <Autocomplete value={account} onChange={setAccount} options={accountOptions} placeholder="ابحث أو اكتب اسم الحساب" />

        {/* Description */}
        <div style={{ marginTop: '0.85rem' }}>
          <label style={labelStyle}>البيان</label>
          <Autocomplete value={description} onChange={setDescription} options={descriptionOptions} placeholder="ابحث أو اكتب البيان" />
        </div>

        {/* Amount */}
        <div style={{ marginTop: '0.85rem' }}>
          <label style={labelStyle}>ادخل المبلغ</label>
          <input
            type="number" inputMode="decimal" min="0" step="any"
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            style={{
              width: '100%', border: '1.5px solid #90caf9', borderRadius: '8px',
              background: 'white', textAlign: 'center', padding: '0.7rem',
              fontSize: '1.1rem', fontWeight: '700', color: '#e91e63',
              fontFamily: "'Cairo','Tajawal',sans-serif", outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Payment method */}
        <div style={{ marginTop: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#1a1a1a', fontWeight: '600' }}>طريقة الدفع</span>
          <div style={{ display: 'flex', gap: '0.85rem' }}>
            {PAYMENT_METHODS.map(p => (
              <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.88rem', color: '#1a1a1a' }}>
                <span>{p.label}</span>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  border: `2px solid ${paymentMethod === p.value ? p.color : '#9e9e9e'}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white',
                }}>
                  {paymentMethod === p.value && (
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                  )}
                </span>
                <input
                  type="radio" name="pm" value={p.value} checked={paymentMethod === p.value}
                  onChange={() => setPM(p.value)} style={{ display: 'none' }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Date */}
        <div style={{ marginTop: '1.2rem', border: '1.5px solid #90caf9', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <span style={{ flex: 1, textAlign: 'right', padding: '0.65rem 0.85rem', fontSize: '0.95rem', color: '#1a1a1a', fontWeight: '600' }}>التاريخ</span>
          <label style={{ background: '#e0e0e0', padding: '0.65rem 0.95rem', cursor: 'pointer', fontSize: '0.95rem', color: '#1a1a1a', position: 'relative' }}>
            {date}
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>

        {/* Messages */}
        {error && <p style={{ color: '#d32f2f', textAlign: 'center', marginTop: '0.85rem', fontSize: '0.9rem' }}>{error}</p>}
        {okMsg && <p style={{ color: '#2e7d32', textAlign: 'center', marginTop: '0.85rem', fontSize: '0.9rem' }}>{okMsg}</p>}

        {/* Save */}
        <button
          onClick={handleSave} disabled={!canSave}
          style={{
            width: '100%', marginTop: '1.5rem',
            background: canSave ? '#3949AB' : '#cfd8dc',
            color: canSave ? 'white' : '#546e7a',
            border: 'none', borderRadius: '8px',
            padding: '0.85rem', fontSize: '1rem', fontWeight: '700',
            cursor: canSave ? 'pointer' : 'not-allowed',
            fontFamily: "'Cairo','Tajawal',sans-serif",
          }}
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
