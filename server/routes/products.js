const express = require('express');
const db      = require('../database/connection');

const router = express.Router();

/**
 * GET /api/products
 * Returns all active products ordered by is_favorite DESC, then name.
 * image_data is excluded from the list to keep payloads small.
 * A boolean has_image flag indicates whether an image is available for
 * individual fetch via GET /api/products/:id/image.
 */
router.get('/', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        id,
        name,
        description,
        selling_price,
        COALESCE(selling_price2, 0) AS selling_price2,
        COALESCE(selling_price3, 0) AS selling_price3,
        purchase_price,
        unit,
        barcode,
        is_favorite,
        is_active,
        quantity,
        min_stock_alert,
        is_resale,
        category,
        expiry_date,
        tax_rate,
        unit_package,
        higher_package,
        box_color,
        created_at,
        updated_at,
        CASE WHEN image_data IS NOT NULL AND image_data != '' THEN 1 ELSE 0 END AS has_image
      FROM products
      WHERE is_active = 1
      ORDER BY is_favorite DESC, name ASC
    `).all();

    return res.json({ success: true, data: products });
  } catch (err) {
    console.error('[products] GET / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/barcode/:barcode
 * Quick lookup used by the mobile barcode scanner.
 * Returns the full product row (still without image_data).
 */
router.get('/barcode/:barcode', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT
        id, name, description, selling_price,
        COALESCE(selling_price2, 0) AS selling_price2,
        COALESCE(selling_price3, 0) AS selling_price3,
        purchase_price,
        unit, barcode, is_favorite, is_active, quantity,
        min_stock_alert, is_resale, category,
        expiry_date, tax_rate, unit_package, higher_package, box_color,
        created_at, updated_at,
        CASE WHEN image_data IS NOT NULL AND image_data != '' THEN 1 ELSE 0 END AS has_image
      FROM products
      WHERE barcode = ? AND is_active = 1
    `).get(req.params.barcode);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    return res.json({ success: true, data: product });
  } catch (err) {
    console.error('[products] GET /barcode/:barcode error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

/**
 * GET /api/products/:id/image
 * Returns only the base64 image string for a single product.
 * Separated from the list endpoint to avoid sending megabytes of image
 * data when the mobile app fetches the product catalogue.
 */
router.get('/:id/image', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid product id' });
  }

  try {
    const row = db.prepare(`
      SELECT image_data FROM products WHERE id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (!row.image_data) {
      return res.status(404).json({ success: false, error: 'No image for this product' });
    }

    return res.json({ success: true, data: row.image_data });
  } catch (err) {
    console.error('[products] GET /:id/image error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch image' });
  }
});

/**
 * POST /api/products/:id/image
 * Stores/replaces a product image as a data URL/base64 string.
 * Body: { image_data: string, image_path?: string }
 */
router.post('/:id/image', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid product id' });
  }

  const imageData = req.body?.image_data || null;
  const imagePath = req.body?.image_path || (imageData ? `remote-${id}` : null);

  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const cols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
    if (!cols.includes('image_path')) {
      db.exec('ALTER TABLE products ADD COLUMN image_path TEXT');
    }

    db.prepare(`
      UPDATE products
      SET image_data = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(imageData, imageData ? imagePath : null, id);

    return res.json({ success: true, data: { id, image_path: imageData ? imagePath : null } });
  } catch (err) {
    console.error('[products] POST /:id/image error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to save image' });
  }
});

const PRODUCT_SELECT = `
  SELECT id, name, description, selling_price,
         COALESCE(selling_price2, 0) AS selling_price2,
         COALESCE(selling_price3, 0) AS selling_price3,
         purchase_price,
         unit, barcode, is_favorite, is_active, quantity,
         min_stock_alert, is_resale, category,
         expiry_date, tax_rate, unit_package, higher_package, box_color,
         created_at, updated_at,
         CASE WHEN image_data IS NOT NULL AND image_data != '' THEN 1 ELSE 0 END AS has_image
  FROM products WHERE id = ?
`;

/**
 * GET /api/products/:id
 * Single product by id.
 */
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid product id' });
  }
  try {
    const product = db.prepare(PRODUCT_SELECT).get(id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    return res.json({ success: true, data: product });
  } catch (err) {
    console.error('[products] GET /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

/**
 * POST /api/products
 * Create a new product from the mobile app.
 */
router.post('/', (req, res) => {
  const {
    name, description, selling_price, selling_price2, selling_price3, purchase_price,
    unit, barcode, category, is_favorite, quantity, min_stock_alert,
    expiry_date, tax_rate, unit_package, higher_package, box_color, image_data,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Product name is required' });
  }

  try {
    const createProduct = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO products (
          name, description, selling_price, selling_price2, selling_price3, purchase_price,
          unit, barcode, category, is_favorite,
          quantity, min_stock_alert,
          expiry_date, tax_rate, unit_package, higher_package, box_color, image_data,
          is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(
        String(name).trim(),
        description || null,
        parseFloat(selling_price) || 0,
        parseFloat(selling_price2) || 0,
        parseFloat(selling_price3) || 0,
        parseFloat(purchase_price) || 0,
        unit || 'pcs',
        barcode || null,
        category || null,
        is_favorite ? 1 : 0,
        parseFloat(quantity) || 0,
        parseFloat(min_stock_alert) || 0,
        expiry_date || null,
        parseFloat(tax_rate) || 0,
        parseFloat(unit_package) || 0,
        higher_package || null,
        box_color || null,
        image_data || null
      );

      // Product creation on the website must flow back to the desktop on the
      // next sync pull. Keep this in the same transaction as the product row.
      db.prepare(`
        INSERT INTO sync_log (entity_type, entity_id, action, synced)
        VALUES ('product', ?, 'create', 0)
      `).run(result.lastInsertRowid);

      return result.lastInsertRowid;
    });

    const productId = createProduct();
    const product = db.prepare(PRODUCT_SELECT).get(productId);
    return res.json({ success: true, data: product });
  } catch (err) {
    console.error('[products] POST / error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

/**
 * PATCH /api/products/:id
 * Update product fields (price, name, category, etc.).
 * Only fields present in the request body are updated.
 */
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid product id' });
  }

  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const b = req.body || {};
    const v = {
      name:             b.name             !== undefined ? String(b.name).trim()              : existing.name,
      description:      b.description      !== undefined ? b.description                       : existing.description,
      selling_price:    b.selling_price    !== undefined ? parseFloat(b.selling_price)   || 0  : existing.selling_price,
      selling_price2:   b.selling_price2   !== undefined ? parseFloat(b.selling_price2)  || 0  : (existing.selling_price2 || 0),
      selling_price3:   b.selling_price3   !== undefined ? parseFloat(b.selling_price3)  || 0  : (existing.selling_price3 || 0),
      purchase_price:   b.purchase_price   !== undefined ? parseFloat(b.purchase_price)  || 0  : existing.purchase_price,
      unit:             b.unit             !== undefined ? b.unit                                : existing.unit,
      barcode:          b.barcode          !== undefined ? b.barcode                             : existing.barcode,
      category:         b.category         !== undefined ? b.category                            : existing.category,
      is_favorite:      b.is_favorite      !== undefined ? (b.is_favorite ? 1 : 0)              : existing.is_favorite,
      quantity:         b.quantity         !== undefined ? parseFloat(b.quantity)         || 0  : existing.quantity,
      min_stock_alert:  b.min_stock_alert  !== undefined ? parseFloat(b.min_stock_alert)  || 0  : existing.min_stock_alert,
      expiry_date:      b.expiry_date      !== undefined ? (b.expiry_date || null)               : (existing.expiry_date || null),
      tax_rate:         b.tax_rate         !== undefined ? parseFloat(b.tax_rate)         || 0  : (existing.tax_rate || 0),
      unit_package:     b.unit_package     !== undefined ? parseFloat(b.unit_package)     || 0  : (existing.unit_package || 0),
      higher_package:   b.higher_package   !== undefined ? (b.higher_package || null)            : (existing.higher_package || null),
      box_color:        b.box_color        !== undefined ? (b.box_color || null)                 : (existing.box_color || null),
      image_data:       b.image_data       !== undefined ? (b.image_data || null)                : existing.image_data,
    };

    db.transaction(() => {
      db.prepare(`
        UPDATE products SET
          name = ?, description = ?, selling_price = ?, selling_price2 = ?, selling_price3 = ?,
          purchase_price = ?, unit = ?, barcode = ?, category = ?, is_favorite = ?,
          quantity = ?, min_stock_alert = ?,
          expiry_date = ?, tax_rate = ?, unit_package = ?, higher_package = ?, box_color = ?,
          image_data = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        v.name, v.description, v.selling_price, v.selling_price2, v.selling_price3,
        v.purchase_price, v.unit, v.barcode, v.category, v.is_favorite,
        v.quantity, v.min_stock_alert,
        v.expiry_date, v.tax_rate, v.unit_package, v.higher_package, v.box_color,
        v.image_data,
        id
      );

      // Log mutation so the desktop pull can propagate the change back.
      db.prepare(`
        INSERT INTO sync_log (entity_type, entity_id, action, synced)
        VALUES ('product', ?, 'update', 0)
      `).run(id);
    })();

    const updated = db.prepare(PRODUCT_SELECT).get(id);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[products] PATCH /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 * Soft-delete: flips is_active to 0 so existing sale_items / purchase_items
 * keep their foreign key reference. The product disappears from the
 * `is_active = 1` list query but historical data stays intact.
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid product id' });
  }
  try {
    const softDelete = db.transaction(() => {
      const info = db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      if (info.changes === 0) return false;

      // Log mutation so desktop pull picks up the soft-delete (is_active=0).
      db.prepare(`
        INSERT INTO sync_log (entity_type, entity_id, action, synced)
        VALUES ('product', ?, 'update', 0)
      `).run(id);
      return true;
    });
    if (!softDelete()) return res.status(404).json({ success: false, error: 'Product not found' });

    return res.json({ success: true });
  } catch (err) {
    console.error('[products] DELETE /:id error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

module.exports = router;
