const { buildLookupRouter } = require('./_lookupFactory');

module.exports = buildLookupRouter({ table: 'product_units', label: 'units' });
