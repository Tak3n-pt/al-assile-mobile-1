/**
 * Integration tests for the sync fixes shipped in commits f29c706, 927e0b6,
 * and cdfdebf. Runs against an in-memory SQLite using the real route modules.
 * No mocks — touches the same SQL the production server runs.
 *
 *   node __tests__/sync-fixes.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
const http = require('node:http');

process.env.JWT_SECRET   = 'test-secret';
process.env.SYNC_KEY     = 'test-sync-key';
process.env.SYNC_API_KEY = 'test-sync-key';
process.env.NODE_ENV     = 'test';

// Inject an in-memory better-sqlite3 connection BEFORE any route module is
// required, so the routers' `require('../database/connection')` returns our
// test instance instead of opening the on-disk dev DB.
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
const connectionPath = path.resolve(__dirname, '../server/database/connection.js');
require.cache[connectionPath] = {
  id: connectionPath,
  filename: connectionPath,
  loaded: true,
  exports: db,
};

// Now the schema initializer (which exports initDatabase(db)) builds tables.
const { initDatabase } = require('../server/database/schema.js');
initDatabase(db);

// Mount the same routers production uses.
const salesRouter      = require('../server/routes/sales.js');
const clientsRouter    = require('../server/routes/clients.js');
const suppliersRouter  = require('../server/routes/suppliers.js');
const productsRouter   = require('../server/routes/products.js');
const syncRouter       = require('../server/routes/sync.js');
const paymentsRouter   = require('../server/routes/payments.js');
const desktopRouter    = require('../server/routes/desktop.js');

function buildApp({ role = 'admin', userId = 1 } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { role, userId }; next(); });
  app.use('/api/clients',   clientsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/products',  productsRouter);
  app.use('/api/payments',  paymentsRouter);
  app.use('/api/desktop',   desktopRouter);
  app.use('/api/sync',      syncRouter);
  app.use('/api/sales',     salesRouter);
  return app;
}

function listen(app) {
  return new Promise(rs => {
    const srv = app.listen(0, () => rs(srv));
  });
}

function call(srv, method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const port = srv.address().port;
    const data = body ? JSON.stringify(body) : null;
    const headers = { ...extraHeaders };
    if (data) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(data);
    }
    const req = http.request({
      port, path, method,
      headers,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null });
        } catch (err) {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Seed a single user, client, walk-in placeholder, product. Reset on each test.
function seed() {
  db.prepare('DELETE FROM sync_log').run();
  db.prepare('DELETE FROM client_payments').run();
  db.prepare('DELETE FROM sale_items').run();
  db.prepare('DELETE FROM sales').run();
  db.prepare('DELETE FROM supplier_payments').run();
  db.prepare('DELETE FROM suppliers').run();
  db.prepare('DELETE FROM clients').run();
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM users').run();

  db.prepare(`INSERT INTO users (id, name, username, password_hash, role) VALUES (1, 'Test Admin', 'admin', 'x', 'admin')`).run();
  db.prepare(`INSERT INTO clients (id, name, phone, balance) VALUES (1, 'Alice', '0555', 0)`).run();
  db.prepare(`INSERT INTO clients (id, name, phone, balance) VALUES (2, 'Bob', '0666', 0)`).run();
  db.prepare(`INSERT INTO suppliers (id, name, phone, balance) VALUES (1, 'Acme', '0777', 0)`).run();
  db.prepare(`INSERT INTO products (id, name, selling_price, unit, quantity) VALUES (1, 'Widget', 100, 'pcs', 50)`).run();
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ============================================================================
// TEST 1 — Mobile POST /:id/payment inserts ledger + leaves sale.paid_amount alone
// ============================================================================
test('POST /:id/payment: inserts client_payments, does NOT mutate sales.paid_amount', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    // Create sale: client=1, total=1000, paid=300 at creation (debt=700)
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 10, unit_price: 100 }],
      paid_amount: 300,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(create.status, 201, 'sale create');
    const saleId = create.body.data.id;

    // Sanity: sale.paid_amount should be 300 in DB
    const before = db.prepare('SELECT paid_amount, status FROM sales WHERE id = ?').get(saleId);
    assert.equal(before.paid_amount, 300, 'before pay: at-creation paid_amount');

    // Record post-creation payment of 200
    const pay = await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 200 });
    assert.equal(pay.status, 200, 'payment ok');

    // After fix: sales.paid_amount should STILL be 300 on disk
    const after = db.prepare('SELECT paid_amount, status FROM sales WHERE id = ?').get(saleId);
    assert.equal(after.paid_amount, 300, 'after pay: sale.paid_amount unchanged on disk');

    // client_payments row should exist with amount=200, sale_id=saleId
    const cp = db.prepare('SELECT * FROM client_payments WHERE sale_id = ?').get(saleId);
    assert.ok(cp, 'ledger row created');
    assert.equal(cp.amount, 200, 'ledger amount');
    assert.equal(cp.client_id, 1, 'ledger client_id');
    assert.equal(cp.sale_id, saleId, 'ledger sale_id');

    // Response paid_amount should be the COMPUTED total (300+200=500)
    assert.equal(pay.body.data.paid_amount, 500, 'response shows running total');
    assert.equal(pay.body.data.paid_at_creation, 300, 'response exposes at-creation');
    assert.equal(pay.body.data.status, 'partial', 'response status');

    // sync_log should have ('payment', payment_id, 'create')
    const log = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'payment'`).get();
    assert.ok(log, 'sync_log entry exists');
    assert.equal(log.entity_id, cp.id, 'log entity_id is payment_id, NOT sale_id');
    assert.equal(log.action, 'create', 'log action');

    // Client balance: -700 (initial) + 200 (payment) = -500
    const cl = db.prepare('SELECT balance FROM clients WHERE id = 1').get();
    assert.equal(cl.balance, -500, 'client balance reflects net debt');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 2 — Walk-in (no client) post-creation payment is rejected with 400
// ============================================================================
test('POST /:id/payment on walk-in sale returns 400, does not corrupt DB', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: null,
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      paid_amount: 100,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(create.status, 201, 'walk-in sale create');
    const saleId = create.body.data.id;

    const pay = await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 50 });
    assert.equal(pay.status, 400, 'walk-in payment rejected');
    assert.match(pay.body.error, /Walk-in/i, 'error mentions walk-in');

    // No client_payments rows for this sale
    const cp = db.prepare('SELECT COUNT(*) AS c FROM client_payments WHERE sale_id = ?').get(saleId);
    assert.equal(cp.c, 0, 'no ledger row inserted');
    // No sync_log entry was leaked from a partial transaction
    const log = db.prepare(`SELECT COUNT(*) AS c FROM sync_log WHERE entity_type = 'payment'`).get();
    assert.equal(log.c, 0, 'no sync_log leak');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 3 — Already-paid sale rejects further payment with 409
// ============================================================================
test('POST /:id/payment on fully-paid sale returns 409', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 5, unit_price: 100 }],
      paid_amount: 500,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(create.status, 201);
    const saleId = create.body.data.id;

    // First post-payment fails: already paid in full
    const pay = await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 100 });
    assert.equal(pay.status, 409, 'overpay rejected');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 4 — GET /api/sales/:id returns paid_total + computed status
// ============================================================================
test('GET /:id returns running paid_total + derived status', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 10, unit_price: 100 }],
      paid_amount: 300,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    const saleId = create.body.data.id;
    await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 200 });
    await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 500 });

    const get = await call(srv, 'GET', `/api/sales/${saleId}`);
    assert.equal(get.status, 200);
    assert.equal(get.body.data.paid_amount, 1000, 'paid_total = 300 + 200 + 500');
    assert.equal(get.body.data.status, 'paid', 'status fully paid');
    assert.equal(get.body.data.paid_at_creation, 300, 'at-creation preserved');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 5 — DELETE /api/sales/:id reverses BOTH at-creation and post-creation balance
// ============================================================================
test('DELETE /:id reverses cumulative balance change correctly', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    // Sale: total=1000, paid=300 at creation → balance -= 700
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 10, unit_price: 100 }],
      paid_amount: 300,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    const saleId = create.body.data.id;

    // Post-creation payment 200 → balance += 200
    await call(srv, 'POST', `/api/sales/${saleId}/payment`, { amount: 200 });

    // Pre-delete balance: -500
    const before = db.prepare('SELECT balance FROM clients WHERE id = 1').get().balance;
    assert.equal(before, -500, 'pre-delete balance');

    const del = await call(srv, 'DELETE', `/api/sales/${saleId}`);
    assert.equal(del.status, 200, 'delete ok');

    // Balance must return to 0
    const after = db.prepare('SELECT balance FROM clients WHERE id = 1').get().balance;
    assert.equal(after, 0, 'balance fully reversed (both at-creation and post-creation)');

    // Stock restored
    const prod = db.prepare('SELECT quantity FROM products WHERE id = 1').get();
    assert.equal(prod.quantity, 50, 'stock restored');

    // Per-payment delete tombstones logged + sale tombstone logged
    const sLog = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'sale' AND action = 'delete'`).all();
    assert.equal(sLog.length, 1, 'sale tombstone logged');
    const pLog = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'payment' AND action = 'delete'`).all();
    assert.equal(pLog.length, 1, 'payment tombstone logged');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6 — POST /api/clients/:id/adjust inserts adjustment row + logs payment
// ============================================================================
test('POST /:id/adjust admin-only credit/debit with sync_log', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    // Credit: write off 200
    const credit = await call(srv, 'POST', '/api/clients/1/adjust', {
      amount: 200,
      reason: 'Goodwill credit',
    });
    assert.equal(credit.status, 201);

    let cl = db.prepare('SELECT balance FROM clients WHERE id = 1').get();
    assert.equal(cl.balance, 200, 'positive adjustment lifts balance');

    // Debit: charge 50
    const debit = await call(srv, 'POST', '/api/clients/1/adjust', {
      amount: -50,
      reason: 'Manual correction',
    });
    assert.equal(debit.status, 201);
    cl = db.prepare('SELECT balance FROM clients WHERE id = 1').get();
    assert.equal(cl.balance, 150, 'negative adjustment lowers balance');

    // Both produced client_payments rows with method='adjustment'
    const rows = db.prepare(`SELECT * FROM client_payments WHERE method = 'adjustment'`).all();
    assert.equal(rows.length, 2, '2 adjustment rows');

    // sync_log has 2 payment.create entries
    const logs = db.prepare(`SELECT COUNT(*) AS c FROM sync_log WHERE entity_type = 'payment' AND action = 'create'`).get();
    assert.equal(logs.c, 2, '2 sync_log entries for adjustments');

    // Reason is required
    const noReason = await call(srv, 'POST', '/api/clients/1/adjust', { amount: 100 });
    assert.equal(noReason.status, 400, 'reason required');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6b — Global client versement allocates through ledger without double-count
// ============================================================================
test('POST /api/payments allocates versement without mutating sale paid_at_creation', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 5, unit_price: 100 }],
      paid_amount: 100,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(create.status, 201, 'sale create');
    const saleId = create.body.data.id;

    const before = db.prepare('SELECT paid_amount, status FROM sales WHERE id = ?').get(saleId);
    assert.equal(before.paid_amount, 100, 'checkout payment stored once');

    const pay = await call(srv, 'POST', '/api/payments', {
      client_id: 1,
      amount: 100,
      method: 'cash',
      notes: '100 DA versement',
    });
    assert.equal(pay.status, 201, 'global versement ok');
    assert.equal(pay.body.data.totalApplied, 100, 'versement applied to debt');
    assert.equal(pay.body.data.creditCarry, 0, 'no credit carry');

    const stored = db.prepare('SELECT paid_amount, status FROM sales WHERE id = ?').get(saleId);
    assert.equal(stored.paid_amount, 100, 'sale paid_at_creation not mutated by versement');

    const get = await call(srv, 'GET', `/api/sales?client_id=1`);
    assert.equal(get.status, 200, 'client sales list ok');
    const sale = get.body.data.find(s => s.id === saleId);
    assert.equal(sale.paid_at_creation, 100, 'response exposes checkout payment');
    assert.equal(sale.paid_amount, 200, 'response paid total counts versement once');
    assert.equal(sale.status, 'partial', 'derived status uses ledger total');

    const day = new Date().toISOString().slice(0, 10);
    const report = await call(srv, 'GET', `/api/sales/report?from=${day}&to=${day}`);
    assert.equal(report.status, 200, 'sales report ok');
    const reportSale = report.body.data.find(s => s.id === saleId);
    assert.equal(reportSale.paid_at_creation, 100, 'report exposes checkout payment');
    assert.equal(reportSale.paid_amount, 200, 'report paid total counts versement once');
    assert.equal(reportSale.status, 'partial', 'report derived status uses ledger total');

    const client = db.prepare('SELECT balance FROM clients WHERE id = 1').get();
    assert.equal(client.balance, -300, 'balance: -400 debt + 100 versement');

    const cp = db.prepare('SELECT * FROM client_payments WHERE sale_id = ?').get(saleId);
    assert.equal(cp.amount, 100, 'one ledger payment row');
    assert.equal(cp.notes, '100 DA versement');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6c — Payment history returns exact-time entries and per-client summary
// ============================================================================
test('GET /api/payments returns entries plus per-client payment summary', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 5, unit_price: 100 }],
      paid_amount: 100,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(create.status, 201, 'sale create');
    const saleId = create.body.data.id;

    await call(srv, 'POST', '/api/payments', {
      client_id: 1,
      amount: 150,
      method: 'bank',
      notes: 'bank transfer',
    });

    const history = await call(srv, 'GET', '/api/payments?client_id=1');
    assert.equal(history.status, 200, 'history ok');
    assert.ok(Array.isArray(history.body.data.entries), 'entries array returned');
    assert.ok(history.body.data.summary, 'summary returned');

    const checkout = history.body.data.entries.find(p => p.id === `sale-${saleId}`);
    assert.ok(checkout, 'synthetic checkout payment row returned');
    assert.equal(checkout.synthetic, 1);
    assert.equal(checkout.entry_type, 'sale_initial_payment');
    assert.equal(checkout.amount, 100);

    const versement = history.body.data.entries.find(p => p.sale_id === saleId && p.synthetic === 0);
    assert.ok(versement, 'versement row returned');
    assert.equal(versement.entry_type, 'sale_versement');
    assert.equal(versement.created_by_name, 'Test Admin');
    assert.ok(versement.created_at, 'exact created_at returned');
    assert.equal(versement.sale_paid_at_creation, 100);
    assert.equal(versement.sale_paid_total, 250);
    assert.equal(versement.sale_remaining, 250);

    const summary = history.body.data.summary;
    assert.equal(summary.total_paid, 250, 'checkout + versement total');
    assert.equal(summary.total_versements, 150, 'explicit versement total');
    assert.equal(summary.total_checkout_paid, 100, 'checkout total');
    assert.equal(summary.total_allocated_to_sales, 250, 'allocated to sale total');
    assert.equal(summary.versement_count, 1, 'one explicit versement');
    assert.ok(summary.last_payment_at, 'last payment timestamp returned');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6d — Legacy double-count repair normalizes old web versements
// ============================================================================
test('POST /api/payments/repair-legacy-double-counts converts old mutated sales back to checkout-only paid_amount', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saleId = db.prepare(`
      INSERT INTO sales (client_id, date, subtotal, discount, total, paid_amount, status, payment_method, created_by)
      VALUES (1, ?, 500, 0, 500, 200, 'partial', 'cash', 1)
    `).run(today).lastInsertRowid;
    db.prepare(`
      INSERT INTO client_payments (client_id, sale_id, amount, date, method, notes, batch_id, created_by)
      VALUES (1, ?, 100, ?, 'cash', 'old versement', 'bulk-old', 1)
    `).run(saleId, today);
    db.prepare('UPDATE clients SET balance = -300 WHERE id = 1').run();

    const before = await call(srv, 'GET', `/api/sales?client_id=1`);
    assert.equal(before.status, 200, 'client sales before repair ok');
    assert.equal(before.body.data[0].paid_amount, 300, 'legacy row is double-counted before repair');

    const repair = await call(srv, 'POST', '/api/payments/repair-legacy-double-counts');
    assert.equal(repair.status, 200, 'repair ok');
    assert.equal(repair.body.data.repaired_sales, 1, 'one polluted sale repaired');
    assert.equal(repair.body.data.repairs[0].old_paid_amount, 200);
    assert.equal(repair.body.data.repairs[0].new_paid_amount, 100);

    const stored = db.prepare('SELECT paid_amount, status FROM sales WHERE id = ?').get(saleId);
    assert.equal(stored.paid_amount, 100, 'sale paid_amount is checkout-only again');
    assert.equal(stored.status, 'partial');

    const after = await call(srv, 'GET', `/api/sales?client_id=1`);
    assert.equal(after.body.data[0].paid_at_creation, 100, 'checkout payment is preserved');
    assert.equal(after.body.data[0].paid_amount, 200, 'paid total counts checkout + versement once');

    const audit = await call(srv, 'GET', '/api/clients/audit');
    assert.equal(audit.status, 200, 'client audit ok');
    assert.equal(audit.body.data.total_drift_count, 0, 'balance math matches after repair');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6e — Desktop checkout payments do not double-count as post-sale ledger
// ============================================================================
test('desktop sale creation stores checkout payment once and does not create a duplicate ledger payment', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/desktop/ipc', {
      channel: 'sales:createComplete',
      args: [{
        client_id: 1,
        date: new Date().toISOString().slice(0, 10),
        total: 500,
        paid_amount: 100,
        payment_method: 'cash',
        items: [{ product_id: 1, quantity: 5, unit_price: 100 }],
      }],
    });
    assert.equal(create.status, 200, 'desktop create ok');
    assert.equal(create.body.success, true, 'desktop create success');
    const saleId = create.body.data.lastInsertRowid;

    const duplicateCount = db.prepare('SELECT COUNT(*) AS c FROM client_payments WHERE sale_id = ?').get(saleId).c;
    assert.equal(duplicateCount, 0, 'checkout amount is not written as a ledger duplicate');

    const detail = await call(srv, 'POST', '/api/desktop/ipc', {
      channel: 'sales:getById',
      args: [saleId],
    });
    assert.equal(detail.body.data.paid_at_creation, 100);
    assert.equal(detail.body.data.paid_amount, 100, 'desktop paid total counts checkout once');
    assert.equal(detail.body.data.status, 'partial');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 6f — API exposes timezone-explicit timestamps for payment display
// ============================================================================
test('GET /api/payments exposes ISO timestamps with timezone for exact payment time display', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const saleId = db.prepare(`
      INSERT INTO sales (client_id, date, subtotal, discount, total, paid_amount, status, payment_method, created_by, created_at)
      VALUES (1, '2026-06-14', 500, 0, 500, 100, 'partial', 'cash', 1, '2026-06-14 12:30:05')
    `).run().lastInsertRowid;
    db.prepare(`
      INSERT INTO client_payments (client_id, sale_id, amount, date, method, notes, batch_id, created_by, created_at)
      VALUES (1, ?, 100, '2026-06-14', 'cash', 'timed versement', 'bulk-time', 1, '2026-06-14 13:45:59')
    `).run(saleId);

    const history = await call(srv, 'GET', '/api/payments?client_id=1');
    assert.equal(history.status, 200, 'history ok');
    const versement = history.body.data.entries.find(p => p.notes === 'timed versement');
    const checkout = history.body.data.entries.find(p => p.id === `sale-${saleId}`);
    assert.equal(versement.created_at_iso, '2026-06-14T13:45:59.000Z');
    assert.equal(checkout.created_at_iso, '2026-06-14T12:30:05.000Z');
    assert.equal(history.body.data.summary.last_payment_at_iso, '2026-06-14T13:45:59.000Z');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 7 — DELETE /api/clients/:id blocks when sales exist + cascades when not
// ============================================================================
test('DELETE /:id blocks if sales exist; otherwise succeeds + logs delete', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    // Bob (id=2) has no sales — delete should succeed
    const ok = await call(srv, 'DELETE', '/api/clients/2');
    assert.equal(ok.status, 200, 'delete ok');
    const exists = db.prepare('SELECT id FROM clients WHERE id = 2').get();
    assert.equal(exists, undefined, 'client gone');
    const log = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'client' AND action = 'delete'`).get();
    assert.ok(log, 'delete logged for sync');
    assert.equal(log.entity_id, 2);

    // Alice has a sale → should be blocked
    await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      paid_amount: 100,
      payment_method: 'cash',
      date: new Date().toISOString().slice(0, 10),
    });
    const blocked = await call(srv, 'DELETE', '/api/clients/1');
    assert.equal(blocked.status, 409, 'blocked because sales exist');
    const stillThere = db.prepare('SELECT id FROM clients WHERE id = 1').get();
    assert.ok(stillThere, 'client preserved');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 8 — DELETE /api/clients non-admin returns 403
// ============================================================================
test('DELETE /:id requires admin', async () => {
  seed();
  const app = buildApp({ role: 'sales' });
  const srv = await listen(app);
  try {
    const r = await call(srv, 'DELETE', '/api/clients/2');
    assert.equal(r.status, 403, 'non-admin blocked');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 9 — POST /:id/adjust requires admin
// ============================================================================
test('POST /:id/adjust requires admin', async () => {
  seed();
  const app = buildApp({ role: 'sales' });
  const srv = await listen(app);
  try {
    const r = await call(srv, 'POST', '/api/clients/1/adjust', { amount: 100, reason: 'x' });
    assert.equal(r.status, 403, 'sales role blocked');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 10 — PATCH /api/clients/:id edits profile + logs update
// ============================================================================
test('PATCH /:id updates profile fields + logs sync update', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const r = await call(srv, 'PATCH', '/api/clients/1', {
      name: 'Alice Smith', phone: '0123456', email: 'a@x.com',
    });
    assert.equal(r.status, 200, 'edit ok');
    const row = db.prepare('SELECT * FROM clients WHERE id = 1').get();
    assert.equal(row.name, 'Alice Smith');
    assert.equal(row.phone, '0123456');
    assert.equal(row.email, 'a@x.com');
    const log = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'client' AND action = 'update'`).get();
    assert.ok(log, 'update logged');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 11 — PATCH /api/suppliers/payments/:id mutates with delta-balance
// ============================================================================
test('PATCH supplier payment adjusts amount with proper balance delta', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/suppliers/1/payments', { amount: 1000 });
    assert.equal(create.status, 201);
    const paymentId = create.body.data.payment_id;

    let s = db.prepare('SELECT balance FROM suppliers WHERE id = 1').get();
    assert.equal(s.balance, 1000, 'balance after 1000 payment');

    // Edit down: 1000 → 700, delta = -300
    const edit = await call(srv, 'PATCH', `/api/suppliers/payments/${paymentId}`, { amount: 700 });
    assert.equal(edit.status, 200, 'edit ok');
    s = db.prepare('SELECT balance FROM suppliers WHERE id = 1').get();
    assert.equal(s.balance, 700, 'balance moves by delta');

    const log = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'supplier_payment' AND action = 'update'`).get();
    assert.ok(log, 'update logged');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 12 — Express route ordering: PATCH /payments/:paymentId is reachable
// (not shadowed by PATCH /:id)
// ============================================================================
test('Route ordering: PATCH /payments/:id reaches the right handler', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    // Hit a non-existent payment path. If routing is broken, PATCH /:id
    // would intercept and return 400 ("Invalid supplier id" because
    // parseInt('payments') is NaN). With correct routing (segment-count
    // match), it reaches PATCH /payments/:paymentId and returns 404.
    const r = await call(srv, 'PATCH', '/api/suppliers/payments/99999', { amount: 100 });
    assert.equal(r.status, 404, 'reached payments handler (not /:id)');
    assert.match(r.body.error, /Payment not found/i);
  } finally { srv.close(); }
});

// ============================================================================
// TEST 13 — Website-created products are emitted to desktop sync with all tarifs
// ============================================================================
test('POST /api/products logs create and /api/sync/pull returns full tarif payload', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/products', {
      name: 'Mobile Product',
      description: 'Created on website',
      selling_price: 100,
      selling_price2: 200,
      selling_price3: 300,
      purchase_price: 70,
      unit: 'kg',
      barcode: 'MOB-1',
      category: 'Dates',
      quantity: 12,
      min_stock_alert: 2,
    });
    assert.equal(create.status, 200, 'product create ok');
    const productId = create.body.data.id;

    const log = db.prepare(`SELECT * FROM sync_log WHERE entity_type = 'product' AND entity_id = ?`).get(productId);
    assert.ok(log, 'product create logged');
    assert.equal(log.action, 'create');
    assert.equal(log.synced, 0);

    const pull = await call(
      srv,
      'GET',
      '/api/sync/pull',
      null,
      { 'x-sync-key': 'test-sync-key' }
    );
    assert.equal(pull.status, 200, 'sync pull ok');
    const product = pull.body.products.find(p => p.id === productId);
    assert.ok(product, 'created product is in sync pull');
    assert.equal(product.__action, 'create');
    assert.equal(product.selling_price, 100);
    assert.equal(product.selling_price2, 200);
    assert.equal(product.selling_price3, 300);
    assert.equal(product.purchase_price, 70);
    assert.equal(product.category, 'Dates');
    assert.equal(product.quantity, 12);

    const after = db.prepare(`SELECT synced FROM sync_log WHERE id = ?`).get(log.id);
    assert.equal(after.synced, 1, 'product log consumed by pull');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 13b — Desktop product edits preserve website-only package metadata
// ============================================================================
test('desktop product update preserves website package and display fields when omitted', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const create = await call(srv, 'POST', '/api/products', {
      name: 'Packaged Product',
      description: 'Created on website',
      selling_price: 100,
      selling_price2: 150,
      selling_price3: 180,
      purchase_price: 70,
      unit: 'قارورة',
      barcode: 'PKG-1',
      category: 'Dates',
      quantity: 24,
      min_stock_alert: 4,
      expiry_date: '2026-12-31',
      tax_rate: 9,
      unit_package: 12,
      higher_package: 'علبة',
      box_color: 'green',
    });
    assert.equal(create.status, 200, 'product create ok');
    const productId = create.body.data.id;

    const desktopEdit = await call(srv, 'POST', '/api/desktop/ipc', {
      channel: 'products:update',
      args: [productId, {
        name: 'Packaged Product Edited',
        description: 'Edited from desktop',
        selling_price: 110,
        selling_price2: 160,
        selling_price3: 190,
        manual_cost: null,
        unit: 'قارورة',
        barcode: 'PKG-1',
        is_favorite: 0,
        is_resale: 1,
        purchase_price: 75,
        quantity: 24,
      }],
    });
    assert.equal(desktopEdit.status, 200, 'desktop edit ok');
    assert.equal(desktopEdit.body.success, true, 'desktop edit success');

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    assert.equal(row.name, 'Packaged Product Edited');
    assert.equal(row.category, 'Dates');
    assert.equal(row.expiry_date, '2026-12-31');
    assert.equal(row.tax_rate, 9);
    assert.equal(row.unit_package, 12);
    assert.equal(row.higher_package, 'علبة');
    assert.equal(row.box_color, 'green');
  } finally { srv.close(); }
});

// ============================================================================
// TEST 14 — Product create + sale in same pull does not double-deduct stock
// ============================================================================
test('sync pull sends pre-sale product quantity when sale is in same response', async () => {
  seed();
  const app = buildApp();
  const srv = await listen(app);
  try {
    const createProduct = await call(srv, 'POST', '/api/products', {
      name: 'Same Pull Product',
      selling_price: 50,
      quantity: 10,
      unit: 'pcs',
    });
    assert.equal(createProduct.status, 200, 'product create ok');
    const productId = createProduct.body.data.id;

    const createSale = await call(srv, 'POST', '/api/sales', {
      client_id: 1,
      date: new Date().toISOString().slice(0, 10),
      paid_amount: 0,
      payment_method: 'cash',
      notes: 'same pull stock test',
      items: [{ product_id: productId, quantity: 2, unit_price: 50 }],
    });
    assert.equal(createSale.status, 201, 'sale create ok');

    const storedAfterSale = db.prepare('SELECT quantity FROM products WHERE id = ?').get(productId);
    assert.equal(storedAfterSale.quantity, 8, 'server stock already deducted by sale');

    const pull = await call(
      srv,
      'GET',
      '/api/sync/pull',
      null,
      { 'x-sync-key': 'test-sync-key' }
    );
    assert.equal(pull.status, 200, 'sync pull ok');
    const product = pull.body.products.find(p => p.id === productId);
    assert.ok(product, 'product is included in pull');
    assert.equal(product.quantity, 10, 'product quantity is pre-sale so desktop sale import deducts once');
    const sale = pull.body.sales.find(s => s.id === createSale.body.data.id);
    assert.ok(sale, 'sale is included in pull');
    assert.equal(sale.items[0].quantity, 2, 'sale item carries the stock movement');
  } finally { srv.close(); }
});

// ============================================================================
// Run all tests
// ============================================================================
(async () => {
  let pass = 0, fail = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`[32m  ✓[0m ${name}`);
      pass++;
    } catch (err) {
      console.log(`[31m  ✗[0m ${name}`);
      console.log(`    ${err.message}`);
      if (err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
      fail++;
    }
  }
  console.log(`\n${pass}/${tests.length} passed${fail ? `, ${fail} failed` : ''}`);
  process.exit(fail ? 1 : 0);
})();
