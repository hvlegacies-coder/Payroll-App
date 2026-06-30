/**
 * Shared numeric utilities for the entire app.
 *
 * Every value coming from Supabase jsonb, Excel/CSV parsing, component
 * state, form inputs, or any other untrusted source MUST be wrapped in
 * `toNum` before being used in arithmetic. Never run plus, minus, times
 * or divide on a raw string, undefined, null, or unknown value.
 */

/**
 * Coerce any value to a finite number. Strips `$` and `,` first, returns
 * `0` for null/undefined/empty/NaN/non-finite. Use this everywhere before
 * arithmetic.
 */
export const toNum = (val: unknown): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const parsed = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Coerce to a money-rounded number (2 decimals). Apply at display and
 * storage boundaries — NEVER inside intermediate sums, or you accumulate
 * rounding error.
 */
export const toMoney = (val: unknown): number =>
  Math.round(toNum(val) * 100) / 100;

/** Back-compat alias — legacy code imports `parseNum`. */
export const parseNum = toNum;