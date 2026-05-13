const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/reports/daily?date=YYYY-MM-DD
// ---------------------------------------------------------------------------

/**
 * Returns a daily summary for the given date (defaults to today).
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     date:            "YYYY-MM-DD",
 *     sales_count:     number,   // regular sales only
 *     returns_count:   number,   // return records only
 *     gross_sales:     number,   // sum of positive totals
 *     returns_total:   number,   // sum of return amounts (positive value)
 *     net_sales:       number,   // gross_sales - returns_total
 *     total_collected: number,   // sum of positive paid_amounts
 *     outstanding:     number,   // net_sales - total_collected
 *     items_sold:      number,   // total units sold (from sale_items on normal sales)
 *     top_products: [
 *       { name: string, quantity: number, revenue: number }
 *     ]
 *   }
 * }
 */
router.get('/daily', (req, res) => {
  let date = req.query.date;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'date query param must be YYYY-MM-DD'
      });
    }
  } else {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const d   = String(now.getDate()).padStart(2, '0');
    date = `${y}-${m}-${d}`;
  }

  try {
    // --- Aggregate sales and returns for the day ---
    // Cancelled sales are excluded from every metric — they're a user-error
    // rollback, not a revenue event. Returns count separately.
    const summary = db.prepare(`
      SELECT
        COUNT(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN 1 END) AS sales_count,
        COUNT(CASE WHEN status  = 'return' OR  total  < 0 THEN 1 END) AS returns_count,
        COALESCE(SUM(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN total       ELSE 0 END), 0) AS gross_sales,
        COALESCE(ABS(SUM(CASE WHEN status  = 'return' OR  total  < 0 THEN total  ELSE 0 END)), 0) AS returns_total,
        COALESCE(SUM(CASE WHEN status NOT IN ('return', 'cancelled') AND paid_amount > 0 THEN paid_amount ELSE 0 END), 0) AS total_collected
      FROM sales
      WHERE date = ?
    `).get(date);

    const grossSales   = summary.gross_sales   || 0;
    const returnsTotal = summary.returns_total || 0;
    const netSales     = grossSales - returnsTotal;
    const outstanding  = Math.max(0, netSales - (summary.total_collected || 0));

    // --- Total units sold (only on non-return, non-cancelled sales) ---
    const itemsRow = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) AS items_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date = ?
        AND s.status NOT IN ('return', 'cancelled') AND s.total >= 0
    `).get(date);

    const itemsSold = itemsRow ? (itemsRow.items_sold || 0) : 0;

    // --- Top products by revenue for the day ---
    const topProducts = db.prepare(`
      SELECT
        p.name                    AS name,
        SUM(si.quantity)          AS quantity,
        SUM(si.total)             AS revenue
      FROM sale_items si
      JOIN sales    s ON s.id  = si.sale_id
      JOIN products p ON p.id  = si.product_id
      WHERE s.date = ?
        AND s.status NOT IN ('return', 'cancelled') AND s.total >= 0
      GROUP BY si.product_id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `).all(date);

    return res.json({
      success: true,
      data: {
        date,
        sales_count:     summary.sales_count   || 0,
        returns_count:   summary.returns_count || 0,
        gross_sales:     grossSales,
        returns_total:   returnsTotal,
        net_sales:       netSales,
        total_collected: summary.total_collected || 0,
        outstanding,
        items_sold:      itemsSold,
        top_products:    topProducts
      }
    });
  } catch (err) {
    console.error('[reports] GET /daily error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to generate daily report' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
// Range summary for the Dashboard tab. Covers both mobile-origin and
// desktop-origin sales (desktop sales arrive via sync push with remote_id
// 'desktop-{id}') so the figures match what the shop sees on the counter.
// ---------------------------------------------------------------------------
router.get('/summary', (req, res) => {
  const { start, end } = req.query;
  const dateRx = /^\d{4}-\d{2}-\d{2}$/;
  if (!start || !end || !dateRx.test(start) || !dateRx.test(end)) {
    return res.status(400).json({
      success: false,
      error: 'start and end query params required as YYYY-MM-DD'
    });
  }
  if (start > end) {
    return res.status(400).json({ success: false, error: 'start must be <= end' });
  }

  try {
    // Cancelled sales are excluded from every metric — they're a user-error
    // rollback, not a revenue event. Returns count separately.
    const totals = db.prepare(`
      SELECT
        COUNT(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN 1 END) AS sales_count,
        COUNT(CASE WHEN status  = 'return' OR  total  < 0 THEN 1 END) AS returns_count,
        COALESCE(SUM(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN total ELSE 0 END), 0) AS gross_sales,
        COALESCE(ABS(SUM(CASE WHEN status = 'return' OR total < 0 THEN total ELSE 0 END)), 0) AS returns_total,
        COALESCE(SUM(CASE WHEN status NOT IN ('return', 'cancelled') AND paid_amount > 0 THEN paid_amount ELSE 0 END), 0) AS total_collected
      FROM sales
      WHERE date >= ? AND date <= ?
    `).get(start, end);

    const grossSales = totals.gross_sales || 0;
    const returnsTotal = totals.returns_total || 0;
    const netSales = grossSales - returnsTotal;
    const outstanding = Math.max(0, netSales - (totals.total_collected || 0));

    const items = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) AS items_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ? AND s.date <= ?
        AND s.status NOT IN ('return', 'cancelled') AND s.total >= 0
    `).get(start, end);

    const topProducts = db.prepare(`
      SELECT p.name AS name, SUM(si.quantity) AS quantity, SUM(si.total) AS revenue
      FROM sale_items si
      JOIN sales    s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.date >= ? AND s.date <= ?
        AND s.status NOT IN ('return', 'cancelled') AND s.total >= 0
      GROUP BY si.product_id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `).all(start, end);

    // Breakdown by day so the UI can render a sparkline / bar chart later.
    const daily = db.prepare(`
      SELECT date,
             COALESCE(SUM(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN total ELSE 0 END), 0) AS revenue,
             COUNT(CASE WHEN status NOT IN ('return', 'cancelled') AND total >= 0 THEN 1 END) AS sales_count
      FROM sales
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(start, end);

    return res.json({
      success: true,
      data: {
        start, end,
        sales_count:     totals.sales_count   || 0,
        returns_count:   totals.returns_count || 0,
        gross_sales:     grossSales,
        returns_total:   returnsTotal,
        net_sales:       netSales,
        total_collected: totals.total_collected || 0,
        outstanding,
        items_sold:      items?.items_sold || 0,
        top_products:    topProducts,
        daily
      }
    });
  } catch (err) {
    console.error('[reports] GET /summary error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to build summary' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/stock-alerts
// Products at/below their minimum stock alert threshold.
// ---------------------------------------------------------------------------
router.get('/stock-alerts', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, unit, quantity, min_stock_alert
      FROM products
      WHERE is_active = 1
        AND min_stock_alert > 0
        AND quantity <= min_stock_alert
      ORDER BY (quantity * 1.0 / NULLIF(min_stock_alert, 0)) ASC, name ASC
    `).all();
    // Also include pure out-of-stock rows even when min_stock_alert is 0 so the
    // user sees everything they can't sell. De-dup by id.
    const zero = db.prepare(`
      SELECT id, name, unit, quantity, min_stock_alert
      FROM products
      WHERE is_active = 1 AND quantity <= 0
    `).all();
    const seen = new Set(rows.map(r => r.id));
    for (const z of zero) if (!seen.has(z.id)) rows.push(z);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[reports] GET /stock-alerts error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load stock alerts' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/payables
// Suppliers with a negative balance (shop owes them). Convention mirrors
// clients: negative = the shop is in debt to this supplier.
// ---------------------------------------------------------------------------
router.get('/payables', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, phone, balance
      FROM suppliers
      WHERE COALESCE(balance, 0) < 0
      ORDER BY balance ASC
    `).all();
    const totalOwed = rows.reduce((s, r) => s + Math.abs(r.balance || 0), 0);
    return res.json({ success: true, data: { suppliers: rows, total_owed: totalOwed } });
  } catch (err) {
    console.error('[reports] GET /payables error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load payables' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/sales/returns?start=&end=
// GET /api/reports/sales/cancelled?start=&end=
// ---------------------------------------------------------------------------
router.get('/sales/returns', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const rows = db.prepare(`
      SELECT s.id, s.date, s.total, s.paid_amount, s.discount, s.notes,
             c.name AS client_name
      FROM sales s LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'return'
      ORDER BY s.date DESC, s.id DESC
    `).all(start, end);
    res.json({ success: true, data: { rows, total: rows.reduce((s, r) => s + Math.abs(r.total || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/sales/cancelled', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const rows = db.prepare(`
      SELECT s.id, s.date, s.total, s.paid_amount, s.notes,
             c.name AS client_name
      FROM sales s LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'cancelled'
      ORDER BY s.date DESC, s.id DESC
    `).all(start, end);
    res.json({ success: true, data: { rows, total: rows.reduce((s, r) => s + (r.total || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------------------
// CLIENT SUB-REPORTS — literal path BEFORE /:id parameterized routes
// ---------------------------------------------------------------------------
router.get('/clients/payment-methods', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const rows = db.prepare(`
      SELECT method, COUNT(*) AS count, SUM(amount) AS total
      FROM client_payments
      WHERE date >= ? AND date <= ?
        AND method NOT IN ('opening_balance','adjustment','balance_correction','funding')
        AND amount > 0
      GROUP BY method ORDER BY total DESC
    `).all(start, end);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/opening', (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const client = db.prepare('SELECT id, name, phone, balance FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT id, amount, date, method, notes FROM client_payments
      WHERE client_id = ? AND method IN ('opening_balance','adjustment','funding','balance_correction')
      ORDER BY date ASC, id ASC
    `).all(id);
    res.json({ success: true, data: { client, rows } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/invoices', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name, balance FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT id, date, subtotal, discount, total, paid_amount, status, payment_method, notes
      FROM sales WHERE client_id = ? AND date >= ? AND date <= ?
        AND status NOT IN ('cancelled','return')
      ORDER BY date ASC, id ASC
    `).all(id, start, end);
    const totalAmount = rows.reduce((s, r) => s + (r.total || 0), 0);
    const totalPaid   = rows.reduce((s, r) => s + (r.paid_amount || 0), 0);
    res.json({ success: true, data: { client, rows, total_amount: totalAmount, total_paid: totalPaid, count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/returns', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT id, date, total, notes FROM sales
      WHERE client_id = ? AND date >= ? AND date <= ? AND status = 'return'
      ORDER BY date DESC, id DESC
    `).all(id, start, end);
    res.json({ success: true, data: { client, rows, total: rows.reduce((s, r) => s + Math.abs(r.total || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/receipts', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT id, amount, date, method, notes, sale_id FROM client_payments
      WHERE client_id = ? AND date >= ? AND date <= ? AND amount > 0
        AND method NOT IN ('opening_balance','adjustment','balance_correction','funding')
      ORDER BY date DESC, id DESC
    `).all(id, start, end);
    res.json({ success: true, data: { client, rows, total: rows.reduce((s, r) => s + (r.amount || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/payments-out', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT id, ABS(amount) AS amount, date, method, notes FROM client_payments
      WHERE client_id = ? AND date >= ? AND date <= ?
        AND (method = 'funding' OR amount < 0)
      ORDER BY date DESC, id DESC
    `).all(id, start, end);
    res.json({ success: true, data: { client, rows, total: rows.reduce((s, r) => s + (r.amount || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/settlement', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name, balance FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT 'invoice' AS type, CAST(id AS TEXT) AS ref_id, date,
             total AS amount, status AS detail, notes
      FROM sales WHERE client_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'
      UNION ALL
      SELECT 'payment' AS type, CAST(id AS TEXT) AS ref_id, date,
             amount, method AS detail, notes
      FROM client_payments
      WHERE client_id = ? AND date >= ? AND date <= ?
        AND method NOT IN ('opening_balance','adjustment','balance_correction')
      ORDER BY date ASC, type ASC
    `).all(id, start, end, id, start, end);
    res.json({ success: true, data: { client, rows } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/clients/:id/products', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    const rows = db.prepare(`
      SELECT p.id AS product_id, p.name AS product_name, p.unit,
             SUM(si.quantity) AS total_qty, SUM(si.total) AS total_amount
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.client_id = ? AND s.date >= ? AND s.date <= ?
        AND s.status NOT IN ('cancelled','return')
      GROUP BY si.product_id, p.name, p.unit
      ORDER BY total_amount DESC
    `).all(id, start, end);
    res.json({ success: true, data: { client, rows, grand_total: rows.reduce((s, r) => s + (r.total_amount || 0), 0) } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------------------
// SUPPLIER SUB-REPORTS — literal path BEFORE /:id parameterized routes
// ---------------------------------------------------------------------------
router.get('/suppliers/payment-methods', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const rows = db.prepare(`
      SELECT method, COUNT(*) AS count, SUM(amount) AS total
      FROM supplier_payments
      WHERE date >= ? AND date <= ?
        AND method NOT IN ('opening_balance','adjustment','balance_correction')
        AND amount > 0
      GROUP BY method ORDER BY total DESC
    `).all(start, end);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/opening', (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const supplier = db.prepare('SELECT id, name, phone, balance FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT id, amount, date, method, notes FROM supplier_payments
      WHERE supplier_id = ? AND method IN ('opening_balance','adjustment','funding','balance_correction')
      ORDER BY date ASC, id ASC
    `).all(id);
    res.json({ success: true, data: { supplier, rows } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/invoices', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const supplier = db.prepare('SELECT id, name, balance FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT id, date, subtotal, discount, total, paid_amount, status, payment_method, notes
      FROM purchases WHERE supplier_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'
      ORDER BY date ASC, id ASC
    `).all(id, start, end);
    const totalAmount = rows.reduce((s, r) => s + (r.total || 0), 0);
    const totalPaid   = rows.reduce((s, r) => s + (r.paid_amount || 0), 0);
    res.json({ success: true, data: { supplier, rows, total_amount: totalAmount, total_paid: totalPaid, count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/payments-out', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT id, amount, date, method, notes, purchase_id FROM supplier_payments
      WHERE supplier_id = ? AND date >= ? AND date <= ? AND amount > 0
        AND method NOT IN ('opening_balance','adjustment','balance_correction')
      ORDER BY date DESC, id DESC
    `).all(id, start, end);
    res.json({ success: true, data: { supplier, rows, total: rows.reduce((s, r) => s + (r.amount || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/receipts', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT id, ABS(amount) AS amount, date, method, notes FROM supplier_payments
      WHERE supplier_id = ? AND date >= ? AND date <= ? AND amount < 0
      ORDER BY date DESC, id DESC
    `).all(id, start, end);
    res.json({ success: true, data: { supplier, rows, total: rows.reduce((s, r) => s + (r.amount || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/settlement', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const supplier = db.prepare('SELECT id, name, balance FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT 'invoice' AS type, CAST(id AS TEXT) AS ref_id, date,
             total AS amount, status AS detail, notes
      FROM purchases WHERE supplier_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'
      UNION ALL
      SELECT 'payment' AS type, CAST(id AS TEXT) AS ref_id, date,
             amount, method AS detail, notes
      FROM supplier_payments
      WHERE supplier_id = ? AND date >= ? AND date <= ?
        AND method NOT IN ('opening_balance','adjustment','balance_correction')
      ORDER BY date ASC, type ASC
    `).all(id, start, end, id, start, end);
    res.json({ success: true, data: { supplier, rows } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/suppliers/:id/products', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const rows = db.prepare(`
      SELECT p.id AS product_id, p.name AS product_name, p.unit,
             SUM(pi.quantity) AS total_qty, SUM(pi.total) AS total_amount
      FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
      JOIN products p ON p.id = pi.product_id
      WHERE pu.supplier_id = ? AND pu.date >= ? AND pu.date <= ? AND pu.status != 'cancelled'
      GROUP BY pi.product_id, p.name, p.unit
      ORDER BY total_amount DESC
    `).all(id, start, end);
    res.json({ success: true, data: { supplier, rows, grand_total: rows.reduce((s, r) => s + (r.total_amount || 0), 0) } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------------------
// GET /api/reports/purchases/cancelled?start=&end=
// ---------------------------------------------------------------------------
router.get('/purchases/cancelled', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const rows = db.prepare(`
      SELECT pu.id, pu.date, pu.total, pu.paid_amount, pu.notes,
             s.name AS supplier_name
      FROM purchases pu LEFT JOIN suppliers s ON s.id = pu.supplier_id
      WHERE pu.date >= ? AND pu.date <= ? AND pu.status = 'cancelled'
      ORDER BY pu.date DESC, pu.id DESC
    `).all(start, end);
    res.json({ success: true, data: { rows, total: rows.reduce((s, r) => s + (r.total || 0), 0), count: rows.length } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------------------------------------------------------------------------
// GET /api/reports/inventory/:id/movement?start=&end=
// ---------------------------------------------------------------------------
router.get('/inventory/:id/movement', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ success: false, error: 'start and end required' });
  try {
    const product = db.prepare('SELECT id, name, unit, quantity FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    const rows = db.prepare(`
      SELECT 'sale' AS type, s.date, si.quantity AS qty, si.unit_price, si.total,
             COALESCE(c.name,'عميل عام') AS party, s.id AS ref_id, s.status
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE si.product_id = ? AND s.date >= ? AND s.date <= ? AND s.status != 'cancelled'
      UNION ALL
      SELECT 'purchase' AS type, pu.date, pi.quantity AS qty, pi.unit_price, pi.total,
             COALESCE(sp.name,'مورد غير معروف') AS party, pu.id AS ref_id, pu.status
      FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
      LEFT JOIN suppliers sp ON sp.id = pu.supplier_id
      WHERE pi.product_id = ? AND pu.date >= ? AND pu.date <= ? AND pu.status != 'cancelled'
      ORDER BY date ASC
    `).all(id, start, end, id, start, end);
    const totalSold   = rows.filter(r => r.type === 'sale'     && r.status !== 'return').reduce((s, r) => s + (r.qty || 0), 0);
    const totalReturn = rows.filter(r => r.type === 'sale'     && r.status === 'return').reduce((s, r) => s + (r.qty || 0), 0);
    const totalBought = rows.filter(r => r.type === 'purchase').reduce((s, r) => s + (r.qty || 0), 0);
    res.json({ success: true, data: { product, rows, total_sold: totalSold, total_return: totalReturn, total_bought: totalBought } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
