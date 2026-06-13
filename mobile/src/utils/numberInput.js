const ARABIC_INDIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ARABIC_ZERO = '۰'.charCodeAt(0);

export const normalizeNumberInput = (value) => String(value ?? '')
  .trim()
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - EASTERN_ARABIC_ZERO))
  .replace(/\s+/g, '')
  .replace(/٬/g, '')
  .replace(/[٫,]/g, '.');

export const parseInputNumber = (value, fallback = 0) => {
  const normalized = normalizeNumberInput(value);
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return fallback;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
