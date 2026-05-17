const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const SETTING_KEYS = {
  include_sales:     'cashbox.include_sales',
  include_purchases: 'cashbox.include_purchases',
  include_expenses:  'cashbox.include_expenses',
};

function readSettings() {
  const rows = db.prepare(`
    SELECT key, value FROM settings WHERE key IN (?, ?, ?)
  `).all(SETTING_KEYS.include_sales, SETTING_KEYS.include_purchases, SETTING_KEYS.include_expenses);
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    include_sales:     map[SETTING_KEYS.include_sales]     === '1',
    include_purchases: map[SETTING_KEYS.include_purchases] === '1',
    include_expenses:  map[SETTING_KEYS.include_expenses]  === '1',
  };
}

function writeSetting(key, on) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, on ? '1' : '0');
}

function computeBalance(settings) {
  const manualRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='add' THEN amount ELSE 0 END), 0) AS adds,
      COALESCE(SUM(CASE WHEN type='sub' THEN amount ELSE 0 END), 0) AS subs
    FROM cash_box_entries
  `).get();

  let balance = (manualRow.adds || 0) - (manualRow.subs || 0);

  if (settings.include_sales) {
    const r = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS v FROM sales WHERE status != 'cancelled'
    `).get();
    balance += r.v || 0;
  }
  if (settings.include_purchases) {
    const r = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS v FROM purchases WHERE status != 'cancelled'
    `).get();
    balance -= r.v || 0;
  }
  if (settings.include_expenses) {
    const r = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM expenses`).get();
    balance -= r.v || 0;
  }

  return balance;
}

// ---------------------------------------------------------------------------
// GET /api/treasury/balance  → current safe balance + active settings
// ---------------------------------------------------------------------------
router.get('/balance', (_req, res) => {
  try {
    const settings = readSettings();
    const balance  = computeBalance(settings);
    return res.json({ success: true, data: { balance, settings } });
  } catch (err) {
    console.error('[treasury] GET /balance error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to compute balance' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/treasury/settings
// PUT /api/treasury/settings   body: { include_sales, include_purchases, include_expenses }
// ---------------------------------------------------------------------------
router.get('/settings', (_req, res) => {
  try {
    return res.json({ success: true, data: readSettings() });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
});

router.put('/settings', (req, res) => {
  const { include_sales, include_purchases, include_expenses } = req.body || {};
  try {
    if (typeof include_sales     === 'boolean') writeSetting(SETTING_KEYS.include_sales,     include_sales);
    if (typeof include_purchases === 'boolean') writeSetting(SETTING_KEYS.include_purchases, include_purchases);
    if (typeof include_expenses  === 'boolean') writeSetting(SETTING_KEYS.include_expenses,  include_expenses);
    return res.json({ success: true, data: readSettings() });
  } catch (err) {
    console.error('[treasury] PUT /settings error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/treasury/entries   body: { type: 'add'|'sub', amount, date, description }
// GET  /api/treasury/entries   recent manual entries (latest 100)
// ---------------------------------------------------------------------------
router.post('/entries', (req, res) => {
  const { type, amount, date, description = null } = req.body || {};
  if (type !== 'add' && type !== 'sub') {
    return res.status(400).json({ success: false, error: "type must be 'add' or 'sub'" });
  }
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
  }
  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO cash_box_entries (type, amount, date, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, amt, date, description || null, req.user.userId);

    const settings = readSettings();
    const balance  = computeBalance(settings);

    return res.status(201).json({ success: true, id: lastInsertRowid, data: { balance, settings } });
  } catch (err) {
    console.error('[treasury] POST /entries error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to record entry' });
  }
});

router.get('/entries', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM cash_box_entries ORDER BY date DESC, created_at DESC LIMIT 100
    `).all();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load entries' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/treasury?date=YYYY-MM-DD
// Daily snapshot — kept for backwards compatibility with anything that still
// hits the bare /api/treasury endpoint.
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const date = req.query.date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' });
  }

  try {
    const salesRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_total,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_cash,
        COALESCE(SUM(CASE WHEN payment_method = 'check' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_check,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_transfer,
        COUNT(CASE WHEN status NOT IN ('cancelled', 'return') THEN 1 END) AS sales_count
      FROM sales WHERE date = ?
    `).get(date);

    const purchasesRow = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS purchases_paid, COUNT(*) AS purchases_count
      FROM purchases WHERE date = ? AND status != 'cancelled'
    `).get(date);

    const expensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS expenses_total, COUNT(*) AS expenses_count
      FROM expenses WHERE date = ?
    `).get(date);

    const expensesByCategory = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM expenses WHERE date = ?
      GROUP BY category ORDER BY total DESC
    `).all(date);

    const cashIn  = salesRow.cash_in_total     || 0;
    const cashOut = (purchasesRow.purchases_paid || 0) + (expensesRow.expenses_total || 0);

    return res.json({
      success: true,
      data: {
        date,
        cash_in: {
          total:    cashIn,
          cash:     salesRow.cash_in_cash     || 0,
          check:    salesRow.cash_in_check    || 0,
          transfer: salesRow.cash_in_transfer || 0,
          sales_count: salesRow.sales_count   || 0,
        },
        cash_out: {
          total:           cashOut,
          purchases:       purchasesRow.purchases_paid  || 0,
          expenses:        expensesRow.expenses_total   || 0,
          purchases_count: purchasesRow.purchases_count || 0,
          expenses_count:  expensesRow.expenses_count   || 0,
          by_category:     expensesByCategory,
        },
        net: cashIn - cashOut,
      },
    });
  } catch (err) {
    console.error('[treasury] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load treasury data' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/treasury/range?start=YYYY-MM-DD&end=YYYY-MM-DD
// Aggregate snapshot across a date range (used by Reports).
// ---------------------------------------------------------------------------
router.get('/range', (req, res) => {
  const { start, end } = req.query;
  const dateRx = /^\d{4}-\d{2}-\d{2}$/;
  if (!start || !end || !dateRx.test(start) || !dateRx.test(end)) {
    return res.status(400).json({ success: false, error: 'start and end required as YYYY-MM-DD' });
  }

  try {
    const salesRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN status != 'cancelled' THEN paid_amount ELSE 0 END), 0) AS cash_in
      FROM sales WHERE date >= ? AND date <= ?
    `).get(start, end);

    const purchasesRow = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS purchases_paid
      FROM purchases WHERE date >= ? AND date <= ? AND status != 'cancelled'
    `).get(start, end);

    const expensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS expenses_total
      FROM expenses WHERE date >= ? AND date <= ?
    `).get(start, end);

    const cashIn  = salesRow.cash_in            || 0;
    const cashOut = (purchasesRow.purchases_paid || 0) + (expensesRow.expenses_total || 0);

    return res.json({
      success: true,
      data: { start, end, cash_in: cashIn, cash_out: cashOut, net: cashIn - cashOut },
    });
  } catch (err) {
    console.error('[treasury] GET /range error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load range data' });
  }
});

module.exports = router;
