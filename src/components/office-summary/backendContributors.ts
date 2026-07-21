// Shared logic for determining which backend rows contribute to a given
// office scope's Backend Money tiles. Used by BackendFeeTable (for the
// tile distributions) and SourceRowsPanel (to surface the same row set
// with matching per-fee totals).

export type FeeType =
  | 'E-File Fee(s)'
  | 'E-File Downlines'
  | 'Service Bureau Fee'
  | 'ERO3Fee'
  | 'Transmitter Fee'
  | 'E-File-EFIN'
  | 'ERO3-EFIN';

export const FEE_TYPES: FeeType[] = [
  'E-File Fee(s)',
  'E-File Downlines',
  'Service Bureau Fee',
  'ERO3Fee',
  'Transmitter Fee',
  'E-File-EFIN',
  'ERO3-EFIN',
];

export const FEE_FIELD_KEY: Record<FeeType, string> = {
  'E-File Fee(s)': 'E-File Fee(s)',
  'E-File Downlines': 'E-File Fee(s)',
  'Service Bureau Fee': 'Service Bureau Fee',
  'ERO3Fee': 'ERO3Fee',
  'Transmitter Fee': 'Transmitter Fee',
  'E-File-EFIN': 'E-File Fee(s)',
  'ERO3-EFIN': 'ERO3Fee',
};

export const FEE_CONFIG_KEY: Record<
  FeeType,
  Exclude<FeeType, 'E-File-EFIN' | 'ERO3-EFIN' | 'E-File Downlines'>
> = {
  'E-File Fee(s)': 'E-File Fee(s)',
  'E-File Downlines': 'E-File Fee(s)',
  'Service Bureau Fee': 'Service Bureau Fee',
  'ERO3Fee': 'ERO3Fee',
  'Transmitter Fee': 'Transmitter Fee',
  'E-File-EFIN': 'E-File Fee(s)',
  'ERO3-EFIN': 'ERO3Fee',
};

export const EFIN_TILE_BY_OFFICE: Record<string, string> = {
  'D & D': '381268',
  'PowerPlay': '381623',
  'S & C': '381871',
};

export const EFIN_TILE_FALLBACK_BY_OFFICE: Record<string, string> = {
  'D & D': '387641',
};

export const TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW = new Set([
  'Higher View', 'PowerPlay', 'D & D', 'King J', 'KingJ', 'Main Event', 'S & C',
  'BC', 'Dior', 'DJN', 'Instant', 'Kenrel', 'LBN', 'Step-by-Step', 'VEO', 'Go Up Financials',
]);

export const SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES = new Set([
  'Higher View', 'King J', 'KingJ', 'Main Event', 'Boss Ladi', 'S & C', 'GG Services', 'Tax Nook',
]);

export const SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES = new Set([
  'BC', 'Dior', 'DJN', 'Instant', 'Kenrel', 'LBN', 'Step-by-Step', 'VEO',
]);

export const SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE = 59.05;

// Explicit per-PTIN office assignment that overrides EFIN/parent inference.
// Use when a preparer is listed under multiple offices but every backend row
// for that PTIN should be credited to one specific office regardless of the
// row's EFIN (e.g. P03251494 works under Kenrel even when filing under
// King J's EFIN).
export const PTIN_OFFICE_OVERRIDES: Record<string, string> = {
  'p03251494': 'Kenrel',
};

export const SERVICE_BUREAU_FEE_D_AND_D_WHITELIST = new Set([
  'Bright Meadow', 'D & D', 'Malone Method Tax Services', 'Premier Tax Software',
  'Prolific Legacy', 'Clarity Tax Group', 'S&D Tax Solutions', "R'Moni",
  'Savvy Tax Pros', 'SmartFile', 'Stellar Tax Co', 'Tygermatic Taxes',
  'Pink Connection', 'Big Payback', 'Tax Champions', 'Go Up Financials',
]);

export const SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST = new Set([
  'GMoad Taxes', 'JMJ', 'LNC', 'PowerPlay', 'Divine Dynasty', 'Brilliant Minds',
  'Dukes and Co.', 'Fast Cash Tax Service', 'Klarity Tax', 'Precise Taxes',
  'Tax Vault Solutions LLC', 'The Tax Doc LLC',
]);

export const EFILE_FEE_D_AND_D_WHITELIST = new Set([
  'D & D', 'Malone Method Tax Services', 'Premier Tax Software', 'Clarity Tax Group',
  'S&D Tax Solutions', "R'Moni", 'Savvy Tax Pros', 'SmartFile', 'Tygermatic Taxes',
  'Pink Connection', 'Big Payback', 'Go Up Financials',
]);

export const EFILE_DOWNLINES_D_AND_D_WHITELIST = new Set([
  'Bright Meadow', 'Prolific Legacy', 'Stellar Tax Co', 'Tax Champions',
]);

export const normalizeOfficeName = (s: string) =>
  (s || '').replace(/\s+/g, '').toLowerCase();

export interface FeeConfigEntry {
  target_office: string;
  mode: 'percentage' | 'flat_rate' | 'remaining';
  value: number;
}

// Shared safe-numeric coercion. See src/lib/num.ts.
import { toNum } from '@/lib/num';
export const parseNum = toNum;

export function getFieldValue(row: Record<string, any>, key: string): number {
  if (row[key] !== undefined) return parseNum(row[key]);
  const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === norm) return parseNum(row[k]);
  }
  return 0;
}

export function distributeFee(amount: number, entries: FeeConfigEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (!entries || entries.length === 0 || amount <= 0) return result;
  let remaining = amount;
  const remainingEntries: FeeConfigEntry[] = [];
  for (const e of entries) {
    if (e.mode === 'percentage') {
      const v = (amount * e.value) / 100;
      result[e.target_office] = (result[e.target_office] || 0) + v;
      remaining -= v;
    } else if (e.mode === 'flat_rate') {
      const v = Math.min(e.value, remaining);
      result[e.target_office] = (result[e.target_office] || 0) + v;
      remaining -= v;
    } else {
      remainingEntries.push(e);
    }
  }
  if (remainingEntries.length > 0 && remaining > 0) {
    const each = remaining / remainingEntries.length;
    for (const e of remainingEntries) {
      result[e.target_office] = (result[e.target_office] || 0) + each;
    }
  }
  return result;
}

export interface BackendLookups {
  ptinToOffices: Record<string, string[]>;
  efinToOffices: Record<string, string[]>;
  officeParent: Record<string, string>;
  officeOrder: string[];
}

export function buildBackendLookups(
  offices: Array<{ office_name: string; primary_efin?: string | null; secondary_efin?: string | null; parent_office?: string | null }>,
  preparers: Array<{ ptin: string | null; tax_office: string | null }>,
): BackendLookups {
  const ptinToOffices: Record<string, string[]> = {};
  for (const p of preparers || []) {
    if (p.ptin && p.tax_office) {
      const k = p.ptin.trim().toLowerCase();
      if (!ptinToOffices[k]) ptinToOffices[k] = [];
      if (!ptinToOffices[k].includes(p.tax_office)) ptinToOffices[k].push(p.tax_office);
    }
  }
  const efinToOffices: Record<string, string[]> = {};
  const officeParent: Record<string, string> = {};
  const officeOrder: string[] = [];
  for (const o of offices || []) {
    if (o.office_name) officeOrder.push(o.office_name);
    if (o.parent_office) officeParent[o.office_name] = o.parent_office;
    for (const efin of [o.primary_efin, o.secondary_efin]) {
      if (efin) {
        if (!efinToOffices[efin]) efinToOffices[efin] = [];
        if (!efinToOffices[efin].includes(o.office_name)) efinToOffices[efin].push(o.office_name);
      }
    }
  }
  return { ptinToOffices, efinToOffices, officeParent, officeOrder };
}

export function resolveTaxOffice(efin: string, ptin: string, lk: BackendLookups): string {
  const ptinKey = ptin.trim().toLowerCase();
  const override = PTIN_OFFICE_OVERRIDES[ptinKey];
  if (override) return override;
  const preparerOffices = lk.ptinToOffices[ptinKey];
  if (preparerOffices && preparerOffices.length === 1) return preparerOffices[0];
  if (preparerOffices && preparerOffices.length > 1) {
    const efinCands = lk.efinToOffices[efin] || [];
    const childOfAnother = preparerOffices.find(po => {
      const parent = lk.officeParent[po];
      return parent
        && preparerOffices.some(other => normalizeOfficeName(other) === normalizeOfficeName(parent))
        && efinCands.includes(po);
    });
    if (childOfAnother) return childOfAnother;
    for (const po of preparerOffices) {
      if (efinCands.includes(po) && lk.officeParent[po]) return po;
    }
    for (const po of preparerOffices) {
      if (efinCands.includes(po)) return po;
    }
    return preparerOffices[0];
  }
  const efinCands = lk.efinToOffices[efin] || [];
  if (efinCands.length === 0) return '';
  if (efinCands.length === 1) return efinCands[0];
  for (const c of efinCands) if (lk.officeParent[c]) return c;
  return efinCands[0];
}

export interface ContributionContext {
  officeScope: string;
  rollupOffices: Set<string>;
  configsBySource: Record<string, Record<FeeType, FeeConfigEntry[]>>;
  effectiveEfin: Set<string> | undefined; // for EFIN-filtered tiles (one or more EFINs)
}

export function buildRollupOffices(officeScope: string, officeParent: Record<string, string>): Set<string> {
  const scopeNorm = normalizeOfficeName(officeScope);
  const set = new Set<string>([officeScope]);
  for (const [child, parent] of Object.entries(officeParent)) {
    if (normalizeOfficeName(parent) === scopeNorm) set.add(child);
  }
  return set;
}

/**
 * For a single backend row whose resolved source office is `sourceOffice`,
 * compute the amount credited to `officeScope` per fee type. Returns zeros
 * across the board if the row contributes nothing — call sites can check
 * `contributes` to filter.
 */
export function getBackendRowContribution(
  row: Record<string, any>,
  sourceOffice: string,
  ctx: ContributionContext,
): { contributes: boolean; perFee: Record<FeeType, number> } {
  const { officeScope, rollupOffices, configsBySource, effectiveEfin } = ctx;
  const scopeNorm = normalizeOfficeName(officeScope);
  const perFee: Record<FeeType, number> = {
    'E-File Fee(s)': 0, 'E-File Downlines': 0, 'Service Bureau Fee': 0,
    'ERO3Fee': 0, 'Transmitter Fee': 0, 'E-File-EFIN': 0, 'ERO3-EFIN': 0,
  };
  let any = false;
  const rowEfin = String(row['EFIN'] ?? '').trim();

  for (const fee of FEE_TYPES) {
    const isEfinTile = fee === 'E-File-EFIN' || fee === 'ERO3-EFIN';
    if (isEfinTile) {
      if (!effectiveEfin || effectiveEfin.size === 0) continue;
      if (!effectiveEfin.has(rowEfin)) continue;
      const v = getFieldValue(row, FEE_FIELD_KEY[fee]);
      perFee[fee] = v;
      if (v) any = true;
      // EFIN-tile rows are credited even when amount is 0 (matches tile logic).
      any = true;
      continue;
    }
    // Transmitter Fee under Higher View
    if (fee === 'Transmitter Fee' && officeScope === 'Higher View') {
      if (!TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW.has(sourceOffice)) continue;
      const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
      const v = Math.max(0, amt - 10);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // Transmitter Fee under D & D
    if (fee === 'Transmitter Fee' && scopeNorm === normalizeOfficeName('D & D')) {
      if (!rollupOffices.has(sourceOffice)) continue;
      const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
      const v = Math.max(0, amt - 10);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // Service Bureau Fee under Higher View
    if (fee === 'Service Bureau Fee' && scopeNorm === normalizeOfficeName('Higher View')) {
      const isFull = SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES.has(sourceOffice);
      const isSplit = SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES.has(sourceOffice);
      if (!isFull && !isSplit) continue;
      const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
      const v = isSplit ? Math.max(0, amt - SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE) : amt;
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // Service Bureau Fee under D & D
    if (fee === 'Service Bureau Fee' && scopeNorm === normalizeOfficeName('D & D')) {
      if (!SERVICE_BUREAU_FEE_D_AND_D_WHITELIST.has(sourceOffice)) continue;
      const v = getFieldValue(row, FEE_FIELD_KEY[fee]);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // Service Bureau Fee under PowerPlay
    if (fee === 'Service Bureau Fee' && scopeNorm === normalizeOfficeName('PowerPlay')) {
      if (!SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST.has(sourceOffice)) continue;
      const v = getFieldValue(row, FEE_FIELD_KEY[fee]);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // E-File Fee(s) under D & D
    if (fee === 'E-File Fee(s)' && scopeNorm === normalizeOfficeName('D & D')) {
      if (!EFILE_FEE_D_AND_D_WHITELIST.has(sourceOffice)) continue;
      const v = getFieldValue(row, FEE_FIELD_KEY[fee]);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // E-File Downlines under D & D
    if (fee === 'E-File Downlines' && scopeNorm === normalizeOfficeName('D & D')) {
      if (!EFILE_DOWNLINES_D_AND_D_WHITELIST.has(sourceOffice)) continue;
      const v = getFieldValue(row, FEE_FIELD_KEY[fee]);
      perFee[fee] = v;
      if (v) any = true;
      continue;
    }
    // Default: routed via office_fee_configs
    const configKey = FEE_CONFIG_KEY[fee];
    const entries = configsBySource[sourceOffice]?.[configKey];
    if (!entries || entries.length === 0) continue;
    let amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
    if (!amt) continue;
    if (fee === 'Transmitter Fee') {
      amt = Math.max(0, amt - 10);
      if (!amt) continue;
    }
    const dist = distributeFee(amt, entries);
    let credited = 0;
    for (const [targetOffice, v] of Object.entries(dist)) {
      if (normalizeOfficeName(targetOffice) === scopeNorm) credited += v;
    }
    if (credited !== 0) {
      perFee[fee] = credited;
      any = true;
    }
  }

  return { contributes: any, perFee };
}

export function computeEffectiveEfin(
  officeScope: string,
  rowsBySource: Record<string, Record<string, any>[]>,
): Set<string> | undefined {
  const efinFilter = EFIN_TILE_BY_OFFICE[officeScope];
  if (!efinFilter) return undefined;
  const fallback = EFIN_TILE_FALLBACK_BY_OFFICE[officeScope];
  // Include BOTH the primary and the fallback EFIN so rows from either
  // contribute to the EFIN-filtered tiles (e.g. D&D 381268 + 387641).
  const set = new Set<string>([efinFilter]);
  if (fallback) set.add(fallback);
  return set;
}