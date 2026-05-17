const express = require('express');
const db      = require('../database/connection');

/**
 * Builds a tiny CRUD router for a name-keyed lookup table.
 *
 * Shared by /api/categories, /api/units, /api/higher-packages — they all have
 * the same shape (id, name UNIQUE) and the same client needs: list, add (with
 * INSERT OR IGNORE so the call is idempotent), bulk-seed, delete by id.
 */
function buildLookupRouter({ table, label }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT id, name FROM ${table} ORDER BY name ASC`).all();
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error(`[${label}] GET / error:`, err.message);
      return res.status(500).json({ success: false, error: `Failed to load ${label}` });
    }
  });

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
      const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`);
      const txn  = db.transaction((items) => { for (const n of items) stmt.run(n); });
      txn(clean);
      const rows = db.prepare(`SELECT id, name FROM ${table} ORDER BY name ASC`).all();
      return res.status(201).json({ success: true, data: rows });
    } catch (err) {
      console.error(`[${label}] POST / error:`, err.message);
      return res.status(500).json({ success: false, error: `Failed to add ${label}` });
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }
    try {
      const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      if (info.changes === 0) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error(`[${label}] DELETE /:id error:`, err.message);
      return res.status(500).json({ success: false, error: `Failed to delete ${label}` });
    }
  });

  return router;
}

module.exports = { buildLookupRouter };
