// ============================================================
// Core Type Definitions — King J Payroll Operations Platform
// Mirrors the Google Sheets data model faithfully
// ============================================================

export type ImportType = 'payroll' | 'backend' | 'advance' | 'fee_intercept' | 'client_data' | 'client_email';
export type ImportStatus = 'pending' | 'validating' | 'validated' | 'importing' | 'imported' | 'failed' | 'archived';
export type BucketRowStatus = 'imported' | 'mapped' | 'no_match' | 'ptin_not_found' | 'missing_office' | 'calculated' | 'advance_applied' | 'distributed' | 'sent' | 'archived';
export type AdvanceStatus = 'matched' | 'unmatched' | 'deducted' | 'duplicate';
export type UserRole = 'super_admin' | 'admin' | 'payroll_processor' | 'office_owner' | 'preparer';

export interface PreparerLookup {
  id: string;
  ptin: string;
  contractor: string;
  tax_office: string;
  main_office: string;
  landing_tab: string;
  share_percent: number;
  efin: string;
  efin2: string;
  shared_efin_percent: number;
  preparer_client_percent: number;
  office_flat_rate: number;
  kingj_preparer_share: number;
  owners_email: string;
  availed_payroll: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollRawImport {
  id: string;
  source_file_name: string;
  import_type: ImportType;
  uploaded_at: string;
  uploaded_by: string;
  status: ImportStatus;
  rows_detected: number;
  rows_imported: number;
  rows_failed: number;
  notes: string;
}

export interface BucketRow {
  id: string;
  efin: string;
  ptin: string;
  taxpayer_last_name: string;
  taxpayer_first_name: string;
  funding_date: string;
  taxpayer_ssn_last4: string;
  expected_tax_prep_fees: number;
  received_tax_prep_fees: number;
  high_prep_fee: boolean;
  efile_fee: number;
  service_bureau_fee: number;
  transmitter_fee: number;
  ero3_fee: number;
  preparer: string;
  tax_office: string;
  main_office: string;
  advance_requested: boolean;
  advance_amount: number;
  after_advance: number;
  pay: number;
  preparer_share: number;
  client_belongs_to: string;
  notes: string;
  status: BucketRowStatus;
  source_import_id: string;
  created_at: string;
  updated_at: string;
}

export interface BackendRow {
  id: string;
  efin: string;
  ptin: string;
  taxpayer_last_name: string;
  taxpayer_first_name: string;
  funding_date: string;
  taxpayer_ssn_last4: string;
  received_amount: number;
  preparer: string;
  tax_office: string;
  main_office: string;
  notes: string;
  status: BucketRowStatus;
  source_import_id: string;
  created_at: string;
  updated_at: string;
}

export interface AdvanceMaster {
  id: string;
  group_efin: string;
  parent_efin: string;
  office_efin: string;
  ptin: string;
  application_date: string;
  decision_date: string;
  loan_type: string;
  requested_loan_level: number;
  status: AdvanceStatus;
  last_name: string;
  first_name: string;
  ssn_last4: string;
  loan_disb_type: string;
  advance_amount: number;
  outstanding_loan_balance: number;
  marketing_fee: number;
  repayment_status: string;
  irs_ack_date: string;
  loan_paid_date: string;
  deducted: boolean;
  notes: string;
  source_import_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClientData {
  id: string;
  location_name: string;
  group_name: string;
  ssn_last4: string;
  client_name: string;
  created_date: string;
  form_type: string;
  filing_status: string;
  efiled_date: string;
  accepted_date: string;
  submission_id: string;
  refund: number;
  prepared_by: string;
  duplicate_marker: boolean;
  email: string;
  source_import_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClientRef {
  id: string;
  name: string;
  ssn_last4: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface OfficeReport {
  id: string;
  office_name: string;
  run_date: string;
  total_received_prep_fee: number;
  total_fees_due: number;
  high_prep_fee_total: number;
  preparer_fee_total: number;
  fee_intercept: number;
  agi: number;
  total_backend_money: number;
  net_pay: number;
  total_transmitter_fee: number;
  created_at: string;
}

export interface WeeklyHistory {
  id: string;
  run_date: string;
  week_label: string;
  category: string;
  office_name: string;
  preparer_name: string;
  total_received: number;
  total_fees: number;
  total_share: number;
  agi: number;
  backend_money: number;
  net_pay: number;
  summary_payload_json: string;
  created_at: string;
}

export interface PreparerShareResult {
  preparer: string;
  ptin: string;
  tax_office: string;
  row_count: number;
  total_received: number;
  preparer_fee: number;
  total_share: number;
  share_percent: number;
}

export interface ProcessingLog {
  id: string;
  action: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at: string;
  user: string;
  rows_affected: number;
  details: string;
  error_message: string;
}

export const ALL_OFFICES = [
  'Higher View',
  'PowerPlay',
  'D & D',
  'Main Event',
  'S & C',
  'King J',
  'VEO',
  'Step-by-Step',
  'LBN',
  'Kenrel',
  'Instant',
  'DJN',
  'Dior',
  'BC',
  'Go Up Financials',
] as const;

export type OfficeName = typeof ALL_OFFICES[number];

export const HIGHER_VIEW_FEE_EXCLUDED_PREPARERS = [
  'BANNERMAN,MICHAEL A',
  'RUFFIN,JULIUS',
];

export const HIGHER_VIEW_PREPARER_FEE = 10;

/**
 * Office consolidation map. When a key office is the active scope, all rows whose
 * resolved tax_office matches one of the listed offices are folded into the parent
 * for per-row calculations (Expected/Received/High Prep/After Advance/Pay, etc.).
 *
 * Use `getConsolidatedOffices(scope)` to look up the canonical set.
 */
export const OFFICE_CONSOLIDATION: Record<string, string[]> = {
  'D & D': ['D & D', 'Tax Champions'],
};

const normalizeOffice = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();

export function getConsolidatedOffices(officeScope: string): Set<string> {
  if (!officeScope) return new Set();
  // Match the consolidation key by normalized name (so "D&D" === "D & D").
  const targetNorm = normalizeOffice(officeScope);
  for (const [key, members] of Object.entries(OFFICE_CONSOLIDATION)) {
    if (normalizeOffice(key) === targetNorm) return new Set(members);
  }
  return new Set([officeScope]);
}

/** True when `rowOffice` should be counted under `officeScope` (consolidation-aware). */
export function officeMatches(rowOffice: string | undefined | null, officeScope: string): boolean {
  if (!officeScope) return false;
  const set = getConsolidatedOffices(officeScope);
  const rowNorm = normalizeOffice(rowOffice || '');
  for (const m of set) {
    if (normalizeOffice(m) === rowNorm) return true;
  }
  return false;
}
