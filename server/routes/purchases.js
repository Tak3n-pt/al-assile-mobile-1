const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

function deriveStatus(total, paid) {
  if (paid <= 0)       return 'pending';
  if (paid >= total)   return 'paid';
  return 'partial';
}

// ---------------------------------------------------------------------------
// GET /api/purchases  — list purchases, newest first
// Query params: ?supplier_id=N  ?start=YYYY-MM-DD  ?end=YYYY-MM-DD
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { supplier_id, start, end } = req.query;
  const filters = [];
  const params  = [];

  if (supplier_id) { filters.push('p.supplier_id = ?'); params.push(parseInt(supplier_id, 10)); }
  if (start)       { filters.push('p.date >= ?');        params.push(start); }
  if (end)         { filters.push('p.date <= ?');        params.push(end); }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const rows = db.prepare(`
      SELECT p.*, s.name AS supplier_name
      FROM   purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT 200
    `).all(...params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[purchases] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load purchases' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/purchases/:id  — single purchase with line items
// ---------------------------------------------------------------------------
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

  try {
    const purchase = db.prepare(`
      SELECT p.*, s.name AS supplier_name
      FROM   purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE  p.id = ?
    `).get(id);
    if (!purchase) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const items = db.prepare(`
      SELECT pi.*, pr.name AS product_name, pr.unit
      FROM   purchase_items pi
      JOIN   products pr ON pr.id = pi.product_id
      WHERE  pi.purchase_id = ?
      ORDER  BY pi.id
    `).all(id);

    return res.json({ success: true, data: { ...purchase, items } });
  } catch (err) {
    console.error('[purchases] GET /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load purchase' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/purchases  — create a new purchase
// Body: { supplier_id, date, paid_amount, discount, payment_method, notes,
//         items: [{ product_id, quantity, unit_price }] }
// Side-effects:
//   - Inserts purchase + purchase_items in a transaction
//   - Increases product quantity for each line item
//   - Updates supplier balance (negative = owed to supplier)
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const {
    supplier_id    = null,
    date,
    paid_amount    = 0,
    discount       = 0,
    payment_method = 'cash',
    notes          = null,
    items          = [],
  } = req.body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'items must not be empty' });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.product_id || it.quantity <= 0 || it.unit_price < 0) {
      return res.status(400).json({ success: false, error: `Item ${i + 1}: invalid product_id, quantity, or unit_price` });
    }
  }

  try {
    const result = db.transaction(() => {
      const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const total    = Math.max(0, subtotal - (discount || 0));
      const paid     = Math.min(paid_amount, total);
      const status   = deriveStatus(total, paid);

      const { lastInsertRowid: purchaseId } = db.prepare(`
        INSERT INTO purchases (supplier_id, date, subtotal, discount, total, paid_amount, status, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(supplier_id, date, subtotal, discount || 0, total, paid, status, payment_method, notes, req.user.userId);

      const insertItem = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?)
      `);
      const updateQty = db.prepare(`
        UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);

      for (const it of items) {
        const lineTotal = it.quantity * it.unit_price;
        insertItem.run(purchaseId, it.product_id, it.quantity, it.unit_price, lineTotal);
        updateQty.run(it.quantity, it.product_id);
      }

      // Update supplier balance: unpaid portion is owed (negative = shop owes)
      if (supplier_id) {
        const owed = total - paid;
        if (owed !== 0) {
          db.prepare(`UPDATE suppliers SET balance = COALESCE(balance,0) - ? WHERE id = ?`).run(owed, supplier_id);
        }
      }

      return { purchaseId, total, status };
    })();

    return res.status(201).json({ success: true, id: result.purchaseId, total: result.total, status: result.status });
  } catch (err) {
    console.error('[purchases] POST / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create purchase' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/purchases/:id  — edit an existing purchase
// Reverses old quantities/balance, replaces items, applies new quantities/balance
// ---------------------------------------------------------------------------
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

  const { date, paid_amount, discount, payment_method, notes, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'items must not be empty' });
  }

  try {
    const result = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
      if (!existing) throw new Error('Purchase not found');

      const oldItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);

      // Reverse old product quantities
      const revQty = db.prepare('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      for (const it of oldItems) revQty.run(it.quantity, it.product_id);

      // Reverse old supplier balance effect
      if (existing.supplier_id) {
        const oldOwed = existing.total - existing.paid_amount;
        if (oldOwed !== 0)
          db.prepare('UPDATE suppliers SET balance = COALESCE(balance,0) + ? WHERE id = ?').run(oldOwed, existing.supplier_id);
      }

      // Delete old items
      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);

      const newDate    = date           || existing.date;
      const newDisc    = discount       != null ? parseFloat(discount)    : existing.discount;
      const newPaid    = paid_amount    != null ? parseFloat(paid_amount) : existing.paid_amount;
      const newMethod  = payment_method || existing.payment_method;
      const newNotes   = notes          != null ? notes                   : existing.notes;

      const subtotal  = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const total     = Math.max(0, subtotal - (newDisc || 0));
      const paid      = Math.min(newPaid || 0, total);
      const status    = deriveStatus(total, paid);

      db.prepare(`
        UPDATE purchases
        SET date=?, subtotal=?, discount=?, total=?, paid_amount=?, status=?,
            payment_method=?, notes=?
        WHERE id=?
      `).run(newDate, subtotal, newDisc || 0, total, paid, status, newMethod, newNotes, id);

      const insertItem = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total) VALUES (?,?,?,?,?)');
      const addQty     = db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

      for (const it of items) {
        const lineTotal = it.quantity * it.unit_price;
        insertItem.run(id, it.product_id, it.quantity, it.unit_price, lineTotal);
        addQty.run(it.quantity, it.product_id);
      }

      if (existing.supplier_id) {
        const newOwed = total - paid;
        if (newOwed !== 0)
          db.prepare('UPDATE suppliers SET balance = COALESCE(balance,0) - ? WHERE id = ?').run(newOwed, existing.supplier_id);
      }

      return { id, total, status };
    })();

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[purchases] PATCH error:', err.message);
    return res.status(err.message === 'Purchase not found' ? 404 : 500)
      .json({ success: false, error: err.message });
  }
});

module.exports = router;
