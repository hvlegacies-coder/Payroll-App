// Shared processor that resolves a raw Payroll Report row into a fully-computed
// row including Pay, Preparer Share, After Advance, Tax Office, and Preparer.
// Mirrors the logic in PayrollProcessing.tsx so other pages (e.g. Office Summary)
// can consume the same computed values.

import { supabase } from '@/integrations/supabase/client';
import { fuzzySimilarity } from '@/services/fuzzyMatch';

export interface OfficeConfig {
  process_advance: boolean;
  share_percent: number;
  process_preparers_share: boolean;
  default_preparers_share: string;
  clients_belongs_data: string;
}

export interface PreparerInfo {
  contractor: string;
  tax_office: string;
  preparer_client_percent: number;
  office_flat_rate: number;
}

interface ClientLookupEntry {
  ssnLast4: string;
  lastName: string;
  firstName: string;
  belongsTo: string;
  priority: number;
}

interface AdvanceEntry {
  ssnLast4: string;
  lastName: string;
  firstName: string;
}

export interface PayrollLookups {
  ptinToPreparers: Record<string, PreparerInfo[]>;
  efinToOffices: Record<string, string[]>;
  officeLookup: Record<string, OfficeConfig>;
  officeNames: string[];
  clientLookupEntries: ClientLookupEntry[];
  advanceRows: AdvanceEntry[];
}

const extractLast4 = (value: string) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : digits;
};
const normalizeNameForMatch = (value: string) =>
  String(value ?? '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\b[a-z]\b/g, '').replace(/[^a-z0-9]/g, '').trim();
const splitClientName = (value: string) => {
  const [lastName = '', ...firstNameParts] = String(value ?? '').split(',');
  return { lastName: lastName.trim(), firstName: firstNameParts.join(',').trim() };
};

async function fetchAllRows(uploadIds: string[]): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  for (let i = 0; i < uploadIds.length; i += 10) {
    const batch = uploadIds.slice(i, i + 10);
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('upload_rows')
        .select('row_data')
        .in('upload_id', batch)
        .range(from, from + pageSize - 1);
      if (error) break;
      if (data) out.push(...data.map(d => d.row_data as Record<string, any>));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }
  return out;
}

export async function fetchPayrollLookups(weekLabel?: string): Promise<PayrollLookups> {
  const clientUploadsQuery = supabase.from('uploads').select('id').eq('type', 'Client Data Report');
  const advanceUploadsQuery = supabase.from('uploads').select('id').eq('type', 'Advance Report');
  if (weekLabel) {
    clientUploadsQuery.eq('week_label', weekLabel);
    advanceUploadsQuery.eq('week_label', weekLabel);
  }
  const [{ data: offices }, { data: preparersData }, { data: clientUploads }, { data: advanceUploads }] = await Promise.all([
    supabase.from('offices').select('office_name, primary_efin, secondary_efin, clients_belongs_data, process_advance, share_percent, process_preparers_share, default_preparers_share').eq('active', true),
    supabase.from('preparers').select('ptin, contractor, tax_office, preparer_client_percent, office_flat_rate').eq('active', true),
    clientUploadsQuery,
    advanceUploadsQuery,
  ]);

  const ptinToPreparers: Record<string, PreparerInfo[]> = {};
  if (preparersData) {
    for (const p of preparersData) {
      if (!p.ptin) continue;
      const key = p.ptin.trim().toLowerCase();
      if (!ptinToPreparers[key]) ptinToPreparers[key] = [];
      ptinToPreparers[key].push({
        contractor: p.contractor,
        tax_office: p.tax_office,
        preparer_client_percent: p.preparer_client_percent ?? 0,
        office_flat_rate: p.office_flat_rate ?? 0,
      });
    }
  }

  const efinToOffices: Record<string, string[]> = {};
  const officeLookup: Record<string, OfficeConfig> = {};
  const officeNames: string[] = [];
  if (offices) {
    for (const o of offices) {
      officeNames.push(o.office_name);
      officeLookup[o.office_name] = {
        process_advance: o.process_advance,
        share_percent: Number(o.share_percent) || 0,
        process_preparers_share: o.process_preparers_share,
        default_preparers_share: (o as any).default_preparers_share || '',
        clients_belongs_data: o.clients_belongs_data || '',
      };
      for (const efin of [o.primary_efin, o.secondary_efin]) {
        if (efin) {
          if (!efinToOffices[efin]) efinToOffices[efin] = [];
          if (!efinToOffices[efin].includes(o.office_name)) efinToOffices[efin].push(o.office_name);
        }
      }
    }
  }

  // Load client data rows + client_overrides
  const clientRows = clientUploads && clientUploads.length > 0
    ? await fetchAllRows(clientUploads.map(u => u.id))
    : [];

  let overridesData: { ssn_ein: string; client_name: string; client_belongs_to: string }[] = [];
  {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('client_overrides')
        .select('ssn_ein, client_name, client_belongs_to')
        .range(from, from + pageSize - 1);
      if (error) break;
      if (data) overridesData.push(...data);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }

  const clientLookupEntries: ClientLookupEntry[] = [];
  for (const cr of clientRows) {
    const gClient = (key: string) => {
      if (cr[key] !== undefined) return String(cr[key]).trim();
      for (const k of Object.keys(cr)) {
        if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) {
          return String(cr[k]).trim();
        }
      }
      return '';
    };
    const ssnEin = gClient('SSN/EIN') || gClient('SSN_EIN') || gClient('SSNEIN') || gClient('SSN');
    const clientName = gClient('Client Name') || gClient('CLIENT_NAME') || gClient('ClientName');
    const belongsTo = gClient('Client Belongs To') || gClient('CLIENT_BELONGS_TO') || gClient('ClientBelongsTo');
    if (ssnEin && clientName && belongsTo) {
      const { lastName, firstName } = splitClientName(clientName);
      if (lastName && firstName) {
        clientLookupEntries.push({ ssnLast4: extractLast4(ssnEin), lastName, firstName, belongsTo, priority: 0 });
      }
    }
  }
  for (const ov of overridesData) {
    if (ov.client_belongs_to) {
      const { lastName, firstName } = splitClientName(ov.client_name);
      if (lastName && firstName) {
        clientLookupEntries.push({ ssnLast4: extractLast4(ov.ssn_ein), lastName, firstName, belongsTo: ov.client_belongs_to, priority: 1 });
      }
    }
  }

  // Load advance rows (deduped)
  const advanceRows: AdvanceEntry[] = [];
  if (advanceUploads && advanceUploads.length > 0) {
    const advRows = await fetchAllRows(advanceUploads.map(u => u.id));
    const seenKeys = new Set<string>();
    for (const rd of advRows) {
      const gAdv = (key: string) => {
        if (rd[key] !== undefined) return String(rd[key]).trim();
        for (const k of Object.keys(rd)) {
          if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) return String(rd[k]).trim();
        }
        return '';
      };
      const ssn = gAdv('SSN');
      const ssnDigits = ssn.replace(/\D/g, '');
      const last4 = ssnDigits.length >= 4 ? ssnDigits.slice(-4) : ssnDigits;
      const lastName = gAdv('Last Name') || gAdv('LAST_NAME');
      const firstName = gAdv('First Name') || gAdv('FIRST_NAME');
      const dedupKey = `${last4}-${lastName.toLowerCase()}-${firstName.toLowerCase()}`;
      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        advanceRows.push({ ssnLast4: last4, lastName, firstName });
      }
    }
  }

  return {
    ptinToPreparers,
    efinToOffices,
    officeLookup,
    officeNames: officeNames.sort(),
    clientLookupEntries,
    advanceRows,
  };
}

export function resolvePreparer(efin: string, ptin: string, lookups: PayrollLookups): PreparerInfo {
  const matches = lookups.ptinToPreparers[(ptin || '').trim().toLowerCase()];
  if (!matches || matches.length === 0) {
    return { contractor: '', tax_office: '', preparer_client_percent: 0, office_flat_rate: 0 };
  }
  if (matches.length === 1) return matches[0];
  const efinOfficeNames = lookups.efinToOffices[efin] || [];
  for (const m of matches) {
    if (efinOfficeNames.includes(m.tax_office)) return m;
  }
  return matches[0];
}

function resolveClientBelongsTo(ssnLast4: string, lastName: string, firstName: string, entries: ClientLookupEntry[]): string {
  const nLast = normalizeNameForMatch(lastName);
  const nFirst = normalizeNameForMatch(firstName);
  // Pass 1: overrides
  for (const e of entries) {
    if (e.priority < 1) continue;
    if (e.ssnLast4 !== ssnLast4) continue;
    const ls = fuzzySimilarity(normalizeNameForMatch(e.lastName), nLast);
    const fs = fuzzySimilarity(normalizeNameForMatch(e.firstName), nFirst);
    if (ls >= 0.85 && fs >= 0.85) return e.belongsTo;
  }
  // Pass 2: raw client data
  let best: ClientLookupEntry | null = null;
  let bestScore = -1;
  for (const e of entries) {
    if (e.priority > 0) continue;
    if (e.ssnLast4 !== ssnLast4) continue;
    const ls = fuzzySimilarity(normalizeNameForMatch(e.lastName), nLast);
    const fs = fuzzySimilarity(normalizeNameForMatch(e.firstName), nFirst);
    if (ls < 0.85 || fs < 0.85) continue;
    const total = ls + fs;
    if (total > bestScore) { bestScore = total; best = e; }
  }
  return best?.belongsTo || '';
}

function resolveAdvanceRequested(ssnLast4: string, lastName: string, firstName: string, advanceRows: AdvanceEntry[]): boolean {
  const nLast = normalizeNameForMatch(lastName);
  const nFirst = normalizeNameForMatch(firstName);
  return advanceRows.some(adv => {
    if (adv.ssnLast4 !== ssnLast4) return false;
    const ls = fuzzySimilarity(normalizeNameForMatch(adv.lastName), nLast);
    const fs = fuzzySimilarity(normalizeNameForMatch(adv.firstName), nFirst);
    return ls >= 0.85 && fs >= 0.85;
  });
}

const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[$,]/g, '')) || 0;
};

const getField = (raw: Record<string, any>, key: string): any => {
  if (raw[key] !== undefined) return raw[key];
  for (const k of Object.keys(raw)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) return raw[k];
  }
  return '';
};

export interface ProcessedPayrollRow {
  raw: Record<string, any>;
  efin: string;
  ptin: string;
  preparer: string;
  taxOffice: string;
  receivedTaxPrepFee: number;
  afterAdvance: number;
  pay: number;
  preparerShare: number;
  clientBelongsTo: string;
  advanceRequested: boolean;
}

/**
 * Processes a raw payroll row using the same logic as PayrollProcessing.tsx,
 * including Client Belongs To resolution and Advance lookup.
 */
export function processPayrollRow(raw: Record<string, any>, lookups: PayrollLookups): ProcessedPayrollRow {
  const efin = String(getField(raw, 'EFIN') || '').trim();
  const ptin = String(getField(raw, 'PTIN') || '').trim();
  const { contractor, tax_office, preparer_client_percent, office_flat_rate } = resolvePreparer(efin, ptin, lookups);
  const officeConfig = lookups.officeLookup[tax_office];

  const ssn = String(getField(raw, 'Taxpayer SSN') || getField(raw, 'TAXPAYER_SSN') || '');
  const ssnLast4 = extractLast4(ssn);
  const lastName = String(getField(raw, 'Taxpayer Last Name') || getField(raw, 'TAXPAYER_LAST_NAME') || '').trim();
  const firstName = String(getField(raw, 'Taxpayer First Name') || getField(raw, 'TAXPAYER_FIRST_NAME') || '').trim();

  const received = num(getField(raw, 'Received Tax Prep Fee(s)') || getField(raw, 'RECEIVED_TAX_PREP_FEE_S_'));
  const advanceRequested = resolveAdvanceRequested(ssnLast4, lastName, firstName, lookups.advanceRows);
  const clientBelongsTo = resolveClientBelongsTo(ssnLast4, lastName, firstName, lookups.clientLookupEntries);

  const afterAdvance = (advanceRequested && officeConfig?.process_advance)
    ? Math.max(0, received - 100)
    : received;
  // Fallback: when the preparer's tax_office isn't a configured active office
  // (e.g. legacy/sub-brand offices that share another office's EFIN), default
  // to a 100% share so the row's received amount still contributes to Pay
  // instead of silently dropping to $0.
  const pay = officeConfig
    ? afterAdvance * (officeConfig.share_percent / 100)
    : afterAdvance;

  let preparerShare = 0;
  if (officeConfig?.process_preparers_share) {
    const belongsLower = (clientBelongsTo || '').toLowerCase().trim();
    if (belongsLower === 'preparer') {
      preparerShare = Math.min(pay * (preparer_client_percent / 100), pay);
    } else if (belongsLower === '' || !clientBelongsTo) {
      const defaultShare = officeConfig.default_preparers_share || 'preparer_client_percent';
      if (defaultShare === 'preparer_client_percent') {
        preparerShare = Math.min(pay * (preparer_client_percent / 100), pay);
      } else {
        preparerShare = office_flat_rate;
      }
    } else {
      preparerShare = office_flat_rate;
    }
  }

  return {
    raw,
    efin,
    ptin,
    preparer: contractor,
    taxOffice: tax_office,
    receivedTaxPrepFee: received,
    afterAdvance,
    pay,
    preparerShare,
    clientBelongsTo,
    advanceRequested,
  };
}
