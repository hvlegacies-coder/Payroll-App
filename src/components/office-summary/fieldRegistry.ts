// Field definitions for the three datasets available in Office Summary
// Only numeric fields are included since Office Summary aggregates values

export interface FieldDef {
  id: string;
  label: string;
  dataset: 'payroll' | 'backend' | 'fee_intercept';
  key: string; // key in row_data jsonb, OR a computed key (see computedKey)
  type: 'number';
  computed?: 'pay' | 'preparer_share' | 'after_advance'; // marks fields that need processed payroll
}

export const FIELD_REGISTRY: FieldDef[] = [
  // Payroll Processing — computed fields (after Payroll Processing)
  { id: 'p_pay', label: 'Pay', dataset: 'payroll', key: '__pay__', type: 'number', computed: 'pay' },
  { id: 'p_preparer_share', label: 'Preparer Share', dataset: 'payroll', key: '__preparer_share__', type: 'number', computed: 'preparer_share' },
  { id: 'p_after_advance', label: 'After Advance', dataset: 'payroll', key: '__after_advance__', type: 'number', computed: 'after_advance' },
  // Payroll Processing — raw numeric fields
  { id: 'p_received', label: 'Received Tax Prep Fees', dataset: 'payroll', key: 'Received Tax Prep Fee(s)', type: 'number' },
  { id: 'p_expected', label: 'Expected Tax Prep Fees', dataset: 'payroll', key: 'Expected Tax Prep Fee(s)', type: 'number' },
  { id: 'p_high_prep', label: 'High Prep Fee', dataset: 'payroll', key: 'High Prep Fee', type: 'number' },
  { id: 'p_tax_prep_after_hp', label: 'Tax Prep After HP Fee', dataset: 'payroll', key: 'Tax Prep After HP Fee', type: 'number' },
  { id: 'p_sb_fee', label: 'Service Bureau Fee', dataset: 'payroll', key: 'Service Bureau Fee', type: 'number' },
  { id: 'p_transmitter', label: 'Transmitter Fee', dataset: 'payroll', key: 'Transmitter Fee', type: 'number' },
  { id: 'p_ero3', label: 'ERO3 Fee', dataset: 'payroll', key: 'ERO3Fee', type: 'number' },
  { id: 'p_ero4', label: 'ERO4 Fee', dataset: 'payroll', key: 'ERO4Fee', type: 'number' },
  { id: 'p_efile', label: 'E-File Fee', dataset: 'payroll', key: 'E-File Fee(s)', type: 'number' },
  { id: 'p_doc_prep', label: 'Doc Prep Fee', dataset: 'payroll', key: 'Doc Prep Fee', type: 'number' },
  { id: 'p_doc_prep_after_bank', label: 'Doc Prep Fee After Bank Fee', dataset: 'payroll', key: 'Doc Prep Fee After Bank Fee', type: 'number' },
  { id: 'p_actual_refund', label: 'Actual Refund', dataset: 'payroll', key: 'Actual Refund', type: 'number' },
  { id: 'p_expected_refund', label: 'Expected Refund', dataset: 'payroll', key: 'Expected Refund', type: 'number' },
  { id: 'p_refund_product_fee', label: 'Refund Product Fee', dataset: 'payroll', key: 'Refund Product Fee', type: 'number' },
  { id: 'p_customer_disb', label: 'Customer Disbursement', dataset: 'payroll', key: 'Customer Disbursement Amount', type: 'number' },
  { id: 'p_advance_repayment', label: 'Advance Repayment', dataset: 'payroll', key: 'Advance Repayment', type: 'number' },
  { id: 'p_refund_offset', label: 'Refund Offset', dataset: 'payroll', key: 'Refund Offset', type: 'number' },
  { id: 'p_prior_year_loan', label: 'Prior Year Loan Debt', dataset: 'payroll', key: 'Prior Year Loan Debt', type: 'number' },
  { id: 'p_addon_fee', label: 'Add On Fee Amount', dataset: 'payroll', key: 'Add On Fee Amount', type: 'number' },
  { id: 'p_royalty', label: 'Royalty Fee', dataset: 'payroll', key: 'RoyaltyFee', type: 'number' },
  { id: 'p_check_fee', label: 'Check Fee', dataset: 'payroll', key: 'Check Fee', type: 'number' },
  { id: 'p_check_fee_rebate', label: 'Check Fee Rebate', dataset: 'payroll', key: 'Check Fee Rebate', type: 'number' },

  // Backend Money — all numeric fields
  { id: 'b_received', label: 'Received Tax Prep Fees', dataset: 'backend', key: 'Received Tax Prep Fee(s)', type: 'number' },
  { id: 'b_expected', label: 'Expected Tax Prep Fees', dataset: 'backend', key: 'Expected Tax Prep Fee(s)', type: 'number' },
  { id: 'b_high_prep', label: 'High Prep Fee', dataset: 'backend', key: 'High Prep Fee', type: 'number' },
  { id: 'b_tax_prep_after_hp', label: 'Tax Prep After HP Fee', dataset: 'backend', key: 'Tax Prep After HP Fee', type: 'number' },
  { id: 'b_sb_fee', label: 'Service Bureau Fee', dataset: 'backend', key: 'Service Bureau Fee', type: 'number' },
  { id: 'b_transmitter', label: 'Transmitter Fee', dataset: 'backend', key: 'Transmitter Fee', type: 'number' },
  { id: 'b_ero3', label: 'ERO3 Fee', dataset: 'backend', key: 'ERO3Fee', type: 'number' },
  { id: 'b_ero4', label: 'ERO4 Fee', dataset: 'backend', key: 'ERO4Fee', type: 'number' },
  { id: 'b_efile', label: 'E-File Fee', dataset: 'backend', key: 'E-File Fee(s)', type: 'number' },
  { id: 'b_doc_prep', label: 'Doc Prep Fee', dataset: 'backend', key: 'Doc Prep Fee', type: 'number' },
  { id: 'b_doc_prep_after_bank', label: 'Doc Prep Fee After Bank Fee', dataset: 'backend', key: 'Doc Prep Fee After Bank Fee', type: 'number' },
  { id: 'b_actual_refund', label: 'Actual Refund', dataset: 'backend', key: 'Actual Refund', type: 'number' },
  { id: 'b_expected_refund', label: 'Expected Refund', dataset: 'backend', key: 'Expected Refund', type: 'number' },
  { id: 'b_refund_product_fee', label: 'Refund Product Fee', dataset: 'backend', key: 'Refund Product Fee', type: 'number' },
  { id: 'b_customer_disb', label: 'Customer Disbursement', dataset: 'backend', key: 'Customer Disbursement Amount', type: 'number' },
  { id: 'b_advance_repayment', label: 'Advance Repayment', dataset: 'backend', key: 'Advance Repayment', type: 'number' },
  { id: 'b_refund_offset', label: 'Refund Offset', dataset: 'backend', key: 'Refund Offset', type: 'number' },
  { id: 'b_prior_year_loan', label: 'Prior Year Loan Debt', dataset: 'backend', key: 'Prior Year Loan Debt', type: 'number' },
  { id: 'b_addon_fee', label: 'Add On Fee Amount', dataset: 'backend', key: 'Add On Fee Amount', type: 'number' },
  { id: 'b_royalty', label: 'Royalty Fee', dataset: 'backend', key: 'RoyaltyFee', type: 'number' },
  { id: 'b_check_fee', label: 'Check Fee', dataset: 'backend', key: 'Check Fee', type: 'number' },
  { id: 'b_check_fee_rebate', label: 'Check Fee Rebate', dataset: 'backend', key: 'Check Fee Rebate', type: 'number' },

  // Fee Intercept — all numeric fields
  { id: 'f_total_tp_fees', label: 'Total TP Fees', dataset: 'fee_intercept', key: 'Total TP Fees', type: 'number' },
  { id: 'f_high_prep', label: 'High Prep Fee', dataset: 'fee_intercept', key: 'High Prep Fee', type: 'number' },
  { id: 'f_efile_fees', label: 'Total E-File Fees', dataset: 'fee_intercept', key: 'Total EFile Fees', type: 'number' },
  { id: 'f_sb_fees', label: 'Total SB Fees', dataset: 'fee_intercept', key: 'Total SB Fees', type: 'number' },
  { id: 'f_gross_fees', label: 'Gross Fees', dataset: 'fee_intercept', key: 'Gross Fees', type: 'number' },
  { id: 'f_intercept', label: 'Total Fee Intercept', dataset: 'fee_intercept', key: 'Total Fee Intercept', type: 'number' },
  { id: 'f_prep_after_hp', label: 'Total Prep After HP Fee', dataset: 'fee_intercept', key: 'Total Prep After HP Fee', type: 'number' },
  { id: 'f_other_fees', label: 'Total Other Fees', dataset: 'fee_intercept', key: 'Total Other Fees', type: 'number' },
  { id: 'f_tp_fully_funded', label: '# TP Fee Fully Funded', dataset: 'fee_intercept', key: '# TP Fee Fully Funded', type: 'number' },
  { id: 'f_tp_partially_funded', label: '# TP Fee Partially Funded', dataset: 'fee_intercept', key: '# TP Fee Partially Funded', type: 'number' },
];

export const DATASET_LABELS: Record<string, string> = {
  payroll: 'Payroll Processing',
  backend: 'Backend Money',
  fee_intercept: 'Fee Intercept',
};

export const UPLOAD_TYPE_MAP: Record<string, string> = {
  payroll: 'Payroll Report',
  backend: 'Backend Money Report',
  fee_intercept: 'Fee Intercept Report',
};

// Office-specific virtual fields (e.g. EFIN-filtered backend totals).
// Resolved by id prefixes `__efin_efile__<EFIN>` and `__efin_ero3__<EFIN>` in SummaryTable.
export interface EfinVirtualField {
  id: string;
  label: string;
  efin: string;
  sourceKey: string; // backend row key to sum
  /** If primary EFIN has zero matching rows, fall back to this EFIN. */
  fallbackEfin?: string;
}
export const EFIN_VIRTUAL_FIELDS: Record<string, EfinVirtualField[]> = {
  'D & D': [
    { id: '__efin_efile__381268', label: 'E-File-EFIN (381268)', efin: '381268', sourceKey: 'E-File Fee(s)', fallbackEfin: '387641' },
    { id: '__efin_ero3__381268', label: 'ERO3-EFIN (381268)', efin: '381268', sourceKey: 'ERO3Fee', fallbackEfin: '387641' },
  ],
  'PowerPlay': [
    { id: '__efin_efile__381623', label: 'E-File-EFIN (381623)', efin: '381623', sourceKey: 'E-File Fee(s)' },
    { id: '__efin_ero3__381623', label: 'ERO3-EFIN (381623)', efin: '381623', sourceKey: 'ERO3Fee' },
  ],
  'S & C': [
    { id: '__efin_efile__381871', label: 'E-File-EFIN (381871)', efin: '381871', sourceKey: 'E-File Fee(s)' },
    { id: '__efin_ero3__381871', label: 'ERO3-EFIN (381871)', efin: '381871', sourceKey: 'ERO3Fee' },
  ],
  'King J': [
    { id: '__efin_efile__741288', label: 'E-File-EFIN (741288)', efin: '741288', sourceKey: 'E-File Fee(s)' },
    { id: '__efin_ero3__741288', label: 'ERO3-EFIN (741288)', efin: '741288', sourceKey: 'ERO3Fee' },
  ],
};

// Office-specific virtual fields that aggregate across an office plus all of
// its downline (descendant) offices, resolved via offices.parent_office.
// IDs are unique across the registry so they can be looked up directly.
export interface DownlineVirtualField {
  id: string;
  label: string;
  dataset: 'payroll' | 'backend';
  sourceKey: string;
  rootOffice: string;
  /** Additional offices to include that aren't in the parent_office downline tree. */
  extraOffices?: string[];
  /** When set, only rows whose EFIN equals this value are included. */
  efinFilter?: string;
  /** When set, rows from `extraOffices` only count if their EFIN equals this value. */
  extraOfficesEfinFilter?: string;
}
export const DOWNLINE_VIRTUAL_FIELDS: Record<string, DownlineVirtualField[]> = {
  'D & D': [
    {
      id: '__downline_p_received__D&D',
      label: 'Received Tax Prep Fees (D&D + Downlines)',
      dataset: 'payroll',
      sourceKey: 'Received Tax Prep Fee(s)',
      rootOffice: 'D & D',
      extraOffices: ['Tax Champions'],
      efinFilter: '381268',
    },
  ],
};

export const ALL_DOWNLINE_VIRTUALS: DownlineVirtualField[] =
  Object.values(DOWNLINE_VIRTUAL_FIELDS).flat();

// Office-specific virtual fields that aggregate across a fixed, hand-picked
// list of offices (resolved tax office, case/space-insensitive match).
export interface OfficeGroupVirtualField {
  id: string;
  label: string;
  dataset: 'payroll' | 'backend';
  sourceKey: string;
  offices: string[];
  /** Optional computed payroll metric (uses processed payroll rows). */
  computed?: 'pay' | 'preparer_share' | 'after_advance';
  /** When set, only rows whose EFIN equals this value are included. */
  efinFilter?: string;
  /** When set, the `efinFilter` is only applied to rows from these offices; other listed offices are unfiltered. */
  efinFilterOffices?: string[];
}
export const OFFICE_GROUP_VIRTUAL_FIELDS: Record<string, OfficeGroupVirtualField[]> = {
  'D & D': [
    {
      id: '__office_group_p_ero3__DD',
      label: 'ERO3 (D&D Group)',
      dataset: 'payroll',
      sourceKey: 'ERO3Fee',
      offices: [
        'Bright Meadow',
        'D & D',
        'Malone Method Tax Services',
        'Premier Tax Software',
        'Prolific Legacy',
        'Clarity Tax Group',
        'S&D Tax Solutions',
        "R'Moni",
        'Savvy Tax Pros',
        'SmartFile',
        'Stellar Tax Co',
        'Tygermatic Taxes',
        'Pink Connection',
        'Big Payback',
        'Tax Champions',
        'Go Up Financials',
      ],
    },
    {
      id: '__office_group_p_pay__TaxChampions',
      label: 'Pay (D&D + Tax Champions)',
      dataset: 'payroll',
      sourceKey: '__pay__',
      offices: ['D & D', 'Tax Champions'],
      computed: 'pay',
      efinFilter: '381268',
    },
  ],
};
export const ALL_OFFICE_GROUP_VIRTUALS: OfficeGroupVirtualField[] =
  Object.values(OFFICE_GROUP_VIRTUAL_FIELDS).flat();

// Auto-computed fields available on every office. Use the same canonical
// formulas as src/services/calculationEngine.ts buildOfficeReport so totals
// match the Office Report KPIs.
export interface AutoField {
  id: string;
  label: string;
  description: string;
}
export const AUTO_FIELDS: AutoField[] = [
  {
    id: '__auto_agi__',
    label: 'AGI',
    description: 'Pay (src) + Fees Due (negative)',
  },
  {
    id: '__auto_backend_total__',
    label: 'Total Backend Money',
    description: 'Σ backend Received Tax Prep Fee(s)',
  },
  {
    id: '__auto_neg_received__',
    label: 'Received Tax Prep Fees (−)',
    description: 'Negated Σ payroll Received Tax Prep Fee(s)',
  },
  {
    id: '__auto_higher_view_cut__',
    label: 'Higher View Cut',
    description: '−Received Tax Prep Fees + Pay (uses src values)',
  },
  {
    id: '__auto_sb_ero3_efile__',
    label: 'Total SB+ERO3+EFile',
    description: 'Service Bureau Fee + ERO3 by EFIN + E-File by EFIN (src totals)',
  },
];
