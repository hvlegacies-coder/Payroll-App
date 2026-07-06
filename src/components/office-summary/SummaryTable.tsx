import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldPicker } from './FieldPicker';
import { CalculatedFieldDialog } from './CalculatedFieldDialog';
import { OperatorRow } from './OperatorRow';

import { FIELD_REGISTRY, UPLOAD_TYPE_MAP, ALL_DOWNLINE_VIRTUALS, ALL_OFFICE_GROUP_VIRTUALS, EFIN_VIRTUAL_FIELDS } from './fieldRegistry';
import type { SummaryTableConfig, TableField, Operator, FieldFilters, CalcOperand, FooterAggregation } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { Plus, Pencil, Trash2, Calculator, GripVertical, X, Palette, Sigma, Check } from 'lucide-react';
import { formatMoney as fmt } from '@/lib/utils';
import { toNum } from '@/lib/num';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchPayrollLookups, processPayrollRow, type PayrollLookups, type ProcessedPayrollRow } from '@/services/payrollRowProcessor';
import { getPreparerFee } from '@/services/calculationEngine';
import { getConsolidatedOffices } from '@/services/types';
import { useAlignmentOptional } from '@/contexts/AlignmentContext';
import {
  buildBackendLookups,
  buildRollupOffices,
  computeEffectiveEfin,
  getBackendRowContribution,
  resolveTaxOffice as resolveBackendTaxOffice,
  type BackendLookups,
  type ContributionContext,
  type FeeConfigEntry,
  type FeeType as BackendFeeType,
} from './backendContributors';
import { useOfficesAndPayrollLookups, useBackendCtxData, useUploadRows } from './useOfficeSummaryData';
import { SourceTotalBadge } from './SourceTotalBadge';

interface SiblingTable { id: string; title: string; total: number }

interface Props {
  config: SummaryTableConfig;
  onChange: (config: SummaryTableConfig) => void;
  onDelete: () => void;
  officeScope?: string; // page-level office filter
  siblingTables?: SiblingTable[];
  onTotalChange?: (total: number) => void;
  readOnly?: boolean;
  onExportData?: (data: { title: string; rows: { label: string; operator?: string; value: number }[]; total: number }) => void;
  /** Reports per-field computed values keyed by `${tableId}:${fieldId}`. */
  onFieldValues?: (values: Record<string, number>) => void;
}

const COLOR_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Blue', value: 'hsl(217 91% 60%)' },
  { label: 'Green', value: 'hsl(142 71% 45%)' },
  { label: 'Purple', value: 'hsl(262 83% 58%)' },
  { label: 'Orange', value: 'hsl(25 95% 53%)' },
  { label: 'Red', value: 'hsl(0 84% 60%)' },
  { label: 'Teal', value: 'hsl(173 80% 40%)' },
  { label: 'Pink', value: 'hsl(330 81% 60%)' },
];

interface TaggedRow {
  dataset: 'payroll' | 'backend' | 'fee_intercept';
  data: Record<string, any>;
  processed?: ProcessedPayrollRow; // only for payroll
  resolvedTaxOffice?: string; // for filtering — payroll: from preparer lookup
}

export function SummaryTable({ config, onChange, onDelete, officeScope, siblingTables = [], onTotalChange, readOnly = false, onExportData, onFieldValues }: Props) {
  const { selectedWeek, selectedWeekRange } = useActiveWeek();
  const alignmentCtx = useAlignmentOptional();
  const refreshTick = alignmentCtx?.refreshTick ?? 0;
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [footerCalcOpen, setFooterCalcOpen] = useState(false);
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);

  const reorderFields = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const list = [...config.fields];
    const from = list.findIndex(f => f.id === sourceId);
    const to = list.findIndex(f => f.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange({ ...config, fields: list });
  };
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingFooterLabel, setEditingFooterLabel] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  // Shared cached data across all SummaryTable instances on the page.
  const officesQuery = useOfficesAndPayrollLookups(selectedWeek, refreshTick);
  const backendQuery = useBackendCtxData();
  const uploadRowsQuery = useUploadRows(selectedWeek, refreshTick, UPLOAD_TYPE_MAP as Record<string, string>, selectedWeekRange);
  const officeList = officesQuery.data?.offices.officeList ?? [];
  const parentMap = officesQuery.data?.offices.parentMap ?? {};
  const officeEfinsMap = officesQuery.data?.offices.officeEfinsMap ?? {};
  const officePrimaryEfinMap = officesQuery.data?.offices.officePrimaryEfinMap ?? {};
  const officeSecondaryEfinMap = officesQuery.data?.offices.officeSecondaryEfinMap ?? {};
  const preparerList = officesQuery.data?.preparerList ?? [];
  const lookups = officesQuery.data?.lookups ?? null;
  const backendLookups = backendQuery.data?.backendLookups ?? null;
  const feeConfigsBySource = backendQuery.data?.feeConfigsBySource ?? {};
  const taggedRows = useMemo<TaggedRow[]>(() => {
    const raw = uploadRowsQuery.data;
    if (!raw || !lookups) return [];
    const out: TaggedRow[] = [];
    for (const r of raw) {
      const data = typeof r.row_data === 'object' && r.row_data ? r.row_data as Record<string, any> : {};
      const ds = r.dataset;
      if (ds === 'payroll') {
        const processed = processPayrollRow(data, lookups);
        out.push({ dataset: ds, data, processed, resolvedTaxOffice: processed.taxOffice });
      } else {
        let resolvedTaxOffice = '';
        if (ds === 'fee_intercept') {
          const efinCandidates = [
            data['EFIN'], data['Parent EFIN'], data['PARENT_EFIN'], data['Group EFIN'], data['GROUP_EFIN'],
          ].map((v) => String(v || '').trim()).filter(Boolean);
          for (const e of efinCandidates) {
            const offices = lookups.efinToOffices[e];
            if (offices && offices.length > 0) { resolvedTaxOffice = offices[0]; break; }
          }
        } else {
          const ptin = String(data['PTIN'] || '').trim().toLowerCase();
          const matches = lookups.ptinToPreparers[ptin];
          resolvedTaxOffice = matches && matches.length > 0 ? matches[0].tax_office : '';
        }
        out.push({ dataset: ds, data, resolvedTaxOffice });
      }
    }
    return out;
  }, [uploadRowsQuery.data, lookups]);

  // Office consolidation: e.g. when scope is "D & D", Tax Champions rows count too.
  // Also auto-includes downline offices that share an EFIN with the scope office.
  const consolidatedScope = useMemo(() => {
    if (!officeScope) return null;
    const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
    const set = new Set<string>(getConsolidatedOffices(officeScope));
    // Match SourceRowsPanel: only use the scope office's PRIMARY EFIN to detect
    // downline offices that share it (descendants only). Secondary EFINs are
    // intentionally excluded here because many downline offices share the
    // secondary 381268 EFIN and would over-broaden the consolidated set.
    const scopePrimary = (officePrimaryEfinMap[officeScope] || '').trim();
    if (scopePrimary && Object.keys(parentMap).length > 0) {
      const isDescendant = (child: string): boolean => {
        let cur = parentMap[child];
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          if (cur === officeScope) return true;
          seen.add(cur);
          cur = parentMap[cur];
        }
        return false;
      };
      Object.keys(officePrimaryEfinMap).forEach((office) => {
        if (office === officeScope || set.has(office)) return;
        const childPrimary = (officePrimaryEfinMap[office] || '').trim();
        if (childPrimary && childPrimary === scopePrimary && isDescendant(office)) {
          set.add(office);
        }
      });
    }
    return new Set([...set].map(norm));
  }, [officeScope, officePrimaryEfinMap, parentMap]);
  // EFINs that belong to the head office or any consolidated downline.
  // Rows tagged with any of these EFINs roll up into the scope, even if
  // their tax_office didn't resolve to a known consolidated name.
  const scopeEfinSet = useMemo(() => {
    if (!officeScope) return null;
    const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
    const efins = new Set<string>();
    Object.entries(officeEfinsMap).forEach(([office, list]) => {
      if (consolidatedScope?.has(norm(office)) || office === officeScope) {
        (list || []).forEach((e) => { if (e) efins.add(String(e).trim()); });
      }
    });
    return efins;
  }, [officeScope, officeEfinsMap, consolidatedScope]);
  const payrollScopeEfin = useMemo(() => {
    if (!officeScope) return '';
    const secondary = (officeSecondaryEfinMap[officeScope] || '').trim();
    const primary = (officePrimaryEfinMap[officeScope] || '').trim();
    return secondary || primary;
  }, [officeScope, officeSecondaryEfinMap, officePrimaryEfinMap]);
  // Payroll tab is scoped by PTIN — a row belongs to this office if its
  // PTIN resolves (via the preparers registry) to a preparer whose CURRENT
  // tax_office rolls up into the consolidated scope. This makes client rows
  // follow the preparer when they change offices, instead of staying tied
  // to the historic EFIN on the row.
  const scopePtinSet = useMemo(() => {
    const s = new Set<string>();
    if (!officeScope || !consolidatedScope || !lookups) return s;
    const norm = (v: string) => (v || '').replace(/\s+/g, '').toLowerCase();
    Object.entries(lookups.ptinToPreparers).forEach(([ptinKey, arr]) => {
      const ptin = String(ptinKey || '').trim().toLowerCase();
      if (!ptin) return;
      const inScope = (arr || []).some((p: any) =>
        consolidatedScope.has(norm(p.tax_office || '')),
      );
      if (inScope) s.add(ptin);
    });
    return s;
  }, [officeScope, consolidatedScope, lookups]);
  // Fee Intercept is scoped strictly to the head office's own EFINs
  // (primary + secondary). Downline/consolidated offices are NOT included.
  const headOfficeEfinSet = useMemo(() => {
    const s = new Set<string>();
    if (!officeScope) return s;
    const p = (officePrimaryEfinMap[officeScope] || '').trim();
    const sec = (officeSecondaryEfinMap[officeScope] || '').trim();
    if (p) s.add(p);
    if (sec) s.add(sec);
    return s;
  }, [officeScope, officePrimaryEfinMap, officeSecondaryEfinMap]);
  const matchesScope = (rowOffice: string | undefined | null) => {
    if (!consolidatedScope) return true;
    const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
    return consolidatedScope.has(norm(rowOffice || ''));
  };
  const matchesScopeRow = (row: TaggedRow) => {
    if (!consolidatedScope) return true;
    if (row.dataset === 'payroll') {
      // PTIN-based scoping: row belongs to this office iff its PTIN is in
      // the scope's PTIN set (built from preparers currently assigned to
      // any office in the consolidated scope). Unknown PTINs are excluded.
      const ptin = String(row.data?.['PTIN'] || '').trim().toLowerCase();
      return !!ptin && scopePtinSet.has(ptin);
    }
    if (row.dataset === 'fee_intercept') {
      // Fee Intercept rows are scoped strictly by the head office's own
      // EFINs (primary + secondary). Downline/consolidated offices are
      // intentionally excluded so totals don't double-count.
      const candidates = [
        row.data?.['EFIN'],
        row.data?.['Parent EFIN'],
        row.data?.['PARENT_EFIN'],
        row.data?.['Group EFIN'],
        row.data?.['GROUP_EFIN'],
      ].map((v) => String(v || '').trim()).filter(Boolean);
      return candidates.some((e) => headOfficeEfinSet.has(e));
    }
    if (matchesScope(row.resolvedTaxOffice)) return true;
    const efin = String(row.data?.['EFIN'] || '').trim();
    if (efin && scopeEfinSet?.has(efin)) return true;
    return false;
  };
  // Map a backend "raw" field key to the FeeType used by the tile system.
  const BACKEND_FIELD_TO_FEE: Record<string, BackendFeeType> = {
    'E-File Fee(s)': 'E-File Fee(s)',
    'Service Bureau Fee': 'Service Bureau Fee',
    ERO3Fee: 'ERO3Fee',
    'Transmitter Fee': 'Transmitter Fee',
  };

  const backendCtx = useMemo<ContributionContext | null>(() => {
    if (!officeScope || !backendLookups) return null;
    const rollupOffices = buildRollupOffices(officeScope, backendLookups.officeParent);
    // Build rowsBySource for fallback-EFIN detection across all backend rows
    const rowsBySource: Record<string, Record<string, any>[]> = {};
    for (const r of taggedRows) {
      if (r.dataset !== 'backend') continue;
      const efin = String(r.data['EFIN'] ?? '').trim();
      const ptin = String(r.data['PTIN'] ?? '').trim();
      const so = resolveBackendTaxOffice(efin, ptin, backendLookups) || '__unknown__';
      (rowsBySource[so] ||= []).push(r.data);
    }
    const effectiveEfin = computeEffectiveEfin(officeScope, rowsBySource);
    return { officeScope, rollupOffices, configsBySource: feeConfigsBySource, effectiveEfin };
  }, [officeScope, backendLookups, feeConfigsBySource, taggedRows]);

  // Apply filters (office scope + per-table filters)
  const filteredRows = useMemo(() => {
    return taggedRows.filter(row => {
      // Page-level office scope
      if (officeScope) {
        if (!matchesScopeRow(row)) return false;
      }
      if (config.filters.efin && String(row.data['EFIN'] || '') !== config.filters.efin) return false;
      if (config.filters.taxOffice) {
        if ((row.resolvedTaxOffice || '') !== config.filters.taxOffice) return false;
      }
      if (config.filters.preparer) {
        const rowPtin = String(row.data['PTIN'] || '');
        if (rowPtin !== config.filters.preparer) return false;
      }
      return true;
    });
  }, [taggedRows, config.filters, officeScope, consolidatedScope, scopeEfinSet, payrollScopeEfin, headOfficeEfinSet]);

  // Compute unique EFIN values from data — scoped to selected office when set
  const filterOptions = useMemo(() => {
    const scopedRows = officeScope
      ? taggedRows.filter(r => matchesScopeRow(r))
      : taggedRows;
    return {
      efins: [...new Set(scopedRows.map(r => String(r.data['EFIN'] || '')).filter(Boolean))].sort(),
    };
  }, [taggedRows, officeScope, consolidatedScope, scopeEfinSet, payrollScopeEfin]);

  // Office dropdown scoped to navigation selection
  const scopedOfficeList = useMemo(
    () => (officeScope ? [officeScope] : officeList),
    [officeScope, officeList]
  );

  // Preparer dropdown scoped to preparers belonging to the selected office
  const scopedPreparerList = useMemo(() => {
    if (!officeScope || !lookups) return preparerList;
    const allowedPtins = new Set<string>();
    Object.entries(lookups.ptinToPreparers).forEach(([ptinKey, arr]) => {
      if (arr.some(p => p.tax_office === officeScope)) {
        allowedPtins.add(ptinKey);
      }
    });
    return preparerList.filter(p => allowedPtins.has(p.ptin.trim().toLowerCase()));
  }, [officeScope, preparerList, lookups]);

  const rowsForDataset = (dataset: string) => filteredRows.filter(r => r.dataset === dataset);

  // Apply per-field overrides on top of an already-filtered dataset row set
  const applyFieldFilters = (rows: TaggedRow[], overrides?: FieldFilters): TaggedRow[] => {
    if (!overrides || (!overrides.efin && !overrides.taxOffice)) return rows;
    return rows.filter(r => {
      if (overrides.efin && String(r.data['EFIN'] || '') !== overrides.efin) return false;
      if (overrides.taxOffice) {
        if ((r.resolvedTaxOffice || '') !== overrides.taxOffice) return false;
      }
      return true;
    });
  };

  // Shared safe-numeric coercion. See src/lib/num.ts.
  const parseNum = toNum;

  const sumFieldDef = (def: typeof FIELD_REGISTRY[number], overrides?: FieldFilters): number => {
    // Backend fee fields: use unscoped backend rows so whitelist/route logic
    // can credit rows from outside the consolidated scope (e.g., Transmitter
    // Fee under Higher View pulls from many offices).
    const useBackendContrib =
      def.dataset === 'backend' && backendCtx && backendLookups && BACKEND_FIELD_TO_FEE[def.key];
    const rows = useBackendContrib
      ? applyFieldFilters(
          taggedRows.filter(r => r.dataset === 'backend'),
          overrides,
        )
      : applyFieldFilters(rowsForDataset(def.dataset), overrides);
    if (def.computed) {
      return rows.reduce((sum, row) => {
        if (!row.processed) return sum;
        if (def.computed === 'pay') return sum + row.processed.pay;
        if (def.computed === 'preparer_share') return sum + row.processed.preparerShare;
        if (def.computed === 'after_advance') return sum + row.processed.afterAdvance;
        return sum;
      }, 0);
    }
    // Backend fee fields: align with BackendFeeTable / SourceRowsPanel by
    // crediting the per-tile contribution amount for the current office scope.
    if (useBackendContrib) {
      const fee = BACKEND_FIELD_TO_FEE[def.key];
      // When no per-field filters are set, defer to the BackendFeeTable tile
      // total emitted via siblingTables so user-built tables match the tile
      // shown directly below exactly.
      const hasOverrides = !!(overrides && (overrides.efin || overrides.taxOffice));
      if (!hasOverrides) {
        const sib = siblingTables.find(s => s.title === fee);
        if (sib) return sib.total;
      }
      let total = 0;
      for (const r of rows) {
        const efin = String(r.data['EFIN'] ?? '').trim();
        const ptin = String(r.data['PTIN'] ?? '').trim();
        const sourceOffice = resolveBackendTaxOffice(efin, ptin, backendLookups);
        if (!sourceOffice) continue;
        const { perFee } = getBackendRowContribution(r.data, sourceOffice, backendCtx);
        total += perFee[fee] || 0;
      }
      return total;
    }
    return rows.reduce((sum, row) => sum + parseNum(row.data[def.key]), 0);
  };

  // Build the set of offices in the downline of `root` (inclusive) using parentMap.
  const getDownlineSet = (root: string): Set<string> => {
    const set = new Set<string>([root]);
    let added = true;
    while (added) {
      added = false;
      Object.entries(parentMap).forEach(([child, parent]) => {
        if (set.has(parent) && !set.has(child)) { set.add(child); added = true; }
      });
    }
    return set;
  };

  const computeDownlineField = (id: string, overrides?: FieldFilters): number => {
    const def = ALL_DOWNLINE_VIRTUALS.find(v => v.id === id);
    if (!def) return 0;
    const downline = def.extraOffices && def.extraOffices.length > 0
      ? new Set<string>([def.rootOffice, ...def.extraOffices])
      : getDownlineSet(def.rootOffice);
    let rows = taggedRows.filter(r => r.dataset === def.dataset && downline.has(r.resolvedTaxOffice || ''));
    if (def.efinFilter) {
      const wanted = def.efinFilter;
      rows = rows.filter(r => String(r.data['EFIN'] ?? '').trim() === wanted);
    }
    if (def.extraOfficesEfinFilter && def.extraOffices && def.extraOffices.length > 0) {
      const extras = new Set(def.extraOffices);
      const wanted = def.extraOfficesEfinFilter;
      rows = rows.filter(r => {
        if (!extras.has(r.resolvedTaxOffice || '')) return true;
        return String(r.data['EFIN'] ?? '').trim() === wanted;
      });
    }
    rows = applyFieldFilters(rows, overrides);
    return rows.reduce((s, r) => s + parseNum(r.data[def.sourceKey]), 0);
  };

  const computeOfficeGroupField = (id: string, overrides?: FieldFilters): number => {
    const def = ALL_OFFICE_GROUP_VIRTUALS.find(v => v.id === id);
    if (!def) return 0;
    const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
    const set = new Set(def.offices.map(norm));
    let rows = taggedRows.filter(r => r.dataset === def.dataset && set.has(norm(r.resolvedTaxOffice || '')));
    if (def.efinFilter) {
      const wanted = def.efinFilter;
      const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
      const scopedOffices = def.efinFilterOffices && def.efinFilterOffices.length > 0
        ? new Set(def.efinFilterOffices.map(norm))
        : null;
      rows = rows.filter(r => {
        if (scopedOffices && !scopedOffices.has(norm(r.resolvedTaxOffice || ''))) return true;
        return String(r.data['EFIN'] ?? '').trim() === wanted;
      });
    }
    rows = applyFieldFilters(rows, overrides);
    if (def.computed) {
      return rows.reduce((sum, row) => {
        if (!row.processed) return sum;
        if (def.computed === 'pay') return sum + row.processed.pay;
        if (def.computed === 'preparer_share') return sum + row.processed.preparerShare;
        if (def.computed === 'after_advance') return sum + row.processed.afterAdvance;
        return sum;
      }, 0);
    }
    return rows.reduce((s, r) => s + parseNum(r.data[def.sourceKey]), 0);
  };

  // Canonical auto-computed fields, mirroring buildOfficeReport in calculationEngine.
  const computeAutoField = (id: string, overrides?: FieldFilters): number => {
    if (id === '__auto_backend_total__') {
      const rows = applyFieldFilters(rowsForDataset('backend'), overrides);
      return rows.reduce((s, r) => s + parseNum(r.data['Received Tax Prep Fee(s)']), 0);
    }
    if (id === '__auto_neg_received__') {
      // Mirror the displayed "Received Tax Prep Fees" row, which overrides to
      // the Source Rows total when available — so calculated fields like
      // "Higher View Cut" stay consistent with the values shown above.
      if (officeScope && alignmentCtx) {
        const src = alignmentCtx.getSourceTotalForField(officeScope, 'Received Tax Prep Fees');
        if (src && src.key === '__received') return -src.total;
      }
      const rows = applyFieldFilters(rowsForDataset('payroll'), overrides);
      return -rows.reduce((s, r) => s + parseNum(r.data['Received Tax Prep Fee(s)']), 0);
    }
    if (id === '__auto_higher_view_cut__') {
      // −(Received Tax Prep Fees) + Pay, using Source Rows totals (src) when
      // available so the value always matches the badges shown above.
      let received: number | null = null;
      let pay: number | null = null;
      if (officeScope && alignmentCtx) {
        const totals = alignmentCtx.getSourceTotals(officeScope);
        const rs = totals.find(s => s.key === '__received');
        const ps = totals.find(s => s.key === '__pay');
        if (rs) received = rs.total;
        if (ps) pay = ps.total;
      }
      if (received === null) {
        const rows = applyFieldFilters(rowsForDataset('payroll'), overrides);
        received = rows.reduce((s, r) => s + parseNum(r.data['Received Tax Prep Fee(s)']), 0);
      }
      if (pay === null) {
        const rows = applyFieldFilters(rowsForDataset('payroll'), overrides);
        pay = rows.reduce((s, r) => s + (r.processed?.pay ?? 0), 0);
      }
      return -received + pay;
    }
    if (id === '__auto_agi__') {
      // AGI = Pay (src) + Fees Due (Fees Due is stored as a negative value,
      // so adding it subtracts the amount). Pay prefers the Source Rows
      // total so it matches the badge shown above; Fees Due is read from
      // the sibling "Fees Due" summary table total.
      let pay: number | null = null;
      if (officeScope && alignmentCtx) {
        const ps = alignmentCtx.getSourceTotals(officeScope).find(s => s.key === '__pay');
        if (ps) pay = ps.total;
      }
      if (pay === null) {
        const rows = applyFieldFilters(rowsForDataset('payroll'), overrides);
        pay = rows.reduce((s, r) => s + (r.processed?.pay ?? 0), 0);
      }
      const feesDueTable = siblingTables.find(
        t => (t.title || '').trim().toLowerCase() === 'fees due',
      );
      // Fees Due sibling stores a positive magnitude (the negation is applied
      // only when displayed via a __table__ field with negate=true). AGI is
      // Pay net of Fees Due, so always subtract the magnitude regardless of
      // sign, to stay consistent with the "Fees Due (−)" row above.
      const feesDue = feesDueTable ? Math.abs(feesDueTable.total) : 0;
      return pay - feesDue;
    }
    if (id === '__auto_sb_ero3_efile__') {
      // Sum exactly the three canonical BackendFeeTable tile totals:
      // Service Bureau Fee + E-File-EFIN + ERO3-EFIN. These are the
      // values shown in the tiles row and are the source of truth.
      const pickById = (tileId: string) =>
        siblingTables.find(s => s.id === tileId)?.total ?? 0;
      const sb = pickById('__bf_sbf');
      const efile = pickById('__bf_efile_efin');
      const ero3 = pickById('__bf_ero3_efin');
      return sb + efile + ero3;
    }
    return 0;
  };

  const computeRawValue = (field: TableField): number => {
    if (field.type === 'custom') {
      // Back-compat: auto-upgrade any saved "Higher View Cut" custom row to
      // the built-in formula so existing tables pick up the live value.
      if ((field.label || '').trim().toLowerCase() === 'higher view cut') {
        return computeAutoField('__auto_higher_view_cut__', field.filters);
      }
      if ((field.label || '').trim().toLowerCase() === 'agi') {
        return computeAutoField('__auto_agi__', field.filters);
      }
      // "Processing Fee" uses manual customValue when set; otherwise auto-computes as $10 × payroll rows in scope
      if ((field.label || '').trim().toLowerCase() === 'processing fee') {
        if (field.customValue != null) return field.customValue;
        return rowsForDataset('payroll').length * 10;
      }
      return field.customValue ?? 0;
    }
    if (field.type === 'calculated') {
      if (field.operands && field.operands.length > 0) return evaluateOperands(field.operands);
      return evaluateFormula(field.formula || '');
    }
    if (field.fieldId.startsWith('__table__')) {
      const tid = field.fieldId.slice('__table__'.length);
      const sib = siblingTables.find(s => s.id === tid);
      const v = sib ? sib.total : 0;
      return field.negate ? -v : v;
    }
    if (field.fieldId.startsWith('__auto_')) {
      return computeAutoField(field.fieldId, field.filters);
    }
    if (field.fieldId.startsWith('__downline_')) {
      return computeDownlineField(field.fieldId, field.filters);
    }
    if (field.fieldId.startsWith('__office_group_')) {
      return computeOfficeGroupField(field.fieldId, field.filters);
    }
    if (field.fieldId.startsWith('__efin_efile__') || field.fieldId.startsWith('__efin_ero3__')) {
      const isEro3 = field.fieldId.startsWith('__efin_ero3__');
      const prefix = isEro3 ? '__efin_ero3__' : '__efin_efile__';
      const sourceKey = isEro3 ? 'ERO3Fee' : 'E-File Fee(s)';
      const efin = field.fieldId.slice(prefix.length);
      // Virtual EFIN fields are not scoped to officeScope — they sum across ALL backend rows
      // with the matching EFIN (primary + fallback together), mirroring the
      // BackendFeeTable EFIN tile semantics.
      const fallback = Object.values(EFIN_VIRTUAL_FIELDS).flat().find(v => v.id === field.fieldId)?.fallbackEfin;
      const efinSet = new Set<string>([efin]);
      if (fallback) efinSet.add(fallback);
      let rows = taggedRows.filter(r => r.dataset === 'backend' && efinSet.has(String(r.data['EFIN'] || '')));
      rows = applyFieldFilters(rows, field.filters);
      return rows.reduce((s, r) => s + parseNum(r.data[sourceKey]), 0);
    }
    const def = FIELD_REGISTRY.find(f => f.id === field.fieldId);
    if (!def) return 0;
    return sumFieldDef(def, field.filters);
  };

  const computeValue = (field: TableField): number => {
    // Auto-computed fields always use their own formula; don't let alias-based
    // Source Rows matches (e.g. label substrings) override the value.
    if (field.fieldId && field.fieldId.startsWith('__auto_')) {
      return computeRawValue(field);
    }
    // Per user request: when a table field maps to a Source Rows total, the
    // displayed value reads directly from that source total so it always
    // matches the "src" badge (no drift between the table and Source Rows).
    if (field.type !== 'custom' && officeScope && alignmentCtx) {
      // Match by fieldId first (handles renamed labels), then by label.
      let src: ReturnType<typeof alignmentCtx.getSourceTotalForField> | null = null;
      if (field.fieldId === 'p_received' || field.fieldId === 'p_pay') {
        const wantKey = field.fieldId === 'p_received' ? '__received' : '__pay';
        src = (alignmentCtx.getSourceTotals(officeScope).find(s => s.key === wantKey)) || null;
      }
      if (!src) src = alignmentCtx.getSourceTotalForField(officeScope, field.label);
      if (src) return field.negate ? -src.total : src.total;
    }
    return computeRawValue(field);
  };

  const resolveOperand = (token: string, overrides?: FieldFilters): number => {
    const tableField = config.fields.find(f => f.id === token);
    if (tableField) return computeValue(tableField);

    if (token.startsWith('__table__')) {
      let rest = token.slice('__table__'.length);
      let neg = false;
      if (rest.endsWith('__neg')) { neg = true; rest = rest.slice(0, -'__neg'.length); }
      const sib = siblingTables.find(s => s.id === rest);
      const v = sib ? sib.total : 0;
      return neg ? -v : v;
    }
    if (token.startsWith('__auto_')) {
      return computeAutoField(token, overrides);
    }
    if (token.startsWith('__downline_')) {
      return computeDownlineField(token, overrides);
    }
    if (token.startsWith('__office_group_')) {
      return computeOfficeGroupField(token, overrides);
    }
    if (token.startsWith('__efin_efile__') || token.startsWith('__efin_ero3__')) {
      const isEro3 = token.startsWith('__efin_ero3__');
      const prefix = isEro3 ? '__efin_ero3__' : '__efin_efile__';
      const sourceKey = isEro3 ? 'ERO3Fee' : 'E-File Fee(s)';
      const efin = token.slice(prefix.length);
      const fallback = Object.values(EFIN_VIRTUAL_FIELDS).flat().find(v => v.id === token)?.fallbackEfin;
      const efinSet = new Set<string>([efin]);
      if (fallback) efinSet.add(fallback);
      let rows = taggedRows.filter(r => r.dataset === 'backend' && efinSet.has(String(r.data['EFIN'] || '')));
      rows = applyFieldFilters(rows, overrides);
      return rows.reduce((s, r) => s + parseNum(r.data[sourceKey]), 0);
    }
    const def = FIELD_REGISTRY.find(f => f.id === token);
    if (def) return sumFieldDef(def, overrides);
    return Number(token) || 0;
  };

  const evaluateOperands = (operands: CalcOperand[]): number => {
    if (operands.length === 0) return 0;
    const valueOf = (op: CalcOperand) =>
      op.type === 'constant' ? Number(op.constant) || 0 : resolveOperand(op.fieldId, op.filters);
    let result = valueOf(operands[0]);
    for (let i = 1; i < operands.length; i++) {
      const op = operands[i];
      const v = valueOf(op);
      switch (op.operator) {
        case '+': result += v; break;
        case '-': result -= v; break;
        case '×': result *= v; break;
        case '÷': result = v !== 0 ? result / v : result; break;
      }
    }
    return result;
  };

  const evaluateFormula = (formula: string): number => {
    const parts = formula.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 0;
    let result = resolveOperand(parts[0]);
    for (let i = 1; i < parts.length - 1; i += 2) {
      const op = parts[i];
      const val = resolveOperand(parts[i + 1]);
      switch (op) {
        case '+': result += val; break;
        case '-': result -= val; break;
        case '×': result *= val; break;
        case '÷': result = val !== 0 ? result / val : result; break;
      }
    }
    return result;
  };

  const runningTotal = useMemo(() => {
    let total = 0;
    let pendingOp: Operator | undefined;
    config.fields.forEach(field => {
      const val = computeValue(field);
      if (pendingOp) {
        switch (pendingOp) {
          case '+': total += val; break;
          case '-': total -= val; break;
          case '×': total *= val; break;
          case '÷': total = val !== 0 ? total / val : total; break;
        }
      } else {
        total = val;
      }
      pendingOp = field.operator;
    });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.fields, filteredRows, siblingTables]);

  // Report total upstream so other tables can reference it
  useEffect(() => {
    onTotalChange?.(runningTotal);
    if (alignmentCtx && officeScope) {
      alignmentCtx.reportTableTotal(officeScope, config.id, config.title, runningTotal);
    }
  }, [runningTotal, onTotalChange, alignmentCtx, officeScope, config.id, config.title]);

  useEffect(() => {
    if (!onExportData) return;
    const rows = config.fields.map((f, idx) => ({
      label: f.label,
      operator: idx === 0 ? undefined : f.operator,
      value: computeValue(f),
    }));
    onExportData({ title: config.title, rows, total: runningTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.title, config.fields, filteredRows, siblingTables, runningTotal]);

  // Emit per-field computed values so parents can run cross-table checks
  // (e.g. verify auto fields equal the sum of their source siblings).
  useEffect(() => {
    if (!onFieldValues) return;
    const out: Record<string, number> = {};
    config.fields.forEach(f => {
      const key = `${config.id}:${f.fieldId || f.id}`;
      out[key] = computeValue(f);
    });
    onFieldValues(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, config.fields, filteredRows, siblingTables, runningTotal]);

  const updateField = (fieldId: string, updates: Partial<TableField>) => {
    onChange({ ...config, fields: config.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) });
  };

  const removeField = (fieldId: string) => {
    onChange({ ...config, fields: config.fields.filter(f => f.id !== fieldId) });
  };

  const addField = (fieldDef: { id: string; label: string }) => {
    let storedId = fieldDef.id;
    let negate = false;
    if (storedId.startsWith('__table__') && storedId.endsWith('__neg')) {
      storedId = storedId.slice(0, -'__neg'.length);
      negate = true;
    }
    const newField: TableField = {
      id: `${fieldDef.id}_${Date.now()}`,
      fieldId: storedId,
      label: fieldDef.label,
      type: 'field',
      ...(negate ? { negate: true } : {}),
    };
    onChange({ ...config, fields: [...config.fields, newField] });
  };

  const addCustomRow = () => {
    const newField: TableField = {
      id: `custom_${Date.now()}`,
      fieldId: 'custom',
      label: 'Custom Value',
      type: 'custom',
      customValue: 0,
    };
    onChange({ ...config, fields: [...config.fields, newField] });
  };

  const addCalcField = (label: string, formula: string, operands?: CalcOperand[]) => {
    const newField: TableField = {
      id: `calc_${Date.now()}`,
      fieldId: 'calculated',
      label,
      type: 'calculated',
      formula,
      operands,
    };
    onChange({ ...config, fields: [...config.fields, newField] });
  };

  // All EFINs available across data (used by per-field filter popovers, ignoring overrides)
  const allEfins = useMemo(() => {
    const scoped = officeScope
      ? taggedRows.filter(r => matchesScopeRow(r))
      : taggedRows;
    return [...new Set(scoped.map(r => String(r.data['EFIN'] || '')).filter(Boolean))].sort();
  }, [taggedRows, officeScope, consolidatedScope, scopeEfinSet, payrollScopeEfin]);

  const officeOptionsForFilters = useMemo(
    () => (officeScope ? [officeScope] : officeList),
    [officeScope, officeList],
  );

  const setFilter = (key: keyof typeof config.filters, value: string) => {
    onChange({ ...config, filters: { ...config.filters, [key]: value } });
  };

  const headerBg = config.color || undefined;

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden flex flex-col w-full min-w-0 align-top">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border"
        style={headerBg ? { backgroundColor: headerBg } : undefined}
      >
        <div className="flex items-center gap-2 flex-1">
          {editingTitle ? (
            <Input
              autoFocus
              className="h-7 text-sm font-semibold max-w-[200px]"
              value={config.title}
              onChange={e => onChange({ ...config, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
            />
          ) : (
            <h3
              className={cn("text-sm font-semibold cursor-pointer flex items-center gap-1", headerBg && "text-white")}
              onDoubleClick={() => !readOnly && setEditingTitle(true)}
            >
              {config.title}
              {!readOnly && <Pencil className="h-3 w-3 opacity-60" />}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("h-7 w-7", headerBg && "text-white hover:bg-white/20")}>
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex gap-1 flex-wrap max-w-[200px]">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.label}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                      config.color === c.value ? "border-primary scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c.value || 'hsl(var(--muted))' }}
                    onClick={() => onChange({ ...config, color: c.value })}
                    title={c.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>}
          {!readOnly && <Button variant="ghost" size="icon" className={cn("h-7 w-7", headerBg && "text-white hover:bg-white/20")} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/20">
        <Select value={config.filters.efin || '_all'} onValueChange={v => setFilter('efin', v === '_all' ? '' : v)}>
          <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue placeholder="All EFINs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All EFINs</SelectItem>
            {filterOptions.efins.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={config.filters.taxOffice || '_all'} onValueChange={v => setFilter('taxOffice', v === '_all' ? '' : v)}>
          <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue placeholder="All Offices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Offices</SelectItem>
            {scopedOfficeList.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={config.filters.preparer || '_all'} onValueChange={v => setFilter('preparer', v === '_all' ? '' : v)}>
          <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue placeholder="All Preparers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Preparers</SelectItem>
            {scopedPreparerList.map(p => <SelectItem key={p.ptin} value={p.ptin}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {config.fields.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No fields added yet. Click "Add Field" to get started.
          </div>
        )}
        {config.fields.map((field, idx) => {
          const val = computeValue(field);
          const rowColor = field.textColor || undefined;

          return (
            <div
              key={field.id}
              onDragOver={e => { if (dragFieldId) { e.preventDefault(); setDragOverFieldId(field.id); } }}
              onDrop={e => {
                if (dragFieldId) {
                  e.preventDefault();
                  reorderFields(dragFieldId, field.id);
                }
                setDragFieldId(null);
                setDragOverFieldId(null);
              }}
              onDragLeave={() => { if (dragOverFieldId === field.id) setDragOverFieldId(null); }}
              className={cn(dragOverFieldId === field.id && dragFieldId !== field.id && "ring-2 ring-primary/50 rounded")}
            >
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 group",
                idx % 2 === 1 && "bg-muted/30",
                dragFieldId === field.id && "opacity-50"
              )}>
                <span
                  draggable
                  onDragStart={e => {
                    setDragFieldId(field.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => { setDragFieldId(null); setDragOverFieldId(null); }}
                  className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </span>
                <div className="flex-1 min-w-0">
                  {editingFieldId === field.id ? (
                    <Input
                      autoFocus
                      className="h-6 text-sm w-full"
                      value={field.label}
                      onChange={e => updateField(field.id, { label: e.target.value })}
                      onBlur={() => setEditingFieldId(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditingFieldId(null)}
                    />
                  ) : (
                    <span
                      className="text-sm cursor-pointer hover:underline flex items-center gap-1 truncate"
                      onDoubleClick={() => setEditingFieldId(field.id)}
                      style={rowColor ? { color: rowColor } : undefined}
                    >
                      {field.type === 'calculated' && <Calculator className="h-3 w-3 text-primary shrink-0" />}
                      <span className="truncate">{field.label}</span>
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </span>
                  )}
                  {field.type !== 'custom' && !(field.fieldId && field.fieldId.startsWith('__auto_')) && (
                    <SourceTotalBadge
                      officeScope={officeScope}
                      field={field.label}
                      tableValue={val}
                      className="mt-0.5"
                    />
                  )}
                </div>
                <div className="w-28 flex justify-end shrink-0">
                  {field.type === 'custom' ? (
                    <Input
                      className="h-6 w-full text-right text-sm tabular-nums"
                      type="number"
                      value={field.customValue ?? 0}
                      onChange={e => updateField(field.id, { customValue: Number(e.target.value) })}
                      style={rowColor ? { color: rowColor } : undefined}
                    />
                  ) : (
                     <span
                       className="text-sm font-medium tabular-nums"
                      style={rowColor ? { color: rowColor } : undefined}
                    >
                      {fmt(val)}
                    </span>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      title="Text color"
                    >
                      <Palette className="h-3 w-3" style={rowColor ? { color: rowColor } : undefined} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c.label}
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                            (field.textColor || '') === c.value ? "border-primary scale-110" : "border-border"
                          )}
                          style={{ backgroundColor: c.value || 'hsl(var(--muted))' }}
                          onClick={() => updateField(field.id, { textColor: c.value || undefined })}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => removeField(field.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {idx < config.fields.length - 1 && (
                <OperatorRow
                  operator={field.operator}
                  onChange={op => updateField(field.id, { operator: op })}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer aggregation (configurable) */}
      {config.fields.length > 0 && (() => {
        const agg: FooterAggregation = config.footerAggregation || 'running';
        if (agg === 'none') return null;
        const values = config.fields.map(f => computeValue(f));
        let footerValue = 0;
        let defaultLabel = '';
        switch (agg) {
          case 'running':
            footerValue = runningTotal;
            defaultLabel = 'Running Total';
            break;
          case 'sum':
            footerValue = values.reduce((a, b) => a + b, 0);
            defaultLabel = 'Sum';
            break;
          case 'average':
            footerValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            defaultLabel = 'Average';
            break;
          case 'min':
            footerValue = values.length ? Math.min(...values) : 0;
            defaultLabel = 'Min';
            break;
          case 'max':
            footerValue = values.length ? Math.max(...values) : 0;
            defaultLabel = 'Max';
            break;
          case 'count':
            footerValue = values.length;
            defaultLabel = 'Count';
            break;
          case 'calculated':
            footerValue = config.footerOperands && config.footerOperands.length > 0
              ? evaluateOperands(config.footerOperands)
              : 0;
            defaultLabel = 'Calculated';
            break;
        }
        const label = config.footerLabel || defaultLabel;
        return (
          <div className="flex justify-between items-center gap-2 px-4 py-2 bg-primary/10 border-t border-border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title={`Footer: ${defaultLabel} (click to change)`}
                  >
                    <Sigma className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs">
                  {([
                    ['running', 'Running Total'],
                    ['sum', 'Sum'],
                    ['average', 'Average'],
                    ['min', 'Minimum'],
                    ['max', 'Maximum'],
                    ['count', 'Count'],
                    ['calculated', 'Calculated Field'],
                    ['none', 'None (hide)'],
                  ] as [FooterAggregation, string][]).map(([val, lbl]) => (
                    <DropdownMenuItem
                      key={val}
                      onClick={() => {
                        onChange({ ...config, footerAggregation: val });
                        if (val === 'calculated') setFooterCalcOpen(true);
                      }}
                      className="text-xs gap-2"
                    >
                      <Check className={cn('h-3 w-3', agg === val ? 'opacity-100' : 'opacity-0')} />
                      {lbl}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {editingFooterLabel ? (
                <Input
                  autoFocus
                  className="h-6 text-sm font-semibold max-w-[180px]"
                  value={config.footerLabel ?? label}
                  onChange={e => onChange({ ...config, footerLabel: e.target.value })}
                  onBlur={() => setEditingFooterLabel(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditingFooterLabel(false)}
                />
              ) : (
                <span
                  className="text-sm font-semibold truncate cursor-pointer hover:underline flex items-center gap-1"
                  onDoubleClick={() => setEditingFooterLabel(true)}
                  title="Double-click to rename"
                >
                  {label}
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-60" />
                </span>
              )}
              <SourceTotalBadge
                officeScope={officeScope}
                field={label}
                tableValue={footerValue}
              />
              {agg === 'calculated' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFooterCalcOpen(true)}
                  title="Edit calculated footer"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="w-28 flex justify-end shrink-0">
              <span className="font-bold tabular-nums">
                {agg === 'count' ? footerValue : fmt(footerValue)}
              </span>
            </div>
            {/* spacer matching the per-row delete button (h-6 w-6 + gap-2 = 24px + 8px) */}
            <div className="w-6 shrink-0" />
          </div>
        );
      })()}

      {/* Actions */}
      {!readOnly && <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-border">
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setFieldPickerOpen(true)}>
          <Plus className="h-3 w-3" /> Add Field
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={addCustomRow}>
          <Plus className="h-3 w-3" /> Custom Value
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setCalcOpen(true)}>
          <Calculator className="h-3 w-3" /> Calculated Field
        </Button>
        {(config.footerAggregation || 'running') === 'none' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1 ml-auto"
            onClick={() => onChange({ ...config, footerAggregation: 'running' })}
          >
            Show Footer
          </Button>
        )}
      </div>}

      <FieldPicker
        open={fieldPickerOpen}
        onClose={() => setFieldPickerOpen(false)}
        onSelect={f => addField(f)}
        existingFieldIds={config.fields.map(f => f.fieldId)}
        siblingTables={siblingTables}
        officeScope={officeScope}
        onSelectTemplate={(t) => addCalcField(t.name, '', t.operands)}
      />
      <CalculatedFieldDialog
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        onAdd={addCalcField}
        existingFields={config.fields}
        siblingTables={siblingTables}
        efinOptions={allEfins}
        officeOptions={officeOptionsForFilters}
        inheritEfin={config.filters.efin || undefined}
        inheritTaxOffice={config.filters.taxOffice || officeScope || undefined}
        officeScope={officeScope}
      />
      <CalculatedFieldDialog
        key={`footer-${config.id}-${footerCalcOpen ? 'open' : 'closed'}`}
        open={footerCalcOpen}
        onClose={() => setFooterCalcOpen(false)}
        onAdd={(label, _formula, operands) => {
          onChange({
            ...config,
            footerAggregation: 'calculated',
            footerLabel: label || 'Calculated',
            footerOperands: operands,
          });
        }}
        existingFields={config.fields}
        siblingTables={siblingTables}
        efinOptions={allEfins}
        officeOptions={officeOptionsForFilters}
        inheritEfin={config.filters.efin || undefined}
        inheritTaxOffice={config.filters.taxOffice || officeScope || undefined}
        title="Footer Calculated Value"
        initialLabel={config.footerLabel || ''}
        initialOperands={config.footerOperands}
        submitText="Save"
        officeScope={officeScope}
      />
    </div>
  );
}
