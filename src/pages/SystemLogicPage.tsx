import { PageHeader } from '@/components/payroll/PageHeader';
import { ALL_OFFICES, HIGHER_VIEW_FEE_EXCLUDED_PREPARERS, HIGHER_VIEW_PREPARER_FEE } from '@/services/types';

const sections = [
  {
    title: 'A. PTIN Mapping Logic',
    rules: [
      'If PTIN unique in lookup → match on PTIN only',
      'If PTIN duplicated in lookup → require EFIN or EFIN2 match',
      'If duplicate PTIN and no EFIN match → Notes = "No Match"',
      'If PTIN not in lookup → blank mapping, Notes = "PTIN not in lookup"',
    ],
  },
  {
    title: 'B. After Advance Calculation',
    rules: [
      'after_advance = received_tax_prep_fees',
      'If advance_requested = true → after_advance = max(0, received_tax_prep_fees − 100)',
      'Advance fee constant = $100 (deducted before pay calc)',
    ],
  },
  {
    title: 'C. Pay Calculation (default offices)',
    rules: [
      'If after_advance ≤ 0 → pay = 0',
      'efinMatch = (row.efin === lookup.efin) OR (row.efin === lookup.efin2)',
      'If PTIN present AND NOT efinMatch AND shared_efin_percent > 0 → pay = after_advance × (shared_efin_percent / 100)',
      'Else → pay = after_advance × (share_percent / 100)',
    ],
  },
  {
    title: 'D. Higher View — Preparer Share',
    rules: [
      'If after_advance ≤ 0 → preparer_share = 0',
      'If client_belongs_to (case-insensitive) === preparer → preparer_share = min(received_tax_prep_fees × (preparer_client_percent / 100), after_advance)',
      'Else → preparer_share = min(office_flat_rate, after_advance)',
    ],
  },
  {
    title: 'E. Higher View — Preparer Fee',
    rules: [
      `Default fee per preparer = $${HIGHER_VIEW_PREPARER_FEE}`,
      `Excluded preparers (fee = $0): ${HIGHER_VIEW_FEE_EXCLUDED_PREPARERS.join(', ')}`,
      'Match is by case-insensitive substring on the normalized (UPPER, trimmed) preparer name',
    ],
  },
  {
    title: 'F. King J — Preparer Share',
    rules: [
      'If after_advance ≤ 0 → preparer_share = 0',
      'preparer_share = after_advance × (kingj_preparer_share / 100)  ← from lookup',
    ],
  },
  {
    title: 'G. Preparer Share Routing',
    rules: [
      'tax_office === "Higher View" → use Higher View share rules (D)',
      'tax_office === "King J"      → use King J share rules (F)',
      'All other offices            → preparer_share = pay (rule C)',
    ],
  },
  {
    title: 'H. Bucket Row Status Transitions',
    rules: [
      'imported → mapped (after PTIN/EFIN resolved)',
      'mapped   → calculated (after pay/preparer_share computed)',
      'calculated → advance_applied → distributed → sent → archived',
      'no_match / ptin_not_found / missing_office are terminal until corrected',
    ],
  },
  {
    title: 'I. Preparer Share Block (per preparer rollup)',
    rules: [
      'Group bucket rows by preparer name (skip blanks)',
      'total_received = Σ received_tax_prep_fees across the preparer’s rows',
      'preparer_fee = getPreparerFee(preparer)  ← Higher View rule E',
      'total_share = max(0, total_received − preparer_fee)',
      'share_percent + ptin pulled from matching PreparerLookup (by contractor name)',
    ],
  },
  {
    title: 'J. Office Report Totals',
    rules: [
      'Filter bucket + backend rows by tax_office === office',
      'Office consolidation: when office === "D & D", Tax Champions rows are folded into D & D for every per-row metric (Expected/Received Tax Prep Fee(s), High Prep Fee, After Advance, Pay, Preparer Share, Transmitter, Backend, etc.)',
      'total_received_prep_fee = Σ received_tax_prep_fees',
      'high_prep_fee_total    = Σ received_tax_prep_fees WHERE high_prep_fee = true',
      'preparer_fee_total     = Σ preparer_fee from preparer share block',
      'total_transmitter_fee  = Σ max(0, transmitter_fee − 10)   ← only the portion above $10 per row',
      'Total Fees Due = high_prep_fee_total + preparer_fee_total + fee_intercept + total_transmitter_fee',
      'AGI            = total_received_prep_fee − Total Fees Due',
      'total_backend_money = Σ backend.received_amount (office only)',
      'Net Pay        = AGI + total_backend_money',
    ],
  },
  {
    title: 'K. Transmitter Fee Summary',
    rules: [
      'Per row: credited = max(0, transmitter_fee − 10)',
      '  • fee ≤ $10 → credited = $0   (e.g. $9 → $0, $10 → $0)',
      '  • fee  > $10 → credited = fee − $10   (e.g. $12 → $2, $15 → $5)',
      'Sum credited per tax_office across all bucket rows',
      'Rows without a tax_office are skipped',
    ],
  },
  {
    title: 'L. Distribution Rules',
    rules: [
      'Route rows by tax_office / landing_tab from lookup',
      'Clear previous office data before writing new period',
      'Sort by Tax Office, then Preparer within each office',
    ],
  },
  {
    title: 'M. Advance Deduplication',
    rules: [
      'Key: ssn_last4 + first_name + last_name',
      'If duplicate found → replace latest record but PRESERVE Deducted flag and Notes',
    ],
  },
  {
    title: 'N. Client Belongs To Matching',
    rules: [
      'Match by SSN last4 + fuzzy first/last name from ClientRef',
      'Fill client_belongs_to on bucket rows when found',
    ],
  },
  {
    title: 'O. Client Email Enrichment',
    rules: [
      'Match using SSN last4 + fuzzy name',
      'Fill email only if currently blank (never overwrite)',
    ],
  },
  {
    title: 'P. Fee Intercept Matching',
    rules: [
      'Match raw EFIN → lookup EFIN / EFIN2 → Tax Office',
      'Aggregate intercept_amount per office and push to office report',
    ],
  },
];

const constants: Array<{ label: string; value: string }> = [
  { label: 'Advance fee deducted from received fees', value: '$100' },
  { label: 'Transmitter fee threshold (Higher View keeps amount above)', value: '$10 per row' },
  { label: 'Higher View preparer fee (default)', value: `$${HIGHER_VIEW_PREPARER_FEE}` },
  { label: 'Higher View excluded preparers (fee = $0)', value: HIGHER_VIEW_FEE_EXCLUDED_PREPARERS.join(', ') },
  { label: 'Default upload week label', value: 'April 10, 2026 (replaced by active week trigger)' },
  { label: 'Email batch size (default)', value: '10 messages per cycle' },
  { label: 'Email send delay (default)', value: '200 ms between sends' },
  { label: 'Transactional email TTL (default)', value: '60 minutes' },
  { label: 'Auth email TTL (default)', value: '15 minutes' },
];

const officeConfigFields: string[] = [
  'office_name, parent_office, primary_efin, secondary_efin',
  'active, notes, clients_belongs_data',
  'process_frontend, process_backend, process_advance, process_preparers_share',
  'share_percent, default_preparers_share',
];

const preparerLookupFields: string[] = [
  'ptin, contractor (name), tax_office, main_office, landing_tab, roles',
  'efin, efin2, share_percent, shared_efin_percent',
  'preparer_client_percent  (Higher View — when client belongs to preparer)',
  'office_flat_rate         (Higher View — when client does NOT belong to preparer)',
  'kingj_preparer_share     (King J % share applied to after_advance)',
  'availed_payroll, active, notes',
];

export default function SystemLogicPage() {
  return (
    <div>
      <PageHeader title="System Logic" description="All formulas, routing rules, and business logic — developer reference" />
      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.title} className="bg-card rounded-xl border border-border p-5 shadow-card">
            <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
            <ul className="space-y-1.5">{section.rules.map((rule, i) => (<li key={i} className="flex items-start gap-2 text-sm"><span className="text-primary font-mono text-xs mt-0.5">→</span><span className="font-mono text-xs">{rule}</span></li>))}</ul>
          </div>
        ))}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-semibold mb-3">System Constants</h3>
          <ul className="space-y-1.5">
            {constants.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                <span className="text-primary font-mono text-xs mt-0.5">→</span>
                <span className="font-mono text-xs">
                  <span className="text-muted-foreground">{c.label}:</span> {c.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-semibold mb-3">Office Configuration Fields</h3>
          <ul className="space-y-1.5">
            {officeConfigFields.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary font-mono text-xs mt-0.5">→</span>
                <span className="font-mono text-xs">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-semibold mb-3">Preparer Lookup Fields (drives all share/pay math)</h3>
          <ul className="space-y-1.5">
            {preparerLookupFields.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary font-mono text-xs mt-0.5">→</span>
                <span className="font-mono text-xs">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-semibold mb-3">Office List (Canonical)</h3>
          <div className="flex flex-wrap gap-2">{ALL_OFFICES.map(o => (<span key={o} className="text-xs px-2.5 py-1 bg-surface-ash rounded-lg font-medium">{o}</span>))}</div>
        </div>
      </div>
    </div>
  );
}
