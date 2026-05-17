const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/expenses
// Query params: ?start=YYYY-MM-DD  ?end=YYYY-MM-DD  ?category=...
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { start, end, category } = req.query;
  const filters = [];
  const params  = [];

  if (start)    { filters.push('date >= ?');    params.push(start); }
  if (end)      { filters.push('date <= ?');    params.push(end); }
  if (category) { filters.push('category = ?'); params.push(category); }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const rows = db.prepare(`
      SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC LIMIT 300
    `).all(...params);
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    return res.json({ success: true, data: rows, total });
  } catch (err) {
    console.error('[expenses] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load expenses' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expenses/accounts   → distinct values of `category` (account names)
// GET /api/expenses/descriptions → distinct values of `description`
// Used to power the two autocomplete inputs on the Expenses form.
// ---------------------------------------------------------------------------
router.get('/accounts', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT category AS name, COUNT(*) AS uses
      FROM expenses
      WHERE category IS NOT NULL AND TRIM(category) != ''
      GROUP BY category
      ORDER BY uses DESC, name ASC
      LIMIT 200
    `).all();
    return res.json({ success: true, data: rows.map(r => r.name) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load accounts' });
  }
});

router.get('/descriptions', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT description AS name, COUNT(*) AS uses
      FROM expenses
      WHERE description IS NOT NULL AND TRIM(description) != ''
      GROUP BY description
      ORDER BY uses DESC, name ASC
      LIMIT 200
    `).all();
    return res.json({ success: true, data: rows.map(r => r.name) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load descriptions' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expenses
// Body: { amount, category, description, date, payment_method, notes }
//   category is free-form (the account name typed by the user).
//   payment_method is free-form: 'cash' | 'card' | 'check' | etc.
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const {
    amount,
    category       = null,
    description    = null,
    date,
    payment_method = 'cash',
    notes          = null,
  } = req.body;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
  }

  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO expenses (amount, category, description, date, payment_method, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(amt, category || null, description || null, date, payment_method || 'cash', notes, req.user.userId);

    return res.status(201).json({ success: true, id: lastInsertRowid });
  } catch (err) {
    console.error('[expenses] POST / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expenses/categories
// Kept for Reports.jsx: union of legacy defaults + any custom values seen in DB.
// ---------------------------------------------------------------------------
router.get('/categories', (_req, res) => {
  const defaults = ['rent', 'utilities', 'salary', 'transport', 'maintenance', 'supplies', 'food', 'other'];
  try {
    const rows = db.prepare(`
      SELECT DISTINCT category FROM expenses
      WHERE category IS NOT NULL AND TRIM(category) != ''
    `).all();
    const seen = new Set(defaults);
    rows.forEach(r => seen.add(r.category));
    return res.json({ success: true, data: Array.from(seen) });
  } catch {
    return res.json({ success: true, data: defaults });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/expenses/:id
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid id' });

  try {
    const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[expenses] DELETE /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
});

module.exports = router;
