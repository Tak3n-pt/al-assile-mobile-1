import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, X, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function BarcodeIcon({ size = 26 }) {
  const bars = [
    { x:1,w:2},{x:5,w:1},{x:8,w:3},{x:13,w:1},
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
      {[0,1,2].map(i=>(
        <div key={i} style={{width:22,height:2,background:'white',borderRadius:2}}/>
      ))}
    </div>
  );
}

function DotsGrid() {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {[4,11,18].flatMap(x=>[4,11,18].map(y=>(
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} fill="#555"/>
      )))}
    </svg>
  );
}

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
        onKeyDown={e => e.key==='Enter' && commit()}
        style={{
          width:'100%', border:'none', borderBottom:'2px solid #3949AB',
          outline:'none', textAlign:'center', fontSize:'0.85rem', fontWeight:'600',
          background:'#eef2ff', borderRadius:4, padding:'2px 4px',
          fontFamily:"'Cairo','Tajawal',sans-serif",
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
      {typeof value==='number' ? (value%1===0 ? value : value.toFixed(2)) : value}
    </span>
  );
}

function ItemRow({ item, onQtyChange, onPriceChange, onRemove }) {
  const lineTotal = (item.unit_price * item.quantity).toFixed(2);
  return (
    <div style={{
      display:'flex', alignItems:'center', borderBottom:'1px solid #e5e7eb',
      background:'white', minHeight:44,
    }}>
      <div style={{flex:1, display:'flex', alignItems:'center', padding:'0.4rem 0.5rem 0.4rem 0.25rem', gap:'0.4rem'}}>
        <span style={{flex:1, fontSize:'0.85rem', color:'#1a1a1a', textAlign:'right', paddingRight:'0.25rem'}}>
          {item.name}
        </span>
        <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',padding:2,lineHeight:1,flexShrink:0}}>
          <X size={14} color="#d32f2f"/>
        </button>
      </div>
      <div style={{width:'22%', padding:'0.4rem 0.25rem'}}>
        <EditCell value={item.unit_price} onChange={onPriceChange}/>
      </div>
      <div style={{width:'18%', padding:'0.4rem 0.25rem'}}>
        <EditCell value={item.quantity} onChange={v => v>0 ? onQtyChange(v) : onRemove()}/>
      </div>
      <div style={{width:'23%', textAlign:'center', padding:'0.4rem 0.25rem', fontSize:'0.82rem', color:'#1a1a1a'}}>
        {lineTotal}
      </div>
    </div>
  );
}

/* ── Center-modal wrapper ──────────────────────────────────────────────────── */
function DialogOverlay({ children, onClose }) {
  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:60,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.35)',
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

/* ── Reusable: number-input dialog (reprint / edit / import) ──────────────── */
function NumberInputDialog({ title, subtitle, confirmLabel = 'متابعة', onConfirm, onClose }) {
  const [val, setVal] = useState('');
  const ok = val.trim() !== '' && parseInt(val, 10) > 0;
  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{ padding:'1.5rem 1.25rem 1.25rem' }}>
        <div style={{ fontWeight:'700', fontSize:'1.05rem', textAlign:'center', marginBottom:'0.3rem', color:'#1a1a1a' }}>
          {title}
        </div>
        <div style={{ fontSize:'0.83rem', color:'#6b7280', textAlign:'center', marginBottom:'1.1rem' }}>
          {subtitle}
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="0"
          style={{
            display:'block', width:'100%', boxSizing:'border-box',
            border:'none', borderBottom:'2px solid #3949AB',
            outline:'none', fontSize:'1.15rem', textAlign:'center',
            padding:'0.45rem 0', marginBottom:'1.35rem',
            background:'transparent', color:'#1a1a1a',
            fontFamily:"'Cairo','Tajawal',sans-serif",
          }}
        />
        {/* RTL: primary (right, first DOM) | تراجع (left, second DOM) */}
        <div style={{ display:'flex', gap:'0.65rem' }}>
          <button
            onClick={() => ok && onConfirm(parseInt(val, 10))}
            disabled={!ok}
            style={{
              flex:1, padding:'0.65rem',
              background: ok ? '#3949AB' : '#cfd8dc',
              color: ok ? 'white' : '#546e7a', border:'none', borderRadius:8,
              fontSize:'0.9rem', fontWeight:'700',
              cursor: ok ? 'pointer' : 'not-allowed',
              fontFamily:"'Cairo','Tajawal',sans-serif",
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            style={{
              flex:1, padding:'0.65rem',
              background:'#f1f5f9', color:'#1a1a1a',
              border:'1px solid #e5e7eb', borderRadius:8,
              fontSize:'0.9rem', fontWeight:'600', cursor:'pointer',
              fontFamily:"'Cairo','Tajawal',sans-serif",
            }}
          >
            تراجع
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ── Reprint dialog — step 1: enter ID, step 2: show invoice ─────────────── */
function ReprintDialog({ api, onClose }) {
  const [purchaseId, setPurchaseId] = useState(null);
  const [purchase, setPurchase]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');

  async function handleConfirm(id) {
    setPurchaseId(id);
    setLoading(true); setErr('');
    try {
      const d = await api.get(`/api/purchases/${id}`);
      setPurchase(d);
    } catch {
      setErr('تعذّر تحميل الفاتورة');
    }
    setLoading(false);
  }

  if (!purchaseId) {
    return (
      <NumberInputDialog
        title="اعاده طباعه فاتورة"
        subtitle="ادخل رقم الفاتورة"
        onConfirm={handleConfirm}
        onClose={onClose}
      />
    );
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{ padding:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}>
            <X size={20} color="#6b7280"/>
          </button>
          <span style={{ fontWeight:'700', fontSize:'1rem', color:'#1a1a1a' }}>فاتورة #{purchaseId}</span>
        </div>
        {loading ? (
          <p style={{ textAlign:'center', color:'#6b7280', padding:'1.5rem 0' }}>جارٍ التحميل...</p>
        ) : err ? (
          <p style={{ textAlign:'center', color:'#d32f2f', padding:'1.5rem 0' }}>{err}</p>
        ) : purchase ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <span style={{ color:'#6b7280', fontSize:'0.83rem' }}>{purchase.date}</span>
              <span style={{ fontWeight:'600', color:'#1a1a1a' }}>فاتورة #{purchase.id}</span>
            </div>
            {(purchase.items||[]).map((it,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'0.45rem 0', borderBottom:'1px solid #e5e7eb' }}>
                <span style={{ color:'#1a1a1a', fontSize:'0.83rem' }}>{(it.unit_price*it.quantity).toFixed(2)}</span>
                <span style={{ fontSize:'0.88rem', color:'#1a1a1a' }}>{it.product_name} × {it.quantity}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.75rem', fontWeight:'700', fontSize:'1rem' }}>
              <span style={{ color:'#e91e63' }}>{purchase.total?.toFixed(2)} ريال</span>
              <span style={{ color:'#1a1a1a' }}>الإجمالي</span>
            </div>
            <button
              onClick={onClose}
              style={{ display:'block', width:'100%', marginTop:'1rem', padding:'0.65rem', background:'#3949AB', color:'white', border:'none', borderRadius:8, fontSize:'0.9rem', fontWeight:'700', cursor:'pointer', fontFamily:"'Cairo','Tajawal',sans-serif" }}
            >
              إغلاق
            </button>
          </>
        ) : null}
      </div>
    </DialogOverlay>
  );
}

/* ── Add-product dialog ───────────────────────────────────────────────────── */
const UNITS     = ['قطعة','كيلو','لتر','علبة','كرتون','دستة','حبة'];
const CATEGORIES = ['عام','مواد غذائية','مشروبات','منظفات','أدوات','إلكترونيات'];

function AddProductDialog({ barcode: initBarcode, api, onClose, onAdded }) {
  const [barcode, setBarcode]     = useState(initBarcode || '');
  const [name, setName]           = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice]   = useState('');
  const [unit, setUnit]           = useState('قطعة');
  const [category, setCategory]   = useState('عام');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const inputStyle = {
    display:'block', width:'100%', boxSizing:'border-box',
    border:'1.5px solid #90caf9', borderRadius:8,
    outline:'none', fontSize:'0.92rem',
    padding:'0.5rem 0.65rem', background:'white',
    textAlign:'right', color:'#1a1a1a',
    fontFamily:"'Cairo','Tajawal',sans-serif",
  };
  const labelStyle = {
    fontSize:'0.75rem', color:'#6b7280', display:'block', marginBottom:'0.15rem',
  };
  const rowStyle = { marginBottom:'0.85rem' };

  async function handleAdd() {
    if (!name.trim()) { setErr('اسم المنتج مطلوب'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: name.trim(),
        barcode: barcode.trim() || null,
        selling_price: parseFloat(sellPrice) || 0,
        purchase_price: parseFloat(buyPrice) || 0,
        unit,
        category,
        quantity: 0,
      };
      const result = await api.post('/api/products', payload);
      onAdded(result);
      onClose();
    } catch (e) {
      setErr(e.message || 'خطأ في الإضافة');
    }
    setSaving(false);
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div dir="rtl" style={{ padding:'1.25rem 1.1rem 1rem' }}>
        <div style={{ fontWeight:'700', fontSize:'1rem', textAlign:'center', marginBottom:'0.25rem', color:'#1a1a1a' }}>
          إضافة منتج جديد
        </div>
        {initBarcode && (
          <div style={{ fontSize:'0.8rem', color:'#6b7280', textAlign:'center', marginBottom:'0.85rem' }}>
            هذا المنتج غير موجود في المخزن، هل تريد إضافته؟
          </div>
        )}

        {err && (
          <div style={{ background:'#fef2f2', color:'#d32f2f', fontSize:'0.8rem', padding:'0.4rem 0.6rem', borderRadius:6, marginBottom:'0.75rem', textAlign:'center' }}>
            {err}
          </div>
        )}

        {/* Barcode row: input RIGHT (first DOM), icon LEFT (second DOM) */}
        <div style={{ ...rowStyle, display:'flex', alignItems:'flex-end', gap:'0.5rem' }}>
          <div style={{ flex:1 }}>
            <span style={labelStyle}>الباركود</span>
            <input
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="اختياري"
              style={inputStyle}
            />
          </div>
          <button
            style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:6, padding:'0.3rem 0.45rem', cursor:'pointer', lineHeight:1, flexShrink:0, marginBottom:2 }}
          >
            <BarcodeIcon size={20}/>
          </button>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>اسم المنتج *</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ادخل اسم المنتج"
            style={inputStyle}
          />
        </div>

        {/* TAX / sell price row */}
        <div style={{ ...rowStyle, display:'flex', gap:'0.75rem' }}>
          <div style={{ flex:1 }}>
            <span style={labelStyle}>سعر البيع</span>
            <input
              type="number"
              value={sellPrice}
              onChange={e => setSellPrice(e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, textAlign:'center' }}
            />
          </div>
          <div style={{ flex:1 }}>
            <span style={labelStyle}>سعر الشراء</span>
            <input
              type="number"
              value={buyPrice}
              onChange={e => setBuyPrice(e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, textAlign:'center' }}
            />
          </div>
        </div>

        {/* التصنيف */}
        <div style={rowStyle}>
          <span style={labelStyle}>التصنيف</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ ...inputStyle, cursor:'pointer' }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Unit */}
        <div style={rowStyle}>
          <span style={labelStyle}>الوحدة</span>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            style={{ ...inputStyle, cursor:'pointer' }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Buttons: اضافه RIGHT (first DOM) | تراجع LEFT (second DOM) */}
        <div style={{ display:'flex', gap:'0.65rem', marginTop:'0.25rem' }}>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              flex:1, padding:'0.65rem',
              background: saving ? '#cfd8dc' : '#3949AB',
              color: saving ? '#546e7a' : 'white', border:'none', borderRadius:8,
              fontSize:'0.9rem', fontWeight:'700',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily:"'Cairo','Tajawal',sans-serif",
            }}
          >
            {saving ? '...' : 'إضافه'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex:1, padding:'0.65rem',
              background:'#f1f5f9', color:'#1a1a1a',
              border:'1px solid #e5e7eb', borderRadius:8,
              fontSize:'0.9rem', fontWeight:'600', cursor:'pointer',
              fontFamily:"'Cairo','Tajawal',sans-serif",
            }}
          >
            تراجع
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   RTL FLEX RULE: first DOM child = visual RIGHT, last DOM child = visual LEFT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function Purchases() {
  const navigate = useNavigate();
  const api      = useApi();

  const [editingId, setEditingId]     = useState(null);
  const [date, setDate]               = useState(todayStr());
  const [items, setItems]             = useState([]);
  const [saving, setSaving]           = useState(false);
  const [savedId, setSavedId]         = useState(null);
  const [error, setError]             = useState('');

  const [products, setProducts]       = useState([]);
  const [search, setSearch]           = useState('');
  const [showDrop, setShowDrop]       = useState(false);

  const [showMenu, setShowMenu]       = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  /* dialog state */
  const [showAddProduct, setShowAddProduct]     = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState('');
  const [showReprint, setShowReprint]           = useState(false);
  const [showEditDialog, setShowEditDialog]     = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const dateRef = useRef(null);

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

  const addProduct = useCallback((product) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product_id: product.id, name: product.name, unit_price: product.purchase_price||0, quantity: 1 }];
    });
    setSearch('');
    setShowDrop(false);
  }, []);

  function updateQty(idx, qty)     { setItems(p => { const n=[...p]; n[idx]={...n[idx],quantity:qty}; return n; }); }
  function updatePrice(idx, price) { setItems(p => { const n=[...p]; n[idx]={...n[idx],unit_price:price}; return n; }); }
  function removeItem(idx)          { setItems(p => p.filter((_,i) => i!==idx)); }

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

  const total     = items.reduce((s,i) => s + i.unit_price * i.quantity, 0);
  const itemCount = items.reduce((s,i) => s + i.quantity, 0);

  async function handleSave() {
    if (items.length === 0) { setError('أضف منتجاً واحداً على الأقل'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        date,
        paid_amount: 0,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      };
      const result = editingId
        ? await api.patch(`/api/purchases/${editingId}`, payload)
        : await api.post('/api/purchases', payload);

      const newId = editingId || result?.id || result;
      setSavedId(newId);
      setItems([]);
      setDate(todayStr());
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'خطأ في الحفظ');
    }
    setSaving(false);
  }

  async function loadForEdit(id) {
    setShowEditDialog(false);
    try {
      const data = await api.get(`/api/purchases/${id}`);
      setEditingId(data.id);
      setDate(data.date);
      setItems((data.items||[]).map(it => ({
        product_id: it.product_id,
        name:       it.product_name,
        unit_price: it.unit_price,
        quantity:   it.quantity,
      })));
      setSavedId(null); setError('');
    } catch (err) { setError(err.message||'تعذّر تحميل الفاتورة'); }
  }

  async function importFromPurchase(id) {
    setShowImportDialog(false);
    try {
      const data = await api.get(`/api/purchases/${id}`);
      const imported = (data.items||[]).map(it => ({
        product_id: it.product_id,
        name:       it.product_name,
        unit_price: it.unit_price,
        quantity:   it.quantity,
      }));
      setItems(prev => {
        const next = [...prev];
        for (const imp of imported) {
          const idx = next.findIndex(i => i.product_id === imp.product_id);
          if (idx>=0) next[idx] = { ...next[idx], quantity: next[idx].quantity + imp.quantity };
          else next.push(imp);
        }
        return next;
      });
    } catch (err) { setError(err.message||'تعذّر الاستيراد'); }
  }

  const menuItems = [
    {
      label: 'اضافه منتج جديد',
      action: () => { setAddProductBarcode(''); setShowAddProduct(true); },
    },
    {
      label: 'اعاده طباعه الفاتورة',
      action: () => setShowReprint(true),
    },
    {
      label: 'تعديل فاتورة مشتريات',
      action: () => setShowEditDialog(true),
    },
    {
      label: 'استيراد البيانات من طلب شراء',
      action: () => setShowImportDialog(true),
    },
  ];

  return (
    <div dir="rtl" style={{
      height:'100%', display:'flex', flexDirection:'column',
      background:'white', fontFamily:"'Cairo','Tajawal',sans-serif",
      position:'relative', overflow:'hidden',
    }}>

      {/* HEADER: hamburger (right) | title | back arrow (left) */}
      <div style={{
        background:'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
        display:'flex', alignItems:'center',
        padding:'0.55rem 0.75rem', flexShrink:0,
        boxShadow:'0 2px 8px rgba(57,73,171,0.4)',
      }}>
        <button onClick={() => setShowMenu(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',padding:'0.3rem',lineHeight:1}}>
          <HamburgerIcon/>
        </button>
        <h1 style={{flex:1,textAlign:'center',color:'white',fontSize:'1.05rem',fontWeight:'700',margin:0}}>
          {editingId ? `تعديل فاتورة #${editingId}` : 'المشتريات'}
        </h1>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',cursor:'pointer',padding:'0.3rem',lineHeight:1}}>
          <ArrowLeft size={22} color="white"/>
        </button>
      </div>

      {/* HAMBURGER DROPDOWN */}
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{position:'fixed',inset:0,zIndex:40}}/>
          <div style={{
            position:'absolute', top:52, right:0, zIndex:50,
            background:'white', minWidth:240,
            border:'1px solid #e5e7eb',
            boxShadow:'0 6px 24px rgba(0,0,0,0.12)',
          }}>
            {menuItems.map((item,i)=>(
              <button key={i}
                onClick={() => { setShowMenu(false); item.action(); }}
                style={{
                  display:'block', width:'100%', padding:'0.95rem 1.25rem',
                  background:'white', border:'none', textAlign:'right',
                  fontSize:'0.95rem', color:'#1a1a1a', cursor:'pointer',
                  borderBottom: i<menuItems.length-1 ? '1px solid #e5e7eb' : 'none',
                  fontFamily:"'Cairo','Tajawal',sans-serif",
                }}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* DATE ROW */}
      <div style={{display:'flex',background:'white',flexShrink:0,borderBottom:'1px solid #e5e7eb'}}>
        <div style={{padding:'0.6rem 1rem',fontSize:'0.9rem',color:'#1a1a1a',fontWeight:'600',display:'flex',alignItems:'center',flexShrink:0}}>
          تاريخ الفاتورة
        </div>
        <div style={{width:1,background:'#e5e7eb',margin:'0.3rem 0'}}/>
        <button
          onClick={() => {
            try { dateRef.current?.showPicker(); }
            catch { dateRef.current?.click(); }
          }}
          style={{flex:1,padding:'0.6rem 1rem',background:'none',border:'none',cursor:'pointer',textAlign:'left',fontSize:'0.9rem',color:'#1a1a1a',fontWeight:'500',fontFamily:"'Cairo','Tajawal',sans-serif"}}>
          {date}
        </button>
        <input ref={dateRef} type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{position:'absolute',opacity:0,width:0,height:0,pointerEvents:'none'}}/>
      </div>

      {/* SEARCH / SCAN / SAVE ROW */}
      <div style={{
        display:'flex', alignItems:'center', background:'white',
        padding:'0.45rem 0.5rem', gap:'0.5rem', flexShrink:0,
        borderBottom:'1px solid #e5e7eb',
      }}>
        <button onClick={() => setShowScanner(true)} style={{
          background:'white', border:'1px solid #e5e7eb', borderRadius:6,
          padding:'0.3rem 0.4rem', cursor:'pointer', flexShrink:0, lineHeight:1,
        }}>
          <BarcodeIcon size={26}/>
        </button>

        <div style={{flex:1,position:'relative'}}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
            onFocus={() => search && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="ابحث عن منتج أو استخدم الكاميرا"
            style={{
              width:'100%', border:'1.5px solid #90caf9', borderRadius:8,
              padding:'0.4rem 0.6rem', fontSize:'0.83rem', outline:'none',
              background:'white', textAlign:'right', color:'#1a1a1a',
              boxSizing:'border-box',
              fontFamily:"'Cairo','Tajawal',sans-serif",
            }}
          />
          {showDrop && searchResults.length>0 && (
            <div style={{
              position:'absolute', top:'100%', right:0, left:0, zIndex:35,
              background:'white', boxShadow:'0 6px 20px rgba(0,0,0,0.12)',
              border:'1px solid #e5e7eb',
              borderRadius:'0 0 8px 8px', maxHeight:260, overflowY:'auto',
            }}>
              {searchResults.map(p=>(
                <button key={p.id} onMouseDown={() => addProduct(p)}
                  style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    width:'100%', padding:'0.65rem 0.9rem', background:'white', border:'none',
                    borderBottom:'1px solid #f1f5f9', cursor:'pointer', textAlign:'right',
                    fontFamily:"'Cairo','Tajawal',sans-serif",
                  }}>
                  <span style={{color:'#6b7280',fontSize:'0.78rem'}}>{(p.purchase_price||0).toFixed(2)} ريال</span>
                  <span style={{color:'#1a1a1a',fontSize:'0.9rem',fontWeight:'500'}}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          background: saving ? '#cfd8dc' : '#3949AB', border:'none', borderRadius:6,
          padding:'0.45rem 0.75rem', display:'flex', alignItems:'center', gap:'0.35rem',
          cursor: saving ? 'not-allowed' : 'pointer', flexShrink:0,
        }}>
          <Save size={17} color={saving ? '#546e7a' : 'white'}/>
          <span style={{color: saving ? '#546e7a' : 'white',fontSize:'0.85rem',fontWeight:'700'}}>حفظ</span>
        </button>
      </div>

      {/* ERROR / SUCCESS BANNERS */}
      {error && (
        <div style={{background:'#fef2f2',padding:'0.4rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #fca5a5',flexShrink:0}}>
          <button onClick={() => setError('')} style={{background:'none',border:'none',cursor:'pointer'}}><X size={14} color="#d32f2f"/></button>
          <span style={{color:'#d32f2f',fontSize:'0.83rem'}}>{error}</span>
        </div>
      )}
      {savedId && !error && (
        <div style={{background:'#f0fdf4',padding:'0.4rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #86efac',flexShrink:0}}>
          <button onClick={() => setSavedId(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={14} color="#2e7d32"/></button>
          <span style={{color:'#2e7d32',fontSize:'0.83rem',display:'flex',alignItems:'center',gap:'0.4rem'}}>
            <Check size={14}/> تم الحفظ — فاتورة #{savedId}
          </span>
        </div>
      )}

      {/* TABLE HEADER */}
      <div style={{display:'flex',background:'#f1f5f9',borderBottom:'1px solid #e5e7eb',flexShrink:0,padding:'0.35rem 0.5rem'}}>
        <span style={{flex:1,         textAlign:'right',  fontSize:'0.78rem',color:'#6b7280',fontWeight:'700',paddingRight:'0.5rem'}}>المنتج</span>
        <span style={{width:'22%',    textAlign:'center', fontSize:'0.78rem',color:'#6b7280',fontWeight:'700'}}>التكلفه</span>
        <span style={{width:'18%',    textAlign:'center', fontSize:'0.78rem',color:'#6b7280',fontWeight:'700'}}>الكمية</span>
        <span style={{width:'23%',    textAlign:'center', fontSize:'0.78rem',color:'#6b7280',fontWeight:'700'}}>الإجمالي</span>
      </div>

      {/* ITEMS LIST */}
      <div style={{flex:1,overflowY:'auto',background:'white'}}>
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

      {/* FLOATING DOTS FAB */}
      <button
        onClick={() => navigate('/products/list')}
        style={{
          position:'absolute', bottom:66, right:16,
          background:'white', border:'1px solid #e5e7eb', borderRadius:'50%',
          width:50, height:50, display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'0 3px 10px rgba(0,0,0,0.12)', zIndex:10,
        }}>
        <DotsGrid/>
      </button>

      {/* BOTTOM BAR */}
      <div style={{
        display:'flex', alignItems:'center', background:'white',
        borderTop:'1px solid #e5e7eb', padding:'0.5rem 0.75rem',
        flexShrink:0, gap:'0.5rem',
      }}>
        <span style={{fontSize:'0.9rem',fontWeight:'700',color:'#1a1a1a',flexShrink:0}}>إجمالي</span>
        <div style={{flex:1,background:'white',border:'1.5px solid #90caf9',borderRadius:20,padding:'0.4rem 0.75rem',textAlign:'center'}}>
          <span style={{color:'#e91e63',fontWeight:'700',fontSize:'1rem'}}>
            {total.toFixed(2)}
          </span>
        </div>
        <span style={{fontSize:'0.8rem',color:'#6b7280',fontWeight:'500',flexShrink:0}}>ريال ع.ق</span>
        <div style={{
          background:'white', border:'1px solid #e5e7eb', borderRadius:20,
          padding:'0.28rem 0.7rem', minWidth:52, textAlign:'center',
          fontSize:'0.9rem', fontWeight:'700', color:'#1a1a1a',
        }}>
          {itemCount % 1 === 0 ? itemCount.toFixed(1) : itemCount.toFixed(2)}
        </div>
      </div>

      {/* OVERLAYS */}
      <BarcodeScanner isOpen={showScanner} onScan={handleScan} onClose={() => setShowScanner(false)}/>

      {showAddProduct && (
        <AddProductDialog
          barcode={addProductBarcode}
          api={api}
          onClose={() => setShowAddProduct(false)}
          onAdded={handleProductAdded}
        />
      )}

      {showReprint && (
        <ReprintDialog api={api} onClose={() => setShowReprint(false)}/>
      )}

      {showEditDialog && (
        <NumberInputDialog
          title="تعديل فاتورة مشتريات"
          subtitle="ادخل رقم الفاتورة"
          onConfirm={loadForEdit}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      {showImportDialog && (
        <NumberInputDialog
          title="استيراد البيانات من طلب شراء"
          subtitle="ادخل رقم طلب شراء"
          onConfirm={importFromPurchase}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
}
