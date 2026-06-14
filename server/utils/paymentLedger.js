const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function postCreationPaymentSumSql(saleAlias = 's') {
  return `COALESCE((
    SELECT SUM(cp.amount)
    FROM client_payments cp
    WHERE cp.sale_id = ${saleAlias}.id
      AND cp.batch_id IS NOT NULL
  ), 0)`;
}

function currentPaidExpr(saleAlias = 's') {
  return `(${saleAlias}.paid_amount + ${postCreationPaymentSumSql(saleAlias)})`;
}

function saleStatusExpr(saleAlias = 's') {
  const paid = currentPaidExpr(saleAlias);
  return `CASE
    WHEN ${saleAlias}.status = 'cancelled' THEN 'cancelled'
    WHEN ${saleAlias}.status = 'return' THEN 'return'
    WHEN ${paid} >= ${saleAlias}.total THEN 'paid'
    WHEN ${paid} > 0 THEN 'partial'
    ELSE 'pending'
  END`;
}

function effectiveClientPaymentWhere(paymentAlias = 'cp') {
  return `(${paymentAlias}.sale_id IS NULL OR ${paymentAlias}.batch_id IS NOT NULL)`;
}

function deriveStatus(total, paidAmount, previousStatus = null) {
  if (previousStatus === 'cancelled' || previousStatus === 'return') return previousStatus;
  const totalValue = money(total);
  const paidValue = money(paidAmount);
  if (paidValue <= 0) return 'pending';
  if (paidValue >= totalValue) return 'paid';
  return 'partial';
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowTime(row) {
  return Date.parse(toIsoTimestamp(row?.created_at || row?.date) || '') || 0;
}

function withIsoTimestamps(row) {
  return {
    ...row,
    created_at_iso: toIsoTimestamp(row.created_at || row.date),
    date_iso: toIsoTimestamp(row.date),
  };
}

module.exports = {
  money,
  postCreationPaymentSumSql,
  currentPaidExpr,
  saleStatusExpr,
  effectiveClientPaymentWhere,
  deriveStatus,
  toIsoTimestamp,
  rowTime,
  withIsoTimestamps,
};
