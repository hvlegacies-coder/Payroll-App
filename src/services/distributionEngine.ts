import { BucketRow, PreparerLookup, ALL_OFFICES } from './types';

export function distributeBucketRows(rows: BucketRow[]): Map<string, BucketRow[]> {
  const officeMap = new Map<string, BucketRow[]>();
  ALL_OFFICES.forEach(office => officeMap.set(office, []));
  rows.forEach(row => {
    if (!row.tax_office) return;
    const existing = officeMap.get(row.tax_office) || [];
    existing.push(row);
    officeMap.set(row.tax_office, existing);
  });
  officeMap.forEach((officeRows, office) => {
    officeRows.sort((a, b) => {
      const taxCmp = a.tax_office.localeCompare(b.tax_office);
      if (taxCmp !== 0) return taxCmp;
      return a.preparer.localeCompare(b.preparer);
    });
    officeMap.set(office, officeRows);
  });
  return officeMap;
}

const OFFICE_COLORS: Record<string, string> = {
  'Higher View': '217 91% 53%',
  'PowerPlay': '142 72% 37%',
  'D & D': '38 92% 50%',
  'Main Event': '262 83% 58%',
  'S & C': '0 72% 50%',
  'King J': '220 26% 10%',
  'VEO': '195 84% 42%',
  'Step-by-Step': '32 95% 44%',
  'LBN': '280 68% 50%',
  'Kenrel': '152 69% 31%',
  'Instant': '340 82% 52%',
  'DJN': '206 92% 44%',
  'Dior': '262 47% 50%',
  'BC': '24 100% 46%',
  'Go Up Financials': '168 76% 36%',
};

export function getOfficeColor(office: string): string {
  return OFFICE_COLORS[office] || '220 20% 50%';
}

export function filterByAllowedEfins(rows: BucketRow[], lookups: PreparerLookup[], allowedOffices: string[]): BucketRow[] {
  const allowedEfins = new Set<string>();
  lookups.forEach(l => {
    if (allowedOffices.includes(l.tax_office)) {
      allowedEfins.add(l.efin);
      if (l.efin2) allowedEfins.add(l.efin2);
    }
  });
  return rows.filter(r => allowedEfins.has(r.efin));
}
