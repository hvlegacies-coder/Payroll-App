// Pure payroll rules shared by the app and the AI assistant's server
// function (which can't load the browser Supabase client).

export const PREPARER_FEE = 10;

// Parse a funding-date cell into a YYYY-MM key. Handles MM/DD/YYYY, ISO strings,
// and Excel serial numbers. Returns '' if it can't be parsed.
export function fundingMonthKey(value: unknown): string {
  if (value == null || value === '') return '';
  // An Excel serial stored as text ("46076") would otherwise parse as year 46076.
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) value = parseFloat(value);
  if (typeof value === 'number' && isFinite(value)) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return '';
  }
  const s = String(value).trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return '';
}

/**
 * A preparer's fee for the week: $10 once they earned a share, and at Higher
 * View $10 per distinct funding-date month. Office Summary and the saved
 * earnings reports both charge this, so the two always agree.
 */
export function preparerFee(taxOffice: string, totalShare: number, fundingMonths: number): number {
  if (totalShare <= 0) return 0;
  return taxOffice === 'Higher View' ? PREPARER_FEE * Math.max(1, fundingMonths) : PREPARER_FEE;
}

/**
 * A funding-date cell as a calendar day (YYYYMMDD), or null. Ranges compare
 * days, never instants: an Excel date is midnight UTC, which is the previous
 * day in Chicago, so instant comparisons picked different rows per timezone.
 */
export function fundingDay(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n <= 20000 || n >= 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return y * 10000 + parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return parseInt(iso[1], 10) * 10000 + parseInt(iso[2], 10) * 100 + parseInt(iso[3], 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Filter for a week's funding-date range (inclusive), or null when the week
 * has no range. Rows without a readable funding date are excluded.
 */
export function makeFundingRangeFilter(from?: string | null, to?: string | null): ((value: unknown) => boolean) | null {
  if (!from && !to) return null;
  let lo = from ? fundingDay(from) : null;
  let hi = to ? fundingDay(to) : null;
  if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
  return (value) => {
    const day = fundingDay(value);
    return day !== null && (lo === null || day >= lo) && (hi === null || day <= hi);
  };
}
