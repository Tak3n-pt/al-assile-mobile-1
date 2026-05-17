import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

function fmt(n) {
  return (Number(n) || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '40px', height: '22px', borderRadius: '22px',
        background: checked ? '#3949AB' : '#cfd8dc',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 0.15s ease',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.15s ease',
      }} />
    </button>
  );
}

export default function Treasury() {
  const { token } = useAuth();

  const [type, setType]         = useState('add'); // 'add' | 'sub'
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(todayStr());
  const [description, setDesc]  = useState('');

  const [settings, setSettings] = useState({ include_sales: false, include_purchases: false, include_expenses: false });
  const [balance, setBalance]   = useState(0);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [okMsg,  setOkMsg]  = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/balance', { headers }).then(r => r.json());
      if (res.success) {
        setBalance(res.data.balance);
        setSettings(res.data.settings);
      }
    } catch {}
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  async function persistSettings(next) {
    setSettings(next); // optimistic
    try {
      const res = await fetch('/api/treasury/settings', {
        method: 'PUT', headers, body: JSON.stringify(next),
      }).then(r => r.json());
      if (res.success) {
        setSettings(res.data);
        refresh();
      }
    } catch {}
  }

  const amt = parseFloat(amount) || 0;
  const canSave = amt > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(''); setOkMsg(''); setSaving(true);
    try {
      const res = await fetch('/api/treasury/entries', {
        method: 'POST', headers,
        body: JSON.stringify({ type, amount: amt, date, description: description.trim() || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'فشل الحفظ');
      setOkMsg(type === 'add' ? 'تمت الإضافة للصندوق' : 'تم الخصم من الصندوق');
      setAmount(''); setDesc('');
      if (json.data) {
        setBalance(json.data.balance);
        setSettings(json.data.settings);
      } else {
        refresh();
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  const isAdd = type === 'add';
  const submitLabel = isAdd ? 'أضافة المبلغ للصندوق' : 'خصم المبلغ من الصندوق';

  const labelStyle = { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '6px', fontWeight: '600' };

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header — centered title + icon on the right, no back arrow, no border */}
      <div style={{ position: 'relative', padding: '1.1rem 1rem 0.5rem' }}>
        <h1 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>الصندوق</h1>
        <span style={{ position: 'absolute', top: '0.85rem', insetInlineEnd: '0.85rem', fontSize: '1.6rem' }}>🏦</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '5rem' }}>
        {/* Add / Subtract toggle card */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-around', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '0.95rem' }}>اضافه للصندوق</span>
            <span style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: `2px solid ${isAdd ? '#2e7d32' : '#9e9e9e'}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white',
            }}>
              {isAdd && <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#2e7d32' }} />}
            </span>
            <input type="radio" name="ttype" checked={isAdd} onChange={() => setType('add')} style={{ display: 'none' }} />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <span style={{ color: '#d32f2f', fontWeight: '700', fontSize: '0.95rem' }}>خصم من الصندوق</span>
            <span style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: `2px solid ${!isAdd ? '#d32f2f' : '#9e9e9e'}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white',
            }}>
              {!isAdd && <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#d32f2f' }} />}
            </span>
            <input type="radio" name="ttype" checked={!isAdd} onChange={() => setType('sub')} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Amount */}
        <div style={{ marginTop: '1.2rem' }}>
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

        {/* Description */}
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>البيان</label>
          <input
            type="text" value={description} onChange={e => setDesc(e.target.value)}
            style={{
              width: '100%', border: '1.5px solid #90caf9', borderRadius: '8px',
              background: 'white', textAlign: 'right', padding: '0.65rem 0.75rem',
              fontSize: '0.95rem', fontFamily: "'Cairo','Tajawal',sans-serif",
              outline: 'none', color: '#1a1a1a', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Toggles list */}
        <div style={{ marginTop: '1.2rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            { key: 'include_sales',     label: 'اضافة مبالغ المبيعات والعملاء للصندوق' },
            { key: 'include_purchases', label: 'خصم مبالغ المشتريات والموردين من الصندوق' },
            { key: 'include_expenses',  label: 'خصم مبالغ المصروفات من الصندوق' },
          ].map((row, i, arr) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontSize: '0.92rem', lineHeight: 1.4 }}>{row.label}</span>
              <Toggle checked={!!settings[row.key]} onChange={(v) => persistSettings({ ...settings, [row.key]: v })} />
            </div>
          ))}
        </div>

        {/* Messages */}
        {error && <p style={{ color: '#d32f2f', textAlign: 'center', marginTop: '0.85rem', fontSize: '0.9rem' }}>{error}</p>}
        {okMsg && <p style={{ color: '#2e7d32', textAlign: 'center', marginTop: '0.85rem', fontSize: '0.9rem' }}>{okMsg}</p>}

        {/* Submit */}
        <button
          onClick={handleSave} disabled={!canSave}
          style={{
            width: '100%', marginTop: '1.2rem',
            background: canSave ? (isAdd ? '#3949AB' : '#d32f2f') : '#cfd8dc',
            color: canSave ? 'white' : '#546e7a',
            border: 'none', borderRadius: '8px',
            padding: '0.85rem', fontSize: '1rem', fontWeight: '700',
            cursor: canSave ? 'pointer' : 'not-allowed',
            fontFamily: "'Cairo','Tajawal',sans-serif",
          }}
        >
          {saving ? 'جارٍ الحفظ...' : submitLabel}
        </button>
      </div>

      {/* Balance footer — "الرصيد" on the right, narrow box with value on the left */}
      <div style={{ background: 'white', padding: '0.75rem 1rem 1rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ flex: 1, textAlign: 'right', color: '#1a1a1a', fontWeight: '700', fontSize: '1rem' }}>الرصيد</span>
        <div style={{ width: '45%', border: '1.5px solid #90caf9', borderRadius: '8px', background: 'white', padding: '0.55rem', textAlign: 'center' }}>
          <span style={{ color: '#e91e63', fontWeight: '700', fontSize: '1rem' }}>{fmt(balance)}</span>
        </div>
      </div>
    </div>
  );
}
