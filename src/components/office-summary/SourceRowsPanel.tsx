import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, formatMoney as fmtMoney } from '@/lib/utils';
import { fetchPayrollLookups, processPayrollRow, type PayrollLookups, type ProcessedPayrollRow } from '@/services/payrollRowProcessor';
import { officeMatches, getConsolidatedOffices } from '@/services/types';
import { useAlignmentOptional, type SourceTotal } from '@/contexts/AlignmentContext';
import {
  FEE_TYPES,
  type FeeType,
  type FeeConfigEntry,
  buildBackendLookups,
  resolveTaxOffice,
  buildRollupOffices,
  computeEffectiveEfin,
  getBackendRowContribution,
  EFIN_TILE_BY_OFFICE,
  normalizeOfficeName,
  type BackendLookups,
} from './backendContributors';

interface Props {
  officeScope: string;
  onExportData?: (data: { tab: TabKey; columns: { key: string; header: string; money?: boolean }[]; rows: Record<string, any>[] }) => void;
}

type TabKey = 'payroll' | 'backend' | 'fee_intercept';

const UPLOAD_TYPE: Record<TabKey, string> = {
  payroll: 'Payroll Report',
  backend: 'Backend Money Report',
  fee_intercept: 'Fee Intercept Report',
};

type ColDef = { key: string; header: string; align?: 'right'; money?: boolean };

const COLUMNS: Record<TabKey, ColDef[]> = {
  payroll: [
    { key: 'Funding Date', header: 'Funding Date' },
    { key: 'EFIN', header: 'EFIN' },
    { key: 'PTIN', header: 'PTIN' },
    { key: 'Taxpayer Last Name', header: 'Last Name' },
    { key: 'Taxpayer First Name', header: 'First Name' },
    { key: 'Taxpayer SSN', header: 'Taxpayer SSN' },
    { key: '__received', header: 'Received Prep', align: 'right', money: true },
    { key: 'High Prep Fee', header: 'High Prep Fee', align: 'right', money: true },
    { key: '__pay', header: 'Pay', align: 'right', money: true },
    { key: '__pshare', header: 'Preparer Share', align: 'right', money: true },
  ],
  backend: [
    { key: 'Funding Date', header: 'Funding Date' },
    { key: 'EFIN', header: 'EFIN' },
    { key: 'PTIN', header: 'PTIN' },
    { key: 'Taxpayer Last Name', header: 'Last Name' },
    { key: 'Taxpayer First Name', header: 'First Name' },
    { key: '__sourceOffice', header: 'Source Office' },
  ],
  fee_intercept: [
    { key: 'EFIN', header: 'EFIN' },
    { key: 'Total TP Fees', header: 'Total TP Fees', align: 'right', money: true },
    { key: 'High Prep Fee', header: 'High Prep Fee', align: 'right', money: true },
    { key: 'Total EFile Fees', header: 'E-File Fees', align: 'right', money: true },
    { key: 'Total SB Fees', header: 'SB Fees', align: 'right', money: true },
    { key: 'Total Other Fees', header: 'Other Fees', align: 'right', money: true },
    { key: 'Gross Fees', header: 'Gross Fees', align: 'right', money: true },
    { key: 'Total Prep After HP Fee', header: 'Prep After HP', align: 'right', money: true },
    { key: 'Total Fee Intercept', header: 'Fee Intercept', align: 'right', money: true },
  ],
};

const FEE_COL_HEADER: Record<FeeType, string> = {
  'E-File Fee(s)': 'E-File',
  'E-File Downlines': 'E-File Downlines',
  'Service Bureau Fee': 'Service Bureau',
  'ERO3Fee': 'ERO3',
  'Transmitter Fee': 'Transmitter',
  'E-File-EFIN': 'E-File (EFIN)',
  'ERO3-EFIN': 'ERO3 (EFIN)',
};

const PAGE_SIZE = 25;

function parseFundingDateStr(v: any): Date | null {
  if (!v) return null;
  // Eastern-time anchored: keeps date scoping consistent for viewers in any
  // timezone (matches useOfficeSummaryData / Backend Fee Table).
  const toEastern = (y: number, mo: number, d: number) =>
    new Date(Date.UTC(y, mo, d, 5, 0, 0));
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
    return toEastern(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toEastern(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[$,]/g, '')) || 0;
}

function getVal(row: Record<string, any>, key: string): any {
  if (row[key] !== undefined) return row[key];
  const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === norm) return row[k];
  }
  return '';
}

// Excel serial date -> "MM/DD/YYYY"
function formatCell(value: any, money?: boolean): string {
  if (value === null || value === undefined || value === '') return '';
  if (money) return fmtMoney(parseNum(value));
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }
  }
  return String(value).trim();
}

function rowIssues(row: Record<string, any>, tab: TabKey): string[] {
  const issues: string[] = [];
  const efin = String(getVal(row, 'EFIN') || '').trim();
  const ptin = String(getVal(row, 'PTIN') || '').trim();
  if (!efin) issues.push('Missing EFIN');
  if (!ptin) issues.push('Missing PTIN');
  if (tab === 'payroll') {
    const received = parseNum(row.__received);
    if (received === 0) issues.push('Zero received');
  }
  if (tab === 'backend') {
    const perFee = (row as any).__perFee || {};
    const sum: number = Object.values(perFee).reduce<number>((s, v) => s + parseNum(v), 0);
    if (sum === 0) issues.push('Zero backend fees');
    if (sum < 0) issues.push('Negative fees');
  }
  if (tab === 'fee_intercept') {
    const fi = parseNum(getVal(row, 'Total Fee Intercept'));
    if (fi === 0) issues.push('Zero fee intercept');
  }
  return issues;
}

export function SourceRowsPanel({ officeScope, onExportData }: Props) {
  const { selectedWeek, selectedWeekRange } = useActiveWeek();
  const alignmentCtx = useAlignmentOptional();
  const refreshTick = alignmentCtx?.refreshTick ?? 0;
  const [tab, setTab] = useState<TabKey>('payroll');
  const [loading, setLoading] = useState(false);
  const [rowsByTab, setRowsByTab] = useState<Record<TabKey, Record<string, any>[]>>({ payroll: [], backend: [], fee_intercept: [] });
  const [scopeEfins, setScopeEfins] = useState<Set<string>>(new Set());
  const [consolidatedOfficeNames, setConsolidatedOfficeNames] = useState<Set<string>>(new Set());
  const [headEfins, setHeadEfins] = useState<Set<string>>(new Set());
  const [efinIncludedOffices, setEfinIncludedOffices] = useState<string[]>([]);
  const [lookups, setLookups] = useState<PayrollLookups | null>(null);
  const [backendLookups, setBackendLookups] = useState<BackendLookups | null>(null);
  const [configsBySource, setConfigsBySource] = useState<Record<string, Record<FeeType, FeeConfigEntry[]>>>({});
  const [search, setSearch] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(0);

  // Build EFIN + office-name set for the scope (same as PreparersShareTable).
  useEffect(() => {
    if (!officeScope) { setScopeEfins(new Set()); setConsolidatedOfficeNames(new Set()); setHeadEfins(new Set()); return; }
    (async () => {
      const { data } = await supabase
        .from('offices')
        .select('office_name, parent_office, primary_efin, secondary_efin, extra_efins')
        .eq('active', true);
      if (!data) return;
      const headRow: any = data.find((o: any) => o.office_name === officeScope);
      const hSet = new Set<string>();
      if (headRow) {
        for (const e of [headRow.primary_efin, headRow.secondary_efin]) {
          const v = String(e || '').trim();
          if (v) hSet.add(v);
        }
        for (const e of (headRow.extra_efins || []) as string[]) {
          const v = String(e || '').trim();
          if (v) hSet.add(v);
        }
      }
      setHeadEfins(hSet);
      const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
      const canon = new Map<string, string>();
      data.forEach((o: any) => { if (o.office_name) canon.set(norm(o.office_name), o.office_name); });
      const parentMap: Record<string, string> = {};
      const efinMap: Record<string, string> = {};
      const efinMap2: Record<string, string> = {};
      data.forEach((o: any) => {
        const child = o.office_name;
        const resolvedParent = o.parent_office ? canon.get(norm(o.parent_office)) || '' : '';
        if (child && resolvedParent && resolvedParent !== child) parentMap[child] = resolvedParent;
        if (child) {
          efinMap[child] = (o.primary_efin || '').trim();
          efinMap2[child] = (o.secondary_efin || '').trim();
        }
      });
      const isDescendant = (child: string): boolean => {
        let cur = parentMap[child];
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          if (cur === officeScope) return true;
          seen.add(cur);
          cur = parentMap[cur];
        }
        // Fallback: tolerate parent_office values that don't resolve via canon
        // (typos, whitespace, casing). Compare the raw parent_office to scope.
        const rawParent = (data.find((o: any) => o.office_name === child) as any)?.parent_office;
        if (rawParent && norm(String(rawParent)) === norm(officeScope)) return true;
        return false;
      };
      const offices = new Set<string>(getConsolidatedOffices(officeScope));
      // Scope EFIN: single effective EFIN for the head office.
      // Rule: secondary_efin if present, else primary_efin.
      // (For D&D this resolves to 381268 — the shared transmitter EFIN
      // across all D&D-branch offices.)
      const headSecondary = efinMap2[officeScope] || '';
      const headPrimary = efinMap[officeScope] || '';
      const effectiveScopeEfin = headSecondary || headPrimary;
      const scopeEfinSet = new Set<string>(
        effectiveScopeEfin ? [effectiveScopeEfin] : [],
      );
      // Include any admin-managed extra EFINs for the head office.
      for (const e of ((headRow?.extra_efins || []) as string[])) {
        const v = String(e || '').trim();
        if (v) scopeEfinSet.add(v);
      }
      // Track descendant offices whose primary OR secondary equals the
      // scope EFIN — informational only (row filter is strict on row.EFIN).
      const efinAdded: string[] = [];
      if (scopeEfinSet.size > 0) {
        Object.keys(efinMap).forEach((o) => {
          if (o === officeScope) return;
          const childEfins = [efinMap[o], efinMap2[o]].filter(Boolean);
          if (childEfins.some(e => scopeEfinSet.has(e)) && isDescendant(o)) {
            efinAdded.push(o);
          }
        });
      }
      setEfinIncludedOffices(efinAdded.sort());
      setConsolidatedOfficeNames(new Set([...offices].map(norm)));
      setScopeEfins(scopeEfinSet);
    })();
  }, [officeScope]);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPage(0);
      const fetchTab = async (key: TabKey): Promise<Record<string, any>[]> => {
        const { data: uploads } = await supabase
          .from('uploads')
          .select('id')
          .eq('type', UPLOAD_TYPE[key])
          .eq('week_label', selectedWeek);
        if (!uploads || uploads.length === 0) return [];
        const ids = uploads.map(u => u.id);
        const collected: Record<string, any>[] = [];
        for (let i = 0; i < ids.length; i += 10) {
          const batch = ids.slice(i, i + 10);
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .from('upload_rows')
              .select('row_data')
              .in('upload_id', batch)
              .range(from, from + 999);
            if (error) break;
            if (data) collected.push(...data.map(d => d.row_data as Record<string, any>));
            if (!data || data.length < 1000) break;
            from += 1000;
          }
        }
        return collected;
      };
      const [lk, payroll, backend, fee_intercept, officesRes, preparersRes, configRowsRes] = await Promise.all([
        fetchPayrollLookups(selectedWeek),
        fetchTab('payroll'),
        fetchTab('backend'),
        fetchTab('fee_intercept'),
        supabase.from('offices').select('office_name, primary_efin, secondary_efin, parent_office').order('office_name'),
        supabase.from('preparers').select('ptin, tax_office'),
        supabase.from('office_fee_configs').select('*'),
      ]);
      if (!cancelled) {
        setLookups(lk);
        setRowsByTab({ payroll, backend, fee_intercept });
        const blk = buildBackendLookups(
          (officesRes.data as any[]) || [],
          (preparersRes.data as any[]) || [],
        );
        setBackendLookups(blk);
        const allConfigs: Record<string, Record<FeeType, FeeConfigEntry[]>> = {};
        for (const r of (configRowsRes.data as any[]) || []) {
          const ft = r.fee_type as FeeType;
          if (!FEE_TYPES.includes(ft)) continue;
          if (!allConfigs[r.office_name]) {
            allConfigs[r.office_name] = {
              'E-File Fee(s)': [], 'E-File Downlines': [], 'Service Bureau Fee': [],
              'ERO3Fee': [], 'Transmitter Fee': [], 'E-File-EFIN': [], 'ERO3-EFIN': [],
            };
          }
          allConfigs[r.office_name][ft].push({
            target_office: r.target_office,
            mode: r.mode as any,
            value: Number(r.value),
          });
        }
        setConfigsBySource(allConfigs);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWeek, refreshTick]);

  // Reset paging on filter changes
  useEffect(() => { setPage(0); }, [search, onlyIssues, tab, officeScope]);

  const visibleFeeTypes = useMemo<FeeType[]>(() => {
    const efinFilter = EFIN_TILE_BY_OFFICE[officeScope];
    const isDD = normalizeOfficeName(officeScope) === normalizeOfficeName('D & D');
    return FEE_TYPES.filter(f => {
      if ((f === 'E-File-EFIN' || f === 'ERO3-EFIN') && !efinFilter) return false;
      if (f === 'E-File Downlines' && !isDD) return false;
      return true;
    });
  }, [officeScope]);

  const backendColumns = useMemo<ColDef[]>(() => {
    const base = COLUMNS.backend;
    const feeCols: ColDef[] = visibleFeeTypes.map(ft => ({
      key: `__fee:${ft}`,
      header: FEE_COL_HEADER[ft],
      align: 'right',
      money: true,
    }));
    return [...base, ...feeCols];
  }, [visibleFeeTypes]);

  const scopeForTab = (key: TabKey): Record<string, any>[] => {
    let allRows = rowsByTab[key] || [];
    // Apply the selected week's funding-date range to row-level tabs that
    // carry a Funding Date. Fee Intercept rows are aggregated per-EFIN and
    // have no Funding Date column, so they're scoped by week_label only —
    // when a narrower date range is ever applied, Fee Intercept can't
    // honor it row-by-row and the tab will show an explanatory empty state.
    if (key !== 'fee_intercept' && selectedWeekRange && (selectedWeekRange.from || selectedWeekRange.to)) {
      let lo = selectedWeekRange.from ? parseFundingDateStr(selectedWeekRange.from) : null;
      let hi = selectedWeekRange.to ? parseFundingDateStr(selectedWeekRange.to) : null;
      if (lo && hi && lo.getTime() > hi.getTime()) { const t = lo; lo = hi; hi = t; }
      if (lo) lo.setHours(0, 0, 0, 0);
      if (hi) hi.setHours(23, 59, 59, 999);
      allRows = allRows.filter(r => {
        const fd = parseFundingDateStr(getVal(r, 'Funding Date'));
        if (!fd) return false;
        if (lo && fd.getTime() < lo.getTime()) return false;
        if (hi && fd.getTime() > hi.getTime()) return false;
        return true;
      });
    }
    if (key === 'payroll') {
      if (!lookups) return [];
      const out: Record<string, any>[] = [];
      const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
      const isDD = normalizeOfficeName(officeScope) === normalizeOfficeName('D & D');
      // PTIN-based scope: preparers whose CURRENT tax_office is in the
      // consolidated scope. A payroll row belongs to this office iff its
      // PTIN is in that set — independent of the row's historic EFIN.
      const scopePtins = new Set<string>();
      if (officeScope) {
        Object.entries(lookups.ptinToPreparers).forEach(([ptinKey, arr]) => {
          const k = String(ptinKey || '').trim().toLowerCase();
          if (!k) return;
          if ((arr || []).some((p: any) => consolidatedOfficeNames.has(norm(p.tax_office || '')))) {
            scopePtins.add(k);
          }
        });
      }
      for (const r of allRows) {
        const processed: ProcessedPayrollRow = processPayrollRow(r, lookups);
        if (officeScope) {
          const ptin = String(getVal(r, 'PTIN') || '').trim().toLowerCase();
          const ptinMatch = !!ptin && scopePtins.has(ptin);
          if (isDD) {
            // D&D only: head office only — do NOT include sub-offices.
            // A row belongs iff its EFIN matches a head-office EFIN, OR
            // its Tax Office equals the head office name ("D & D").
            // PTIN- and consolidated-office matches are intentionally excluded.
            const rowEfin = String(getVal(r, 'EFIN') || '').trim();
            const rowTaxOffice = String(
              getVal(r, 'Tax Office') ||
              getVal(r, 'TaxOffice') ||
              processed.taxOffice ||
              ''
            ).trim();
            const efinMatch = !!rowEfin && scopeEfins.has(rowEfin);
            const officeMatch = !!rowTaxOffice && norm(rowTaxOffice) === norm(officeScope);
            if (!efinMatch && !officeMatch) continue;
          } else {
            // PTIN match (preparer currently assigned within the scope), OR
            // EFIN match against this office's own/extra EFINs (scopeEfins —
            // includes the "Extra EFINs" admin field). This lets a downline
            // that shares an office-managed EFIN roll up into the head
            // office's Front End Source Rows even when its PTIN doesn't
            // resolve to a preparer assigned within the scope.
            const rowEfin = String(getVal(r, 'EFIN') || '').trim();
            const efinMatch = !!rowEfin && scopeEfins.has(rowEfin);
            if (!ptinMatch && !efinMatch) continue;
          }
        }
        out.push({
          ...r,
          __received: processed.receivedTaxPrepFee,
          __pay: processed.pay,
          __pshare: processed.preparerShare,
          __preparer: processed.preparer,
          __taxOffice: processed.taxOffice,
        });
      }
      return out;
    }
    if (key === 'fee_intercept') {
      // Consolidate by the head office's own EFINs (primary + secondary).
      if (!officeScope || headEfins.size === 0) return [];
      const out: Record<string, any>[] = [];
      for (const r of allRows) {
        const candidates = [
          getVal(r, 'EFIN'),
          getVal(r, 'Parent EFIN'),
          getVal(r, 'PARENT_EFIN'),
          getVal(r, 'Group EFIN'),
          getVal(r, 'GROUP_EFIN'),
        ].map(v => String(v || '').trim()).filter(Boolean);
        if (candidates.some(e => headEfins.has(e))) out.push(r);
      }
      return out;
    }
    // Backend tab: filter to the exact rows that feed the Backend Money tiles
    // for this office scope, so totals match tile-for-tile.
    if (!backendLookups || !officeScope) return [];
    const rollupOffices = buildRollupOffices(officeScope, backendLookups.officeParent);
    // Group rows by source office once so we can compute effectiveEfin
    const rowsBySource: Record<string, Record<string, any>[]> = {};
    const rowSourceMap = new Map<Record<string, any>, string>();
    for (const r of allRows) {
      const efin = String(getVal(r, 'EFIN') || '').trim();
      const ptin = String(getVal(r, 'PTIN') || '').trim();
      const src = resolveTaxOffice(efin, ptin, backendLookups);
      if (!src) continue;
      rowSourceMap.set(r, src);
      if (!rowsBySource[src]) rowsBySource[src] = [];
      rowsBySource[src].push(r);
    }
    const effectiveEfin = computeEffectiveEfin(officeScope, rowsBySource);
    const ctx = { officeScope, rollupOffices, configsBySource, effectiveEfin };
    const out: Record<string, any>[] = [];
    for (const r of allRows) {
      const src = rowSourceMap.get(r);
      if (!src) continue;
      const { contributes, perFee } = getBackendRowContribution(r, src, ctx);
      if (!contributes) continue;
      out.push({ ...r, __sourceOffice: src, __perFee: perFee });
    }
    return out;
  };

  const scopedRows = useMemo(() => scopeForTab(tab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsByTab, scopeEfins, headEfins, officeScope, tab, lookups, backendLookups, configsBySource, selectedWeekRange]);

  const scopedRowsOther = useMemo(() => {
    const others: TabKey[] = (['payroll', 'backend', 'fee_intercept'] as TabKey[]).filter(k => k !== tab);
    return others.map(key => ({ key, rows: scopeForTab(key) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsByTab, scopeEfins, headEfins, officeScope, tab, lookups, backendLookups, configsBySource, selectedWeekRange]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return scopedRows.filter(r => {
      if (onlyIssues && rowIssues(r, tab).length === 0) return false;
      if (!s) return true;
      return Object.values(r).some(v => String(v ?? '').toLowerCase().includes(s));
    });
  }, [scopedRows, search, onlyIssues, tab]);

  const issueCount = useMemo(
    () => scopedRows.filter(r => rowIssues(r, tab).length > 0).length,
    [scopedRows, tab],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const cols = tab === 'backend' ? backendColumns : COLUMNS[tab];
  const colsForTab = (k: TabKey): ColDef[] => (k === 'backend' ? backendColumns : COLUMNS[k]);

  useEffect(() => {
    // Emit export data for BOTH tabs so the parent always has the complete
    // dataset, regardless of which tab is currently visible.
    onExportData?.({ tab, columns: cols, rows: filteredRows });
    scopedRowsOther.forEach(({ key, rows }) => {
      onExportData?.({ tab: key, columns: colsForTab(key), rows });
    });
  }, [tab, filteredRows, scopedRowsOther, onExportData, cols, backendColumns]);

  const moneyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const c of cols) {
      if (!c.money) continue;
      totals[c.key] = filteredRows.reduce((s, r) => {
        let v: any;
        if (c.key.startsWith('__fee:')) {
          const ft = c.key.slice('__fee:'.length) as FeeType;
          v = r.__perFee?.[ft] ?? 0;
        } else if (c.key.startsWith('__')) {
          v = r[c.key];
        } else {
          v = getVal(r, c.key);
        }
        return s + parseNum(v);
      }, 0);
    }
    return totals;
  }, [filteredRows, cols]);

  // Push computed money totals to the alignment context so the banner can
  // compare them against the user-defined summary tables. Emits totals for
  // BOTH tabs so the comparison works regardless of which tab is active.
  useEffect(() => {
    if (!alignmentCtx || !officeScope) return;
    const sumByCols = (rows: Record<string, any>[], colDefs: ColDef[]): SourceTotal[] =>
      colDefs.filter(c => c.money).map(c => ({
        key: c.key,
        label: c.header,
        total: rows.reduce((s, r) => {
          let v: any;
          if (c.key.startsWith('__fee:')) {
            const ft = c.key.slice('__fee:'.length) as FeeType;
            v = r.__perFee?.[ft] ?? 0;
          } else if (c.key.startsWith('__')) v = r[c.key];
          else v = getVal(r, c.key);
          return s + parseNum(v);
        }, 0),
      }));
    const currentTotals = sumByCols(scopedRows, cols);
    const map = new Map<string, SourceTotal>();
    scopedRowsOther.forEach(({ key, rows }) => {
      sumByCols(rows, colsForTab(key)).forEach(t => map.set(t.key, t));
    });
    currentTotals.forEach(t => map.set(t.key, t));
    alignmentCtx.reportSourceTotals(officeScope, [...map.values()]);
  }, [scopedRows, scopedRowsOther, cols, backendColumns, officeScope, alignmentCtx]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Source Rows</h3>
          <span className="text-xs text-muted-foreground">
            Verify the raw data feeding {officeScope || 'this office'}'s tables.
          </span>
          {tab === 'payroll' ? (
            <span className="text-[11px] text-muted-foreground ml-2">
              · Payroll consolidated by PTIN — rows follow each preparer's current office assignment.
            </span>
          ) : (
            efinIncludedOffices.length > 0 && (
              <span className="text-[11px] text-muted-foreground ml-2">
                · EFIN {[...headEfins][0] || ''} also pulls in: {efinIncludedOffices.join(', ')}
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-7 w-48 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant={onlyIssues ? 'default' : 'outline'}
            className="h-8 gap-1.5 text-xs"
            onClick={() => setOnlyIssues(v => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Issues {issueCount > 0 && <span className="font-bold">({issueCount})</span>}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)}>
        <div className="px-4 pt-3">
          <TabsList>
            <TabsTrigger value="payroll">Front End</TabsTrigger>
            <TabsTrigger value="backend">Backend Money</TabsTrigger>
            <TabsTrigger value="fee_intercept">Fee Intercept</TabsTrigger>
          </TabsList>
        </div>

        {(['payroll', 'backend', 'fee_intercept'] as TabKey[]).map(key => (
          <TabsContent key={key} value={key} className="mt-3">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {scopedRows.length === 0
                  ? `No ${UPLOAD_TYPE[key]} rows for ${officeScope || 'this office'} in ${selectedWeek || 'the active week'}.`
                  : 'No rows match the current filter.'}
              </div>
            ) : (
              <>
                <div className="overflow-auto max-h-[480px] border-t border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60 border-b border-border z-10">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                        {cols.map(c => (
                          <th
                            key={c.key}
                            className={cn(
                              'px-2 py-2 font-medium text-muted-foreground whitespace-nowrap',
                              c.align === 'right' ? 'text-right' : 'text-left',
                            )}
                          >
                            {c.header}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => {
                        const issues = rowIssues(r, key);
                        const rowIdx = page * PAGE_SIZE + i + 1;
                        return (
                          <tr
                            key={i}
                            className={cn(
                              'border-b border-border/60 hover:bg-muted/40',
                              issues.length > 0 && 'bg-destructive/5',
                            )}
                          >
                            <td className="px-2 py-1.5 text-muted-foreground">{rowIdx}</td>
                            {cols.map(c => (
                              <td
                                key={c.key}
                                className={cn(
                                  'px-2 py-1.5 whitespace-nowrap',
                                  c.align === 'right' ? 'text-right font-mono' : '',
                                )}
                              >
                                {formatCell(
                                  c.key.startsWith('__fee:')
                                    ? (r.__perFee?.[c.key.slice('__fee:'.length)] ?? 0)
                                    : c.key.startsWith('__')
                                      ? r[c.key]
                                      : getVal(r, c.key),
                                  c.money,
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-1.5">
                              {issues.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  {issues.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/40 border-t border-border sticky bottom-0">
                      <tr>
                        <td className="px-2 py-1.5 font-semibold" colSpan={1}>Total</td>
                        {cols.map(c => (
                          <td
                            key={c.key}
                            className={cn(
                              'px-2 py-1.5 whitespace-nowrap',
                              c.align === 'right' ? 'text-right font-mono font-semibold' : '',
                            )}
                          >
                            {c.money ? fmtMoney(moneyTotals[c.key] || 0) : ''}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
                  <span>
                    Showing {page * PAGE_SIZE + 1}–{Math.min(filteredRows.length, (page + 1) * PAGE_SIZE)} of {filteredRows.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page === 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2">Page {page + 1} / {totalPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}