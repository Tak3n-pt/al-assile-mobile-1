const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

const VALID_CATEGORIES = ['rent', 'utilities', 'salary', 'transport', 'maintenance', 'supplies', 'food', 'other'];

// ---------------------------------------------------------------------------
// GET /api/expenses
// Query params: ?start=YYYY-MM-DD  ?end=YYYY-MM-DD  ?category=other
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
// POST /api/expenses
// Body: { amount, category, description, date, payment_method, notes }
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const {
    amount,
    category       = 'other',
    description    = null,
    date,
    payment_method = 'cash',
    notes          = null,
  } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
  }

  const cat = VALID_CATEGORIES.includes(category) ? category : 'other';

  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO expenses (amount, category, description, date, payment_method, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(amount, cat, description, date, payment_method, notes, req.user.userId);

    return res.status(201).json({ success: true, id: lastInsertRowid });
  } catch (err) {
    console.error('[expenses] POST / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/expenses/:id
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

  try {
    const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[expenses] DELETE /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/expenses/categories  — list valid categories
// ---------------------------------------------------------------------------
router.get('/categories', (_req, res) => {
  return res.json({ success: true, data: VALID_CATEGORIES });
});

module.exports = router;
