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

module.exports = router;
