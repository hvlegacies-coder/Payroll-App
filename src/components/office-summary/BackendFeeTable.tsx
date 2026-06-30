import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { Loader2 } from 'lucide-react';
import { cn, formatMoney as fmt } from '@/lib/utils';
import { SourceTotalBadge } from './SourceTotalBadge';

type FeeType = 'E-File Fee(s)' | 'E-File Downlines' | 'Service Bureau Fee' | 'ERO3Fee' | 'Transmitter Fee' | 'E-File-EFIN' | 'ERO3-EFIN';

// Same parser used by SourceRowsPanel so date scoping is identical.
function parseFundingDateStr(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }
  const s = String(v);
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 20000 && n < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    }
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const FEE_TYPES: FeeType[] = ['E-File Fee(s)', 'E-File Downlines', 'Service Bureau Fee', 'ERO3Fee', 'Transmitter Fee', 'E-File-EFIN', 'ERO3-EFIN'];

// Underlying field source for each tile (E-File-EFIN reuses the E-File field but filters by EFIN)
const FEE_FIELD_KEY: Record<FeeType, string> = {
  'E-File Fee(s)': 'E-File Fee(s)',
  'E-File Downlines': 'E-File Fee(s)',
  'Service Bureau Fee': 'Service Bureau Fee',
  'ERO3Fee': 'ERO3Fee',
  'Transmitter Fee': 'Transmitter Fee',
  'E-File-EFIN': 'E-File Fee(s)',
  'ERO3-EFIN': 'ERO3Fee',
};

// Which fee config a tile uses for routing (E-File-EFIN routes via E-File config)
const FEE_CONFIG_KEY: Record<FeeType, Exclude<FeeType, 'E-File-EFIN' | 'ERO3-EFIN' | 'E-File Downlines'>> = {
  'E-File Fee(s)': 'E-File Fee(s)',
  'E-File Downlines': 'E-File Fee(s)',
  'Service Bureau Fee': 'Service Bureau Fee',
  'ERO3Fee': 'ERO3Fee',
  'Transmitter Fee': 'Transmitter Fee',
  'E-File-EFIN': 'E-File Fee(s)',
  'ERO3-EFIN': 'ERO3Fee',
};

// Office scopes that should see the special EFIN-filtered tile, mapped to the EFIN to filter on
const EFIN_TILE_BY_OFFICE: Record<string, string> = {
  'D & D': '381268',
  'PowerPlay': '381623',
  'S & C': '385634',
};

// Fallback EFIN used by the EFIN-filtered tiles when the primary EFIN has zero
// matching backend rows. Mirrors fieldRegistry.EFIN_VIRTUAL_FIELDS.fallbackEfin.
const EFIN_TILE_FALLBACK_BY_OFFICE: Record<string, string> = {
  'D & D': '387641',
};

const HEADER_COLOR: Record<FeeType, string> = {
  'Transmitter Fee': 'hsl(0 0% 80%)',
  'Service Bureau Fee': 'hsl(142 50% 75%)',
  'ERO3Fee': 'hsl(45 90% 75%)',
  'E-File Fee(s)': 'hsl(217 70% 80%)',
  'E-File Downlines': 'hsl(190 70% 80%)',
  'E-File-EFIN': 'hsl(280 60% 80%)',
  'ERO3-EFIN': 'hsl(330 60% 80%)',
};

// Service Bureau offices under Higher View — only these contribute to the
// Transmitter Fee tile when the Higher View office summary is being viewed.
const TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW = new Set([
  'Higher View','PowerPlay','D & D','King J','KingJ','Main Event','S & C',
  'BC','Dior','DJN','Instant','Kenrel','LBN','Step-by-Step','VEO','Go Up Financials',
]);

// Service Bureau Fee under Higher View is a fixed backend-source rollup.
// Split offices send $59.05 per row elsewhere; Higher View receives the remainder.
const SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES = new Set([
  'Higher View','King J','KingJ','Main Event','Boss Ladi','S & C','GG Services','Tax Nook',
]);
const SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES = new Set([
  'BC','Dior','DJN','Instant','Kenrel','LBN','Step-by-Step','VEO',
]);
const SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE = 59.05;

// Hard PTIN→office overrides. Wins over EFIN/parent inference.
const PTIN_OFFICE_OVERRIDES: Record<string, string> = {
  'p03251494': 'Kenrel',
};

// Service Bureau Fee offices that should appear in the D&D office summary.
const SERVICE_BUREAU_FEE_D_AND_D_WHITELIST = new Set([
  'Bright Meadow',
  'D & D',
  'Malone Method Tax Services',
  'Premier Tax Software',
  'Prolific Legacy',
  'Clarity Tax Group',
  "S&D Tax Solutions",
  "R'Moni",
  'Savvy Tax Pros',
  'SmartFile',
  'Stellar Tax Co',
  'Tygermatic Taxes',
  'Pink Connection',
  'Big Payback',
  'Tax Champions',
  'Go Up Financials',
]);

// Service Bureau Fee offices that should appear in the PowerPlay office summary.
const SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST = new Set([
  'GMoad Taxes',
  'JMJ',
  'LNC',
  'PowerPlay',
  'Divine Dynasty',
  'Brilliant Minds',
  'Dukes and Co.',
  'Fast Cash Tax Service',
  'Klarity Tax',
  'Precise Taxes',
  'Tax Vault Solutions LLC',
  'The Tax Doc LLC',
]);

// E-File Fee tile under D&D — only these offices contribute (subset of the
// service-bureau whitelist; the four downline offices below are split into
// the dedicated "E-File Downlines" tile instead).
const EFILE_FEE_D_AND_D_WHITELIST = new Set([
  'D & D',
  'Malone Method Tax Services',
  'Premier Tax Software',
  'Clarity Tax Group',
  'S&D Tax Solutions',
  "R'Moni",
  'Savvy Tax Pros',
  'SmartFile',
  'Tygermatic Taxes',
  'Pink Connection',
  'Big Payback',
  'Go Up Financials',
]);

// E-File Downlines tile under D&D — raw sum from these four downline offices.
const EFILE_DOWNLINES_D_AND_D_WHITELIST = new Set([
  'Bright Meadow',
  'Prolific Legacy',
  'Stellar Tax Co',
  'Tax Champions',
]);

// Normalize office names for loose comparison (e.g. "D & D" === "D&D").
const normalizeOfficeName = (s: string) => s.replace(/\s+/g, '').toLowerCase();

interface FeeConfigEntry {
  target_office: string;
  mode: 'percentage' | 'flat_rate' | 'remaining';
  value: number;
}

interface Props {
  officeScope: string; // current office viewing the summary
  onTotalsChange?: (totals: Record<FeeType, number>) => void;
  hiddenFeeTypes?: string[];
  onHideFee?: (feeType: string) => void;
  onExportData?: (tiles: { feeType: string; rows: { office: string; amount: number }[]; total: number }[]) => void;
}

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[$,]/g, '')) || 0;
}

function getFieldValue(row: Record<string, any>, key: string): number {
  if (row[key] !== undefined) return parseNum(row[key]);
  const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === norm) return parseNum(row[k]);
  }
  return 0;
}

/** Distribute a single fee amount across target offices. */
function distributeFee(amount: number, entries: FeeConfigEntry[]): Record<string, number> {
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

export function BackendFeeTable({ officeScope, onTotalsChange, hiddenFeeTypes = [], onHideFee, onExportData }: Props) {
  const { selectedWeek, selectedWeekRange } = useActiveWeek();
  const [loading, setLoading] = useState(true);
  // configsBySource[sourceOffice][feeType] = entries
  const [configsBySource, setConfigsBySource] = useState<Record<string, Record<FeeType, FeeConfigEntry[]>>>({});
  // Map: sourceOffice -> array of backend rows belonging to that office
  const [rowsBySource, setRowsBySource] = useState<Record<string, Record<string, any>[]>>({});
  // Ordered list of all known offices (for stable display order)
  const [officeOrder, setOfficeOrder] = useState<string[]>([]);
  // Map: office_name -> parent_office (for rollup logic)
  const [officeParents, setOfficeParents] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Load ALL fee configs (we need every office's config)
      const { data: configRows } = await supabase
        .from('office_fee_configs')
        .select('*');

      const allConfigs: Record<string, Record<FeeType, FeeConfigEntry[]>> = {};
      if (configRows) {
        for (const r of configRows) {
          const ft = r.fee_type as FeeType;
          if (!FEE_TYPES.includes(ft)) continue;
          if (!allConfigs[r.office_name]) {
            allConfigs[r.office_name] = {
              'E-File Fee(s)': [], 'E-File Downlines': [], 'Service Bureau Fee': [], 'ERO3Fee': [], 'Transmitter Fee': [], 'E-File-EFIN': [], 'ERO3-EFIN': [],
            };
          }
          allConfigs[r.office_name][ft].push({
            target_office: r.target_office,
            mode: r.mode as any,
            value: Number(r.value),
          });
        }
      }

      // Load uploads + offices + preparers
      const [{ data: uploads }, { data: offices }, { data: preparersData }] = await Promise.all([
        supabase.from('uploads').select('id').eq('type', 'Backend Money Report').eq('week_label', selectedWeek),
        supabase.from('offices').select('office_name, primary_efin, secondary_efin, parent_office').order('office_name'),
        supabase.from('preparers').select('ptin, tax_office'),
      ]);

      const orderedOffices = (offices || []).map((o: any) => o.office_name).filter(Boolean);

      // Build parent map early so it's available for early-return path too.
      const officeParentEarly: Record<string, string> = {};
      if (offices) {
        for (const o of offices) {
          if (o.parent_office) officeParentEarly[o.office_name] = o.parent_office;
        }
      }

      if (!uploads || uploads.length === 0) {
        if (!cancelled) {
          setConfigsBySource(allConfigs);
          setRowsBySource({});
          setOfficeOrder(orderedOffices);
          setOfficeParents(officeParentEarly);
          setLoading(false);
        }
        return;
      }

      const uploadIds = uploads.map(u => u.id);
      let allRows: any[] = [];
      for (let i = 0; i < uploadIds.length; i += 10) {
        const batch = uploadIds.slice(i, i + 10);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('upload_rows')
            .select('row_data')
            .in('upload_id', batch)
            .range(from, from + 999);
          if (error) break;
          if (data) allRows.push(...data);
          if (!data || data.length < 1000) break;
          from += 1000;
        }
      }

      // Apply Funding Date range filter so tile totals align with the
      // Source Rows panel footer (which scopes by the same range).
      if (selectedWeekRange && (selectedWeekRange.from || selectedWeekRange.to)) {
        let lo = selectedWeekRange.from ? parseFundingDateStr(selectedWeekRange.from) : null;
        let hi = selectedWeekRange.to ? parseFundingDateStr(selectedWeekRange.to) : null;
        if (lo && hi && lo.getTime() > hi.getTime()) { const t = lo; lo = hi; hi = t; }
        if (lo) lo.setHours(0, 0, 0, 0);
        if (hi) hi.setHours(23, 59, 59, 999);
        allRows = allRows.filter(r => {
          const data = (typeof r.row_data === 'object' && r.row_data) ? r.row_data as Record<string, any> : {};
          const fd = parseFundingDateStr(data['Funding Date']);
          if (!fd) return false;
          if (lo && fd.getTime() < lo.getTime()) return false;
          if (hi && fd.getTime() > hi.getTime()) return false;
          return true;
        });
      }

      // Build PTIN/EFIN -> office lookups
      const ptinToOffices: Record<string, string[]> = {};
      if (preparersData) {
        for (const p of preparersData) {
          if (p.ptin && p.tax_office) {
            const k = p.ptin.trim().toLowerCase();
            if (!ptinToOffices[k]) ptinToOffices[k] = [];
            if (!ptinToOffices[k].includes(p.tax_office)) ptinToOffices[k].push(p.tax_office);
          }
        }
      }
      const efinToOffices: Record<string, string[]> = {};
      const officeParent: Record<string, string> = {};
      if (offices) {
        for (const o of offices) {
          if (o.parent_office) officeParent[o.office_name] = o.parent_office;
          for (const efin of [o.primary_efin, o.secondary_efin]) {
            if (efin) {
              if (!efinToOffices[efin]) efinToOffices[efin] = [];
              if (!efinToOffices[efin].includes(o.office_name)) efinToOffices[efin].push(o.office_name);
            }
          }
        }
      }

      const resolveTaxOffice = (efin: string, ptin: string): string => {
        const ptinKey = ptin.trim().toLowerCase();
        const override = PTIN_OFFICE_OVERRIDES[ptinKey];
        if (override) return override;
        const preparerOffices = ptinToOffices[ptinKey];
        if (preparerOffices && preparerOffices.length === 1) return preparerOffices[0];
        if (preparerOffices && preparerOffices.length > 1) {
          const efinCands = efinToOffices[efin] || [];
          // If one candidate's parent_office is another candidate AND the
          // child's EFIN matches the row EFIN, prefer the deeper child
          // (e.g. Kenrel/King J shared PTIN with Kenrel's EFIN → Kenrel).
          const childOfAnother = preparerOffices.find(po => {
            const parent = officeParent[po];
            return parent
              && preparerOffices.some(other => normalizeOfficeName(other) === normalizeOfficeName(parent))
              && efinCands.includes(po);
          });
          if (childOfAnother) return childOfAnother;
          for (const po of preparerOffices) {
            if (efinCands.includes(po) && officeParent[po]) return po;
          }
          for (const po of preparerOffices) {
            if (efinCands.includes(po)) return po;
          }
          return preparerOffices[0];
        }
        const efinCands = efinToOffices[efin] || [];
        if (efinCands.length === 0) return '';
        if (efinCands.length === 1) return efinCands[0];
        for (const c of efinCands) if (officeParent[c]) return c;
        return efinCands[0];
      };

      // Group rows by source (Tax Office)
      const grouped: Record<string, Record<string, any>[]> = {};
      for (const r of allRows) {
        const data = (typeof r.row_data === 'object' && r.row_data) ? r.row_data as Record<string, any> : {};
        const efin = String(data['EFIN'] ?? '').trim();
        const ptin = String(data['PTIN'] ?? '').trim();
        const src = resolveTaxOffice(efin, ptin);
        if (!src) continue;
        if (!grouped[src]) grouped[src] = [];
        grouped[src].push(data);
      }

      if (!cancelled) {
        setConfigsBySource(allConfigs);
        setRowsBySource(grouped);
        setOfficeOrder(orderedOffices);
        setOfficeParents(officeParent);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [officeScope, selectedWeek, selectedWeekRange?.from, selectedWeekRange?.to]);

  // For each fee type: compute the amount each SOURCE office contributes TO officeScope.
  const distributions = useMemo(() => {
    const out: Record<FeeType, Record<string, number>> = {
      'E-File Fee(s)': {}, 'E-File Downlines': {}, 'Service Bureau Fee': {}, 'ERO3Fee': {}, 'Transmitter Fee': {}, 'E-File-EFIN': {}, 'ERO3-EFIN': {},
    };
    const efinFilter = EFIN_TILE_BY_OFFICE[officeScope]; // EFIN to filter on for the special tile
    const efinFallback = EFIN_TILE_FALLBACK_BY_OFFICE[officeScope];
    // Build the set of source offices that "roll up" to officeScope (the scope
    // itself plus any office whose parent_office matches it, normalized).
    const scopeNorm = normalizeOfficeName(officeScope);
    const rollupOffices = new Set<string>();
    rollupOffices.add(officeScope);
    for (const [child, parent] of Object.entries(officeParents)) {
      if (normalizeOfficeName(parent) === scopeNorm) rollupOffices.add(child);
    }
    for (const fee of FEE_TYPES) {
      const isEfinTile = fee === 'E-File-EFIN' || fee === 'ERO3-EFIN';
      // Skip the EFIN-filtered tiles entirely for offices that don't use them
      if (isEfinTile && !efinFilter) continue;
      // Service Bureau Fee under Higher View: seed every FULL/SPLIT office
      // with $0 so offices that have no backend rows (e.g. Boss Ladi,
      // GG Services) still render in the tile.
      if (fee === 'Service Bureau Fee' && normalizeOfficeName(officeScope) === normalizeOfficeName('Higher View')) {
        for (const o of SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES) out[fee][o] = 0;
        for (const o of SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES) out[fee][o] = 0;
      }
      // Special tile: raw sum of source field where row EFIN matches, grouped by source office.
      // No routing/config required — every dollar attributable to this EFIN counts.
      if (isEfinTile) {
        // Include BOTH the primary EFIN and the fallback EFIN so rows from
        // either contribute to this tile (e.g. D&D 381268 + 387641).
        const efinSet = new Set<string>([efinFilter]);
        if (efinFallback) efinSet.add(efinFallback);
        for (const [sourceOffice, rows] of Object.entries(rowsBySource)) {
          let credited = 0;
          for (const row of rows) {
            const rowEfin = String(row['EFIN'] ?? '').trim();
            if (!efinSet.has(rowEfin)) continue;
            credited += getFieldValue(row, FEE_FIELD_KEY[fee]);
          }
          // Always include source offices that have rows matching the EFIN, even when total is 0
          const hasMatchingRow = rows.some(r => efinSet.has(String(r['EFIN'] ?? '').trim()));
          if (hasMatchingRow) out[fee][sourceOffice] = credited;
        }
        continue;
      }
      const configKey = FEE_CONFIG_KEY[fee];
      for (const [sourceOffice, rows] of Object.entries(rowsBySource)) {
        // Transmitter Fee under Higher View: raw sum from whitelisted offices only,
        // no routing/config required.
        if (fee === 'Transmitter Fee' && officeScope === 'Higher View') {
          if (!TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
            credited += Math.max(0, amt - 10);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // Transmitter Fee under D&D: raw sum from D&D itself plus any offices
        // that roll up to D&D (parent_office === D&D), no routing/config.
        if (fee === 'Transmitter Fee' && normalizeOfficeName(officeScope) === normalizeOfficeName('D & D')) {
          if (!rollupOffices.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
            credited += Math.max(0, amt - 10);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // Service Bureau Fee under Higher View: locked to backend source rows so
        // refreshes or edits to other summary tables do not change these totals.
        if (fee === 'Service Bureau Fee' && normalizeOfficeName(officeScope) === normalizeOfficeName('Higher View')) {
          const isFull = SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES.has(sourceOffice);
          const isSplit = SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES.has(sourceOffice);
          if (!isFull && !isSplit) continue;
          let credited = 0;
          for (const row of rows) {
            const amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
            credited += isSplit ? Math.max(0, amt - SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE) : amt;
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // Service Bureau Fee under D&D: raw sum from whitelisted offices only,
        // no routing/config required.
        if (fee === 'Service Bureau Fee' && normalizeOfficeName(officeScope) === normalizeOfficeName('D & D')) {
          if (!SERVICE_BUREAU_FEE_D_AND_D_WHITELIST.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            credited += getFieldValue(row, FEE_FIELD_KEY[fee]);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // Service Bureau Fee under PowerPlay: raw sum from whitelisted offices only.
        if (fee === 'Service Bureau Fee' && normalizeOfficeName(officeScope) === normalizeOfficeName('PowerPlay')) {
          if (!SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            credited += getFieldValue(row, FEE_FIELD_KEY[fee]);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // E-File Fee(s) under D&D: raw sum from the same whitelisted offices,
        // no routing/config required.
        if (fee === 'E-File Fee(s)' && normalizeOfficeName(officeScope) === normalizeOfficeName('D & D')) {
          if (!EFILE_FEE_D_AND_D_WHITELIST.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            credited += getFieldValue(row, FEE_FIELD_KEY[fee]);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        // E-File Downlines under D&D: raw sum from the four downline offices.
        if (fee === 'E-File Downlines' && normalizeOfficeName(officeScope) === normalizeOfficeName('D & D')) {
          if (!EFILE_DOWNLINES_D_AND_D_WHITELIST.has(sourceOffice)) continue;
          let credited = 0;
          for (const row of rows) {
            credited += getFieldValue(row, FEE_FIELD_KEY[fee]);
          }
          out[fee][sourceOffice] = credited;
          continue;
        }
        const entries = configsBySource[sourceOffice]?.[configKey];
        if (!entries || entries.length === 0) continue;
        let credited = 0;
        for (const row of rows) {
          let amt = getFieldValue(row, FEE_FIELD_KEY[fee]);
          if (!amt) continue;
          // Transmitter Fee: Higher View only receives the portion above $10 per row.
          if (fee === 'Transmitter Fee') {
            amt = Math.max(0, amt - 10);
            if (!amt) continue;
          }
          const dist = distributeFee(amt, entries);
          // Match target_office to officeScope using normalized comparison so
          // configs targeting "D&D" still credit "D & D" and vice versa.
          for (const [targetOffice, v] of Object.entries(dist)) {
            if (normalizeOfficeName(targetOffice) === scopeNorm) credited += v;
          }
        }
        if (credited !== 0 || entries.some(e => normalizeOfficeName(e.target_office) === scopeNorm)) {
          out[fee][sourceOffice] = credited;
        }
      }
    }
    return out;
  }, [configsBySource, rowsBySource, officeScope, officeParents]);

  useEffect(() => {
    if (!onTotalsChange) return;
    const totals: Record<FeeType, number> = {
      'E-File Fee(s)': 0, 'E-File Downlines': 0, 'Service Bureau Fee': 0, 'ERO3Fee': 0, 'Transmitter Fee': 0, 'E-File-EFIN': 0, 'ERO3-EFIN': 0,
    };
    for (const fee of FEE_TYPES) {
      totals[fee] = Object.values(distributions[fee]).reduce((s, v) => s + v, 0);
    }
    onTotalsChange(totals);
  }, [distributions, onTotalsChange]);

  useEffect(() => {
    if (!onExportData) return;
    const efinFilterX = EFIN_TILE_BY_OFFICE[officeScope];
    const isDDX = normalizeOfficeName(officeScope) === normalizeOfficeName('D & D');
    const visible = FEE_TYPES.filter(f => {
      if ((f === 'E-File-EFIN' || f === 'ERO3-EFIN') && !efinFilterX) return false;
      if (f === 'E-File Downlines' && !isDDX) return false;
      if (hiddenFeeTypes.includes(f)) return false;
      return true;
    });
    const tiles = visible.map(fee => {
      const dist = distributions[fee] || {};
      const present = new Set(Object.keys(dist));
      const ordered = [
        ...officeOrder.filter(o => present.has(o)),
        ...Object.keys(dist).filter(o => !officeOrder.includes(o)),
      ];
      const rows = ordered.map(o => ({ office: o, amount: dist[o] || 0 }));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { feeType: fee, rows, total };
    });
    onExportData(tiles);
  }, [distributions, officeOrder, officeScope, hiddenFeeTypes, onExportData]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const efinFilter = EFIN_TILE_BY_OFFICE[officeScope];
  const isDD = normalizeOfficeName(officeScope) === normalizeOfficeName('D & D');
  const visibleFeeTypes = FEE_TYPES.filter(f => {
    if ((f === 'E-File-EFIN' || f === 'ERO3-EFIN') && !efinFilter) return false;
    if (f === 'E-File Downlines' && !isDD) return false;
    if (hiddenFeeTypes.includes(f)) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {visibleFeeTypes.map(fee => {
        const dist = distributions[fee];
        // Order source offices using global office order, then any extras
        const present = new Set(Object.keys(dist));
        const ordered = [
          ...officeOrder.filter(o => present.has(o)),
          ...Object.keys(dist).filter(o => !officeOrder.includes(o)),
        ];
        const total = ordered.reduce((s, o) => s + (dist[o] || 0), 0);

        return (
          <div key={fee} className="bg-card rounded-xl border border-border shadow-card overflow-hidden relative group">
            {onHideFee && (
              <button
                type="button"
                onClick={() => onHideFee(fee)}
                title="Hide this tile for this sub-account"
                className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-md border border-border bg-background/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              </button>
            )}
            <div
              className="px-3 py-2 border-b border-border font-semibold text-sm"
              style={{ backgroundColor: HEADER_COLOR[fee] }}
            >
              {fee}
            </div>
            <div className="divide-y divide-border">
              {ordered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground italic">
                  {fee === 'E-File-EFIN' || fee === 'ERO3-EFIN'
                    ? `No ${FEE_FIELD_KEY[fee]} rows found for EFIN ${efinFilter}.`
                    : `No offices route this fee to ${officeScope}.`}
                </div>
              ) : (
                ordered.map((office, idx) => (
                  <div
                    key={office}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 text-sm",
                      idx % 2 === 1 && "bg-muted/30"
                    )}
                  >
                    <span>{office}</span>
                    <span className="font-mono">{fmt(dist[office] || 0)}</span>
                  </div>
                ))
              )}
            </div>
            {ordered.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-t border-border">
                <span className="text-sm font-semibold">Total</span>
                <div className="flex items-center gap-2">
                  <SourceTotalBadge officeScope={officeScope} field={`__fee:${fee}`} tableValue={total} />
                  <span className="font-mono font-bold text-sm">{fmt(total)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
