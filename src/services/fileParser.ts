import * as XLSX from 'xlsx';

export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  errors: string[];
}

// Required headers per report type — matches real file exports
// Validation normalizes spaces/parens so "Received Tax Prep Fee(s)" matches "RECEIVED_TAX_PREP_FEE_S_"
const PAYROLL_BACKEND_HEADERS = [
  'EFIN', 'PARENT_EFIN', 'GROUP_EFIN', 'PTIN',
  'TAXPAYER_SSN', 'TAXPAYER_LAST_NAME', 'TAXPAYER_FIRST_NAME',
  'DISBURSEMENT_TYPE', 'TAX_CUSTOMER_ACCOUNT_NUMBER', 'CARD_NUMBER',
  'APPLICATION_DATE', 'FUNDING_DATE', 'FUNDING_TYPE',
  'EXPECTED_REFUND', 'ACTUAL_REFUND', 'CUSTOMER_DISBURSEMENT_AMOUNT',
  'REFUND_OFFSET', 'ADVANCE_REPAYMENT', 'PRIOR_YEAR_LOAN_DEBT',
  'REFUND_PRODUCT_FEE', 'EXPECTED_TAX_PREP_FEE_S_', 'RECEIVED_TAX_PREP_FEE_S_',
  'HIGH_PREP_FEE', 'TAX_PREP_AFTER_HP_FEE', 'EFIN_RECEIVING_PREP_FEE',
  'ADD_ON_FEE_AMOUNT', 'EFIN_RECEIVING_ADD_ON_FEE',
  'E_FILE_FEE_S_', 'EFIN_RECEIVING_E_FILE_FEE',
  'SERVICE_BUREAU_FEE', 'EFIN_RECEIVING_SERVICE_BUREAU_FEE',
  'TRANSMITTER_FEE', 'ROYALTYFEE', 'EFIN_RECEIVING_ROYALTY_FEE',
  'CHECK_STATUS', 'BANK_ACCOUNT_NUMBER', 'BANK_ROUTING_NUMBER',
  'TAXPAYER_ADDRESS', 'TAXPAYER_CITY', 'TAXPAYER_STATE', 'TAXPAYER_ZIP_CODE',
  'TAXPAYER_DOB', 'SPOUSE_NAME', 'SPOUSE_DOB',
  'ERO3FEE', 'ERO4FEE', 'EFIN_RECEIVING_ERO3_FEE', 'EFIN_RECEIVING_ERO4_FEE',
  'CHECK_FEE', 'CHECK_FEE_REBATE', 'EFIN_RECEIVING_CHECK_FEE_REBATE',
  'DOC_PREP_FEE', 'DOC_PREP_FEE_AFTER_BANK_FEE', 'EFIN_RECEIVING_DOC_PREP_FEE',
];

// Daily Deposit Detail export — alternate accepted template for Fee Intercept Report
const FEE_INTERCEPT_DAILY_DEPOSIT_HEADERS = [
  'GROUP_EFIN', 'PARENT_EFIN', 'OFFICE_EFIN', 'PTIN', 'FUNDING_TYPE', 'SSN',
  'TAXPAYER_FIRST_NAME', 'TAXPAYER_LAST_NAME', 'SPOUSE_SSN',
  'SPOUSE_FIRST_NAME', 'SPOUSE_LAST_NAME', 'PHONE', 'RTN', 'ACCOUNT', 'PMT',
  'DISBURSEMENT_TYPE', 'EXPECTED_REFUND', 'ACTUAL_REFUND',
  'EXPECTED_TAX_PREP_FEE_S', 'RECEIVED_TAX_PREP_FEE_S', 'HIGH_PREP_FEE',
  'TAX_PREP_AFTER_HP_FEE', 'TAX_PREP_PAID_TO',
  'EXPECTED_ADD_ON_FEE_S', 'RECEIVED_ADD_ON_FEE_S', 'ADD_ON_PAID_TO',
  'EXPECTED_E_FILE_FEE_S', 'RECEIVED_E_FILE_FEE_S', 'E_FILE_PAID_TO',
  'EXPECTED_SERVICE_BUREAU_FEE_S', 'RECEIVED_SERVICE_BUREAU_FEE_S', 'SBFEE_PAID_TO',
  'EXPECTED_ROYALTY_FEE', 'ROYALTY_FEE_PAID_TO',
  'EXPECTED_ERO3_FEE_S', 'RECEIVED_ERO3_FEE_S', 'ERO3_PAID_TO',
  'EXPECTED_ERO4_FEE_S', 'RECEIVED_ERO4_FEE_S', 'ERO4_PAID_TO',
  'EXPECTED_CHECK_FEE_REBATE', 'RECEIVED_CHECK_FEE_REBATE', 'CHECK_FEE_REBATE_PAID_TO',
  'EXPECTED_DOC_PREP_FEE_S', 'RECEIVED_DOC_PREP_FEE_S',
  'DOC_PREP_AFTER_BANK_FEE_S', 'DOC_PREP_FEE_PAY_TO',
];

// Each upload type can accept one OR MORE header templates. Validation passes
// if the file matches any one of the accepted sets.
const EXPECTED_HEADER_SETS: Record<string, string[][]> = {
  'Payroll Report': [PAYROLL_BACKEND_HEADERS],
  'Backend Money Report': [PAYROLL_BACKEND_HEADERS],
  'Advance Report': [[
    'GROUP_EFIN', 'PARENT_EFIN', 'OFFICE_EFIN', 'PTIN',
    'APPLICATION_DATE', 'DECISION_DATE', 'LOAN_TYPE', 'REQUESTED_LOAN_LEVEL',
    'STATUS', 'LAST_NAME', 'FIRST_NAME', 'SSN', 'LOAN_DISB_TYPE',
    'ADVANCE_AMOUNT', 'OUTSTANDING_LOAN_BALANCE', 'MARKETING_FEE',
    'REPAYMENT_STATUS', 'IRS_ACK_DATE', 'LOAN_PAID_DATE',
  ]],
  'Client Data Report': [[
    'LOCATION_NAME', 'GROUP_NAME', 'SSN_EIN', 'CLIENT_NAME', 'CREATED_DATE',
    'FORM_TYPE', 'FILING_STATUS', 'E_FILED_DATE', 'ACCEPTED_DATE',
    'SUBMISSION_ID', 'REFUND', 'PREPARED_BY',
  ]],
  'Client Email Report': [[
    'LOCATION_NAME', 'GROUP_NAME', 'SSN_EIN', 'LAST_NAME', 'FIRST_NAME',
    'STREET_ADDRESS', 'APARTMENT_NO', 'CITY', 'STATE', 'ZIP_CODE', 'EMAIL',
  ]],
  'Fee Intercept Report': [
    // SubOffice Summary template (original)
    [
      'GROUP_EFIN', 'PARENT_EFIN', 'EFIN', 'TOTAL_TP_FEES', 'HIGH_PREP_FEE',
      'TOTAL_PREP_AFTER_HP_FEE', 'TOTAL_EFILE_FEES', 'TOTAL_SB_FEES',
      'TOTAL_OTHER_FEES', 'GROSS_FEES', 'TOTAL_FEE_INTERCEPT',
      '_TP_FEE_PARTIALLY_FUNDED', '_TP_FEE_FULLY_FUNDED', 'ACCOUNT_LAST_4',
    ],
    // Daily Deposit Detail template (new)
    FEE_INTERCEPT_DAILY_DEPOSIT_HEADERS,
  ],
};

// Header row index (0-based) per report type — default is 0 (row 1)
const HEADER_ROW_INDEX: Record<string, number> = {
  'Client Data Report': 2,    // row 3
  'Client Email Report': 2,   // row 3
};

export function getHeaderRowIndex(uploadType: string): number {
  return HEADER_ROW_INDEX[uploadType] ?? 0;
}

export function getExpectedHeaderSets(uploadType: string): string[][] {
  return EXPECTED_HEADER_SETS[uploadType] || [];
}

// Backward-compatible: returns the union of all accepted header sets so that
// header-chip highlighting in the upload preview marks any recognized column.
export function getExpectedHeaders(uploadType: string): string[] {
  const sets = EXPECTED_HEADER_SETS[uploadType] || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const set of sets) for (const h of set) if (!seen.has(h)) { seen.add(h); out.push(h); }
  return out;
}

export async function parseFile(file: File, uploadType?: string): Promise<ParsedFile> {
  const headerRowIdx = uploadType ? getHeaderRowIndex(uploadType) : 0;
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const errors: string[] = [];

  try {
    let headers: string[] = [];
    let rows: Record<string, string | number>[] = [];

    if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length === 0) return { fileName, headers: [], rows: [], rowCount: 0, errors: ['File is empty'] };
      // Use headerRowIdx to find the header line, skip rows before it
      const headerLine = headerRowIdx < lines.length ? headerRowIdx : 0;
      headers = lines[headerLine].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      rows = lines.slice(headerLine + 1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string | number> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
        return row;
      });
    } else if (['xlsx', 'xls', 'xlsb', 'xlsm'].includes(ext || '')) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Fix incorrect !ref by recalculating the actual used range
      const trueRef = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (const key of Object.keys(ws)) {
        if (key[0] === '!') continue;
        const cell = XLSX.utils.decode_cell(key);
        if (cell.r > trueRef.e.r) trueRef.e.r = cell.r;
        if (cell.c > trueRef.e.c) trueRef.e.c = cell.c;
      }
      ws['!ref'] = XLSX.utils.encode_range(trueRef);
      // For Excel, use header row offset
      const allRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { defval: '', header: 1 });
      if (allRows.length > headerRowIdx) {
        const headerRow = allRows[headerRowIdx] as unknown as string[];
        headers = headerRow.map(h => String(h).trim());
        rows = allRows.slice(headerRowIdx + 1).map(valuesArr => {
          const values = valuesArr as unknown as (string | number)[];
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
          return row;
        });
      }
    } else {
      errors.push(`Unsupported file type: .${ext}`);
    }

    return { fileName, headers, rows, rowCount: rows.length, errors };
  } catch (e) {
    return { fileName, headers: [], rows: [], rowCount: 0, errors: [`Parse error: ${(e as Error).message}`] };
  }
}

/** Normalize header to uppercase, spaces/parens → underscores for flexible matching */
function normalizeHeader(h: string): string {
  return h.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
}

export function validateHeaders(parsed: ParsedFile, uploadType: string): { valid: boolean; missing: string[]; extra: string[] } {
  const sets = getExpectedHeaderSets(uploadType);
  if (sets.length === 0) return { valid: true, missing: [], extra: [] };
  const normalizedHeaders = parsed.headers.map(normalizeHeader);
  // Pick the template with the fewest missing headers (best match).
  let best: { valid: boolean; missing: string[]; extra: string[] } | null = null;
  for (const expected of sets) {
    const normalizedExpected = expected.map(normalizeHeader);
    const missing = expected.filter((_, i) => !normalizedHeaders.includes(normalizedExpected[i]));
    const extra = parsed.headers.filter((_, i) => !normalizedExpected.includes(normalizedHeaders[i]));
    const candidate = { valid: missing.length === 0, missing, extra };
    if (candidate.valid) return candidate;
    if (!best || candidate.missing.length < best.missing.length) best = candidate;
  }
  return best!;
}