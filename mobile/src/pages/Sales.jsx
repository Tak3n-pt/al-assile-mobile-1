import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Check, Save } from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import ProductBrowser from '../components/ProductBrowser.jsx';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── Icons ─────────────────────────────────────────────────────────────────── */
function BarcodeIcon({ size = 26 }) {
  const bars = [
    {x:1,w:2},{x:5,w:1},{x:8,w:3},{x:13,w:1},
    {x:16,w:2},{x:20,w:1},{x:23,w:3},{x:28,w:1},{x:31,w:2},
  ];
  return (
    <svg width={size} height={Math.round(size*0.72)} viewBox="0 0 34 22" fill="none">
      {bars.map((b,i) => <rect key={i} x={b.x} y={0} width={b.w} height={22} fill="#444"/>)}
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5,padding:'2px 0'}}>
      {[0,1,2].map(i => <div key={i} style={{width:22,height:2,background:'white',borderRadius:2}}/>)}
    </div>
  );
}

function DotsGrid() {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {[4,11,18].flatMap(x => [4,11,18].map(y => (
        <rect key={`${x}-${y}`} x={x-2.5} y={y-2.5} width={5} height={5} rx={1} fill="#555"/>
      )))}
    </svg>
  );
}

function PersonIcon({ size = 22, color = '#444' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function CalcIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="8" y2="10"/>
      <line x1="12" y1="10" x2="12" y2="10"/>
      <line x1="16" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="8" y2="14"/>
      <line x1="12" y1="14" x2="12" y2="14"/>
      <line x1="16" y1="14" x2="16" y2="14"/>
      <line x1="8" y1="18" x2="8" y2="18"/>
      <line x1="12" y1="18" x2="12" y2="18"/>
      <line x1="16" y1="18" x2="16" y2="18"/>
    </svg>
  );
}

/* ── Editable cell ─────────────────────────────────────────────────────────── */
function EditCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));

  function commit() {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  }

  if (editing) {
    return (
      <input
        autoFocus type="number" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        style={{
          width:'100%', border:'none', borderBottom:'2px solid #2b5be8',
          outline:'none', textAlign:'center', fontSize:'0.85rem', fontWeight:'600',
          background:'#eef2ff', borderRadius:4, padding:'2px 4px',
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{cursor:'pointer',display:'block',textAlign:'center',
              fontSize:'0.85rem',fontWeight:'600',color:'#1a1a1a'}}
    >
      {typeof value === 'number' ? (value%1===0 ? value : value.toFixed(2)) : value}
    </span>
  );
}

/* ── Item row ──────────────────────────────────────────────────────────────── */
function ItemRow({ item, onQtyChange, onPriceChange, onRemove }) {
  const lineTotal = (item.unit_price * item.quantity).toFixed(2);
  return (
    <div style={{
      display:'flex', alignItems:'center', borderBottom:'1px solid #f0f0f0',
      background:'white', minHeight:44,
    }}>
      <div style={{flex:1,display:'flex',alignItems:'center',padding:'0.4rem 0.5rem 0.4rem 0.25rem',gap:'0.4rem'}}>
        <span style={{flex:1,fontSize:'0.85rem',color:'#1a1a1a',textAlign:'right',paddingRight:'0.25rem'}}>
          {item.name}
        </span>
        <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',padding:2,lineHeight:1,flexShrink:0}}>
          <X size={14} color="#dc2626"/>
        </button>
      </div>
      <div style={{width:'22%',padding:'0.4rem 0.25rem'}}>
        <EditCell value={item.unit_price} onChange={onPriceChange}/>
      </div>
      <div style={{width:'18%',padding:'0.4rem 0.25rem'}}>
        <EditCell value={item.quantity} onChange={v => v > 0 ? onQtyChange(v) : onRemove()}/>
      </div>
      <div style={{width:'23%',textAlign:'center',padding:'0.4rem 0.25rem',fontSize:'0.82rem',color:'#444'}}>
        {lineTotal}
      </div>
    </div>
  );
}

/* ── Dialog overlay ────────────────────────────────────────────────────────── */
function DialogOverlay({ children, onClose }) {
  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:60,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.52)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'white', borderRadius:14,
          width:'calc(100% - 40px)', maxWidth:380,
          maxHeight:'90vh', overflowY:'auto',
          boxShadow:'0 8px 32px rgba(0,0,0,0.22)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Number-input dialog ────────────────────────────────────────────────────── */
function NumberInputDialog({ title, subtitle, confirmLabel = 'متابعة', onConfirm, onClose }) {
  const [val, setVal] = useState('');
  const ok = val.trim() !== '' && parseInt(val, 10) > 0;
  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1.5rem 1.25rem 1.25rem'}}>
        <div style={{fontWeight:'700',fontSize:'1.05rem',textAlign:'center',marginBottom:'0.3rem'}}>{title}</div>
        <div style={{fontSize:'0.83rem',color:'#666',textAlign:'center',marginBottom:'1.1rem'}}>{subtitle}</div>
        <input
          type="number" inputMode="numeric" value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="0"
          style={{
            display:'block',width:'100%',boxSizing:'border-box',
            border:'none',borderBottom:'2px solid #2b5be8',
            outline:'none',fontSize:'1.15rem',textAlign:'center',
            padding:'0.45rem 0',marginBottom:'1.35rem',background:'transparent',
          }}
        />
        <div style={{display:'flex',gap:'0.65rem'}}>
          <button
            onClick={() => ok && onConfirm(parseInt(val,10))}
            disabled={!ok}
            style={{
              flex:1,padding:'0.65rem',
              background: ok ? '#2b5be8' : '#b0b8d0',
              color:'white',border:'none',borderRadius:8,
              fontSize:'0.9rem',fontWeight:'700',
              cursor: ok ? 'pointer' : 'not-allowed',
            }}
          >{confirmLabel}</button>
          <button onClick={onClose} style={{flex:1,padding:'0.65rem',background:'#f0f0f0',color:'#333',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'600',cursor:'pointer'}}>
            تراجع
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ── Reprint dialog ─────────────────────────────────────────────────────────── */
function ReprintDialog({ api, onClose }) {
  const [saleId, setSaleId]   = useState(null);
  const [sale, setSale]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  async function handleConfirm(id) {
    setSaleId(id); setLoading(true); setErr('');
    try {
      const d = await api.get(`/api/sales/${id}`);
      setSale(d);
    } catch { setErr('تعذّر تحميل الفاتورة'); }
    setLoading(false);
  }

  if (!saleId) {
    return <NumberInputDialog title="اعاده طباعه فاتوره" subtitle="ادخل رقم الفاتورة" onConfirm={handleConfirm} onClose={onClose}/>;
  }
  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#666"/></button>
          <span style={{fontWeight:'700',fontSize:'1rem'}}>فاتورة #{saleId}</span>
        </div>
        {loading ? (
          <p style={{textAlign:'center',color:'#888',padding:'1.5rem 0'}}>جارٍ التحميل...</p>
        ) : err ? (
          <p style={{textAlign:'center',color:'#dc2626',padding:'1.5rem 0'}}>{err}</p>
        ) : sale ? (
          <>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}>
              <span style={{color:'#888',fontSize:'0.83rem'}}>{sale.date}</span>
              <span style={{fontWeight:'600'}}>فاتورة #{sale.id}</span>
            </div>
            {(sale.items||[]).map((it,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.45rem 0',borderBottom:'1px solid #f5f5f5'}}>
                <span style={{color:'#444',fontSize:'0.83rem'}}>{(it.unit_price*it.quantity).toFixed(2)}</span>
                <span style={{fontSize:'0.88rem'}}>{it.product_name} × {it.quantity}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:'0.75rem',fontWeight:'700',fontSize:'1rem'}}>
              <span style={{color:'#2b5be8'}}>{sale.total?.toFixed(2)} ريال</span>
              <span>الإجمالي</span>
            </div>
            <button onClick={onClose} style={{display:'block',width:'100%',marginTop:'1rem',padding:'0.65rem',background:'#2b5be8',color:'white',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'700',cursor:'pointer'}}>
              إغلاق
            </button>
          </>
        ) : null}
      </div>
    </DialogOverlay>
  );
}

/* ── Import from quote dialog ──────────────────────────────────────────────── */
function ImportFromQuoteDialog({ api, onImport, onClose }) {
  const [clientName, setClientName] = useState('');
  const [quoteId, setQuoteId]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const ok = quoteId.trim() !== '' && parseInt(quoteId, 10) > 0;

  async function handleConfirm() {
    if (!ok) return;
    setLoading(true); setErr('');
    try {
      const d = await api.get(`/api/sales/${parseInt(quoteId,10)}`);
      onImport(d);
      onClose();
    } catch { setErr('تعذّر تحميل عرض السعر'); }
    setLoading(false);
  }

  const inputStyle = {
    display:'block',width:'100%',boxSizing:'border-box',
    border:'none',borderBottom:'2px solid #2b5be8',
    outline:'none',fontSize:'1rem',
    padding:'0.45rem 0',marginBottom:'1.1rem',background:'transparent',
    textAlign:'right',
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1.5rem 1.25rem 1.25rem'}}>
        <div style={{fontWeight:'700',fontSize:'1.05rem',textAlign:'center',marginBottom:'0.3rem'}}>
          استيراد البيانات من عرض سعر
        </div>
        <div style={{fontSize:'0.83rem',color:'#666',textAlign:'center',marginBottom:'1.1rem'}}>
          اكتب رقم عرض السعر او ابحث باسم العميل
        </div>
        {err && <div style={{background:'#fef2f2',color:'#dc2626',fontSize:'0.8rem',padding:'0.4rem 0.6rem',borderRadius:6,marginBottom:'0.75rem',textAlign:'center'}}>{err}</div>}
        <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.2rem'}}>اسم العميل</div>
        <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="ابحث باسم العميل" style={inputStyle}/>
        <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.2rem'}}>رقم عرض السعر</div>
        <input type="number" inputMode="numeric" value={quoteId} onChange={e => setQuoteId(e.target.value)} placeholder="0" style={{...inputStyle,textAlign:'center'}}/>
        <div style={{display:'flex',gap:'0.65rem',marginTop:'0.25rem'}}>
          <button
            onClick={handleConfirm}
            disabled={!ok || loading}
            style={{flex:1,padding:'0.65rem',background: ok && !loading ? '#2b5be8' : '#b0b8d0',color:'white',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'700',cursor: ok ? 'pointer' : 'not-allowed'}}
          >{loading ? '...' : 'متابعة'}</button>
          <button onClick={onClose} style={{flex:1,padding:'0.65rem',background:'#f0f0f0',color:'#333',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'600',cursor:'pointer'}}>تراجع</button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ── Customer balance query dialog ─────────────────────────────────────────── */
function CustomerQueryDialog({ api, onClose }) {
  const [search, setSearch]       = useState('');
  const [results, setResults]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [searching, setSearching] = useState(false);

  async function doSearch(q) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const d = await api.get(`/api/clients/search?q=${encodeURIComponent(q)}`);
      setResults(Array.isArray(d) ? d : []);
    } catch { setResults([]); }
    setSearching(false);
  }

  const balance = selected ? (selected.balance || 0) : 0;
  const balanceColor = balance < 0 ? '#dc2626' : balance > 0 ? '#16a34a' : '#333';

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1.25rem 1.1rem 1rem'}}>
        <div style={{textAlign:'left',fontWeight:'700',fontSize:'1rem',color:'#2b5be8',marginBottom:'0.75rem'}}>MicroPOS</div>
        <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.2rem',textAlign:'right'}}>اسم العميل</div>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); doSearch(e.target.value); setSelected(null); }}
            placeholder="ابحث عن عميل"
            style={{
              flex:1,border:'1px solid #ccc',borderRadius:6,
              padding:'0.4rem 0.6rem',fontSize:'0.9rem',outline:'none',textAlign:'right',
            }}
          />
          <div style={{border:'1px solid #ccc',borderRadius:6,padding:'0.35rem 0.45rem',cursor:'pointer',lineHeight:1}}>
            <BarcodeIcon size={20}/>
          </div>
        </div>
        {results.length > 0 && !selected && (
          <div style={{border:'1px solid #eee',borderRadius:6,maxHeight:150,overflowY:'auto',marginBottom:'0.75rem'}}>
            {results.map(c => (
              <button key={c.id} onClick={() => { setSelected(c); setSearch(c.name); setResults([]); }}
                style={{display:'block',width:'100%',padding:'0.5rem 0.75rem',background:'none',border:'none',cursor:'pointer',textAlign:'right',fontSize:'0.88rem',borderBottom:'1px solid #f5f5f5'}}>
                {c.name}{c.phone ? ` · ${c.phone}` : ''}
              </button>
            ))}
          </div>
        )}
        {searching && <p style={{fontSize:'0.8rem',color:'#888',textAlign:'center',marginBottom:'0.5rem'}}>جاري البحث...</p>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div style={{background:'#f5f5f5',borderRadius:8,padding:'0.4rem 1rem',minWidth:80,textAlign:'center'}}>
            <span style={{fontWeight:'700',fontSize:'1rem',color: balanceColor}}>
              {balance.toFixed(2)}
            </span>
          </div>
          <span style={{fontSize:'0.85rem',color:'#555',fontWeight:'600'}}>الإجمالي</span>
        </div>
        <button onClick={onClose} style={{display:'block',width:'60%',padding:'0.6rem',background:'#e0e0e0',color:'#333',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'600',cursor:'pointer'}}>
          تراجع
        </button>
      </div>
    </DialogOverlay>
  );
}

/* ── Add product dialog ─────────────────────────────────────────────────────── */
const UNITS      = ['قطعة','كيلو','لتر','علبة','كرتون','دستة','حبة'];
const CATEGORIES = ['عام','مواد غذائية','مشروبات','منظفات','أدوات','إلكترونيات'];

function AddProductDialog({ barcode: initBarcode, api, onClose, onAdded }) {
  const [barcode, setBarcode]       = useState(initBarcode || '');
  const [name, setName]             = useState('');
  const [sellPrice, setSellPrice]   = useState('');
  const [sellPrice2, setSellPrice2] = useState('');
  const [sellPrice3, setSellPrice3] = useState('');
  const [buyPrice, setBuyPrice]     = useState('');
  const [unit, setUnit]             = useState('قطعة');
  const [category, setCategory]     = useState('عام');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  const inputStyle = {
    display:'block',width:'100%',boxSizing:'border-box',
    border:'none',borderBottom:'1px solid #ccc',
    outline:'none',fontSize:'0.92rem',
    padding:'0.45rem 0',background:'transparent',textAlign:'right',color:'#111',
  };
  const labelStyle = { fontSize:'0.75rem',color:'#888',display:'block',marginBottom:'0.15rem' };
  const rowStyle   = { marginBottom:'0.85rem' };

  async function handleAdd() {
    if (!name.trim()) { setErr('اسم المنتج مطلوب'); return; }
    setSaving(true); setErr('');
    try {
      const result = await api.post('/api/products', {
        name: name.trim(),
        barcode: barcode.trim() || null,
        selling_price:  parseFloat(sellPrice)  || 0,
        selling_price2: parseFloat(sellPrice2) || 0,
        selling_price3: parseFloat(sellPrice3) || 0,
        purchase_price: parseFloat(buyPrice)   || 0,
        unit, category, quantity: 0,
      });
      onAdded(result);
      onClose();
    } catch (e) { setErr(e.message || 'خطأ في الإضافة'); }
    setSaving(false);
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1.25rem 1.1rem 1rem'}}>
        <div style={{fontWeight:'700',fontSize:'1rem',textAlign:'center',marginBottom:'0.25rem'}}>
          {initBarcode ? 'هذا المنتج غير موجود في المخزن هل تريد اضافته' : 'إضافة منتج جديد'}
        </div>
        {err && <div style={{background:'#fef2f2',color:'#dc2626',fontSize:'0.8rem',padding:'0.4rem 0.6rem',borderRadius:6,marginBottom:'0.75rem',textAlign:'center'}}>{err}</div>}

        <div style={{...rowStyle,display:'flex',alignItems:'flex-end',gap:'0.5rem'}}>
          <div style={{flex:1}}>
            <span style={labelStyle}>رقم المنتج (Barcode)</span>
            <input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="اختياري" style={inputStyle}/>
          </div>
          <div style={{border:'1px solid #ccc',borderRadius:6,padding:'0.3rem 0.45rem',cursor:'pointer',lineHeight:1,flexShrink:0,marginBottom:2}}>
            <BarcodeIcon size={20}/>
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>اسم المنتج *</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ادخل اسم المنتج" style={inputStyle}/>
        </div>

        <div style={{...rowStyle,display:'flex',gap:'0.5rem'}}>
          <div style={{flex:1}}>
            <span style={labelStyle}>سعر البيع</span>
            <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0" style={{...inputStyle,textAlign:'center'}}/>
          </div>
          <div style={{flex:1}}>
            <span style={labelStyle}>سعر البيع2</span>
            <input type="number" value={sellPrice2} onChange={e => setSellPrice2(e.target.value)} placeholder="0" style={{...inputStyle,textAlign:'center'}}/>
          </div>
          <div style={{flex:1}}>
            <span style={labelStyle}>سعر البيع3</span>
            <input type="number" value={sellPrice3} onChange={e => setSellPrice3(e.target.value)} placeholder="0" style={{...inputStyle,textAlign:'center'}}/>
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>سعر الشراء-التكلفة</span>
          <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="0" style={{...inputStyle,textAlign:'center'}}/>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>التصنيف</span>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{...inputStyle,cursor:'pointer'}}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>الوحدة</span>
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{...inputStyle,cursor:'pointer'}}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div style={{display:'flex',gap:'0.65rem',marginTop:'0.25rem'}}>
          <button onClick={handleAdd} disabled={saving}
            style={{flex:1,padding:'0.65rem',background: saving ? '#9ab4f5' : '#2b5be8',color:'white',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'700',cursor: saving ? 'not-allowed' : 'pointer'}}>
            {saving ? '...' : 'اضافه'}
          </button>
          <button onClick={onClose} style={{flex:1,padding:'0.65rem',background:'#f0f0f0',color:'#333',border:'none',borderRadius:8,fontSize:'0.9rem',fontWeight:'600',cursor:'pointer'}}>
            تراجع
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ── Checkout/save dialog ───────────────────────────────────────────────────── */
const PAYMENT_METHODS = [
  { key: 'cash',   label: 'نقد' },
  { key: 'credit', label: 'آجل' },
  { key: 'card',   label: 'بطاقة' },
  { key: 'check',  label: 'شيك' },
];

function CheckoutDialog({ items, api, onSaved, onClose }) {
  const [clientSearch, setClientSearch]   = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [payMethod, setPayMethod]         = useState('cash');
  const [paidAmount, setPaidAmount]       = useState('');
  const [saving, setSaving]               = useState(false);
  const [err, setErr]                     = useState('');

  const total = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);

  async function searchClient(q) {
    if (!q.trim()) { setClientResults([]); return; }
    try {
      const d = await api.get(`/api/clients/search?q=${encodeURIComponent(q)}`);
      setClientResults(Array.isArray(d) ? d.slice(0, 6) : []);
    } catch { setClientResults([]); }
  }

  async function handleSave() {
    setSaving(true); setErr('');
    const paid = payMethod === 'credit' ? 0 : (parseFloat(paidAmount) || total);
    try {
      const payload = {
        date: todayStr(),
        client_id: selectedClient?.id || null,
        paid_amount: paid,
        payment_method: payMethod,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      };
      const result = await api.post('/api/sales', payload);
      onSaved(result?.id || result);
      onClose();
    } catch (e) { setErr(e.message || 'خطأ في الحفظ'); }
    setSaving(false);
  }

  const inputStyle = {
    flex:1, border:'1px solid #ddd', borderRadius:6,
    padding:'0.4rem 0.6rem', fontSize:'0.9rem',
    outline:'none', textAlign:'right',
    width:'100%', boxSizing:'border-box',
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{padding:'1.25rem 1.1rem 1rem'}}>
        <div style={{fontWeight:'700',fontSize:'1.05rem',textAlign:'center',marginBottom:'1rem'}}>
          تأكيد الفاتورة
        </div>

        {err && <div style={{background:'#fef2f2',color:'#dc2626',fontSize:'0.8rem',padding:'0.4rem 0.6rem',borderRadius:6,marginBottom:'0.75rem',textAlign:'center'}}>{err}</div>}

        {/* Total */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f0f7ff',borderRadius:8,padding:'0.6rem 0.9rem',marginBottom:'1rem'}}>
          <span style={{fontWeight:'700',fontSize:'1.1rem',color:'#2b5be8'}}>{total.toFixed(2)} ريال</span>
          <span style={{color:'#666',fontSize:'0.88rem'}}>الإجمالي</span>
        </div>

        {/* Client */}
        <div style={{marginBottom:'0.85rem'}}>
          <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.2rem'}}>اسم العميل (اختياري)</div>
          <input
            value={selectedClient ? selectedClient.name : clientSearch}
            onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); searchClient(e.target.value); }}
            placeholder="ابحث عن عميل..."
            style={inputStyle}
          />
          {clientResults.length > 0 && !selectedClient && (
            <div style={{border:'1px solid #eee',borderRadius:6,maxHeight:120,overflowY:'auto',marginTop:2}}>
              {clientResults.map(c => (
                <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(c.name); setClientResults([]); }}
                  style={{display:'block',width:'100%',padding:'0.45rem 0.75rem',background:'none',border:'none',cursor:'pointer',textAlign:'right',fontSize:'0.86rem',borderBottom:'1px solid #f5f5f5'}}>
                  {c.name}{c.phone ? ` · ${c.phone}` : ''}
                </button>
              ))}
            </div>
          )}
          {selectedClient && (
            <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'#dc2626',marginTop:2}}>
              × إلغاء الاختيار
            </button>
          )}
        </div>

        {/* Payment method */}
        <div style={{marginBottom:'0.85rem'}}>
          <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.4rem'}}>طريقة الدفع</div>
          <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.key} onClick={() => setPayMethod(pm.key)}
                style={{
                  flex:1, padding:'0.5rem 0', border:'2px solid',
                  borderColor: payMethod === pm.key ? '#2b5be8' : '#e0e0e0',
                  borderRadius:8, background: payMethod === pm.key ? '#eef2ff' : 'white',
                  color: payMethod === pm.key ? '#2b5be8' : '#555',
                  fontWeight: payMethod === pm.key ? '700' : '500',
                  fontSize:'0.88rem', cursor:'pointer',
                }}>
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paid amount (not for credit) */}
        {payMethod !== 'credit' && (
          <div style={{marginBottom:'0.85rem'}}>
            <div style={{fontSize:'0.75rem',color:'#888',marginBottom:'0.2rem'}}>المبلغ المدفوع</div>
            <input
              type="number" inputMode="decimal"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              placeholder={total.toFixed(2)}
              style={{...inputStyle,textAlign:'center'}}
            />
          </div>
        )}

        {/* Items summary */}
        <div style={{marginBottom:'1rem',maxHeight:140,overflowY:'auto',border:'1px solid #f0f0f0',borderRadius:8}}>
          {items.map((it, i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.4rem 0.65rem',borderBottom:'1px solid #f8f8f8',fontSize:'0.82rem'}}>
              <span style={{color:'#2b5be8',fontWeight:'600'}}>{(it.unit_price*it.quantity).toFixed(2)}</span>
              <span>{it.name} × {it.quantity}</span>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:'0.65rem'}}>
          <button onClick={handleSave} disabled={saving}
            style={{flex:1,padding:'0.7rem',background: saving ? '#9ab4f5' : '#2b5be8',color:'white',border:'none',borderRadius:8,fontSize:'0.95rem',fontWeight:'700',cursor: saving ? 'not-allowed' : 'pointer'}}>
            {saving ? '...' : 'حفظ الفاتورة'}
          </button>
          <button onClick={onClose} style={{flex:1,padding:'0.7rem',background:'#f0f0f0',color:'#333',border:'none',borderRadius:8,fontSize:'0.95rem',fontWeight:'600',cursor:'pointer'}}>
            تراجع
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ── Invoices report view ───────────────────────────────────────────────────── */
function sevenDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function InvoicesReportView({ api, onClose }) {
  const today = todayStr();
  const [from, setFrom]         = useState(sevenDaysAgoStr);
  const [to, setTo]             = useState(today);
  const [q, setQ]               = useState('');
  const [methods, setMethods]   = useState({ cash:true, credit:true, card:true, check:true });
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-load results on open so the user doesn't see a blank screen
  useEffect(() => { doSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const METHOD_LABELS = { cash:'النقد', credit:'الاجل', card:'بطاقة', check:'شيك' };

  async function doSearch() {
    setLoading(true);
    const selectedMethods = Object.entries(methods).filter(([,v]) => v).map(([k]) => k);
    try {
      const params = new URLSearchParams({ from, to, q, methods: selectedMethods.join(',') });
      const d = await api.get(`/api/sales/report?${params}`);
      setResults(Array.isArray(d) ? d : []);
      setSearched(true);
    } catch { setResults([]); setSearched(true); }
    setLoading(false);
  }

  return (
    <div dir="rtl" style={{
      position:'fixed', inset:0, zIndex:55, background:'white',
      display:'flex', flexDirection:'column', fontFamily:"'Cairo','Tajawal',sans-serif",
    }}>
      {/* Header */}
      <div style={{background:'#2b5be8',padding:'0.6rem 0.75rem',display:'flex',alignItems:'center',flexShrink:0}}>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:'0.3rem'}}>
          <ArrowLeft size={22} color="white"/>
        </button>
        <h2 style={{flex:1,textAlign:'center',color:'white',fontSize:'1rem',fontWeight:'700',margin:0}}>عرض الفواتير</h2>
        <div style={{width:38}}/>
      </div>

      {/* Filters */}
      <div style={{padding:'0.75rem',background:'#f8f8f8',borderBottom:'1px solid #e0e0e0',flexShrink:0}}>
        {/* Search field */}
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="رقم الفاتوره او اسم العميل"
          style={{
            display:'block',width:'100%',boxSizing:'border-box',
            border:'1px solid #ddd',borderRadius:8,
            padding:'0.5rem 0.75rem',fontSize:'0.9rem',
            outline:'none',marginBottom:'0.5rem',textAlign:'right',
          }}
        />

        {/* Date range */}
        <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginBottom:'0.5rem',fontSize:'0.85rem',color:'#555'}}>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{flex:1,border:'1px solid #ddd',borderRadius:6,padding:'0.35rem 0.5rem',outline:'none',textAlign:'center',fontSize:'0.82rem'}}/>
          <span>الي</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{flex:1,border:'1px solid #ddd',borderRadius:6,padding:'0.35rem 0.5rem',outline:'none',textAlign:'center',fontSize:'0.82rem'}}/>
          <span>للفترة من:</span>
        </div>

        {/* Payment method checkboxes */}
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'}}>
          {Object.entries(METHOD_LABELS).map(([key, label]) => (
            <label key={key} style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.85rem',cursor:'pointer'}}>
              <input type="checkbox" checked={methods[key]} onChange={e => setMethods(p => ({...p,[key]:e.target.checked}))}/>
              {label}
            </label>
          ))}
          <button onClick={doSearch} disabled={loading}
            style={{marginRight:'auto',padding:'0.4rem 1rem',background:'#2b5be8',color:'white',border:'none',borderRadius:6,fontSize:'0.85rem',fontWeight:'700',cursor:'pointer'}}>
            {loading ? '...' : 'بحث'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{flex:1,overflowY:'auto'}}>
        {!searched ? (
          <p style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:'0.9rem'}}>اضغط بحث لعرض النتائج</p>
        ) : results.length === 0 ? (
          <p style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:'0.9rem'}}>لا توجد فواتير</p>
        ) : (
          results.map(s => (
            <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.65rem 0.9rem',borderBottom:'1px solid #f0f0f0',background:'white'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:'700',color:'#2b5be8',fontSize:'0.95rem'}}>{(s.total||0).toFixed(2)} ريال</div>
                <div style={{fontSize:'0.75rem',color:'#888'}}>{s.date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'600',fontSize:'0.9rem'}}>فاتورة #{s.id}</div>
                <div style={{fontSize:'0.78rem',color:'#666'}}>{s.client_name || 'عميل نقدي'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   RTL FLEX RULE: first DOM child = visual RIGHT, last DOM child = visual LEFT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function Sales() {
  const navigate = useNavigate();
  const api      = useApi();

  const [editingId, setEditingId]   = useState(null);
  const [items, setItems]           = useState([]);
  const [saving, setSaving]         = useState(false);
  const [savedId, setSavedId]       = useState(null);
  const [error, setError]           = useState('');
  const [priceTier, setPriceTier]   = useState(null); // null | 1 | 2 | 3

  const [products, setProducts]     = useState([]);
  const [search, setSearch]         = useState('');
  const [showDrop, setShowDrop]     = useState(false);

  const [showMenu, setShowMenu]     = useState(false);
  const [showScanner, setShowScanner]   = useState(false);
  const [showBrowser, setShowBrowser]   = useState(false);

  /* dialog state */
  const [showAddProduct, setShowAddProduct]     = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState('');
  const [showReprint, setShowReprint]           = useState(false);
  const [showEditDialog, setShowEditDialog]     = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCustomerQuery, setShowCustomerQuery] = useState(false);
  const [showCheckout, setShowCheckout]         = useState(false);
  const [showInvoices, setShowInvoices]         = useState(false);

  useEffect(() => {
    api.get('/api/products')
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const searchResults = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search))
      ).slice(0, 8)
    : [];

  function getPriceForTier(product) {
    if (priceTier === 2 && (product.selling_price2 || 0) > 0) return product.selling_price2;
    if (priceTier === 3 && (product.selling_price3 || 0) > 0) return product.selling_price3;
    return product.selling_price || 0;
  }

  const addProduct = useCallback((product) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: getPriceForTier(product),
        quantity: 1,
      }];
    });
    setSearch('');
    setShowDrop(false);
  }, [priceTier]);

  function updateQty(idx, qty)     { setItems(p => { const n=[...p]; n[idx]={...n[idx],quantity:qty}; return n; }); }
  function updatePrice(idx, price) { setItems(p => { const n=[...p]; n[idx]={...n[idx],unit_price:price}; return n; }); }
  function removeItem(idx)          { setItems(p => p.filter((_,i) => i!==idx)); }

  const removeProduct = useCallback((product) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id);
      if (idx < 0) return prev;
      if (prev[idx].quantity > 1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
        return next;
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  function handleScan(barcode) {
    setShowScanner(false);
    const found = products.find(p => p.barcode === barcode);
    if (found) {
      addProduct(found);
    } else {
      setAddProductBarcode(barcode);
      setShowAddProduct(true);
    }
  }

  function handleProductAdded(newProduct) {
    setProducts(prev => [...prev, newProduct]);
    addProduct(newProduct);
  }

  async function loadForEdit(id) {
    setShowEditDialog(false);
    try {
      const data = await api.get(`/api/sales/${id}`);
      setEditingId(data.id);
      setItems((data.items||[]).map(it => ({
        product_id: it.product_id,
        name:       it.product_name,
        unit_price: it.unit_price,
        quantity:   it.quantity,
      })));
      setSavedId(null); setError('');
    } catch (err) { setError(err.message||'تعذّر تحميل الفاتورة'); }
  }

  function importFromQuote(sale) {
    const imported = (sale.items||[]).map(it => ({
      product_id: it.product_id,
      name:       it.product_name,
      unit_price: it.unit_price,
      quantity:   it.quantity,
    }));
    setItems(prev => {
      const next = [...prev];
      for (const imp of imported) {
        const idx = next.findIndex(i => i.product_id === imp.product_id);
        if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + imp.quantity };
        else next.push(imp);
      }
      return next;
    });
  }

  async function handleSaveEdit() {
    if (items.length === 0) { setError('أضف منتجاً واحداً على الأقل'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        date: todayStr(),
        paid_amount: 0,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      };
      await api.patch(`/api/sales/${editingId}`, payload);
      setSavedId(editingId);
      setItems([]); setEditingId(null);
    } catch (err) { setError(err.message || 'خطأ في الحفظ'); }
    setSaving(false);
  }

  const total     = items.reduce((s,i) => s + i.unit_price * i.quantity, 0);
  const itemCount = items.reduce((s,i) => s + i.quantity, 0);

  const tierTitle = priceTier ? ` - سعر البيع${priceTier}` : '';

  const menuItems = [
    { label: 'اعاده طباعه الفاتورة',           action: () => setShowReprint(true) },
    { label: 'تعديل فاتورة البيع',             action: () => setShowEditDialog(true) },
    { label: 'تثبيت سعر البيع1',               action: () => setPriceTier(priceTier === 1 ? null : 1) },
    { label: 'تثبيت سعر البيع2',               action: () => setPriceTier(priceTier === 2 ? null : 2) },
    { label: 'تثبيت سعر البيع3',               action: () => setPriceTier(priceTier === 3 ? null : 3) },
    { label: 'الحاسبه',                         action: () => {} },
    { label: 'الاستعلام عن الباقي عند العميل', action: () => setShowCustomerQuery(true) },
    { label: 'استيراد البيانات من عرض سعر',    action: () => setShowImportDialog(true) },
    { label: 'قارىء الباركود متضمن/خارج الشاشة', action: () => setShowScanner(true) },
    { label: 'اضافه منتج جديد',                action: () => { setAddProductBarcode(''); setShowAddProduct(true); } },
    { label: 'عرض الفواتير',                   action: () => setShowInvoices(true) },
    { label: 'مسح المنتجات من القائمه',         action: () => { if (items.length > 0) setItems([]); } },
  ];

  return (
    <div dir="rtl" style={{
      height:'100%', display:'flex', flexDirection:'column',
      background:'#f5f5f5', fontFamily:"'Cairo','Tajawal',sans-serif",
      position:'relative', overflow:'hidden',
    }}>

      {/* HEADER */}
      <div style={{
        background:'#2b5be8', display:'flex', alignItems:'center',
        padding:'0.55rem 0.75rem', flexShrink:0,
        boxShadow:'0 2px 8px rgba(43,91,232,0.4)',
      }}>
        {/* hamburger — RIGHT in RTL (first DOM) */}
        <button onClick={() => setShowMenu(v => !v)} style={{background:'none',border:'none',cursor:'pointer',padding:'0.3rem',lineHeight:1}}>
          <HamburgerIcon/>
        </button>
        <h1 style={{flex:1,textAlign:'center',color:'white',fontSize:'1.05rem',fontWeight:'700',margin:0}}>
          {editingId ? `تعديل فاتورة #${editingId}` : `المبيعات${tierTitle}`}
        </h1>
        {/* back arrow — LEFT in RTL (last DOM) */}
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',cursor:'pointer',padding:'0.3rem',lineHeight:1}}>
          <ArrowLeft size={22} color="white"/>
        </button>
      </div>

      {/* HAMBURGER DROPDOWN */}
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{position:'fixed',inset:0,zIndex:40}}/>
          <div style={{
            position:'fixed',top:52,right:0,zIndex:50,
            background:'white',minWidth:250,
            boxShadow:'0 6px 24px rgba(0,0,0,0.18)',
            maxHeight:'calc(100vh - 60px)',overflowY:'auto',
          }}>
            {menuItems.map((item, i) => (
              <button key={i}
                onClick={() => { setShowMenu(false); item.action(); }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  width:'100%', padding:'0.9rem 1.25rem',
                  background:'none', border:'none', textAlign:'right',
                  fontSize:'0.93rem', color:'#1a1a1a', cursor:'pointer',
                  borderBottom: i < menuItems.length-1 ? '1px solid #f0f0f0' : 'none',
                }}>
                <span/>
                <span>
                  {item.label}
                  {/* Checkmark on active price tiers */}
                  {(item.label === 'تثبيت سعر البيع1' && priceTier === 1) ||
                   (item.label === 'تثبيت سعر البيع2' && priceTier === 2) ||
                   (item.label === 'تثبيت سعر البيع3' && priceTier === 3) ? ' ✓' : ''}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* SEARCH / ICONS ROW */}
      <div style={{
        display:'flex', alignItems:'center', background:'white',
        padding:'0.45rem 0.5rem', gap:'0.4rem', flexShrink:0,
        borderBottom:'1px solid #e8e8e8', boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* RIGHT side icons (first DOM in RTL) */}
        <button onClick={() => setShowScanner(true)} style={{background:'none',border:'1px solid #ccc',borderRadius:6,padding:'0.3rem 0.4rem',cursor:'pointer',flexShrink:0,lineHeight:1}}>
          <BarcodeIcon size={24}/>
        </button>
        <button onClick={() => setShowCustomerQuery(true)} style={{background:'none',border:'1px solid #ccc',borderRadius:6,padding:'0.3rem 0.4rem',cursor:'pointer',flexShrink:0,lineHeight:1}}>
          <PersonIcon size={20}/>
        </button>
        {/* Grid browse button */}
        <button
          onClick={() => setShowBrowser(true)}
          title="تصفح المنتجات"
          style={{
            background: items.length > 0
              ? 'linear-gradient(135deg,#2b5be8,#4f8eff)'
              : 'none',
            border: items.length > 0 ? 'none' : '1px solid #ccc',
            borderRadius: 6, padding:'0.3rem 0.5rem', cursor:'pointer',
            flexShrink:0, lineHeight:1, position:'relative',
          }}>
          <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            {[[2,2],[9,2],[16,2],[2,9],[9,9],[16,9],[2,16],[9,16],[16,16]].map(([x,y],i) => (
              <rect key={i} x={x} y={y} width={5} height={5} rx={1.5}
                fill={items.length > 0 ? 'white' : '#555'}/>
            ))}
          </svg>
          {items.length > 0 && (
            <span style={{
              position:'absolute', top:-6, right:-6,
              background:'#ef4444', color:'white',
              borderRadius:10, minWidth:17, height:17,
              fontSize:'0.62rem', fontWeight:800,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px solid white', lineHeight:1, padding:'0 3px',
            }}>
              {items.reduce((s,i)=>s+i.quantity,0)}
            </span>
          )}
        </button>

        {/* Search input */}
        <div style={{flex:1,position:'relative'}}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
            onFocus={() => search && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="ابحث عن منتج او استخدم الكاميرا"
            style={{
              width:'100%',border:'none',borderBottom:'1px solid #bbb',
              padding:'0.35rem 0',fontSize:'0.83rem',outline:'none',
              background:'transparent',textAlign:'right',color:'#333',
              boxSizing:'border-box',
            }}
          />
          {showDrop && searchResults.length > 0 && (
            <div style={{
              position:'absolute',top:'100%',right:0,left:0,zIndex:35,
              background:'white',boxShadow:'0 6px 20px rgba(0,0,0,0.15)',
              borderRadius:'0 0 8px 8px',maxHeight:260,overflowY:'auto',
            }}>
              {searchResults.map(p => (
                <button key={p.id} onMouseDown={() => addProduct(p)}
                  style={{
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    width:'100%',padding:'0.65rem 0.9rem',background:'none',border:'none',
                    borderBottom:'1px solid #f5f5f5',cursor:'pointer',textAlign:'right',
                  }}>
                  <span style={{color:'#888',fontSize:'0.78rem'}}>{getPriceForTier(p).toFixed(2)} ريال</span>
                  <span style={{color:'#1a1a1a',fontSize:'0.9rem',fontWeight:'500'}}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LEFT side icons (last DOM in RTL) */}
        <button
          onClick={() => {
            if (editingId) { handleSaveEdit(); }
            else if (items.length > 0) { setShowCheckout(true); }
            else { setError('أضف منتجاً واحداً على الأقل'); }
          }}
          title="الدفع"
          style={{
            background:'none',border:'1px solid #ccc',borderRadius:6,
            padding:'0.3rem 0.4rem',cursor:'pointer',flexShrink:0,lineHeight:1,
          }}>
          <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            {[[2,2],[9,2],[16,2],[2,9],[9,9],[16,9],[2,16],[9,16],[16,16]].map(([x,y],i) => (
              <rect key={i} x={x} y={y} width={5} height={5} rx={1} fill={editingId ? '#2b5be8' : '#555'}/>
            ))}
          </svg>
        </button>
        <button onClick={() => setShowScanner(true)} title="الحاسبه" style={{background:'none',border:'1px solid #ccc',borderRadius:6,padding:'0.3rem 0.4rem',cursor:'pointer',flexShrink:0,lineHeight:1}}>
          <CalcIcon size={20}/>
        </button>
      </div>

      {/* ERROR / SUCCESS BANNERS */}
      {error && (
        <div style={{background:'#fef2f2',padding:'0.4rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #fca5a5',flexShrink:0}}>
          <button onClick={() => setError('')} style={{background:'none',border:'none',cursor:'pointer'}}><X size={14} color="#dc2626"/></button>
          <span style={{color:'#dc2626',fontSize:'0.83rem'}}>{error}</span>
        </div>
      )}
      {savedId && !error && (
        <div style={{background:'#f0fdf4',padding:'0.4rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #86efac',flexShrink:0}}>
          <button onClick={() => setSavedId(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={14} color="#16a34a"/></button>
          <span style={{color:'#16a34a',fontSize:'0.83rem',display:'flex',alignItems:'center',gap:'0.4rem'}}>
            <Check size={14}/> تم الحفظ — فاتورة #{savedId}
          </span>
        </div>
      )}

      {/* TABLE HEADER */}
      <div style={{display:'flex',background:'#ebebeb',borderBottom:'1px solid #ddd',flexShrink:0,padding:'0.35rem 0.5rem'}}>
        <span style={{flex:1,textAlign:'right',fontSize:'0.78rem',color:'#555',fontWeight:'700',paddingRight:'0.5rem'}}>المنتج</span>
        <span style={{width:'22%',textAlign:'center',fontSize:'0.78rem',color:'#555',fontWeight:'700'}}>السعر</span>
        <span style={{width:'18%',textAlign:'center',fontSize:'0.78rem',color:'#555',fontWeight:'700'}}>الكمية</span>
        <span style={{width:'23%',textAlign:'center',fontSize:'0.78rem',color:'#555',fontWeight:'700'}}>الإجمالي</span>
      </div>

      {/* ITEMS LIST */}
      <div style={{flex:1,overflowY:'auto',background:'#fafafa'}}>
        {items.length === 0 && (
          <div style={{textAlign:'center',padding:'3rem 1rem',color:'#bbb',fontSize:'0.9rem'}}>
            ابحث عن منتج أو امسح الباركود لإضافته
          </div>
        )}
        {items.map((item, idx) => (
          <ItemRow
            key={item.product_id}
            item={item}
            onQtyChange={v => updateQty(idx, v)}
            onPriceChange={v => updatePrice(idx, v)}
            onRemove={() => removeItem(idx)}
          />
        ))}
      </div>

      {/* FLOATING GRID FAB (checkout) */}
      <button
        onClick={() => {
          if (editingId) { handleSaveEdit(); }
          else if (items.length > 0) { setShowCheckout(true); }
          else { setError('أضف منتجاً واحداً على الأقل'); }
        }}
        style={{
          position:'absolute', bottom:66, right:16,
          background:'#2b5be8', border:'none', borderRadius:'50%',
          width:52, height:52, display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'0 3px 12px rgba(43,91,232,0.45)', zIndex:10,
        }}>
        <DotsGrid/>
      </button>

      {/* BOTTOM BAR */}
      <div style={{
        display:'flex', alignItems:'center', background:'white',
        borderTop:'1px solid #e0e0e0', padding:'0.5rem 0.75rem',
        flexShrink:0, gap:'0.5rem',
      }}>
        {/* RIGHT: label (first DOM in RTL) */}
        <span style={{fontSize:'0.88rem',fontWeight:'700',color:'#222',flexShrink:0}}>
          {editingId ? `تعديل #${editingId}` : 'إجمالي+TAX'}
        </span>
        {/* total box */}
        <div style={{flex:1,background:'#c8efc8',borderRadius:20,padding:'0.4rem 0.75rem',textAlign:'center'}}>
          <span style={{color:'#c0392b',fontWeight:'700',fontSize:'1rem'}}>
            {total.toFixed(2)}
          </span>
        </div>
        {/* currency */}
        <span style={{fontSize:'0.8rem',color:'#555',fontWeight:'500',flexShrink:0}}>ريال ع.ق</span>
        {/* count box (LEFT — last DOM) */}
        <div style={{
          background:'white', border:'1px solid #e0e0e0', borderRadius:20,
          padding:'0.28rem 0.7rem', minWidth:52, textAlign:'center',
          fontSize:'0.9rem', fontWeight:'700', color:'#c0392b',
        }}>
          {itemCount % 1 === 0 ? itemCount.toFixed(1) : itemCount.toFixed(2)}
        </div>
      </div>

      {/* OVERLAYS */}
      <BarcodeScanner isOpen={showScanner} onScan={handleScan} onClose={() => setShowScanner(false)}/>

      {showAddProduct && (
        <AddProductDialog
          key={addProductBarcode}
          barcode={addProductBarcode}
          api={api}
          onClose={() => setShowAddProduct(false)}
          onAdded={handleProductAdded}
        />
      )}

      {showReprint && <ReprintDialog api={api} onClose={() => setShowReprint(false)}/>}

      {showEditDialog && (
        <NumberInputDialog
          title="تعديل فاتورة البيع"
          subtitle="ادخل رقم الفاتورة"
          onConfirm={loadForEdit}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      {showImportDialog && (
        <ImportFromQuoteDialog
          api={api}
          onImport={importFromQuote}
          onClose={() => setShowImportDialog(false)}
        />
      )}

      {showCustomerQuery && (
        <CustomerQueryDialog api={api} onClose={() => setShowCustomerQuery(false)}/>
      )}

      {showCheckout && (
        <CheckoutDialog
          items={items}
          api={api}
          onSaved={id => { setSavedId(id); setItems([]); setEditingId(null); }}
          onClose={() => setShowCheckout(false)}
        />
      )}

      {showInvoices && <InvoicesReportView api={api} onClose={() => setShowInvoices(false)}/>}

      <ProductBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        products={products}
        items={items}
        onAddProduct={addProduct}
        onRemoveProduct={removeProduct}
        getPriceForTier={getPriceForTier}
      />
    </div>
  );
}
