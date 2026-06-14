const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const {
  currentPaidExpr,
  saleStatusExpr,
  effectiveClientPaymentWhere,
} = require('../utils/paymentLedger');

const router = express.Router();

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const asId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const flag = (v) => (v === true || v === 1 || v === '1' ? 1 : 0);

function monthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  return { start, end: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}

function runData(info) {
  return {
    lastInsertRowid: info && info.lastInsertRowid != null ? Number(info.lastInsertRowid) : undefined,
    changes: info ? info.changes : undefined,
  };
}

function ok(data, extra = {}) {
  return { success: true, data, ...extra };
}

function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

function addColumn(table, column, definition) {
  if (!cols(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedSetting(key, value) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function ensureDesktopSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      quantity REAL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      cost_per_unit REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 0,
      supplier_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES stock_categories(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment')),
      quantity REAL NOT NULL,
      unit_cost REAL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_id) REFERENCES stock(id)
    );
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      stock_item_id INTEGER NOT NULL,
      quantity_needed REAL NOT NULL,
      unit TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_item_id) REFERENCES stock(id)
    );
    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity_produced REAL NOT NULL,
      ingredient_cost REAL DEFAULT 0,
      expense_allocation REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS client_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      number TEXT NOT NULL,
      sale_id INTEGER,
      client_id INTEGER,
      date DATE NOT NULL,
      data TEXT,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      address TEXT,
      salary REAL DEFAULT 0,
      hire_date DATE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      payment_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    );
  `);

  for (const c of [
    ['products', 'manual_cost', 'REAL'],
    ['products', 'image_path', 'TEXT'],
    ['products', 'image_data', 'TEXT'],
    ['products', 'selling_price2', 'REAL DEFAULT 0'],
    ['products', 'selling_price3', 'REAL DEFAULT 0'],
    ['products', 'is_resale', 'INTEGER DEFAULT 0'],
    ['products', 'purchase_price', 'REAL DEFAULT 0'],
    ['products', 'min_stock_alert', 'REAL DEFAULT 0'],
    ['products', 'category', 'TEXT'],
    ['products', 'expiry_date', 'DATE'],
    ['products', 'tax_rate', 'REAL DEFAULT 0'],
    ['products', 'unit_package', 'REAL DEFAULT 0'],
    ['products', 'higher_package', 'TEXT'],
    ['products', 'box_color', 'TEXT'],
    ['clients', 'category_id', 'INTEGER'],
    ['clients', 'credit_blocked', 'INTEGER DEFAULT 0'],
    ['clients', 'last_contact_note', 'TEXT'],
    ['clients', 'last_contact_at', 'DATETIME'],
    ['users', 'last_login', 'DATETIME'],
    ['expenses', 'category_id', 'INTEGER'],
    ['expenses', 'category', 'TEXT'],
    ['expenses', 'is_recurring', 'INTEGER DEFAULT 0'],
    ['expenses', 'recurring_period', 'TEXT'],
    ['expenses', 'payment_method', "TEXT DEFAULT 'cash'"],
    ['purchases', 'payment_method', "TEXT DEFAULT 'cash'"],
    ['purchase_items', 'stock_item_id', 'INTEGER'],
  ]) {
    addColumn(c[0], c[1], c[2]);
  }

  const stockDefaults = [
    ['Dates', 'All types of dates'],
    ['Sugar & Sweeteners', 'Sugar, honey, syrup'],
    ['Chocolate', 'Chocolate, cocoa'],
    ['Nuts & Fillings', 'Almonds, pistachios, walnuts'],
    ['Packaging', 'Bottles, boxes, labels'],
    ['Other Ingredients', 'Misc ingredients'],
  ];
  const stockStmt = db.prepare('INSERT OR IGNORE INTO stock_categories (name, description) VALUES (?, ?)');
  for (const row of stockDefaults) stockStmt.run(row[0], row[1]);

  const expenseDefaults = [
    ['Water', 'Water bills'],
    ['Electricity', 'Electric bills'],
    ['Gas', 'Gas bills'],
    ['Transport', 'Delivery and transport costs'],
    ['Rent', 'Rent and lease payments'],
    ['Salaries', 'Employee salary payments'],
    ['Maintenance', 'Equipment and facility maintenance'],
    ['Other', 'Miscellaneous expenses'],
  ];
  const expStmt = db.prepare('INSERT OR IGNORE INTO expense_categories (name, description) VALUES (?, ?)');
  for (const row of expenseDefaults) expStmt.run(row[0], row[1]);

  [
    ['currency', 'DZD'],
    ['currency_symbol', 'د.ج'],
    ['business_name', 'شركة التمور الجزائرية'],
    ['business_name_fr', 'Société des Dattes Algériennes'],
    ['invoice_prefix', 'FAC'],
    ['delivery_prefix', 'BL'],
    ['proforma_prefix', 'PRO'],
    ['purchase_order_prefix', 'BC'],
    ['exit_voucher_prefix', 'BS'],
    ['credit_note_prefix', 'AV'],
    ['quote_prefix', 'DEV'],
    ['reception_voucher_prefix', 'BR'],
    ['next_invoice_number', '1'],
    ['next_delivery_number', '1'],
    ['next_proforma_number', '1'],
    ['next_purchase_order_number', '1'],
    ['next_exit_voucher_number', '1'],
    ['next_credit_note_number', '1'],
    ['next_quote_number', '1'],
    ['next_reception_voucher_number', '1'],
  ].forEach(([key, value]) => seedSetting(key, value));
}

ensureDesktopSchema();

const productSelect = `
  SELECT
    p.*,
    CASE
      WHEN p.image_path IS NOT NULL AND p.image_path != '' THEN p.image_path
      WHEN p.image_data IS NOT NULL AND p.image_data != '' THEN 'remote-' || p.id
      ELSE NULL
    END AS image_path,
    (SELECT COUNT(*) FROM product_recipes WHERE product_id = p.id) AS ingredient_count,
    (SELECT COUNT(*) FROM production_batches WHERE product_id = p.id) AS batch_count,
    (SELECT COALESCE(SUM(quantity_produced), 0) FROM production_batches WHERE product_id = p.id) AS total_produced,
    (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE product_id = p.id) AS total_sold,
    CASE WHEN p.quantity <= p.min_stock_alert AND p.min_stock_alert > 0 THEN 1 ELSE 0 END AS is_low_stock
  FROM products p
`;

function getProduct(id) {
  return db.prepare(`${productSelect} WHERE p.id = ?`).get(id);
}

function getOrCreateClientCategory(name) {
  const normalized = String(name || '').trim();
  if (!normalized) return null;
  const existing = db.prepare('SELECT id FROM client_categories WHERE LOWER(name) = LOWER(?)').get(normalized);
  if (existing) return existing.id;
  return Number(db.prepare('INSERT INTO client_categories (name) VALUES (?)').run(normalized).lastInsertRowid);
}

function resolveClientCategory(data = {}) {
  if (data.new_category_name) return getOrCreateClientCategory(data.new_category_name);
  if (data.category_id === '' || data.category_id == null) return null;
  return asId(data.category_id);
}

function salesBaseSelect() {
  const paid = currentPaidExpr('s');
  return `
    SELECT s.*, c.name AS client_name, c.phone AS client_phone,
           ${paid} AS paid_amount,
           s.paid_amount AS paid_at_creation,
           ${saleStatusExpr('s')} AS status,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
  `;
}

function createSale(data, userId) {
  return db.transaction(() => {
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new Error('At least one item is required');
    const subtotal = money(data.subtotal != null
      ? data.subtotal
      : items.reduce((sum, item) => sum + money(item.quantity) * money(item.unit_price), 0));
    const discount = money(data.discount);
    const total = money(data.total != null ? data.total : subtotal - discount);
    const paid = money(data.paid_amount);
    const status = total <= 0 ? 'paid' : paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';

    const saleInfo = db.prepare(`
      INSERT INTO sales (client_id, date, subtotal, discount, total, paid_amount, status, payment_method, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asId(data.client_id),
      data.date || today(),
      subtotal,
      discount,
      total,
      paid,
      status,
      data.payment_method || 'cash',
      data.notes || null,
      userId || data.created_by || null
    );
    const saleId = Number(saleInfo.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateQty = db.prepare('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    for (const item of items) {
      const productId = asId(item.product_id);
      const quantity = money(item.quantity);
      const unitPrice = money(item.unit_price);
      const product = db.prepare('SELECT id, name, quantity FROM products WHERE id = ? AND is_active = 1').get(productId);
      if (!product) throw new Error(`Product ${productId} not found`);
      if ((Number(product.quantity) || 0) < quantity) {
        throw new Error(`Insufficient stock for "${product.name}": ${product.quantity} available`);
      }
      insertItem.run(saleId, productId, quantity, unitPrice, money(item.total != null ? item.total : quantity * unitPrice));
      updateQty.run(quantity, productId);
    }

    const clientId = asId(data.client_id);
    if (clientId) {
      if (total > paid) {
        db.prepare('UPDATE clients SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(total - paid), clientId);
      } else if (paid > total) {
        const credit = money(paid - total);
        db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(credit, clientId);
        db.prepare(`
          INSERT INTO client_payments (client_id, sale_id, amount, date, method, notes, created_by)
          VALUES (?, NULL, ?, ?, 'credit_carry', ?, ?)
        `).run(clientId, credit, data.date || today(), data.notes || null, userId || null);
      }
    }

    return runData(saleInfo);
  })();
}

function addClientPayment(clientId, amount, opts, userId) {
  const amt = money(amount);
  if (!clientId || amt <= 0) throw new Error('Payment amount must be positive');
  return db.transaction(() => {
    const date = opts?.date || today();
    const method = opts?.method || 'cash';
    const notes = opts?.notes || null;
    const batchId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let remaining = amt;
    const allocations = [];
    const unpaid = db.prepare(`
      SELECT s.id, s.total, ${currentPaidExpr('s')} AS paid_amount
      FROM sales s
      WHERE s.client_id = ? AND s.status NOT IN ('paid', 'cancelled', 'return')
      ORDER BY s.date ASC, s.id ASC
    `).all(clientId);
    const insertPayment = db.prepare(`
      INSERT INTO client_payments (client_id, sale_id, amount, date, method, notes, batch_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const sale of unpaid) {
      if (remaining <= 0) break;
      const outstanding = money(sale.total - sale.paid_amount);
      if (outstanding <= 0) continue;
      const allocate = money(Math.min(remaining, outstanding));
      const info = insertPayment.run(clientId, sale.id, allocate, date, method, notes, batchId, userId || opts?.created_by || null);
      db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(allocate, clientId);
      allocations.push({ payment_id: Number(info.lastInsertRowid), sale_id: sale.id, amount: allocate });
      remaining = money(remaining - allocate);
    }
    let creditCarry = 0;
    if (remaining > 0) {
      const info = insertPayment.run(clientId, null, remaining, date, 'credit_carry', notes, batchId, userId || opts?.created_by || null);
      db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(remaining, clientId);
      allocations.push({ payment_id: Number(info.lastInsertRowid), sale_id: null, amount: remaining });
      creditCarry = remaining;
    }
    return { success: true, batchId, totalApplied: money(amt - creditCarry), creditCarry, allocations };
  })();
}

function addSupplierPayment(data, userId) {
  const amount = money(data.amount);
  if (amount <= 0) throw new Error('Amount must be positive');
  return db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO supplier_payments (supplier_id, purchase_id, amount, date, method, notes, batch_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asId(data.supplier_id),
      asId(data.purchase_id),
      amount,
      data.date || today(),
      data.method || 'cash',
      data.notes || null,
      data.batch_id || null,
      userId || data.created_by || null
    );
    db.prepare('UPDATE suppliers SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(amount, asId(data.supplier_id));
    if (asId(data.purchase_id)) {
      const p = db.prepare('SELECT total, paid_amount FROM purchases WHERE id = ?').get(asId(data.purchase_id));
      if (p) {
        const paid = money((p.paid_amount || 0) + amount);
        const status = paid >= p.total ? 'paid' : paid > 0 ? 'partial' : 'pending';
        db.prepare('UPDATE purchases SET paid_amount = ?, status = ? WHERE id = ?').run(paid, status, asId(data.purchase_id));
      }
    }
    return { id: Number(info.lastInsertRowid), lastInsertRowid: Number(info.lastInsertRowid) };
  })();
}

function dispatch(channel, args, user) {
  const userId = user?.userId || null;

  switch (channel) {
    // Stock
    case 'stock:getCategories':
      return ok(db.prepare('SELECT * FROM stock_categories ORDER BY name').all());
    case 'stock:addCategory':
      return ok(runData(db.prepare('INSERT INTO stock_categories (name, description) VALUES (?, ?)').run(args[0], args[1] || null)));
    case 'stock:getAll':
      return ok(db.prepare(`
        SELECT s.*, sc.name AS category_name, sup.name AS supplier_name,
               CASE WHEN s.quantity <= s.min_stock_alert AND s.min_stock_alert > 0 THEN 1 ELSE 0 END AS is_low_stock
        FROM stock s
        LEFT JOIN stock_categories sc ON s.category_id = sc.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        ORDER BY s.name
      `).all());
    case 'stock:getById':
      return ok(db.prepare(`
        SELECT s.*, sc.name AS category_name, sup.name AS supplier_name
        FROM stock s
        LEFT JOIN stock_categories sc ON s.category_id = sc.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE s.id = ?
      `).get(args[0]) || null);
    case 'stock:getLowStock':
      return ok(db.prepare(`
        SELECT s.*, sc.name AS category_name, sup.name AS supplier_name
        FROM stock s
        LEFT JOIN stock_categories sc ON s.category_id = sc.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE s.quantity <= s.min_stock_alert AND s.min_stock_alert > 0
        ORDER BY s.quantity ASC
      `).all());
    case 'stock:search':
      return ok(db.prepare(`
        SELECT s.*, sc.name AS category_name, sup.name AS supplier_name,
               CASE WHEN s.quantity <= s.min_stock_alert AND s.min_stock_alert > 0 THEN 1 ELSE 0 END AS is_low_stock
        FROM stock s
        LEFT JOIN stock_categories sc ON s.category_id = sc.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE s.name LIKE ? OR sc.name LIKE ?
        ORDER BY s.name
      `).all(`%${args[0] || ''}%`, `%${args[0] || ''}%`));
    case 'stock:getByCategory':
      return ok(db.prepare(`
        SELECT s.*, sc.name AS category_name, sup.name AS supplier_name,
               CASE WHEN s.quantity <= s.min_stock_alert AND s.min_stock_alert > 0 THEN 1 ELSE 0 END AS is_low_stock
        FROM stock s
        LEFT JOIN stock_categories sc ON s.category_id = sc.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE s.category_id = ?
        ORDER BY s.name
      `).all(args[0]));
    case 'stock:add': {
      const data = args[0] || {};
      return ok(db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO stock (name, category_id, quantity, unit, cost_per_unit, min_stock_alert, supplier_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data.name, asId(data.category_id), money(data.quantity), data.unit || 'kg', money(data.cost_per_unit), money(data.min_stock_alert), asId(data.supplier_id), data.notes || null);
        if (money(data.quantity) > 0) {
          db.prepare('INSERT INTO stock_transactions (stock_id, type, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)')
            .run(Number(info.lastInsertRowid), 'in', money(data.quantity), money(data.cost_per_unit), 'Initial stock');
        }
        return runData(info);
      })());
    }
    case 'stock:update': {
      const data = args[1] || {};
      return ok(runData(db.prepare(`
        UPDATE stock SET name = ?, category_id = ?, unit = ?, cost_per_unit = ?, min_stock_alert = ?,
          supplier_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(data.name, asId(data.category_id), data.unit || 'kg', money(data.cost_per_unit), money(data.min_stock_alert), asId(data.supplier_id), data.notes || null, args[0])));
    }
    case 'stock:delete':
      return ok(runData(db.prepare('DELETE FROM stock WHERE id = ?').run(args[0])));
    case 'stock:addQuantity':
      return ok(db.transaction(() => {
        db.prepare('UPDATE stock SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(args[1]), args[0]);
        return runData(db.prepare('INSERT INTO stock_transactions (stock_id, type, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)')
          .run(args[0], 'in', money(args[1]), money(args[2]), args[3] || null));
      })());
    case 'stock:removeQuantity':
      return ok(db.transaction(() => {
        const row = db.prepare('SELECT quantity FROM stock WHERE id = ?').get(args[0]);
        if (!row) throw new Error('Stock item not found');
        if (money(args[1]) > money(row.quantity)) throw new Error(`Insufficient stock: requested ${args[1]}, available ${row.quantity}`);
        db.prepare('UPDATE stock SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(args[1]), args[0]);
        return runData(db.prepare('INSERT INTO stock_transactions (stock_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
          .run(args[0], 'out', money(args[1]), args[3] || null, args[4] || null, args[2] || null));
      })());
    case 'stock:adjustQuantity':
      return ok(db.transaction(() => {
        const row = db.prepare('SELECT quantity FROM stock WHERE id = ?').get(args[0]);
        if (!row) throw new Error('Stock item not found');
        const next = money(args[1]);
        const diff = money(next - money(row.quantity));
        db.prepare('UPDATE stock SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, args[0]);
        return runData(db.prepare('INSERT INTO stock_transactions (stock_id, type, quantity, notes) VALUES (?, ?, ?, ?)')
          .run(args[0], 'adjustment', diff, args[2] || 'Manual adjustment'));
      })());
    case 'stock:getTransactions':
      return ok(db.prepare('SELECT * FROM stock_transactions WHERE stock_id = ? ORDER BY created_at DESC LIMIT 100').all(args[0]));
    case 'stock:getAllTransactions':
      return ok(db.prepare(`
        SELECT st.*, s.name AS stock_name, s.unit
        FROM stock_transactions st LEFT JOIN stock s ON st.stock_id = s.id
        ORDER BY st.created_at DESC LIMIT ?
      `).all(Number(args[0]) || 50));
    case 'stock:getStats':
      return ok(db.prepare(`
        SELECT COUNT(*) AS total_items,
               SUM(CASE WHEN quantity <= min_stock_alert AND min_stock_alert > 0 THEN 1 ELSE 0 END) AS low_stock_count,
               COALESCE(SUM(quantity * cost_per_unit), 0) AS total_value
        FROM stock
      `).get());

    // Products and production
    case 'products:getAll':
      return ok(db.prepare(`${productSelect} WHERE p.is_active = 1 ORDER BY p.name`).all());
    case 'products:getById':
      return ok(getProduct(args[0]) || null);
    case 'products:search':
      return ok(db.prepare(`${productSelect}
        WHERE p.is_active = 1 AND (p.name LIKE ? OR p.description LIKE ? OR p.barcode LIKE ?)
        ORDER BY p.name
      `).all(`%${args[0] || ''}%`, `%${args[0] || ''}%`, `%${args[0] || ''}%`));
    case 'products:getByBarcode': {
      const barcode = String(args[0] || '');
      return ok(db.prepare(`${productSelect}
        WHERE p.is_active = 1 AND p.barcode = ?
        ORDER BY p.id LIMIT 1
      `).get(barcode) || null);
    }
    case 'products:getFavorites':
      return ok(db.prepare(`${productSelect} WHERE p.is_active = 1 AND p.is_favorite = 1 ORDER BY p.name`).all());
    case 'products:add': {
      const data = args[0] || {};
      const info = db.prepare(`
        INSERT INTO products (
          name, description, selling_price, selling_price2, selling_price3, manual_cost, unit, barcode,
          is_favorite, image_path, image_data, is_resale, purchase_price, quantity, min_stock_alert,
          category, expiry_date, tax_rate, unit_package, higher_package, box_color, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(
        data.name,
        data.description || null,
        money(data.selling_price),
        data.selling_price2 !== '' && data.selling_price2 != null ? money(data.selling_price2) : 0,
        data.selling_price3 !== '' && data.selling_price3 != null ? money(data.selling_price3) : 0,
        data.manual_cost !== '' && data.manual_cost != null ? money(data.manual_cost) : null,
        data.unit || 'pcs',
        data.barcode || null,
        flag(data.is_favorite),
        data.image_path || null,
        data.image_data || null,
        flag(data.is_resale),
        money(data.purchase_price),
        money(data.quantity),
        money(data.min_stock_alert),
        data.category || null,
        data.expiry_date || null,
        money(data.tax_rate),
        money(data.unit_package),
        data.higher_package || null,
        data.box_color || null
      );
      return ok(runData(info));
    }
    case 'products:update': {
      const data = args[1] || {};
      const existing = db.prepare('SELECT image_data, image_path, quantity FROM products WHERE id = ?').get(args[0]);
      const imagePath = data.image_path !== undefined ? (data.image_path || null) : existing?.image_path || null;
      const imageData = data.image_data !== undefined
        ? (data.image_data || null)
        : (data.image_path === '' ? null : existing?.image_data || null);
      const quantity = data.quantity !== undefined ? money(data.quantity) : money(existing?.quantity);
      return ok(runData(db.prepare(`
        UPDATE products SET
          name = ?, description = ?, selling_price = ?, selling_price2 = ?, selling_price3 = ?,
          manual_cost = ?, unit = ?, barcode = ?, is_favorite = ?, image_path = ?, image_data = ?,
          is_resale = ?, purchase_price = ?, quantity = ?, min_stock_alert = ?, category = ?, expiry_date = ?,
          tax_rate = ?, unit_package = ?, higher_package = ?, box_color = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.name,
        data.description || null,
        money(data.selling_price),
        data.selling_price2 !== '' && data.selling_price2 != null ? money(data.selling_price2) : 0,
        data.selling_price3 !== '' && data.selling_price3 != null ? money(data.selling_price3) : 0,
        data.manual_cost !== '' && data.manual_cost != null ? money(data.manual_cost) : null,
        data.unit || 'pcs',
        data.barcode || null,
        flag(data.is_favorite),
        imagePath,
        imageData,
        flag(data.is_resale),
        money(data.purchase_price),
        quantity,
        money(data.min_stock_alert),
        data.category || null,
        data.expiry_date || null,
        money(data.tax_rate),
        money(data.unit_package),
        data.higher_package || null,
        data.box_color || null,
        args[0]
      )));
    }
    case 'products:delete':
      return ok(runData(db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(args[0])));
    case 'products:getStats': {
      const now = new Date();
      const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);
      return ok({
        ...db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM products WHERE is_active = 1) AS total_products,
            (SELECT COUNT(*) FROM production_batches) AS total_batches,
            (SELECT COALESCE(SUM(quantity_produced), 0) FROM production_batches) AS total_produced,
            (SELECT COALESCE(SUM(total_cost), 0) FROM production_batches) AS total_cost
        `).get(),
        ...db.prepare(`
          SELECT COUNT(*) AS month_batches,
                 COALESCE(SUM(quantity_produced), 0) AS month_produced,
                 COALESCE(SUM(total_cost), 0) AS month_cost
          FROM production_batches WHERE date BETWEEN ? AND ?
        `).get(start, end),
      });
    }
    case 'products:getRecipe':
      return ok(db.prepare(`
        SELECT pr.*, pr.unit AS unit, s.name AS stock_name, s.unit AS stock_unit,
               s.quantity AS stock_quantity, s.cost_per_unit AS stock_cost
        FROM product_recipes pr
        LEFT JOIN stock s ON pr.stock_item_id = s.id
        WHERE pr.product_id = ?
      `).all(args[0]));
    case 'products:setRecipe':
      return ok(db.transaction(() => {
        db.prepare('DELETE FROM product_recipes WHERE product_id = ?').run(args[0]);
        const stmt = db.prepare('INSERT INTO product_recipes (product_id, stock_item_id, quantity_needed, unit) VALUES (?, ?, ?, ?)');
        for (const item of (args[1] || [])) {
          stmt.run(args[0], asId(item.stock_item_id), money(item.quantity_needed), item.unit || null);
        }
        return { success: true, count: (args[1] || []).length };
      })());
    case 'products:addRecipeItem':
      return ok(runData(db.prepare('INSERT INTO product_recipes (product_id, stock_item_id, quantity_needed, unit) VALUES (?, ?, ?, ?)')
        .run(args[0]?.product_id, args[0]?.stock_item_id, money(args[0]?.quantity_needed), args[0]?.unit || null)));
    case 'products:deleteRecipeItem':
      return ok(runData(db.prepare('DELETE FROM product_recipes WHERE id = ?').run(args[0])));
    case 'products:calculateCost': {
      const recipe = db.prepare(`
        SELECT pr.quantity_needed, s.cost_per_unit
        FROM product_recipes pr LEFT JOIN stock s ON pr.stock_item_id = s.id
        WHERE pr.product_id = ?
      `).all(args[0]);
      return ok(recipe.reduce((sum, r) => sum + money(r.quantity_needed) * money(r.cost_per_unit), 0) * (Number(args[1]) || 1));
    }
    case 'products:checkStock': {
      const rows = db.prepare(`
        SELECT pr.stock_item_id, pr.quantity_needed, s.name AS stock_name, s.quantity AS available, s.unit
        FROM product_recipes pr LEFT JOIN stock s ON pr.stock_item_id = s.id
        WHERE pr.product_id = ?
      `).all(args[0]);
      const qty = Number(args[1]) || 1;
      const shortages = rows
        .map(r => ({ stock_item_id: r.stock_item_id, stock_name: r.stock_name, needed: money(r.quantity_needed * qty), available: money(r.available), shortage: money(r.quantity_needed * qty - r.available), unit: r.unit }))
        .filter(r => r.shortage > 0);
      return ok({ canProduce: shortages.length === 0, shortages });
    }
    case 'products:toggleFavorite':
      return ok(runData(db.prepare('UPDATE products SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(args[0])));
    case 'products:updateBarcode':
      return ok(runData(db.prepare('UPDATE products SET barcode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(args[1] || null, args[0])));
    case 'products:adjustQuantity':
    case 'products:setInitialQuantity':
      return ok(db.transaction(() => {
        const product = db.prepare('SELECT quantity FROM products WHERE id = ?').get(args[0]);
        if (!product) throw new Error('Product not found');
        const oldQuantity = money(product.quantity);
        const next = money(args[1]);
        db.prepare('UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, args[0]);
        if (next !== oldQuantity) {
          db.prepare('INSERT INTO production_batches (product_id, quantity_produced, total_cost, expense_allocation, date, notes) VALUES (?, ?, 0, 0, ?, ?)')
            .run(args[0], money(next - oldQuantity), today(), args[2] || 'Opening balance adjustment');
        }
        return { success: true, product_id: args[0], old_quantity: oldQuantity, new_quantity: next, difference: money(next - oldQuantity) };
      })());
    case 'products:addResaleStock':
      return ok(db.transaction(() => {
        const product = db.prepare('SELECT quantity FROM products WHERE id = ?').get(args[0]);
        if (!product) throw new Error('Product not found');
        const quantity = money(args[1]);
        const unitCost = money(args[2]);
        const newQuantity = money(product.quantity + quantity);
        db.prepare('UPDATE products SET quantity = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, unitCost, args[0]);
        db.prepare('INSERT INTO production_batches (product_id, quantity_produced, ingredient_cost, total_cost, expense_allocation, date, notes) VALUES (?, ?, ?, ?, 0, ?, ?)')
          .run(args[0], quantity, money(quantity * unitCost), money(quantity * unitCost), today(), args[3] || 'Resale stock purchase');
        return { success: true, product_id: args[0], new_quantity: newQuantity, quantity_added: quantity };
      })());
    case 'products:deleteImage':
      return ok(runData(db.prepare('UPDATE products SET image_path = NULL, image_data = NULL, updated_at = CURRENT_TIMESTAMP WHERE image_path = ?').run(args[0])));

    // Batches
    case 'batches:getAll':
      return ok(db.prepare(`
        SELECT pb.*, p.name AS product_name, p.unit AS product_unit
        FROM production_batches pb LEFT JOIN products p ON pb.product_id = p.id
        ORDER BY pb.date DESC, pb.created_at DESC
      `).all());
    case 'batches:getById':
      return ok(db.prepare(`
        SELECT pb.*, p.name AS product_name, p.unit AS product_unit
        FROM production_batches pb LEFT JOIN products p ON pb.product_id = p.id
        WHERE pb.id = ?
      `).get(args[0]) || null);
    case 'batches:getByProduct':
      return ok(db.prepare(`
        SELECT pb.*, p.name AS product_name, p.unit AS product_unit
        FROM production_batches pb LEFT JOIN products p ON pb.product_id = p.id
        WHERE pb.product_id = ? ORDER BY pb.date DESC
      `).all(args[0]));
    case 'batches:create':
      return ok(db.transaction(() => {
        const data = args[0] || {};
        const qty = money(data.quantity_produced);
        const recipe = db.prepare(`
          SELECT pr.stock_item_id, pr.quantity_needed, s.quantity AS available, s.name AS stock_name
          FROM product_recipes pr LEFT JOIN stock s ON pr.stock_item_id = s.id
          WHERE pr.product_id = ?
        `).all(data.product_id);
        for (const item of recipe) {
          const needed = money(item.quantity_needed * qty);
          if (needed > money(item.available)) throw new Error(`Insufficient stock: ${item.stock_name}`);
        }
        const ingredientCost = recipe.reduce((sum, item) => {
          const stock = db.prepare('SELECT cost_per_unit FROM stock WHERE id = ?').get(item.stock_item_id);
          return sum + money(item.quantity_needed * qty) * money(stock?.cost_per_unit);
        }, 0);
        const totalCost = money(data.total_cost != null ? data.total_cost : ingredientCost + money(data.expense_allocation));
        const info = db.prepare(`
          INSERT INTO production_batches (product_id, quantity_produced, ingredient_cost, total_cost, expense_allocation, date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(data.product_id, qty, ingredientCost, totalCost, money(data.expense_allocation), data.date || today(), data.notes || null);
        for (const item of recipe) {
          const needed = money(item.quantity_needed * qty);
          db.prepare('UPDATE stock SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(needed, item.stock_item_id);
          db.prepare('INSERT INTO stock_transactions (stock_id, type, quantity, notes, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(item.stock_item_id, 'out', needed, `Production x${qty}`, 'production', Number(info.lastInsertRowid));
        }
        db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, data.product_id);
        return runData(info);
      })());
    case 'batches:update':
      return ok(runData(db.prepare('UPDATE production_batches SET quantity_produced = ?, total_cost = ?, expense_allocation = ?, date = ?, notes = ? WHERE id = ?')
        .run(money(args[1]?.quantity_produced), money(args[1]?.total_cost), money(args[1]?.expense_allocation), args[1]?.date || today(), args[1]?.notes || null, args[0])));
    case 'batches:delete': {
      const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(args[0]);
      if (batch) db.prepare('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(batch.quantity_produced), batch.product_id);
      return ok(runData(db.prepare('DELETE FROM production_batches WHERE id = ?').run(args[0])));
    }

    // Clients and payments
    case 'clientCategories:getAll':
      return ok(db.prepare(`
        SELECT cc.*, COUNT(c.id) AS client_count
        FROM client_categories cc LEFT JOIN clients c ON c.category_id = cc.id
        GROUP BY cc.id ORDER BY cc.name
      `).all());
    case 'clientCategories:add': {
      const id = getOrCreateClientCategory(args[0]);
      return ok(db.prepare('SELECT * FROM client_categories WHERE id = ?').get(id));
    }
    case 'clients:getAll':
      return ok(db.prepare(`
        SELECT c.*, cc.name AS category_name,
               (SELECT COUNT(*) FROM sales WHERE client_id = c.id) AS sale_count,
               (SELECT COALESCE(SUM(total), 0) FROM sales WHERE client_id = c.id) AS total_purchases,
               (SELECT COALESCE(SUM(total - ${currentPaidExpr('sales')}), 0) FROM sales WHERE client_id = c.id AND status NOT IN ('paid','cancelled','return')) AS outstanding_debt,
               (SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return')) AS last_sale_date,
               CAST(julianday('now') - julianday((SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return'))) AS INTEGER) AS days_since_last_sale
        FROM clients c LEFT JOIN client_categories cc ON c.category_id = cc.id
        ORDER BY c.name
      `).all());
    case 'clients:getById':
      return ok(db.prepare(`
        SELECT c.*, cc.name AS category_name,
               (SELECT COUNT(*) FROM sales WHERE client_id = c.id) AS sale_count,
               (SELECT COALESCE(SUM(total), 0) FROM sales WHERE client_id = c.id) AS total_purchases,
               (SELECT COALESCE(SUM(total - ${currentPaidExpr('sales')}), 0) FROM sales WHERE client_id = c.id AND status NOT IN ('paid','cancelled','return')) AS outstanding_debt
        FROM clients c LEFT JOIN client_categories cc ON c.category_id = cc.id
        WHERE c.id = ?
      `).get(args[0]) || null);
    case 'clients:search':
      return ok(db.prepare(`
        SELECT c.*, cc.name AS category_name,
               (SELECT COUNT(*) FROM sales WHERE client_id = c.id) AS sale_count,
               (SELECT COALESCE(SUM(total - ${currentPaidExpr('sales')}), 0) FROM sales WHERE client_id = c.id AND status NOT IN ('paid','cancelled','return')) AS outstanding_debt
        FROM clients c LEFT JOIN client_categories cc ON c.category_id = cc.id
        WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ? OR cc.name LIKE ?
        ORDER BY c.name
      `).all(...Array(5).fill(`%${args[0] || ''}%`)));
    case 'clients:getWithDebt':
      return ok(db.prepare(`
        SELECT c.*, cc.name AS category_name,
               (SELECT COUNT(*) FROM sales WHERE client_id = c.id) AS sale_count,
               ABS(c.balance) AS outstanding_debt
        FROM clients c LEFT JOIN client_categories cc ON c.category_id = cc.id
        WHERE c.balance < 0 OR EXISTS (SELECT 1 FROM sales WHERE client_id = c.id AND ${saleStatusExpr('sales')} != 'paid')
        ORDER BY c.balance ASC
      `).all());
    case 'clients:getInactive': {
      const days = Math.max(1, parseInt(args[0], 10) || 30);
      return ok(db.prepare(`
        SELECT c.*, cc.name AS category_name,
               (SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return')) AS last_sale_date,
               CAST(julianday('now') - julianday((SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return'))) AS INTEGER) AS days_since_last_sale
        FROM clients c LEFT JOIN client_categories cc ON c.category_id = cc.id
        WHERE (
          (SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return')) IS NULL
          OR CAST(julianday('now') - julianday((SELECT MAX(date) FROM sales WHERE client_id = c.id AND status NOT IN ('cancelled','return'))) AS INTEGER) >= ?
        )
        ORDER BY days_since_last_sale DESC, c.name
      `).all(days));
    }
    case 'clients:add': {
      const data = args[0] || {};
      const categoryId = resolveClientCategory(data);
      const info = db.prepare(`
        INSERT INTO clients (name, category_id, phone, address, email, notes, balance, credit_blocked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(data.name, categoryId, data.phone || null, data.address || null, data.email || null, data.notes || null, money(data.balance), flag(data.credit_blocked));
      return ok(runData(info));
    }
    case 'clients:update': {
      const data = args[1] || {};
      return ok(runData(db.prepare(`
        UPDATE clients SET name = ?, category_id = ?, phone = ?, address = ?, email = ?, notes = ?,
          credit_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(data.name, resolveClientCategory(data), data.phone || null, data.address || null, data.email || null, data.notes || null, flag(data.credit_blocked), args[0])));
    }
    case 'clients:recordContact':
      return ok(runData(db.prepare('UPDATE clients SET last_contact_note = ?, last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(args[1] == null ? null : String(args[1]).trim() || null, args[0])));
    case 'clients:audit': {
      const rows = db.prepare(`
        SELECT c.id, c.name, c.phone, c.balance AS stored_balance,
               COALESCE((SELECT SUM(amount) FROM client_payments cp WHERE cp.client_id = c.id AND ${effectiveClientPaymentWhere('cp')}), 0) AS sum_payments,
               COALESCE((SELECT SUM(total - paid_amount) FROM sales WHERE client_id = c.id AND status NOT IN ('paid','cancelled','return')), 0) AS sum_outstanding
        FROM clients c ORDER BY c.name
      `).all().map(r => {
        const expected = money(r.sum_payments - r.sum_outstanding);
        const stored = money(r.stored_balance);
        return { id: r.id, name: r.name, phone: r.phone, stored_balance: stored, expected_balance: expected, drift: money(stored - expected), has_drift: Math.abs(stored - expected) > 0.005 };
      });
      return ok({ all: rows, drifts: rows.filter(r => r.has_drift), total_drift_count: rows.filter(r => r.has_drift).length });
    }
    case 'clients:repairBalance':
      return ok(db.transaction(() => {
        const id = args[0];
        const row = db.prepare(`
          SELECT c.balance AS old_balance,
                 COALESCE((SELECT SUM(amount) FROM client_payments cp WHERE cp.client_id = c.id AND ${effectiveClientPaymentWhere('cp')}), 0) AS sum_payments,
                 COALESCE((SELECT SUM(total - paid_amount) FROM sales WHERE client_id = c.id AND status NOT IN ('paid','cancelled','return')), 0) AS sum_outstanding
          FROM clients c WHERE c.id = ?
        `).get(id);
        if (!row) throw new Error('Client not found');
        const expected = money(row.sum_payments - row.sum_outstanding);
        db.prepare('UPDATE clients SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(expected, id);
        return { id, old_balance: money(row.old_balance), balance: expected };
      })());
    case 'clients:delete': {
      const saleCount = db.prepare('SELECT COUNT(*) AS c FROM sales WHERE client_id = ?').get(args[0]).c;
      if (saleCount > 0) throw new Error('Cannot delete: client has sales on record');
      return ok(runData(db.prepare('DELETE FROM clients WHERE id = ?').run(args[0])));
    }
    case 'clients:getStats': {
      const now = new Date();
      const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);
      return ok({
        ...db.prepare(`
          SELECT (SELECT COUNT(*) FROM clients) AS total_clients,
                 (SELECT COUNT(*) FROM sales) AS total_sales,
                 (SELECT COALESCE(SUM(total), 0) FROM sales) AS total_revenue,
                 (SELECT COALESCE(SUM(${currentPaidExpr('sales')}), 0) FROM sales) AS total_collected,
                 (SELECT COALESCE(SUM(ABS(balance)), 0) FROM clients WHERE balance < 0) AS total_outstanding,
                 (SELECT COUNT(*) FROM clients WHERE balance < 0) AS clients_with_debt
        `).get(),
        ...db.prepare('SELECT COUNT(*) AS month_sales, COALESCE(SUM(total), 0) AS month_revenue FROM sales WHERE date BETWEEN ? AND ?').get(start, end),
      });
    }
    case 'clients:recordPayment':
      return ok(addClientPayment(args[0], args[1], args[2] || {}, userId));
    case 'clients:getPayments': {
      const clientId = args[0];
      const ledger = db.prepare(`
        SELECT cp.*, s.date AS sale_date, s.total AS sale_total, ${saleStatusExpr('s')} AS sale_status,
               u.name AS created_by_name, 0 AS synthetic
        FROM client_payments cp
        LEFT JOIN sales s ON cp.sale_id = s.id
        LEFT JOIN users u ON cp.created_by = u.id
        WHERE cp.client_id = ?
          AND ${effectiveClientPaymentWhere('cp')}
      `).all(clientId);
      const synthetic = db.prepare(`
        SELECT 'sale-' || s.id AS id, s.client_id, s.id AS sale_id, s.paid_amount AS amount,
               s.date, s.payment_method AS method, NULL AS notes, NULL AS batch_id, s.created_by,
               s.created_at, s.date AS sale_date, s.total AS sale_total, ${saleStatusExpr('s')} AS sale_status,
               u.name AS created_by_name, 1 AS synthetic
        FROM sales s LEFT JOIN users u ON s.created_by = u.id
        WHERE s.client_id = ? AND s.paid_amount > 0
      `).all(clientId);
      return ok([...ledger, ...synthetic].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))));
    }
    case 'clients:updatePayment': {
      const id = args[0];
      const data = args[1] || {};
      return ok(db.transaction(() => {
        const p = db.prepare('SELECT * FROM client_payments WHERE id = ?').get(id);
        if (!p) throw new Error('Payment not found');
        const next = data.amount != null ? money(data.amount) : money(p.amount);
        const delta = money(next - p.amount);
        db.prepare('UPDATE client_payments SET amount = ?, date = ?, notes = ? WHERE id = ?')
          .run(next, data.date || p.date, data.notes !== undefined ? data.notes : p.notes, id);
        db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(delta, p.client_id);
        return { success: true, delta };
      })());
    }
    case 'clients:deletePayment':
      return ok(db.transaction(() => {
        const p = db.prepare('SELECT * FROM client_payments WHERE id = ?').get(args[0]);
        if (!p) throw new Error('Payment not found');
        db.prepare('UPDATE clients SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(p.amount, p.client_id);
        db.prepare('DELETE FROM client_payments WHERE id = ?').run(args[0]);
        return { success: true };
      })());
    case 'clients:adjustBalance':
      return ok(db.transaction(() => {
        const clientId = args[0];
        const delta = money(args[1]);
        if (!args[2]) throw new Error('A reason is required for balance adjustments');
        const info = db.prepare(`
          INSERT INTO client_payments (client_id, sale_id, amount, date, method, notes, created_by)
          VALUES (?, NULL, ?, ?, 'adjustment', ?, ?)
        `).run(clientId, delta, today(), String(args[2]).trim(), args[3] || userId);
        db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(delta, clientId);
        return { success: true, paymentId: Number(info.lastInsertRowid) };
      })());

    // Sales
    case 'sales:getAll':
      return ok(db.prepare(`${salesBaseSelect()} ORDER BY s.date DESC, s.created_at DESC`).all());
    case 'sales:getById': {
      const sale = db.prepare(`${salesBaseSelect()} WHERE s.id = ?`).get(args[0]);
      if (!sale) return ok(null);
      const items = db.prepare(`
        SELECT si.*, p.name AS product_name, p.unit AS product_unit
        FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(args[0]);
      return ok({ ...sale, items });
    }
    case 'sales:getByClient':
      return ok(db.prepare(`${salesBaseSelect()} WHERE s.client_id = ? ORDER BY s.date DESC`).all(args[0]));
    case 'sales:getByStatus':
      return ok(db.prepare(`${salesBaseSelect()} WHERE ${saleStatusExpr('s')} = ? ORDER BY s.date DESC`).all(args[0]));
    case 'sales:getByDateRange':
      return ok(db.prepare(`${salesBaseSelect()} WHERE s.date BETWEEN ? AND ? ORDER BY s.date DESC`).all(args[0], args[1]));
    case 'sales:getUnpaid':
      return ok(db.prepare(`${salesBaseSelect()} WHERE ${saleStatusExpr('s')} != 'paid' ORDER BY s.date ASC`).all());
    case 'sales:createComplete':
      return ok(createSale(args[0] || {}, userId));
    case 'sales:update': {
      const data = args[1] || {};
      return ok(runData(db.prepare(`
        UPDATE sales SET client_id = ?, date = ?, total = ?, paid_amount = ?, status = ?, notes = ?
        WHERE id = ?
      `).run(asId(data.client_id), data.date || today(), money(data.total), money(data.paid_amount), data.status || 'pending', data.notes || null, args[0])));
    }
    case 'sales:addPayment': {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(args[0]);
      if (!sale) throw new Error('Sale not found');
      if (!sale.client_id) throw new Error('Walk-in sales cannot accept post-creation payments');
      const result = addClientPayment(sale.client_id, args[1], { ...(args[2] || {}), sale_id: sale.id }, userId);
      return ok(result);
    }
    case 'sales:delete':
      return ok(db.transaction(() => {
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(args[0]);
        if (!sale) return { changes: 0 };
        const items = db.prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?').all(args[0]);
        if (sale.status !== 'return') {
          for (const item of items) db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(item.quantity, item.product_id);
        }
        db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(args[0]);
        db.prepare('DELETE FROM client_payments WHERE sale_id = ?').run(args[0]);
        return runData(db.prepare('DELETE FROM sales WHERE id = ?').run(args[0]));
      })());
    case 'sales:getItems':
      return ok(db.prepare(`
        SELECT si.*, p.name AS product_name, p.unit AS product_unit
        FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(args[0]));
    case 'sales:addItem': {
      const data = args[0] || {};
      return ok(db.transaction(() => {
        const total = money(data.total != null ? data.total : money(data.quantity) * money(data.unit_price));
        const info = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)')
          .run(data.sale_id, data.product_id, money(data.quantity), money(data.unit_price), total);
        db.prepare('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(data.quantity), data.product_id);
        return runData(info);
      })());
    }
    case 'sales:updateItem': {
      const data = args[1] || {};
      return ok(runData(db.prepare('UPDATE sale_items SET product_id = ?, quantity = ?, unit_price = ?, total = ? WHERE id = ?')
        .run(data.product_id, money(data.quantity), money(data.unit_price), money(data.total != null ? data.total : money(data.quantity) * money(data.unit_price)), args[0])));
    }
    case 'sales:deleteItem':
      return ok(runData(db.prepare('DELETE FROM sale_items WHERE id = ?').run(args[0])));
    case 'sales:getSummary': {
      const range = args[0] && args[1] ? monthRange(args[0], args[1]) : null;
      const where = range ? 'WHERE s.date BETWEEN ? AND ?' : '';
      const params = range ? [range.start, range.end] : [];
      return ok(db.prepare(`
        SELECT c.id AS client_id, c.name AS client_name, COUNT(s.id) AS sale_count,
               COALESCE(SUM(s.total), 0) AS total_amount,
               COALESCE(SUM(${currentPaidExpr('s')}), 0) AS paid_amount,
               COALESCE(SUM(s.total - ${currentPaidExpr('s')}), 0) AS outstanding
        FROM clients c LEFT JOIN sales s ON c.id = s.client_id ${where ? `AND s.date BETWEEN ? AND ?` : ''}
        GROUP BY c.id ORDER BY total_amount DESC
      `).all(...params));
    }
    case 'sales:getTopProducts':
      return ok(db.prepare(`
        SELECT p.id, p.name, p.unit, COALESCE(SUM(si.quantity), 0) AS total_sold,
               COALESCE(SUM(si.quantity * si.unit_price), 0) AS total_revenue
        FROM products p LEFT JOIN sale_items si ON p.id = si.product_id
        GROUP BY p.id ORDER BY total_sold DESC LIMIT ?
      `).all(Number(args[0]) || 10));
    case 'sales:getMonthlySales': {
      const year = String(args[0]);
      return ok(db.prepare(`
        SELECT strftime('%m', date) AS month, COUNT(*) AS sale_count,
               COALESCE(SUM(total), 0) AS total_revenue,
               COALESCE(SUM(${currentPaidExpr('sales')}), 0) AS collected
        FROM sales WHERE strftime('%Y', date) = ?
        GROUP BY strftime('%m', date) ORDER BY month
      `).all(year));
    }

    // Suppliers and purchases
    case 'suppliers:getAll':
      return ok(db.prepare(`
        SELECT s.*, (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) AS purchase_count,
               (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id) AS total_purchases
        FROM suppliers s ORDER BY s.name
      `).all());
    case 'suppliers:getById':
      return ok(db.prepare(`
        SELECT s.*, (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) AS purchase_count,
               (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id) AS total_purchases
        FROM suppliers s WHERE s.id = ?
      `).get(args[0]) || null);
    case 'suppliers:search':
      return ok(db.prepare(`
        SELECT s.*, (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) AS purchase_count,
               (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id) AS total_purchases
        FROM suppliers s
        WHERE s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.address LIKE ?
        ORDER BY s.name
      `).all(...Array(4).fill(`%${args[0] || ''}%`)));
    case 'suppliers:add': {
      const data = args[0] || {};
      const info = db.prepare('INSERT INTO suppliers (name, phone, address, email, notes, balance) VALUES (?, ?, ?, ?, ?, ?)')
        .run(data.name, data.phone || null, data.address || null, data.email || null, data.notes || null, money(data.initial_balance || data.balance));
      return ok(runData(info));
    }
    case 'suppliers:update': {
      const data = args[1] || {};
      return ok(runData(db.prepare('UPDATE suppliers SET name = ?, phone = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(data.name, data.phone || null, data.address || null, data.email || null, data.notes || null, args[0])));
    }
    case 'suppliers:updateBalance':
      return ok(runData(db.prepare('UPDATE suppliers SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(args[1]), args[0])));
    case 'suppliers:delete':
      return ok(runData(db.prepare('DELETE FROM suppliers WHERE id = ?').run(args[0])));
    case 'suppliers:getStats': {
      const now = new Date();
      const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);
      return ok({
        ...db.prepare(`
          SELECT COUNT(*) AS total_suppliers,
                 (SELECT COUNT(*) FROM purchases) AS total_purchases,
                 (SELECT COALESCE(SUM(total), 0) FROM purchases) AS total_amount,
                 (SELECT COALESCE(SUM(total - paid_amount), 0) FROM purchases WHERE status != 'paid') AS total_debt
          FROM suppliers
        `).get(),
        ...db.prepare('SELECT COUNT(*) AS month_purchases, COALESCE(SUM(total), 0) AS month_amount FROM purchases WHERE date BETWEEN ? AND ?').get(start, end),
      });
    }
    case 'suppliers:recordPayment':
      return ok(addSupplierPayment(args[0] || {}, userId));
    case 'suppliers:recordVersement':
      return ok(db.transaction(() => {
        const supplierId = args[0];
        let remaining = money(args[1]);
        const opts = args[2] || {};
        const batchId = `sup-versement-${Date.now()}`;
        const allocations = [];
        const unpaid = db.prepare(`
          SELECT id, total, paid_amount FROM purchases
          WHERE supplier_id = ? AND status NOT IN ('paid','cancelled') AND (total - paid_amount) > 0
          ORDER BY date ASC, id ASC
        `).all(supplierId);
        for (const p of unpaid) {
          if (remaining <= 0) break;
          const allocate = money(Math.min(remaining, p.total - p.paid_amount));
          const r = addSupplierPayment({ supplier_id: supplierId, purchase_id: p.id, amount: allocate, date: opts.date, method: opts.method, notes: opts.notes, batch_id: batchId }, userId);
          allocations.push({ payment_id: r.id, purchase_id: p.id, amount: allocate });
          remaining = money(remaining - allocate);
        }
        let prepayCarry = 0;
        if (remaining > 0) {
          const r = addSupplierPayment({ supplier_id: supplierId, amount: remaining, date: opts.date, method: 'prepayment', notes: opts.notes, batch_id: batchId }, userId);
          allocations.push({ payment_id: r.id, purchase_id: null, amount: remaining });
          prepayCarry = remaining;
        }
        return { batchId, totalApplied: money(args[1] - prepayCarry), prepayCarry, allocations };
      })());
    case 'suppliers:getPayments':
      return ok(db.prepare(`
        SELECT sp.*, p.id AS purchase_reference, p.date AS purchase_date, u.name AS created_by_name
        FROM supplier_payments sp
        LEFT JOIN purchases p ON sp.purchase_id = p.id
        LEFT JOIN users u ON sp.created_by = u.id
        WHERE sp.supplier_id = ? ORDER BY sp.created_at DESC
      `).all(args[0]));
    case 'suppliers:deletePayment':
      return ok(db.transaction(() => {
        const p = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(args[0]);
        if (!p) throw new Error('Payment not found');
        db.prepare('UPDATE suppliers SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(p.amount, p.supplier_id);
        db.prepare('DELETE FROM supplier_payments WHERE id = ?').run(args[0]);
        return { success: true };
      })());
    case 'suppliers:updatePayment':
      return ok(db.transaction(() => {
        const p = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(args[0]);
        if (!p) throw new Error('Payment not found');
        const next = args[1]?.amount != null ? money(args[1].amount) : money(p.amount);
        const delta = money(next - p.amount);
        db.prepare('UPDATE supplier_payments SET amount = ?, date = ?, notes = ? WHERE id = ?')
          .run(next, args[1]?.date || p.date, args[1]?.notes !== undefined ? args[1].notes : p.notes, args[0]);
        db.prepare('UPDATE suppliers SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(delta, p.supplier_id);
        return { success: true, delta };
      })());
    case 'suppliers:audit': {
      const rows = db.prepare(`
        SELECT s.id, s.name, s.phone, s.balance AS stored_balance,
               COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) AS sum_payments,
               COALESCE((SELECT SUM(total - paid_amount) FROM purchases WHERE supplier_id = s.id AND status NOT IN ('paid','cancelled')), 0) AS sum_unpaid
        FROM suppliers s ORDER BY s.name
      `).all().map(r => {
        const expected = money(r.sum_payments - r.sum_unpaid);
        const stored = money(r.stored_balance);
        return { id: r.id, name: r.name, phone: r.phone, stored_balance: stored, expected_balance: expected, drift: money(stored - expected), has_drift: Math.abs(stored - expected) > 0.005 };
      });
      return ok({ all: rows, drifts: rows.filter(r => r.has_drift), total_drift_count: rows.filter(r => r.has_drift).length });
    }
    case 'suppliers:repairBalance':
      return ok(db.transaction(() => {
        const id = args[0];
        const sums = db.prepare(`
          SELECT s.balance,
                 COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) AS sum_payments,
                 COALESCE((SELECT SUM(total - paid_amount) FROM purchases WHERE supplier_id = s.id AND status NOT IN ('paid','cancelled')), 0) AS sum_unpaid
          FROM suppliers s WHERE s.id = ?
        `).get(id);
        if (!sums) throw new Error('Supplier not found');
        const expected = money(sums.sum_payments - sums.sum_unpaid);
        db.prepare('UPDATE suppliers SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(expected, id);
        return { id, old_balance: money(sums.balance), balance: expected };
      })());

    case 'purchases:getAll':
      return ok(db.prepare(`
        SELECT p.*, s.name AS supplier_name, (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count
        FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.date DESC, p.created_at DESC
      `).all());
    case 'purchases:getById':
      return ok(db.prepare('SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?').get(args[0]) || null);
    case 'purchases:getBySupplier':
      return ok(db.prepare(`
        SELECT p.*, s.name AS supplier_name, (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count
        FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.supplier_id = ? ORDER BY p.date DESC
      `).all(args[0]));
    case 'purchases:getByStatus':
      return ok(db.prepare('SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.status = ? ORDER BY p.date DESC').all(args[0]));
    case 'purchases:getUnpaid':
      return ok(db.prepare(`
        SELECT p.*, s.name AS supplier_name, (p.total - p.paid_amount) AS remaining
        FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.status != 'paid' ORDER BY p.date ASC
      `).all());
    case 'purchases:add': {
      const data = args[0] || {};
      const info = db.prepare(`
        INSERT INTO purchases (supplier_id, date, subtotal, discount, total, paid_amount, status, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(asId(data.supplier_id), data.date || today(), money(data.subtotal), money(data.discount), money(data.total), money(data.paid_amount), data.status || 'pending', data.payment_method || 'cash', data.notes || null, userId);
      return ok(runData(info));
    }
    case 'purchases:update': {
      const data = args[1] || {};
      return ok(runData(db.prepare(`
        UPDATE purchases SET supplier_id = ?, date = ?, total = ?, paid_amount = ?, status = ?, payment_method = ?, notes = ? WHERE id = ?
      `).run(asId(data.supplier_id), data.date || today(), money(data.total), money(data.paid_amount), data.status || 'pending', data.payment_method || 'cash', data.notes || null, args[0])));
    }
    case 'purchases:addPayment':
      return ok(addSupplierPayment({ supplier_id: db.prepare('SELECT supplier_id FROM purchases WHERE id = ?').get(args[0])?.supplier_id, purchase_id: args[0], amount: args[1] }, userId));
    case 'purchases:delete':
      return ok(runData(db.prepare('DELETE FROM purchases WHERE id = ?').run(args[0])));
    case 'purchases:getItems':
      return ok(db.prepare(`
        SELECT pi.*, COALESCE(st.name, pr.name) AS stock_name, COALESCE(st.unit, pr.unit) AS stock_unit,
               pr.name AS product_name, pr.unit AS product_unit
        FROM purchase_items pi
        LEFT JOIN stock st ON pi.stock_item_id = st.id
        LEFT JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = ?
      `).all(args[0]));
    case 'purchases:addItem': {
      const data = args[0] || {};
      const info = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, stock_item_id, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.purchase_id, asId(data.product_id), asId(data.stock_item_id), money(data.quantity), money(data.unit_price), money(data.total != null ? data.total : money(data.quantity) * money(data.unit_price)));
      if (asId(data.stock_item_id)) db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?').run(money(data.quantity), asId(data.stock_item_id));
      if (asId(data.product_id)) db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(money(data.quantity), asId(data.product_id));
      return ok(runData(info));
    }
    case 'purchases:updateItem': {
      const data = args[1] || {};
      return ok(runData(db.prepare('UPDATE purchase_items SET product_id = ?, stock_item_id = ?, quantity = ?, unit_price = ?, total = ? WHERE id = ?')
        .run(asId(data.product_id), asId(data.stock_item_id), money(data.quantity), money(data.unit_price), money(data.total != null ? data.total : money(data.quantity) * money(data.unit_price)), args[0])));
    }
    case 'purchases:deleteItem':
      return ok(runData(db.prepare('DELETE FROM purchase_items WHERE id = ?').run(args[0])));

    // Expenses
    case 'expenses:getCategories':
      return ok(db.prepare('SELECT * FROM expense_categories ORDER BY name').all());
    case 'expenses:addCategory':
      return ok(runData(db.prepare('INSERT INTO expense_categories (name, description) VALUES (?, ?)').run(args[0], args[1] || null)));
    case 'expenses:updateCategory':
      return ok(runData(db.prepare('UPDATE expense_categories SET name = ?, description = ? WHERE id = ?').run(args[1], args[2] || null, args[0])));
    case 'expenses:deleteCategory':
      return ok(runData(db.prepare('DELETE FROM expense_categories WHERE id = ?').run(args[0])));
    case 'expenses:getAll':
      return ok(db.prepare(`
        SELECT e.*, COALESCE(ec.name, e.category) AS category_name
        FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
        ORDER BY e.date DESC, e.created_at DESC
      `).all());
    case 'expenses:getById':
      return ok(db.prepare('SELECT e.*, COALESCE(ec.name, e.category) AS category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.id = ?').get(args[0]) || null);
    case 'expenses:getByCategory':
      return ok(db.prepare('SELECT e.*, COALESCE(ec.name, e.category) AS category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.category_id = ? ORDER BY e.date DESC').all(args[0]));
    case 'expenses:getByDateRange':
      return ok(db.prepare('SELECT e.*, COALESCE(ec.name, e.category) AS category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.date BETWEEN ? AND ? ORDER BY e.date DESC').all(args[0], args[1]));
    case 'expenses:getByMonth': {
      const r = monthRange(args[0], args[1]);
      return dispatch('expenses:getByDateRange', [r.start, r.end], user);
    }
    case 'expenses:search':
      return ok(db.prepare(`
        SELECT e.*, COALESCE(ec.name, e.category) AS category_name
        FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
        WHERE e.description LIKE ? OR ec.name LIKE ? OR e.category LIKE ? OR e.notes LIKE ?
        ORDER BY e.date DESC
      `).all(...Array(4).fill(`%${args[0] || ''}%`)));
    case 'expenses:add': {
      const data = args[0] || {};
      const categoryName = data.category || db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(data.category_id)?.name || null;
      const info = db.prepare(`
        INSERT INTO expenses (category_id, category, description, amount, date, is_recurring, recurring_period, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(asId(data.category_id), categoryName, data.description || null, money(data.amount), data.date || today(), flag(data.is_recurring), data.recurring_period || null, data.payment_method || 'cash', data.notes || null, userId);
      return ok(runData(info));
    }
    case 'expenses:update': {
      const data = args[1] || {};
      const categoryName = data.category || db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(data.category_id)?.name || null;
      return ok(runData(db.prepare(`
        UPDATE expenses SET category_id = ?, category = ?, description = ?, amount = ?, date = ?,
          is_recurring = ?, recurring_period = ?, payment_method = ?, notes = ? WHERE id = ?
      `).run(asId(data.category_id), categoryName, data.description || null, money(data.amount), data.date || today(), flag(data.is_recurring), data.recurring_period || null, data.payment_method || 'cash', data.notes || null, args[0])));
    }
    case 'expenses:delete':
      return ok(runData(db.prepare('DELETE FROM expenses WHERE id = ?').run(args[0])));
    case 'expenses:getStats': {
      const now = new Date();
      const r = monthRange(now.getFullYear(), now.getMonth() + 1);
      return ok({
        ...db.prepare('SELECT COUNT(*) AS total_count, COALESCE(SUM(amount), 0) AS total_amount FROM expenses').get(),
        ...db.prepare('SELECT COUNT(*) AS month_count, COALESCE(SUM(amount), 0) AS month_amount FROM expenses WHERE date BETWEEN ? AND ?').get(r.start, r.end),
      });
    }
    case 'expenses:getMonthlySummary':
      return ok(db.prepare("SELECT strftime('%m', date) AS month, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE strftime('%Y', date) = ? GROUP BY strftime('%m', date) ORDER BY month").all(String(args[0])));
    case 'expenses:getCategorySummary':
      return ok(db.prepare(`
        SELECT ec.id AS category_id, ec.name AS category_name, COUNT(e.id) AS count, COALESCE(SUM(e.amount), 0) AS total
        FROM expense_categories ec LEFT JOIN expenses e ON ec.id = e.category_id
        GROUP BY ec.id ORDER BY total DESC
      `).all());
    case 'expenses:getRecurring':
      return ok(db.prepare('SELECT e.*, COALESCE(ec.name, e.category) AS category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_recurring = 1 ORDER BY e.date DESC').all());

    // Employers / payroll
    case 'employers:getAll':
      return ok(db.prepare(`
        SELECT e.*, (SELECT COUNT(*) FROM payroll WHERE employer_id = e.id) AS payment_count,
               (SELECT COALESCE(SUM(amount), 0) FROM payroll WHERE employer_id = e.id AND paid = 1) AS total_paid,
               (SELECT COUNT(*) FROM payroll WHERE employer_id = e.id AND paid = 0) AS pending_payments
        FROM employers e ORDER BY e.name
      `).all());
    case 'employers:getById':
      return ok(db.prepare('SELECT * FROM employers WHERE id = ?').get(args[0]) || null);
    case 'employers:getActive':
      return ok(db.prepare("SELECT * FROM employers WHERE status = 'active' ORDER BY name").all());
    case 'employers:search':
      return ok(db.prepare('SELECT * FROM employers WHERE name LIKE ? OR role LIKE ? OR phone LIKE ? ORDER BY name').all(...Array(3).fill(`%${args[0] || ''}%`)));
    case 'employers:add': {
      const d = args[0] || {};
      return ok(runData(db.prepare('INSERT INTO employers (name, role, phone, address, salary, hire_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(d.name, d.role || null, d.phone || null, d.address || null, money(d.salary), d.hire_date || today(), d.status || 'active', d.notes || null)));
    }
    case 'employers:update': {
      const d = args[1] || {};
      return ok(runData(db.prepare('UPDATE employers SET name = ?, role = ?, phone = ?, address = ?, salary = ?, hire_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(d.name, d.role || null, d.phone || null, d.address || null, money(d.salary), d.hire_date || today(), d.status || 'active', d.notes || null, args[0])));
    }
    case 'employers:delete':
      return ok(db.transaction(() => {
        db.prepare('DELETE FROM payroll WHERE employer_id = ?').run(args[0]);
        return runData(db.prepare('DELETE FROM employers WHERE id = ?').run(args[0]));
      })());
    case 'employers:getStats': {
      const now = new Date();
      return ok({
        ...db.prepare(`
          SELECT (SELECT COUNT(*) FROM employers) AS total_employers,
                 (SELECT COUNT(*) FROM employers WHERE status = 'active') AS active_employers,
                 (SELECT COALESCE(SUM(salary), 0) FROM employers WHERE status = 'active') AS monthly_salary_total,
                 (SELECT COUNT(*) FROM payroll WHERE paid = 0) AS pending_payments,
                 (SELECT COALESCE(SUM(amount), 0) FROM payroll WHERE paid = 0) AS pending_amount
        `).get(),
        ...db.prepare('SELECT COALESCE(SUM(amount), 0) AS year_total_paid FROM payroll WHERE year = ? AND paid = 1').get(now.getFullYear()),
        ...db.prepare('SELECT COALESCE(SUM(amount), 0) AS month_total_paid FROM payroll WHERE year = ? AND month = ? AND paid = 1').get(now.getFullYear(), now.getMonth() + 1),
      });
    }
    case 'payroll:getAll':
      return ok(db.prepare('SELECT p.*, e.name AS employer_name, e.role AS employer_role, e.salary AS employer_salary FROM payroll p LEFT JOIN employers e ON p.employer_id = e.id ORDER BY p.year DESC, p.month DESC, e.name').all());
    case 'payroll:getById':
      return ok(db.prepare('SELECT p.*, e.name AS employer_name, e.role AS employer_role FROM payroll p LEFT JOIN employers e ON p.employer_id = e.id WHERE p.id = ?').get(args[0]) || null);
    case 'payroll:getByEmployer':
      return ok(db.prepare('SELECT * FROM payroll WHERE employer_id = ? ORDER BY year DESC, month DESC').all(args[0]));
    case 'payroll:getByMonth':
      return ok(db.prepare('SELECT p.*, e.name AS employer_name, e.role AS employer_role, e.salary AS employer_salary FROM payroll p LEFT JOIN employers e ON p.employer_id = e.id WHERE p.year = ? AND p.month = ? ORDER BY e.name').all(args[0], args[1]));
    case 'payroll:getPending':
      return ok(db.prepare('SELECT p.*, e.name AS employer_name, e.role AS employer_role, e.salary AS employer_salary FROM payroll p LEFT JOIN employers e ON p.employer_id = e.id WHERE p.paid = 0 ORDER BY p.year, p.month, e.name').all());
    case 'payroll:add': {
      const d = args[0] || {};
      return ok(runData(db.prepare('INSERT INTO payroll (employer_id, month, year, amount, paid, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(d.employer_id, d.month, d.year, money(d.amount), flag(d.paid), d.payment_date || null, d.notes || null)));
    }
    case 'payroll:update': {
      const d = args[1] || {};
      return ok(runData(db.prepare('UPDATE payroll SET employer_id = ?, month = ?, year = ?, amount = ?, paid = ?, payment_date = ?, notes = ? WHERE id = ?')
        .run(d.employer_id, d.month, d.year, money(d.amount), flag(d.paid), d.payment_date || null, d.notes || null, args[0])));
    }
    case 'payroll:markPaid':
      return ok(runData(db.prepare('UPDATE payroll SET paid = 1, payment_date = ? WHERE id = ?').run(args[1] || today(), args[0])));
    case 'payroll:delete':
      return ok(runData(db.prepare('DELETE FROM payroll WHERE id = ?').run(args[0])));
    case 'payroll:generate':
      return ok(db.transaction(() => {
        const active = db.prepare("SELECT * FROM employers WHERE status = 'active'").all();
        const existing = new Set(db.prepare('SELECT employer_id FROM payroll WHERE year = ? AND month = ?').all(args[0], args[1]).map(r => r.employer_id));
        const stmt = db.prepare('INSERT INTO payroll (employer_id, month, year, amount, paid) VALUES (?, ?, ?, ?, 0)');
        let created = 0;
        for (const e of active) {
          if (!existing.has(e.id)) {
            stmt.run(e.id, args[1], args[0], money(e.salary));
            created++;
          }
        }
        return { success: true, created };
      })());
    case 'payroll:getSummary':
      return ok(db.prepare('SELECT month, COUNT(*) AS payment_count, COALESCE(SUM(amount), 0) AS total_amount, SUM(CASE WHEN paid = 1 THEN amount ELSE 0 END) AS paid_amount, SUM(CASE WHEN paid = 0 THEN amount ELSE 0 END) AS pending_amount FROM payroll WHERE year = ? GROUP BY month ORDER BY month').all(args[0]));

    // Reports
    case 'reports:getProfitLoss': {
      const start = args[0], end = args[1];
      const revenue = db.prepare('SELECT COALESCE(SUM(total), 0) AS total_revenue, COUNT(*) AS sale_count FROM sales WHERE date BETWEEN ? AND ?').get(start, end);
      const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total_expenses, COUNT(*) AS expense_count FROM expenses WHERE date BETWEEN ? AND ?').get(start, end);
      const cogs = db.prepare(`
        SELECT COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, p.manual_cost, 0)), 0) AS total
        FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id
        WHERE s.date BETWEEN ? AND ?
      `).get(start, end).total || 0;
      const totalRevenue = revenue.total_revenue || 0;
      const totalExpenses = expenses.total_expenses || 0;
      return ok({
        period: { startDate: start, endDate: end },
        revenue: { total: totalRevenue, saleCount: revenue.sale_count },
        costs: { production: cogs, expenses: totalExpenses, expenseCount: expenses.expense_count },
        profit: { gross: totalRevenue - cogs, net: totalRevenue - cogs - totalExpenses, margin: totalRevenue > 0 ? (((totalRevenue - cogs - totalExpenses) / totalRevenue) * 100).toFixed(2) : 0 },
      });
    }
    case 'reports:getMonthlyProfitLoss': {
      const year = Number(args[0]);
      const out = [];
      for (let m = 1; m <= 12; m++) {
        const r = monthRange(year, m);
        const pl = dispatch('reports:getProfitLoss', [r.start, r.end], user).data;
        out.push({ month: m, monthName: new Date(year, m - 1).toLocaleString('default', { month: 'short' }), revenue: pl.revenue.total, expenses: pl.costs.expenses, productionCost: pl.costs.production, profit: pl.profit.net });
      }
      return ok(out);
    }
    case 'reports:getLowStockItems':
      return dispatch('stock:getLowStock', [], user);
    case 'reports:getOutOfStockItems':
      return ok(db.prepare('SELECT * FROM stock WHERE quantity <= 0 ORDER BY name').all());
    case 'reports:getStockValuation':
      return ok(db.prepare('SELECT COALESCE(SUM(quantity * cost_per_unit), 0) AS total_value, COUNT(*) AS total_items, SUM(CASE WHEN quantity <= min_stock_alert AND min_stock_alert > 0 THEN 1 ELSE 0 END) AS low_stock_count, SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock_count FROM stock').get());
    case 'reports:getStockByCategory':
      return ok(db.prepare('SELECT sc.id, sc.name AS category_name, COUNT(s.id) AS item_count, COALESCE(SUM(s.quantity), 0) AS total_quantity, COALESCE(SUM(s.quantity * s.cost_per_unit), 0) AS total_value FROM stock_categories sc LEFT JOIN stock s ON s.category_id = sc.id GROUP BY sc.id ORDER BY total_value DESC').all());
    case 'reports:getProductionHistory':
      return ok(db.prepare('SELECT pb.*, p.name AS product_name, p.selling_price FROM production_batches pb LEFT JOIN products p ON pb.product_id = p.id ORDER BY pb.date DESC, pb.id DESC LIMIT ?').all(Number(args[0]) || 50));
    case 'reports:getProductionByProduct':
      return ok(db.prepare('SELECT p.id, p.name AS product_name, p.selling_price, COUNT(pb.id) AS batch_count, COALESCE(SUM(pb.quantity_produced), 0) AS total_produced, COALESCE(SUM(pb.total_cost), 0) AS total_cost, COALESCE(AVG(pb.total_cost / NULLIF(pb.quantity_produced, 0)), 0) AS avg_unit_cost FROM products p LEFT JOIN production_batches pb ON pb.product_id = p.id GROUP BY p.id ORDER BY total_produced DESC').all());
    case 'reports:getProductionByMonth': {
      const year = Number(args[0]);
      const out = [];
      for (let m = 1; m <= 12; m++) {
        const r = monthRange(year, m);
        out.push({ month: m, monthName: new Date(year, m - 1).toLocaleString('default', { month: 'short' }), ...db.prepare('SELECT COUNT(*) AS batch_count, COALESCE(SUM(quantity_produced), 0) AS total_produced, COALESCE(SUM(total_cost), 0) AS total_cost FROM production_batches WHERE date BETWEEN ? AND ?').get(r.start, r.end) });
      }
      return ok(out);
    }
    case 'reports:getSalesByClient':
      return ok(db.prepare(`SELECT c.id, c.name AS client_name, c.phone, COUNT(s.id) AS sale_count, COALESCE(SUM(s.total), 0) AS total_sales, COALESCE(SUM(${currentPaidExpr('s')}), 0) AS total_paid, COALESCE(SUM(s.total - ${currentPaidExpr('s')}), 0) AS outstanding FROM clients c LEFT JOIN sales s ON s.client_id = c.id AND s.date BETWEEN ? AND ? GROUP BY c.id HAVING sale_count > 0 ORDER BY total_sales DESC`).all(args[0], args[1]));
    case 'reports:getTopProducts':
      return ok(db.prepare('SELECT p.id, p.name AS product_name, SUM(si.quantity) AS total_quantity, SUM(si.quantity * si.unit_price) AS total_revenue, COUNT(DISTINCT s.id) AS sale_count FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id WHERE s.date BETWEEN ? AND ? GROUP BY p.id ORDER BY total_revenue DESC LIMIT ?').all(args[0], args[1], Number(args[2]) || 10));
    case 'reports:getSalesByStatus':
      return ok(db.prepare(`SELECT ${saleStatusExpr('s')} AS status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount, COALESCE(SUM(${currentPaidExpr('s')}), 0) AS paid_amount FROM sales s GROUP BY ${saleStatusExpr('s')}`).all());
    case 'reports:getMonthlySales':
      return dispatch('sales:getMonthlySales', [args[0]], user);
    case 'reports:getExpensesByCategory':
      return ok(db.prepare('SELECT ec.id, ec.name AS category_name, COUNT(e.id) AS expense_count, COALESCE(SUM(e.amount), 0) AS total_amount FROM expense_categories ec LEFT JOIN expenses e ON e.category_id = ec.id AND e.date BETWEEN ? AND ? GROUP BY ec.id ORDER BY total_amount DESC').all(args[0], args[1]));
    case 'reports:getMonthlyExpenses': {
      const year = Number(args[0]);
      const out = [];
      for (let m = 1; m <= 12; m++) {
        const r = monthRange(year, m);
        out.push({ month: m, monthName: new Date(year, m - 1).toLocaleString('default', { month: 'short' }), ...db.prepare('SELECT COUNT(*) AS expense_count, COALESCE(SUM(amount), 0) AS total_amount FROM expenses WHERE date BETWEEN ? AND ?').get(r.start, r.end) });
      }
      return ok(out);
    }
    case 'reports:getTopExpenses':
      return ok(db.prepare('SELECT e.*, COALESCE(ec.name, e.category) AS category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.date BETWEEN ? AND ? ORDER BY e.amount DESC LIMIT ?').all(args[0], args[1], Number(args[2]) || 10));
    case 'reports:getPurchasesBySupplier':
      return ok(db.prepare('SELECT s.id, s.name AS supplier_name, s.phone, COUNT(p.id) AS purchase_count, COALESCE(SUM(p.total), 0) AS total_purchases, COALESCE(SUM(p.paid_amount), 0) AS total_paid, COALESCE(SUM(p.total - p.paid_amount), 0) AS outstanding FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.id AND p.date BETWEEN ? AND ? GROUP BY s.id HAVING purchase_count > 0 ORDER BY total_purchases DESC').all(args[0], args[1]));
    case 'reports:getMonthlyPurchases': {
      const year = Number(args[0]);
      const out = [];
      for (let m = 1; m <= 12; m++) {
        const r = monthRange(year, m);
        out.push({ month: m, monthName: new Date(year, m - 1).toLocaleString('default', { month: 'short' }), ...db.prepare('SELECT COUNT(*) AS purchase_count, COALESCE(SUM(total), 0) AS total_purchases, COALESCE(SUM(paid_amount), 0) AS total_paid FROM purchases WHERE date BETWEEN ? AND ?').get(r.start, r.end) });
      }
      return ok(out);
    }
    case 'reports:getDashboardStats': {
      const firstDay = today().slice(0, 8) + '01';
      const stock = db.prepare('SELECT COUNT(*) AS total_items, COALESCE(SUM(quantity * cost_per_unit), 0) AS total_value, SUM(CASE WHEN quantity <= min_stock_alert AND min_stock_alert > 0 THEN 1 ELSE 0 END) AS low_stock_count FROM stock').get();
      const sales = db.prepare(`SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS total_sales, COALESCE(SUM(${currentPaidExpr('sales')}), 0) AS total_collected FROM sales WHERE date >= ?`).get(firstDay);
      const expenses = db.prepare('SELECT COUNT(*) AS expense_count, COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE date >= ?').get(firstDay);
      const production = db.prepare('SELECT COUNT(*) AS batch_count, COALESCE(SUM(quantity_produced), 0) AS total_produced, COALESCE(SUM(total_cost), 0) AS total_cost FROM production_batches WHERE date >= ?').get(firstDay);
      const pendingPayroll = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM payroll WHERE paid = 0').get();
      return ok({
        stock, sales, expenses, production,
        outstanding: {
          fromClients: Math.abs(db.prepare('SELECT COALESCE(SUM(balance), 0) AS amount FROM clients WHERE balance < 0').get().amount || 0),
          toSuppliers: Math.abs(db.prepare('SELECT COALESCE(SUM(balance), 0) AS amount FROM suppliers WHERE balance < 0').get().amount || 0),
          pendingPayroll: pendingPayroll.amount,
          pendingPayrollCount: pendingPayroll.count,
        },
        monthProfit: (sales.total_sales || 0) - (expenses.total_expenses || 0) - (production.total_cost || 0),
      });
    }

    // Settings / documents / users
    case 'settings:getAll': {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      return ok(Object.fromEntries(rows.map(r => [r.key, r.value])));
    }
    case 'settings:get':
      return ok(db.prepare('SELECT value FROM settings WHERE key = ?').get(args[0])?.value || null);
    case 'settings:set':
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP').run(args[0], String(args[1] ?? ''));
      return ok({ key: args[0], value: args[1] });
    case 'settings:setMultiple': {
      const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');
      db.transaction((obj) => { for (const [k, v] of Object.entries(obj || {})) stmt.run(k, String(v ?? '')); })(args[0] || {});
      return ok(args[0] || {});
    }
    case 'documents:getAll':
      return ok(db.prepare('SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON d.client_id = c.id ORDER BY d.created_at DESC LIMIT ?').all(Number(args[0]) || 100));
    case 'documents:getByType':
      return ok(db.prepare('SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.type = ? ORDER BY d.created_at DESC').all(args[0]));
    case 'documents:getById':
      return ok(db.prepare('SELECT d.*, c.name AS client_name, c.phone AS client_phone, c.address AS client_address, c.email AS client_email FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ?').get(args[0]) || null);
    case 'documents:getBySale':
      return ok(db.prepare('SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.sale_id = ? ORDER BY d.created_at DESC').all(args[0]));
    case 'documents:getByClient':
      return ok(db.prepare('SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.client_id = ? ORDER BY d.created_at DESC').all(args[0]));
    case 'documents:getByDateRange':
      return ok(db.prepare('SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.date BETWEEN ? AND ? ORDER BY d.created_at DESC').all(args[0], args[1]));
    case 'documents:create': {
      const d = args[0] || {};
      const config = {
        invoice: ['invoice_prefix', 'next_invoice_number'],
        delivery: ['delivery_prefix', 'next_delivery_number'],
        proforma: ['proforma_prefix', 'next_proforma_number'],
        purchase_order: ['purchase_order_prefix', 'next_purchase_order_number'],
        exit_voucher: ['exit_voucher_prefix', 'next_exit_voucher_number'],
        credit_note: ['credit_note_prefix', 'next_credit_note_number'],
        quote: ['quote_prefix', 'next_quote_number'],
        reception_voucher: ['reception_voucher_prefix', 'next_reception_voucher_number'],
      }[d.type] || ['invoice_prefix', 'next_invoice_number'];
      const prefix = db.prepare('SELECT value FROM settings WHERE key = ?').get(config[0])?.value || 'DOC';
      const nextNum = Number(db.prepare('SELECT value FROM settings WHERE key = ?').get(config[1])?.value || 1);
      const number = `${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
      const info = db.prepare('INSERT INTO documents (type, number, sale_id, client_id, date, data, total) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(d.type, number, asId(d.sale_id), asId(d.client_id), d.date || today(), JSON.stringify(d.data || {}), money(d.total));
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP').run(config[1], String(nextNum + 1));
      return ok({ id: Number(info.lastInsertRowid), number, ...d });
    }
    case 'documents:delete':
      return ok(runData(db.prepare('DELETE FROM documents WHERE id = ?').run(args[0])));
    case 'documents:getStats':
      return ok({ all: db.prepare('SELECT type, COUNT(*) AS count, SUM(total) AS total_amount FROM documents GROUP BY type').all(), thisMonth: db.prepare("SELECT type, COUNT(*) AS count, SUM(total) AS total_amount FROM documents WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') GROUP BY type").all() });
    case 'documents:getNextNumber': {
      const d = { type: args[0] };
      const config = {
        invoice: ['invoice_prefix', 'next_invoice_number'],
        delivery: ['delivery_prefix', 'next_delivery_number'],
        proforma: ['proforma_prefix', 'next_proforma_number'],
        purchase_order: ['purchase_order_prefix', 'next_purchase_order_number'],
        exit_voucher: ['exit_voucher_prefix', 'next_exit_voucher_number'],
        credit_note: ['credit_note_prefix', 'next_credit_note_number'],
        quote: ['quote_prefix', 'next_quote_number'],
        reception_voucher: ['reception_voucher_prefix', 'next_reception_voucher_number'],
      }[d.type] || ['invoice_prefix', 'next_invoice_number'];
      const prefix = db.prepare('SELECT value FROM settings WHERE key = ?').get(config[0])?.value || 'DOC';
      const nextNum = Number(db.prepare('SELECT value FROM settings WHERE key = ?').get(config[1])?.value || 1);
      return { success: true, data: `${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`, preview: true };
    }
    case 'auth:verifyPassword': {
      const hash = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(args[0])?.password_hash;
      return ok(Boolean(hash && bcrypt.compareSync(args[1], hash)));
    }
    case 'users:getAll':
      return ok(db.prepare('SELECT id, username, name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC').all());
    case 'users:getById':
      return ok(db.prepare('SELECT id, username, name, role, is_active, last_login, created_at FROM users WHERE id = ?').get(args[0]) || null);
    case 'users:add': {
      const d = args[0] || {};
      const info = db.prepare('INSERT INTO users (username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?)')
        .run(d.username, bcrypt.hashSync(d.password, 10), d.name, d.role || 'sales', d.is_active !== undefined ? flag(d.is_active) : 1);
      return ok(runData(info));
    }
    case 'users:update': {
      const d = args[1] || {};
      return ok(runData(db.prepare('UPDATE users SET username = ?, name = ?, role = ?, is_active = ? WHERE id = ?')
        .run(d.username, d.name, d.role || 'sales', d.is_active !== undefined ? flag(d.is_active) : 1, args[0])));
    }
    case 'users:updatePassword':
      return ok(runData(db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(args[1], 10), args[0])));
    case 'users:delete':
      if (Number(args[0]) === 1) throw new Error('Cannot delete primary administrator');
      return ok(runData(db.prepare('DELETE FROM users WHERE id = ?').run(args[0])));
    case 'users:getStats':
      return ok(db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins, SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) AS managers, SUM(CASE WHEN role = 'sales' THEN 1 ELSE 0 END) AS sales, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM users").get());
    case 'db:backup':
      return ok({ mode: 'remote', message: 'The desktop now uses the remote server database; local SQLite backup is disabled.' });
    case 'system:reset': {
      const { userId: resetUserId, password } = args[0] || {};
      const userRow = db.prepare('SELECT password_hash, role FROM users WHERE id = ?').get(resetUserId);
      if (!userRow || userRow.role !== 'admin') throw new Error('Only admin can reset the system');
      if (!bcrypt.compareSync(password, userRow.password_hash)) throw new Error('Invalid password');
      return ok(db.transaction(() => {
        const tables = ['stock_transactions', 'sale_items', 'sales', 'purchase_items', 'purchases', 'payroll', 'production_batches', 'product_recipes', 'documents', 'expenses', 'products', 'stock', 'clients', 'client_categories', 'suppliers', 'employers'];
        for (const table of tables) db.prepare(`DELETE FROM ${table}`).run();
        return { message: 'System reset successfully' };
      })());
    }
    default:
      throw new Error(`Unsupported desktop IPC channel: ${channel}`);
  }
}

router.post('/ipc', (req, res) => {
  const channel = req.body?.channel;
  const args = Array.isArray(req.body?.args) ? req.body.args : [];
  if (!channel) {
    return res.status(400).json({ success: false, error: 'channel is required' });
  }

  try {
    return res.json(dispatch(channel, args, req.user));
  } catch (err) {
    console.error(`[desktop] ${channel} error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/product-image/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const id = fileName.startsWith('remote-') ? Number(fileName.slice(7)) : null;
    const row = id
      ? db.prepare('SELECT image_data FROM products WHERE id = ?').get(id)
      : db.prepare('SELECT image_data FROM products WHERE image_path = ?').get(fileName);
    if (!row || !row.image_data) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }
    return res.json({ success: true, data: row.image_data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
