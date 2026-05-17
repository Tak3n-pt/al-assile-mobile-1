const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/categories  → all categories, alpha order
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name FROM product_categories ORDER BY name ASC
    `).all();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[categories] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load categories' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/categories   body: { name } | { names: [...] }
// `name`  → add a single category (idempotent — duplicate is treated as success)
// `names` → bulk seed (used to migrate the old localStorage entries on first launch)
// Returns the full current list so the client can replace its state in one shot.
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const { name, names } = req.body || {};

  const list = Array.isArray(names) ? names : (name ? [name] : []);
  const clean = list
    .map(n => String(n || '').trim())
    .filter(n => n.length > 0 && n.length <= 80);

  if (clean.length === 0) {
    return res.status(400).json({ success: false, error: 'name is required' });
  }

  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO product_categories (name) VALUES (?)');
    const txn  = db.transaction((items) => { for (const n of items) stmt.run(n); });
    txn(clean);

    const rows = db.prepare('SELECT id, name FROM product_categories ORDER BY name ASC').all();
    return res.status(201).json({ success: true, data: rows });
  } catch (err) {
    console.error('[categories] POST / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to add category' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/categories/:id   → remove a category by id
// Does NOT touch products that still reference its name; the products table
// stores `category` as free text and continues to work after deletion.
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid id' });
  }
  try {
    const info = db.prepare('DELETE FROM product_categories WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[categories] DELETE /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

module.exports = router;
