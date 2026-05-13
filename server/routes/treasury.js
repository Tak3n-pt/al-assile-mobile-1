const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// GET /api/treasury?date=YYYY-MM-DD
// Returns a cash-box snapshot for the given date (defaults to today).
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const date = req.query.date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' });
  }

  try {
    // Cash received from sales (cash payment method only, non-cancelled)
    const salesRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_total,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_cash,
        COALESCE(SUM(CASE WHEN payment_method = 'check' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_check,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND status NOT IN ('cancelled') THEN paid_amount ELSE 0 END), 0) AS cash_in_transfer,
        COUNT(CASE WHEN status NOT IN ('cancelled', 'return') THEN 1 END) AS sales_count
      FROM sales WHERE date = ?
    `).get(date);

    // Cash paid out for purchases
    const purchasesRow = db.prepare(`
      SELECT
        COALESCE(SUM(paid_amount), 0) AS purchases_paid,
        COUNT(*) AS purchases_count
      FROM purchases WHERE date = ? AND status != 'cancelled'
    `).get(date);

    // Expenses
    const expensesRow = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS expenses_total,
        COUNT(*) AS expenses_count
      FROM expenses WHERE date = ?
    `).get(date);

    // Expense breakdown by category
    const expensesByCategory = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM expenses WHERE date = ?
      GROUP BY category ORDER BY total DESC
    `).all(date);

    const cashIn  = salesRow.cash_in_total     || 0;
    const cashOut = (purchasesRow.purchases_paid || 0) + (expensesRow.expenses_total || 0);
    const net     = cashIn - cashOut;

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
        net,
      },
    });
  } catch (err) {
    console.error('[treasury] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load treasury data' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/treasury/range?start=YYYY-MM-DD&end=YYYY-MM-DD
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
