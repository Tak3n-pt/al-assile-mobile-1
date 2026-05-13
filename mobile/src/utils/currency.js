export const formatCurrency = (v) =>
  new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0) + ' DA';

export const formatCurrencyShort = (v) => {
  const num = v || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M DA';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k DA';
  return formatCurrency(num);
};

export const parseAmount = (str) => {
  if (!str) return 0;
  const stripped = String(str).replace(/[^\d.,]/g, '');
  const parts = stripped.split('.');
  const lastComma = stripped.lastIndexOf(',');
  const lastDot = stripped.lastIndexOf('.');
  let normalized;
  if (lastComma > lastDot) {
    // comma is decimal separator (e.g. "1.234,56" → "1234.56")
    normalized = stripped.replace(/\./g, '').replace(',', '.');
  } else {
    // dot is decimal separator or no decimal at all (e.g. "1,234.56" → "1234.56")
    normalized = stripped.replace(/,/g, '');
  }
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};
