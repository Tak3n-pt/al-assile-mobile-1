const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

/**
 * GET /api/notifications
 *
 * Returns two alert lists:
 *   debt_alerts     — clients with balance < 0 (they owe money)
 *   delivery_alerts — sales where delivery_due_date < today and not yet delivered
 *
 * Query params:
 *   debt_days     (optional, default 0) — only include debts where the oldest
 *                 unpaid sale is older than N days.  0 = include all debts.
 *   delivery_days (optional, default 0) — reserved for future filtering.
 */
router.get('/', (req, res) => {
  try {
    const debtDaysThreshold     = parseInt(req.query.debt_days,     10) || 0;
    const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ── Debt alerts ────────────────────────────────────────────────────────
    // For each client with negative balance, find the date of their oldest
    // unpaid (pending/partial) sale so we can show how long the debt has been
    // sitting. If no unpaid sale exists (debt predates the system), fall back
    // to the client's created_at date.
    const debtRows = db.prepare(`
      SELECT
        c.id              AS client_id,
        c.name            AS client_name,
        c.phone           AS client_phone,
        c.balance,
        c.last_contact_at,
        c.last_contact_note,
        MIN(s.date)       AS oldest_unpaid_date
      FROM clients c
      LEFT JOIN sales s
        ON s.client_id = c.id
        AND s.status IN ('pending', 'partial')
        AND s.remote_id LIKE 'desktop-%'  -- only desktop-origin unpaid sales
      WHERE c.balance < 0
      GROUP BY c.id
      ORDER BY c.balance ASC
    `).all();

    // Also check mobile-origin unpaid sales (those have remote_id NULL on
    // the server; desktop-origin ones carry remote_id='desktop-{id}').
    // Run a second pass to pick up mobile unpaid sales per client.
    const mobileUnpaidByClient = {};
    const mobileUnpaid = db.prepare(`
      SELECT client_id, MIN(date) AS oldest_date
      FROM sales
      WHERE status IN ('pending','partial')
        AND (remote_id IS NULL OR remote_id NOT LIKE 'desktop-%')
        AND client_id IS NOT NULL
      GROUP BY client_id
    `).all();
    for (const r of mobileUnpaid) {
      mobileUnpaidByClient[r.client_id] = r.oldest_date;
    }

    const today = new Date(todayIso);

    const debtAlerts = [];
    for (const row of debtRows) {
      // Determine the oldest unpaid sale date (desktop or mobile)
      const mobileDate   = mobileUnpaidByClient[row.client_id] || null;
      const desktopDate  = row.oldest_unpaid_date || null;
      let oldestDate = null;
      if (mobileDate && desktopDate) {
        oldestDate = mobileDate < desktopDate ? mobileDate : desktopDate;
      } else {
        oldestDate = mobileDate || desktopDate;
      }

      const daysOverdue = oldestDate
        ? Math.floor((today - new Date(oldestDate)) / 86400000)
        : null;

      const daysSinceContact = row.last_contact_at
        ? Math.floor((today - new Date(row.last_contact_at)) / 86400000)
        : null;

      if (debtDaysThreshold > 0 && daysOverdue !== null && daysOverdue < debtDaysThreshold) {
        continue;
      }

      debtAlerts.push({
        client_id:          row.client_id,
        client_name:        row.client_name,
        client_phone:       row.client_phone || null,
        balance:            row.balance,
        oldest_unpaid_date: oldestDate,
        days_overdue:       daysOverdue,
        last_contact_at:    row.last_contact_at || null,
        last_contact_note:  row.last_contact_note || null,
        days_since_contact: daysSinceContact,
      });
    }

    // ── Delivery alerts ────────────────────────────────────────────────────
    // Sales where delivery_due_date has passed but delivered_at is still NULL.
    const deliveryRows = db.prepare(`
      SELECT
        s.id             AS sale_id,
        s.client_id,
        c.name           AS client_name,
        c.phone          AS client_phone,
        s.date,
        s.delivery_due_date,
        s.delivery_notes,
        s.total,
        s.paid_amount,
        s.status
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.delivery_due_date IS NOT NULL
        AND s.delivery_due_date < ?
        AND s.delivered_at IS NULL
        AND s.status != 'cancelled'
      ORDER BY s.delivery_due_date ASC
    `).all(todayIso);

    const deliveryAlerts = deliveryRows.map(row => ({
      sale_id:            row.sale_id,
      client_id:          row.client_id,
      client_name:        row.client_name || null,
      client_phone:       row.client_phone || null,
      sale_date:          row.date,
      delivery_due_date:  row.delivery_due_date,
      delivery_notes:     row.delivery_notes || null,
      days_overdue:       Math.floor((today - new Date(row.delivery_due_date)) / 86400000),
      total:              row.total,
      paid_amount:        row.paid_amount,
      status:             row.status,
    }));

    return res.json({
      success:         true,
      debt_alerts:     debtAlerts,
      delivery_alerts: deliveryAlerts,
      total:           debtAlerts.length + deliveryAlerts.length,
    });
  } catch (err) {
    console.error('[notifications] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
});

module.exports = router;
