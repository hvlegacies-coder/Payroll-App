import { supabase } from '@/integrations/supabase/client';
import { fetchPayrollLookups } from '@/services/payrollRowProcessor';

export type CheckSeverity = 'error' | 'warning' | 'info';
export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface PrepToAdd {
  ptin: string;
  contractor: string;
}

export interface PrepToFix {
  ptin: string;
  contractor: string;
}

export type ResolveType = 'add_preparers' | 'set_share' | 'set_office';

export interface VerificationCheck {
  id: string;
  category: 'uploads' | 'preparer_matching' | 'data_quality';
  severity: CheckSeverity;
  status: CheckStatus;
  title: string;
  description: string;
  affectedCount: number;
  details: string[];
  fixPath?: string;
  fixLabel?: string;
  resolveType?: ResolveType;
  resolveData?: PrepToAdd[] | PrepToFix[];
}

export interface VerificationReport {
  weekLabel: string;
  ranAt: Date;
  totalRows: number;
  checks: VerificationCheck[];
  errorCount: number;
  warningCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

function getField(raw: Record<string, any>, key: string): string {
  if (raw[key] !== undefined && raw[key] !== null) return String(raw[key]).trim();
  for (const k of Object.keys(raw)) {
    if (norm(k) === norm(key)) return String(raw[k] ?? '').trim();
  }
  return '';
}

const toNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[$,]/g, '')) || 0;
};

async function fetchRowsForUpload(uploadId: string): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('upload_rows')
      .select('row_data')
      .eq('upload_id', uploadId)
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    rows.push(...data.map((d: any) => d.row_data as Record<string, any>));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function pass(id: string, category: VerificationCheck['category'], severity: CheckSeverity, title: string, description: string): VerificationCheck {
  return { id, category, severity, status: 'pass', title, description, affectedCount: 0, details: [] };
}

function skip(id: string, category: VerificationCheck['category'], severity: CheckSeverity, title: string): VerificationCheck {
  return { id, category, severity, status: 'skip', title, description: 'Skipped — upload a Payroll Report first.', affectedCount: 0, details: [] };
}

function buildReport(weekLabel: string, ranAt: Date, totalRows: number, checks: VerificationCheck[]): VerificationReport {
  return {
    weekLabel, ranAt, totalRows, checks,
    errorCount: checks.filter(c => c.severity === 'error' && c.status === 'fail').length,
    warningCount: checks.filter(c => (c.severity === 'warning' || c.severity === 'info') && (c.status === 'fail' || c.status === 'warn')).length,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runPayrollVerification(weekLabel: string): Promise<VerificationReport> {
  const ranAt = new Date();

  // Phase 1: load data in parallel
  const [lookups, uploadsRes, preparersRes] = await Promise.all([
    fetchPayrollLookups(weekLabel),
    supabase.from('uploads').select('id, type, rows_detected').eq('week_label', weekLabel),
    supabase.from('preparers').select('ptin, contractor, tax_office, share_percent').eq('active', true),
  ]);

  const uploads = uploadsRes.data ?? [];
  const allPreparers = preparersRes.data ?? [];

  const hasType = (type: string) => uploads.some(u => u.type === type);
  const getUpload = (type: string) => uploads.find(u => u.type === type);

  // Build per-PTIN detail lookup (share_percent, tax_office)
  const prepDetail: Record<string, { contractor: string; tax_office: string; share_percent: number }> = {};
  for (const p of allPreparers) {
    if (p.ptin) prepDetail[p.ptin.trim().toLowerCase()] = p;
  }

  const checks: VerificationCheck[] = [];

  // ── UPLOAD CHECKS ─────────────────────────────────────────────────────────

  const payrollUpload = getUpload('Payroll Report');
  if (!payrollUpload) {
    checks.push({ id: 'upload_payroll', category: 'uploads', severity: 'error', status: 'fail',
      title: 'Payroll Report Not Uploaded',
      description: 'The Payroll Report (Disbursement Listing) is required before payroll can run. Upload it from the Uploads tab.',
      affectedCount: 1, details: [] });
  } else {
    checks.push(pass('upload_payroll', 'uploads', 'error', 'Payroll Report Uploaded',
      `${payrollUpload.rows_detected.toLocaleString()} rows loaded and ready.`));
  }

  const advanceOffices = Object.entries(lookups.officeLookup)
    .filter(([, cfg]) => cfg.process_advance).map(([name]) => name);
  if (advanceOffices.length > 0 && !hasType('Advance Report')) {
    checks.push({ id: 'upload_advance', category: 'uploads', severity: 'error', status: 'fail',
      title: 'Advance Report Missing',
      description: `${advanceOffices.length} office(s) have advance deductions enabled but no Advance Report is uploaded. The $100 advance fee will NOT be deducted.`,
      affectedCount: advanceOffices.length, details: advanceOffices });
  } else if (advanceOffices.length > 0) {
    const au = getUpload('Advance Report')!;
    checks.push(pass('upload_advance', 'uploads', 'error', 'Advance Report Uploaded',
      `${au.rows_detected.toLocaleString()} advance records loaded for ${advanceOffices.length} office(s).`));
  } else {
    checks.push(pass('upload_advance', 'uploads', 'info', 'Advance Report',
      'No offices have advance processing enabled — Advance Report not required.'));
  }

  const clientOffices = Object.entries(lookups.officeLookup)
    .filter(([, cfg]) => cfg.clients_belongs_data === 'true' || (cfg.clients_belongs_data as any) === true)
    .map(([name]) => name);
  if (clientOffices.length > 0 && !hasType('Client Data Report')) {
    checks.push({ id: 'upload_client', category: 'uploads', severity: 'warning', status: 'warn',
      title: 'Client Data Report Missing',
      description: `${clientOffices.length} office(s) use client ownership for preparer share calculations. Without this file, all rows will default to the flat rate.`,
      affectedCount: clientOffices.length, details: clientOffices });
  } else if (clientOffices.length > 0) {
    const cu = getUpload('Client Data Report')!;
    checks.push(pass('upload_client', 'uploads', 'warning', 'Client Data Report Uploaded',
      `${cu.rows_detected.toLocaleString()} client records loaded.`));
  } else {
    checks.push(pass('upload_client', 'uploads', 'info', 'Client Data Report',
      'No offices require client ownership data.'));
  }

  if (!hasType('Backend Money Report')) {
    checks.push({ id: 'upload_backend', category: 'uploads', severity: 'info', status: 'warn',
      title: 'Backend Money Report Not Uploaded',
      description: 'Backend money will be $0 for all offices this week. Upload if backend fees should be distributed.',
      affectedCount: 0, details: [] });
  } else {
    const bu = getUpload('Backend Money Report')!;
    checks.push(pass('upload_backend', 'uploads', 'info', 'Backend Money Report Uploaded',
      `${bu.rows_detected.toLocaleString()} backend rows loaded.`));
  }

  // Skip row-level checks if no Payroll Report
  if (!payrollUpload) {
    const rowChecks = [
      skip('ptin_not_found', 'preparer_matching', 'error', 'Unmatched PTINs'),
      skip('ptin_zero_share', 'preparer_matching', 'error', 'Preparers With 0% Share'),
      skip('ptin_no_office', 'preparer_matching', 'error', 'Preparers Without Office'),
      skip('missing_ptin', 'data_quality', 'error', 'Rows Missing PTIN'),
      skip('missing_ssn', 'data_quality', 'warning', 'Rows Missing SSN'),
      skip('zero_fee', 'data_quality', 'warning', '$0 Fee Rows'),
    ];
    return buildReport(weekLabel, ranAt, 0, [...checks, ...rowChecks]);
  }

  // Phase 2: load payroll rows
  const payrollRows = await fetchRowsForUpload(payrollUpload.id);

  // ── PREPARER MATCHING CHECKS ──────────────────────────────────────────────

  const ptinCounts: Record<string, number> = {};
  const missingPtinRows: number[] = [];
  const missingSSNList: string[] = [];
  const zeroFeeList: string[] = [];

  for (let i = 0; i < payrollRows.length; i++) {
    const row = payrollRows[i];
    const ptin = getField(row, 'PTIN').toLowerCase();
    const ssn = getField(row, 'Taxpayer SSN') || getField(row, 'TAXPAYER_SSN');
    const fee = toNum(getField(row, 'Received Tax Prep Fee(s)') || getField(row, 'RECEIVED_TAX_PREP_FEE_S_'));
    const rowLabel = ptin ? `PTIN ${ptin.toUpperCase()}` : `Row ${i + 1}`;

    if (!ptin) {
      missingPtinRows.push(i + 1);
    } else {
      ptinCounts[ptin] = (ptinCounts[ptin] ?? 0) + 1;
    }
    if (!ssn) missingSSNList.push(rowLabel);
    if (fee === 0) zeroFeeList.push(`Row ${i + 1} — ${rowLabel} — $0 fee`);
  }

  const unmatchedPtins: string[] = [];
  const unmatchedPtinsRaw: PrepToAdd[] = [];
  const zeroSharePtins: string[] = [];
  const zeroSharePtinsRaw: PrepToFix[] = [];
  const noOfficePtins: string[] = [];
  const noOfficePtinsRaw: PrepToFix[] = [];

  for (const [ptin, count] of Object.entries(ptinCounts)) {
    const inLookup = !!lookups.ptinToPreparers[ptin];
    const detail = prepDetail[ptin];
    const displayPtin = ptin.toUpperCase();

    if (!inLookup) {
      unmatchedPtins.push(`${displayPtin} — ${count} row(s) will be excluded from payroll`);
      unmatchedPtinsRaw.push({ ptin: displayPtin, contractor: displayPtin });
    } else {
      if (detail?.share_percent === 0) {
        const name = detail.contractor || displayPtin;
        zeroSharePtins.push(`${name} (${displayPtin}) — ${count} row(s), pay will be $0`);
        zeroSharePtinsRaw.push({ ptin: displayPtin, contractor: name });
      }
      if (detail && !detail.tax_office) {
        const name = detail.contractor || displayPtin;
        noOfficePtins.push(`${name} (${displayPtin}) — no tax office assigned`);
        noOfficePtinsRaw.push({ ptin: displayPtin, contractor: name });
      }
    }
  }

  const uniquePtinCount = Object.keys(ptinCounts).length;

  checks.push(
    unmatchedPtins.length === 0
      ? pass('ptin_not_found', 'preparer_matching', 'error', 'All PTINs Matched',
          `All ${uniquePtinCount} unique PTINs in the Payroll Report resolved to active preparers.`)
      : { id: 'ptin_not_found', category: 'preparer_matching', severity: 'error', status: 'fail',
          title: `${unmatchedPtins.length} Unmatched PTIN${unmatchedPtins.length > 1 ? 's' : ''}`,
          description: 'These PTINs appear in the Payroll Report but are not in the Preparers table. Those rows will be excluded from ALL pay calculations.',
          affectedCount: unmatchedPtins.length, details: unmatchedPtins.slice(0, 50),
          fixPath: `/preparers?vfilter=ptin_not_found&ptins=${unmatchedPtinsRaw.map(p => encodeURIComponent(p.ptin)).join(',')}`,
          fixLabel: 'Go to Preparers',
          resolveType: 'add_preparers', resolveData: unmatchedPtinsRaw }
  );

  checks.push(
    zeroSharePtins.length === 0
      ? pass('ptin_zero_share', 'preparer_matching', 'error', 'All Active Preparers Have Share %',
          'No preparers in this week\'s payroll have a 0% share rate.')
      : { id: 'ptin_zero_share', category: 'preparer_matching', severity: 'error', status: 'fail',
          title: `${zeroSharePtins.length} Preparer${zeroSharePtins.length > 1 ? 's' : ''} With 0% Share`,
          description: 'These preparers have share_percent = 0%. They will compute $0 pay even if they have valid rows. Update their profile to set the correct percentage.',
          affectedCount: zeroSharePtins.length, details: zeroSharePtins,
          fixPath: '/preparers?vfilter=zero_share',
          fixLabel: 'Go to Preparers',
          resolveType: 'set_share', resolveData: zeroSharePtinsRaw }
  );

  checks.push(
    noOfficePtins.length === 0
      ? pass('ptin_no_office', 'preparer_matching', 'error', 'All Preparers Have Office Assignment',
          'All preparers appearing in this week\'s payroll have a tax office assigned.')
      : { id: 'ptin_no_office', category: 'preparer_matching', severity: 'error', status: 'fail',
          title: `${noOfficePtins.length} Preparer${noOfficePtins.length > 1 ? 's' : ''} Without Office`,
          description: 'These preparers have no tax_office set. Their rows will be excluded from office totals and may show as "missing_office" status.',
          affectedCount: noOfficePtins.length, details: noOfficePtins,
          fixPath: '/preparers?vfilter=no_office',
          fixLabel: 'Go to Preparers',
          resolveType: 'set_office', resolveData: noOfficePtinsRaw }
  );

  // ── DATA QUALITY CHECKS ───────────────────────────────────────────────────

  checks.push(
    missingPtinRows.length === 0
      ? pass('missing_ptin', 'data_quality', 'error', 'No Rows Missing PTIN',
          'Every row in the Payroll Report has a PTIN value.')
      : { id: 'missing_ptin', category: 'data_quality', severity: 'error', status: 'fail',
          title: `${missingPtinRows.length} Row${missingPtinRows.length > 1 ? 's' : ''} Missing PTIN`,
          description: 'These rows have no PTIN and cannot be attributed to any preparer. They will be excluded from all calculations.',
          affectedCount: missingPtinRows.length,
          details: missingPtinRows.slice(0, 50).map(n => `Row ${n}`) }
  );

  checks.push(
    missingSSNList.length === 0
      ? pass('missing_ssn', 'data_quality', 'warning', 'No Rows Missing SSN',
          'All rows have a taxpayer SSN — advance and client matching will work normally.')
      : { id: 'missing_ssn', category: 'data_quality', severity: 'warning', status: 'warn',
          title: `${missingSSNList.length} Row${missingSSNList.length > 1 ? 's' : ''} Missing SSN`,
          description: 'These rows have no taxpayer SSN. Advance deductions and client ownership lookups cannot run for these rows.',
          affectedCount: missingSSNList.length, details: missingSSNList.slice(0, 50) }
  );

  checks.push(
    zeroFeeList.length === 0
      ? pass('zero_fee', 'data_quality', 'warning', 'No $0 Received Fee Rows',
          'All rows have a non-zero received tax prep fee.')
      : { id: 'zero_fee', category: 'data_quality', severity: 'warning', status: 'warn',
          title: `${zeroFeeList.length} Row${zeroFeeList.length > 1 ? 's' : ''} With $0 Received Fee`,
          description: 'These rows have a $0 received tax prep fee. They may be voids, errors, or bank product declines. Pay for these rows will be $0.',
          affectedCount: zeroFeeList.length, details: zeroFeeList.slice(0, 50) }
  );

  return buildReport(weekLabel, ranAt, payrollRows.length, checks);
}
