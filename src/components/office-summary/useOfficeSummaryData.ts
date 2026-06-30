import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPayrollLookups, type PayrollLookups } from '@/services/payrollRowProcessor';
import { buildBackendLookups, type BackendLookups, type FeeConfigEntry, type FeeType as BackendFeeType } from './backendContributors';

export interface OfficesPayload {
  officeList: string[];
  parentMap: Record<string, string>;
  officeEfinsMap: Record<string, string[]>;
  officePrimaryEfinMap: Record<string, string>;
  officeSecondaryEfinMap: Record<string, string>;
}

export interface OfficesPreparersLookups {
  offices: OfficesPayload;
  preparerList: { name: string; ptin: string }[];
  lookups: PayrollLookups;
}

export interface BackendCtxData {
  backendLookups: BackendLookups;
  feeConfigsBySource: Record<string, Record<BackendFeeType, FeeConfigEntry[]>>;
}

const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();

export function useOfficesAndPayrollLookups(selectedWeek: string | null | undefined, refreshTick: number) {
  return useQuery<OfficesPreparersLookups>({
    queryKey: ['os-offices-payroll', selectedWeek, refreshTick],
    enabled: !!selectedWeek,
    staleTime: 60_000,
    queryFn: async () => {
      const [officesRes, preparersRes, payLookups] = await Promise.all([
        supabase.from('offices').select('office_name, parent_office, primary_efin, secondary_efin').eq('active', true).order('office_name'),
        supabase.from('preparers').select('contractor, ptin').eq('active', true).order('contractor'),
        fetchPayrollLookups(selectedWeek as string),
      ]);
      const offices: OfficesPayload = {
        officeList: [],
        parentMap: {},
        officeEfinsMap: {},
        officePrimaryEfinMap: {},
        officeSecondaryEfinMap: {},
      };
      if (officesRes.data) {
        offices.officeList = officesRes.data.map((o: any) => o.office_name).filter(Boolean);
        const canon = new Map<string, string>();
        officesRes.data.forEach((o: any) => { if (o.office_name) canon.set(norm(o.office_name), o.office_name); });
        officesRes.data.forEach((o: any) => {
          const child = o.office_name;
          const rawParent = (o.parent_office || '').trim();
          const resolved = rawParent ? canon.get(norm(rawParent)) : '';
          if (child && resolved && resolved !== child) offices.parentMap[child] = resolved;
          if (child) {
            offices.officeEfinsMap[child] = [o.primary_efin, o.secondary_efin]
              .map((e: string) => (e || '').trim())
              .filter(Boolean);
            offices.officePrimaryEfinMap[child] = (o.primary_efin || '').trim();
            offices.officeSecondaryEfinMap[child] = (o.secondary_efin || '').trim();
          }
        });
      }
      const preparerList = (preparersRes.data || []).map((p: any) => ({ name: p.contractor, ptin: p.ptin }));
      return { offices, preparerList, lookups: payLookups };
    },
  });
}

export function useBackendCtxData() {
  return useQuery<BackendCtxData>({
    queryKey: ['os-backend-ctx'],
    staleTime: 60_000,
    queryFn: async () => {
      const [officesRes, preparersRes, configsRes] = await Promise.all([
        supabase.from('offices').select('office_name, parent_office, primary_efin, secondary_efin').eq('active', true),
        supabase.from('preparers').select('ptin, tax_office').eq('active', true),
        supabase.from('office_fee_configs').select('office_name, fee_type, target_office, mode, value'),
      ]);
      const backendLookups = buildBackendLookups(
        (officesRes.data || []) as any,
        (preparersRes.data || []) as any,
      );
      const grouped: Record<string, Record<BackendFeeType, FeeConfigEntry[]>> = {};
      for (const c of (configsRes.data || []) as any[]) {
        const src = c.office_name as string;
        const fee = c.fee_type as BackendFeeType;
        if (!src || !fee) continue;
        if (!grouped[src]) grouped[src] = {} as any;
        if (!grouped[src][fee]) grouped[src][fee] = [];
        grouped[src][fee].push({
          target_office: c.target_office,
          mode: c.mode,
          value: Number(c.value) || 0,
        });
      }
      return { backendLookups, feeConfigsBySource: grouped };
    },
  });
}

export interface TaggedRowRaw {
  dataset: 'payroll' | 'backend' | 'fee_intercept';
  data: Record<string, any>;
  resolvedTaxOffice?: string;
  // processed payroll attached by consumer (needs lookups)
}

export interface FundingRange { from: string | null; to: string | null }

function parseFundingDateStr(v: any): Date | null {
  if (!v) return null;
  // All funding dates are interpreted in US Eastern time to keep results
  // consistent regardless of the viewer's local timezone.
  const toEastern = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => {
    // Eastern is UTC-5 (EST) or UTC-4 (EDT). Use a fixed -5h anchor then let
    // JS compare as absolute instants; the daylight offset only shifts the
    // boundary by 1h which is well inside a full-day filter window.
    return new Date(Date.UTC(y, mo, d, h + 5, mi, s));
  };
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  }
  const str = String(v);
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = parseFloat(str);
    if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  }
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return toEastern(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toEastern(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function getFieldLoose(raw: Record<string, any>, key: string): any {
  if (raw[key] !== undefined) return raw[key];
  for (const k of Object.keys(raw)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) return raw[k];
  }
  return '';
}

export function useUploadRows(selectedWeek: string | null | undefined, refreshTick: number, uploadTypeMap: Record<string, string>, fundingRange?: FundingRange | null) {
  return useQuery<{ upload_id: string; row_data: any; dataset: TaggedRowRaw['dataset'] }[]>({
    queryKey: ['os-upload-rows', selectedWeek, refreshTick, fundingRange?.from || '', fundingRange?.to || ''],
    enabled: !!selectedWeek,
    staleTime: 60_000,
    queryFn: async () => {
      const datasets = Object.keys(uploadTypeMap);
      const { data: uploads } = await supabase
        .from('uploads')
        .select('id, type')
        .in('type', datasets.map(d => uploadTypeMap[d]))
        .eq('week_label', selectedWeek as string);
      if (!uploads || uploads.length === 0) return [];
      const typeToDataset: Record<string, string> = {};
      datasets.forEach(d => { typeToDataset[uploadTypeMap[d]] = d; });
      const uploadIdToDataset: Record<string, TaggedRowRaw['dataset']> = {};
      uploads.forEach((u: any) => { uploadIdToDataset[u.id] = typeToDataset[u.type] as TaggedRowRaw['dataset']; });
      const uploadIds = uploads.map((u: any) => u.id);
      // Fetch all batches in parallel
      const batchPromises: Promise<{ upload_id: string; row_data: any }[]>[] = [];
      for (let i = 0; i < uploadIds.length; i += 10) {
        const batch = uploadIds.slice(i, i + 10);
        batchPromises.push((async () => {
          const all: { upload_id: string; row_data: any }[] = [];
          let from = 0;
          while (true) {
            const { data } = await supabase
              .from('upload_rows')
              .select('upload_id, row_data')
              .in('upload_id', batch)
              .range(from, from + 999);
            if (data?.length) all.push(...data);
            if (!data || data.length < 1000) break;
            from += 1000;
          }
          return all;
        })());
      }
      const batchResults = await Promise.all(batchPromises);
      const out: { upload_id: string; row_data: any; dataset: TaggedRowRaw['dataset'] }[] = [];
      let lo: Date | undefined;
      let hi: Date | undefined;
      if (fundingRange && (fundingRange.from || fundingRange.to)) {
        lo = fundingRange.from ? parseFundingDateStr(fundingRange.from) || undefined : undefined;
        hi = fundingRange.to ? parseFundingDateStr(fundingRange.to) || undefined : undefined;
        if (lo && hi && lo.getTime() > hi.getTime()) { const t = lo; lo = hi; hi = t; }
        // Anchor day boundaries to Eastern time (start = 00:00 ET, end = 24:00 ET).
        if (lo) lo = new Date(lo.getTime()); // already 00:00 ET
        if (hi) hi = new Date(hi.getTime() + 86400000 - 1);
      }
      const rangeActive = !!(lo || hi);
      for (const arr of batchResults) {
        for (const r of arr) {
          const ds = uploadIdToDataset[r.upload_id];
          if (!ds) continue;
          if (rangeActive && (ds === 'payroll' || ds === 'backend')) {
            const fd = parseFundingDateStr(getFieldLoose(r.row_data || {}, 'Funding Date'));
            if (!fd) continue;
            if (lo && fd.getTime() < lo.getTime()) continue;
            if (hi && fd.getTime() > hi.getTime()) continue;
          }
          out.push({ upload_id: r.upload_id, row_data: r.row_data, dataset: ds });
        }
      }
      return out;
    },
  });
}