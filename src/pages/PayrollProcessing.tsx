import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Save, Check } from 'lucide-react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { PayrollRow, PayrollStatus } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, Import, AlertTriangle, HelpCircle, CheckCircle, Calculator, Truck, Loader2, Trash2, UserX, Building2, CalendarIcon } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { fuzzySimilarity } from '@/services/fuzzyMatch';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { logAudit } from '@/services/auditLog';

const tabs = ['All', 'Imported', 'Needs Mapping', 'No Match', 'Ready', 'Calculated', 'Distributed'];
const noPreparerColumns: Column<PayrollRow>[] = [
  { key: '_rowNum', header: '#', render: (_r, i) => (i ?? 0) + 1 },
  { key: 'efin', header: 'EFIN', mono: true, sortable: true },
  { key: 'ptin', header: 'PTIN', mono: true, sortable: true },
  { key: 'taxpayerLastName', header: 'Last Name', sortable: true },
  { key: 'taxpayerFirstName', header: 'First Name', sortable: true },
  { key: 'fundingDate', header: 'Funding Date', sortable: true },
  { key: 'ssnLast4', header: 'Taxpayer SSN', mono: true, render: (r) => `•••${r.ssnLast4}`, sortable: true },
];

const fmt = (v: number | undefined) => v != null && !isNaN(v) ? formatMoney(v) : '—';
const dash = (v: string | undefined) => v || '—';
const extractLast4 = (value: string) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : digits;
};
/** Parse Excel serial date numbers or date strings into formatted dates */
const parseDate = (value: string | number): string => {
  if (!value && value !== 0) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  // Excel serial date number
  const asNum = Number(raw);
  if (!isNaN(asNum) && asNum > 10000 && asNum < 100000) {
    // Excel epoch is Jan 0, 1900 (with the Lotus 1-2-3 bug: day 60 = Feb 29, 1900)
    const excelEpoch = Date.UTC(1899, 11, 30); // Dec 30, 1899
    const ms = excelEpoch + asNum * 86400000;
    const d = new Date(ms);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  // Try common date formats
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  }
  // Already in MM/DD/YYYY or similar
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(raw)) return raw;
  return raw;
};
const normalizeNameForMatch = (value: string) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\b[a-z]\b/g, '') // strip single-letter middle initials (e.g. "TYLER P" -> "TYLER")
    .replace(/[^a-z0-9]/g, '')
    .trim();
const splitClientName = (value: string) => {
  const [lastName = '', ...firstNameParts] = String(value ?? '').split(',');
  return {
    lastName: lastName.trim(),
    firstName: firstNameParts.join(',').trim(),
  };
};

/** Map a raw row_data JSON object to our PayrollRow shape */
function mapRowData(row_data: Record<string, any>, id: string, uploadId: string): PayrollRow {
  const g = (key: string) => getNormalizedRowValue(row_data, key);
  const num = (key: string) => {
    const v = g(key);
    const n = parseFloat(String(v).replace(/[$,]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const str = (key: string) => String(g(key) ?? '').trim();
  const ssn = str('Taxpayer SSN') || str('TAXPAYER_SSN');
  const ssnLast4 = extractLast4(ssn);
  const fundingDateRaw = str('Funding Date') || str('FUNDING_DATE');
  const applicationDateRaw = str('Application Date') || str('APPLICATION_DATE');

  return {
    id,
    batch: uploadId.slice(0, 13),
    status: 'Imported' as PayrollStatus,
    notes: '',
    efin: str('EFIN'),
    parentEfin: str('Parent EFIN') || str('PARENT_EFIN'),
    groupEfin: str('Group EFIN') || str('GROUP_EFIN'),
    ptin: str('PTIN'),
    taxpayerSsn: ssn,
    ssnLast4,
    taxpayerLastName: str('Taxpayer Last Name') || str('TAXPAYER_LAST_NAME'),
    taxpayerFirstName: str('Taxpayer First Name') || str('TAXPAYER_FIRST_NAME'),
    disbursementType: str('Disbursement Type') || str('DISBURSEMENT_TYPE'),
    taxCustomerAccountNumber: str('Tax Customer Account Number') || str('TAX_CUSTOMER_ACCOUNT_NUMBER'),
    cardNumber: str('Card Number') || str('CARD_NUMBER'),
    applicationDate: parseDate(applicationDateRaw),
    fundingDate: parseDate(fundingDateRaw),
    fundingType: str('Funding Type') || str('FUNDING_TYPE'),
    expectedRefund: num('Expected Refund') || num('EXPECTED_REFUND'),
    actualRefund: num('Actual Refund') || num('ACTUAL_REFUND'),
    customerDisbursementAmount: num('Customer Disbursement Amount') || num('CUSTOMER_DISBURSEMENT_AMOUNT'),
    refundOffset: num('Refund Offset') || num('REFUND_OFFSET'),
    advanceRepayment: num('Advance Repayment') || num('ADVANCE_REPAYMENT'),
    priorYearLoanDebt: num('Prior Year Loan Debt') || num('PRIOR_YEAR_LOAN_DEBT'),
    refundProductFee: num('Refund Product Fee') || num('REFUND_PRODUCT_FEE'),
    expectedTaxPrepFee: num('Expected Tax Prep Fee(s)') || num('EXPECTED_TAX_PREP_FEE_S_'),
    receivedTaxPrepFee: num('Received Tax Prep Fee(s)') || num('RECEIVED_TAX_PREP_FEE_S_'),
    highPrepFee: num('High Prep Fee') || num('HIGH_PREP_FEE'),
    taxPrepAfterHpFee: num('Tax Prep After HP Fee') || num('TAX_PREP_AFTER_HP_FEE'),
    efinReceivingPrepFee: str('EFIN Receiving Prep Fee') || str('EFIN_RECEIVING_PREP_FEE'),
    addOnFeeAmount: num('Add On Fee Amount') || num('ADD_ON_FEE_AMOUNT'),
    efinReceivingAddOnFee: str('EFIN Receiving Add On Fee') || str('EFIN_RECEIVING_ADD_ON_FEE'),
    eFileFee: num('E-File Fee(s)') || num('E_FILE_FEE_S_'),
    efinReceivingEFileFee: str('EFIN Receiving E-File Fee') || str('EFIN_RECEIVING_E_FILE_FEE'),
    serviceBureauFee: num('Service Bureau Fee') || num('SERVICE_BUREAU_FEE'),
    efinReceivingServiceBureauFee: str('EFIN Receiving Service Bureau Fee') || str('EFIN_RECEIVING_SERVICE_BUREAU_FEE'),
    transmitterFee: num('Transmitter Fee') || num('TRANSMITTER_FEE'),
    royaltyFee: num('RoyaltyFee') || num('ROYALTYFEE'),
    efinReceivingRoyaltyFee: str('EFIN Receiving Royalty Fee') || str('EFIN_RECEIVING_ROYALTY_FEE'),
    checkStatus: str('Check Status') || str('CHECK_STATUS'),
    bankAccountNumber: str('Bank Account Number') || str('BANK_ACCOUNT_NUMBER'),
    bankRoutingNumber: str('Bank Routing Number') || str('BANK_ROUTING_NUMBER'),
    taxpayerAddress: str('Taxpayer Address') || str('TAXPAYER_ADDRESS'),
    taxpayerCity: str('Taxpayer City') || str('TAXPAYER_CITY'),
    taxpayerState: str('Taxpayer State') || str('TAXPAYER_STATE'),
    taxpayerZipCode: str('Taxpayer Zip Code') || str('TAXPAYER_ZIP_CODE'),
    taxpayerDob: str('Taxpayer DOB') || str('TAXPAYER_DOB'),
    spouseName: str('Spouse Name') || str('SPOUSE_NAME'),
    spouseDob: str('Spouse DOB') || str('SPOUSE_DOB'),
    ero3Fee: num('ERO3Fee') || num('ERO3FEE'),
    ero4Fee: num('ERO4Fee') || num('ERO4FEE'),
    efinReceivingEro3Fee: str('EFIN Receiving ERO3 Fee') || str('EFIN_RECEIVING_ERO3_FEE'),
    efinReceivingEro4Fee: str('EFIN Receiving ERO4 Fee') || str('EFIN_RECEIVING_ERO4_FEE'),
    checkFee: num('Check Fee') || num('CHECK_FEE'),
    checkFeeRebate: num('Check Fee Rebate') || num('CHECK_FEE_REBATE'),
    efinReceivingCheckFeeRebate: str('EFIN Receiving Check Fee Rebate') || str('EFIN_RECEIVING_CHECK_FEE_REBATE'),
    docPrepFee: num('Doc Prep Fee') || num('DOC_PREP_FEE'),
    docPrepFeeAfterBankFee: num('Doc Prep Fee After Bank Fee') || num('DOC_PREP_FEE_AFTER_BANK_FEE'),
    efinReceivingDocPrepFee: str('EFIN Receiving Doc Prep Fee') || str('EFIN_RECEIVING_DOC_PREP_FEE'),
    // Computed columns (TBD)
    advanceRequested: false,
    afterAdvance: 0,
    taxOffice: '',
    pay: 0,
    preparer: '',
    clientBelongsTo: '',
    preparerShare: 0,
  };
}

function getNormalizedRowValue(rowData: Record<string, any>, key: string) {
  if (rowData[key] !== undefined) return rowData[key];
  const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const existingKey of Object.keys(rowData)) {
    if (existingKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalizedKey) {
      return rowData[existingKey];
    }
  }
  return '';
}

function hasPayrollContent(rowData: Record<string, any>) {
  const hasValue = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return !Number.isNaN(value) && value !== 0;
    const normalized = String(value).trim();
    return normalized !== '' && normalized !== '0' && normalized !== '$0.00';
  };

  return [
    'EFIN',
    'PTIN',
    'Taxpayer Last Name',
    'Taxpayer First Name',
    'Taxpayer SSN',
    'Funding Date',
    'Expected Tax Prep Fee(s)',
    'Received Tax Prep Fee(s)',
    'Actual Refund',
    'Customer Disbursement Amount',
  ].some((key) => hasValue(getNormalizedRowValue(rowData, key)));
}

const columns: Column<PayrollRow>[] = [
  { key: '_rowNum', header: '#', render: (_r, i) => (i ?? 0) + 1 },
  { key: 'efin', header: 'EFIN', mono: true, sortable: true },
  { key: 'ptin', header: 'PTIN', mono: true, sortable: true },
  { key: 'taxpayerLastName', header: 'Last Name', sortable: true },
  { key: 'taxpayerFirstName', header: 'First Name', sortable: true },
  { key: 'fundingDate', header: 'Funding Date', sortable: true },
  { key: 'ssnLast4', header: 'Taxpayer SSN', mono: true, render: (r) => `•••${r.ssnLast4}`, sortable: true },
  { key: 'expectedTaxPrepFee', header: 'Expected Prep Fee', mono: true, render: (r) => fmt(r.expectedTaxPrepFee), sortable: true },
  { key: 'receivedTaxPrepFee', header: 'Received Prep Fee', mono: true, render: (r) => fmt(r.receivedTaxPrepFee), sortable: true },
  { key: 'highPrepFee', header: 'High Prep Fee', mono: true, render: (r) => fmt(r.highPrepFee), sortable: true },
  { key: 'advanceRequested', header: 'Advance Requested', render: (r) => r.advanceRequested ? 'True' : 'False', sortable: true },
  { key: 'afterAdvance', header: 'After Advance', mono: true, render: (r) => fmt(r.afterAdvance), sortable: true },
  { key: 'taxOffice', header: 'Tax Office', render: (r) => dash(r.taxOffice), sortable: true },
  { key: 'pay', header: 'Pay', mono: true, render: (r) => fmt(r.pay), sortable: true },
  { key: 'preparer', header: 'Preparer', render: (r) => dash(r.preparer), sortable: true },
  { key: 'clientBelongsTo', header: 'Client Belongs To', render: (r) => dash(r.clientBelongsTo), sortable: true },
  { key: 'preparerShare', header: 'Preparer Share', mono: true, render: (r) => fmt(r.preparerShare), sortable: true },
];

const DetailField = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div><span className="text-muted-foreground">{label}:</span> <span className="font-mono">{value ?? '—'}</span></div>
);
const DetailMoney = ({ label, value }: { label: string; value: number | undefined }) => (
  <DetailField label={label} value={fmt(value)} />
);
const DetailSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface-ash rounded-lg p-4 space-y-2">
    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
    <div className="grid grid-cols-2 gap-2 text-sm">{children}</div>
  </div>
);

const MissingBelongsTable = ({ rows, onUpdate }: { rows: PayrollRow[]; onUpdate: (rowId: string, value: string) => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (row: PayrollRow, value: string) => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const clientName = `${(row.taxpayerLastName || '').trim()}, ${(row.taxpayerFirstName || '').trim()}`.toUpperCase();
      const normalizedValue = value.trim().toUpperCase();
      await supabase.from('client_overrides').upsert({
        ssn_ein: row.taxpayerSsn || `***-**-${row.ssnLast4}`,
        client_name: clientName,
        client_belongs_to: normalizedValue,
      }, { onConflict: 'ssn_ein,client_name' });
      onUpdate(row.id, value.trim());
      setEditingId(null);
      setEditValue('');
    } catch (err: any) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="border rounded-lg overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">#</th>
            <th className="text-left p-2 font-medium">EFIN</th>
            <th className="text-left p-2 font-medium">PTIN</th>
            <th className="text-left p-2 font-medium">Last Name</th>
            <th className="text-left p-2 font-medium">First Name</th>
            <th className="text-left p-2 font-medium">Client Belongs To</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No rows found.</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => { if (editingId !== r.id) { setEditingId(r.id); setEditValue(''); } }}>
              <td className="p-2">{i + 1}</td>
              <td className="p-2 font-mono">{r.efin}</td>
              <td className="p-2 font-mono">{r.ptin}</td>
              <td className="p-2">{r.taxpayerLastName}</td>
              <td className="p-2">{r.taxpayerFirstName}</td>
              <td className="p-2" onClick={e => e.stopPropagation()}>
                {editingId === r.id ? (
                  <Select value={editValue} onValueChange={val => { setEditValue(val); handleSave(r, val); }}>
                    <SelectTrigger className="h-7 text-sm w-32"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Preparer">Preparer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-muted-foreground italic">Click to set</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PayrollProcessing() {
  const { selectedWeek, selectedWeekRange } = useActiveWeek();
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<PayrollRow | null>(null);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [officeLookupState, setOfficeLookupState] = useState<Record<string, { clients_belongs_data: string }>>({});

  const loadRows = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    try {
      // Get only Payroll Report uploads for the selected week
      const { data: uploads, error: uErr } = await supabase
        .from('uploads')
        .select('id')
        .eq('type', 'Payroll Report')
        .eq('week_label', selectedWeek);

      if (uErr || !uploads || uploads.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const uploadIds = uploads.map(u => u.id);

      // Fetch all upload_rows for these uploads (paginate to handle >1000)
      let allRowData: any[] = [];
      for (let i = 0; i < uploadIds.length; i += 10) {
        const batch = uploadIds.slice(i, i + 10);
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('upload_rows')
            .select('id, upload_id, row_data')
            .in('upload_id', batch)
            .range(from, from + pageSize - 1);
          if (error) break;
          if (data) allRowData.push(...data);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
      }

      // Fetch offices, preparers, client data, and advance uploads
      const [{ data: offices }, { data: preparersData }, { data: clientUploads }, { data: advanceUploads }] = await Promise.all([
        supabase.from('offices').select('office_name, primary_efin, secondary_efin, parent_office, clients_belongs_data, process_advance, share_percent, process_preparers_share, default_preparers_share'),
        supabase.from('preparers').select('ptin, contractor, tax_office, efin, efin2, preparer_client_percent, office_flat_rate'),
        supabase.from('uploads').select('id').eq('type', 'Client Data Report').eq('week_label', selectedWeek),
        supabase.from('uploads').select('id').eq('type', 'Advance Report').eq('week_label', selectedWeek),
      ]);

      // Load client data rows
      let clientRows: Record<string, any>[] = [];
      if (clientUploads && clientUploads.length > 0) {
        const clientUploadIds = clientUploads.map(u => u.id);
        for (let i = 0; i < clientUploadIds.length; i += 10) {
          const batch = clientUploadIds.slice(i, i + 10);
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from('upload_rows')
              .select('row_data')
              .in('upload_id', batch)
              .range(from, from + pageSize - 1);
            if (error) break;
            if (data) clientRows.push(...data.map(d => d.row_data as Record<string, any>));
            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
        }
      }

      // Load advance data rows for matching
      let advanceRows: { ssnLast4: string; lastName: string; firstName: string }[] = [];
      if (advanceUploads && advanceUploads.length > 0) {
        const advUploadIds = advanceUploads.map(u => u.id);
        const seenKeys = new Set<string>();
        for (let i = 0; i < advUploadIds.length; i += 10) {
          const batch = advUploadIds.slice(i, i + 10);
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from('upload_rows')
              .select('row_data')
              .in('upload_id', batch)
              .range(from, from + pageSize - 1);
            if (error) break;
            if (data) {
              for (const d of data) {
                const rd = d.row_data as Record<string, any>;
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
            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
        }
      }

      // Build PTIN -> list of preparers (with contractor, tax_office)
      const ptinToPreparers: Record<string, { contractor: string; tax_office: string; preparer_client_percent: number; office_flat_rate: number }[]> = {};
      if (preparersData) {
        for (const p of preparersData) {
          if (p.ptin) {
            const key = p.ptin.trim().toLowerCase();
            if (!ptinToPreparers[key]) ptinToPreparers[key] = [];
            ptinToPreparers[key].push({ contractor: p.contractor, tax_office: p.tax_office, preparer_client_percent: p.preparer_client_percent ?? 0, office_flat_rate: p.office_flat_rate ?? 0 });
          }
        }
      }

      // Build EFIN -> office names and parent lookup
      const efinToOffices: Record<string, string[]> = {};
      const officeParent: Record<string, string> = {};
      const officeLookup: Record<string, { process_advance: boolean; share_percent: number; process_preparers_share: boolean; default_preparers_share: string; clients_belongs_data: string }> = {};
      if (offices) {
        for (const o of offices) {
          if (o.parent_office) officeParent[o.office_name] = o.parent_office;
          officeLookup[o.office_name] = { process_advance: o.process_advance, share_percent: o.share_percent, process_preparers_share: o.process_preparers_share, default_preparers_share: (o as any).default_preparers_share || '', clients_belongs_data: o.clients_belongs_data || '' };
          for (const efin of [o.primary_efin, o.secondary_efin]) {
            if (efin) {
              if (!efinToOffices[efin]) efinToOffices[efin] = [];
              if (!efinToOffices[efin].includes(o.office_name)) efinToOffices[efin].push(o.office_name);
            }
          }
        }
      }

      // Resolve preparer (contractor) and tax office
      const resolvePreparer = (efin: string, ptin: string): { contractor: string; taxOffice: string; preparer_client_percent: number; office_flat_rate: number } => {
        const matches = ptinToPreparers[ptin.trim().toLowerCase()];
        if (!matches || matches.length === 0) return { contractor: '', taxOffice: '', preparer_client_percent: 0, office_flat_rate: 0 };
        if (matches.length === 1) return { contractor: matches[0].contractor, taxOffice: matches[0].tax_office, preparer_client_percent: matches[0].preparer_client_percent, office_flat_rate: matches[0].office_flat_rate };
        const efinOfficeNames = efinToOffices[efin] || [];
        for (const m of matches) {
          if (efinOfficeNames.includes(m.tax_office)) return { contractor: m.contractor, taxOffice: m.tax_office, preparer_client_percent: m.preparer_client_percent, office_flat_rate: m.office_flat_rate };
        }
        return { contractor: matches[0].contractor, taxOffice: matches[0].tax_office, preparer_client_percent: matches[0].preparer_client_percent, office_flat_rate: matches[0].office_flat_rate };
      };

      // Load client overrides from dedicated table
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

      type ClientLookupEntry = {
        ssnLast4: string;
        lastName: string;
        firstName: string;
        belongsTo: string;
        priority: number;
      };

      const clientLookupEntries: ClientLookupEntry[] = [];

      // First load from raw upload data
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
            clientLookupEntries.push({
              ssnLast4: extractLast4(ssnEin),
              lastName,
              firstName,
              belongsTo,
              priority: 0,
            });
          }
        }
      }

      // Override with persisted client_overrides (takes priority)
      for (const ov of overridesData) {
        if (ov.client_belongs_to) {
          const { lastName, firstName } = splitClientName(ov.client_name);
          if (lastName && firstName) {
            clientLookupEntries.push({
              ssnLast4: extractLast4(ov.ssn_ein),
              lastName,
              firstName,
              belongsTo: ov.client_belongs_to,
              priority: 1,
            });
          }
        }
      }

      const resolveClientBelongsTo = (ssnLast4: string, lastName: string, firstName: string): string => {
        const normalizedPayrollLast = normalizeNameForMatch(lastName);
        const normalizedPayrollFirst = normalizeNameForMatch(firstName);

        // First pass: only check client_overrides (priority 1) — these are the authoritative source
        for (const entry of clientLookupEntries) {
          if (entry.priority < 1) continue;
          if (entry.ssnLast4 !== ssnLast4) continue;
          const lastScore = fuzzySimilarity(normalizeNameForMatch(entry.lastName), normalizedPayrollLast);
          const firstScore = fuzzySimilarity(normalizeNameForMatch(entry.firstName), normalizedPayrollFirst);
          if (lastScore >= 0.85 && firstScore >= 0.85) return entry.belongsTo;
        }

        // Second pass: fall back to raw uploaded Client Data (priority 0)
        let bestMatch: ClientLookupEntry | null = null;
        let bestScore = -1;
        for (const entry of clientLookupEntries) {
          if (entry.priority > 0) continue;
          if (entry.ssnLast4 !== ssnLast4) continue;
          const lastScore = fuzzySimilarity(normalizeNameForMatch(entry.lastName), normalizedPayrollLast);
          const firstScore = fuzzySimilarity(normalizeNameForMatch(entry.firstName), normalizedPayrollFirst);
          if (lastScore < 0.85 || firstScore < 0.85) continue;
          const totalScore = lastScore + firstScore;
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestMatch = entry;
          }
        }

        return bestMatch?.belongsTo || '';
      };

      // Check if advance was requested: match SSN last 4 + fuzzy name (85%)
      const resolveAdvanceRequested = (ssnLast4: string, lastName: string, firstName: string): boolean => {
        return advanceRows.some(adv => {
          if (adv.ssnLast4 !== ssnLast4) return false;
          const lastSim = fuzzySimilarity(normalizeNameForMatch(adv.lastName), normalizeNameForMatch(lastName));
          const firstSim = fuzzySimilarity(normalizeNameForMatch(adv.firstName), normalizeNameForMatch(firstName));
          return lastSim >= 0.85 && firstSim >= 0.85;
        });
      };

      const mapped = allRowData.flatMap(r => {
        const rawRow = (r.row_data as Record<string, any>) || {};
        if (!hasPayrollContent(rawRow)) return [];

        const row = mapRowData(rawRow, r.id, r.upload_id);
        const { contractor, taxOffice, preparer_client_percent, office_flat_rate } = resolvePreparer(row.efin, row.ptin);
        row.preparer = contractor;
        row.taxOffice = taxOffice;
        row.clientBelongsTo = resolveClientBelongsTo(row.ssnLast4, row.taxpayerLastName, row.taxpayerFirstName);
        row.advanceRequested = resolveAdvanceRequested(row.ssnLast4, row.taxpayerLastName, row.taxpayerFirstName);
        // After Advance: deduct $100 only if advance requested AND office has process_advance = true
        const officeConfig = officeLookup[taxOffice];
        if (row.advanceRequested && officeConfig?.process_advance) {
          row.afterAdvance = Math.max(0, row.receivedTaxPrepFee - 100);
        } else {
          row.afterAdvance = row.receivedTaxPrepFee;
        }
        // Pay = After Advance * Office Share %
        row.pay = officeConfig ? row.afterAdvance * (officeConfig.share_percent / 100) : 0;
        // Preparer Share: only if office has process_preparers_share enabled
        if (officeConfig?.process_preparers_share) {
          const belongsLower = (row.clientBelongsTo || '').toLowerCase().trim();
          if (belongsLower === 'preparer') {
            row.preparerShare = Math.min(row.receivedTaxPrepFee * (preparer_client_percent / 100), row.afterAdvance);
          } else if (belongsLower === '' || !row.clientBelongsTo) {
            // Client Belongs To is null/empty → use Default Preparers Share from office
            const defaultShare = officeConfig.default_preparers_share || 'preparer_client_percent';
            if (defaultShare === 'preparer_client_percent') {
              row.preparerShare = Math.min(row.receivedTaxPrepFee * (preparer_client_percent / 100), row.afterAdvance);
            } else {
              row.preparerShare = office_flat_rate;
            }
          } else {
            // Office or other value → use office_flat_rate
            row.preparerShare = office_flat_rate;
          }
        } else {
          row.preparerShare = 0;
        }
        return [row];
      });
      // Sort by Tax Office first, then Last Name, then First Name
      mapped.sort((a, b) => {
        const office = (a.taxOffice || '').localeCompare(b.taxOffice || '', undefined, { sensitivity: 'base' });
        if (office !== 0) return office;
        const last = a.taxpayerLastName.localeCompare(b.taxpayerLastName, undefined, { sensitivity: 'base' });
        if (last !== 0) return last;
        return a.taxpayerFirstName.localeCompare(b.taxpayerFirstName, undefined, { sensitivity: 'base' });
      });
      setOfficeLookupState(officeLookup);
      setRows(mapped);
    } catch (err) {
      console.error('Failed to load payroll rows:', err);
    }
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const [scoreDialog, setScoreDialog] = useState<'noPreparer' | 'noOffice' | 'missingBelongs' | null>(null);
  const [officeFilter, setOfficeFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Funding-date range from the selected payroll week (set at week creation)
  const parseIsoDate = (s: string | null | undefined): Date | undefined => {
    if (!s) return undefined;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return undefined;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  };
  const dateFrom = parseIsoDate(selectedWeekRange?.from);
  const dateTo = parseIsoDate(selectedWeekRange?.to);

  // Parse a row's fundingDate (MM/DD/YYYY) into a Date at local midnight
  const parseFundingDate = (v: string): Date | null => {
    if (!v) return null;
    const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
    }
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const rangeActive = !!(dateFrom || dateTo);
  const [rangeLo, rangeHi] = (() => {
    let lo = dateFrom ? new Date(dateFrom) : undefined;
    let hi = dateTo ? new Date(dateTo) : undefined;
    if (lo && hi && lo.getTime() > hi.getTime()) { const t = lo; lo = hi; hi = t; }
    if (lo) lo.setHours(0, 0, 0, 0);
    if (hi) hi.setHours(23, 59, 59, 999);
    return [lo, hi];
  })();
  const inRange = (row: PayrollRow): boolean => {
    if (!rangeActive) return true;
    const d = parseFundingDate(row.fundingDate);
    if (!d) return false;
    if (rangeLo && d.getTime() < rangeLo.getTime()) return false;
    if (rangeHi && d.getTime() > rangeHi.getTime()) return false;
    return true;
  };
  const rangeRows = useMemo(() => rows.filter(inRange), [rows, rangeActive, dateFrom, dateTo]);

  const statusCounts = (status: string) => rangeRows.filter(r => r.status === status).length;
  const noPreparerCount = rangeRows.filter(r => !r.preparer).length;
  const noOfficeCount = rangeRows.filter(r => !r.taxOffice).length;

  const kpis = [
    { title: 'Imported Rows', value: statusCounts('Imported'), icon: Import, filterKey: 'none' as const },
    { title: 'Needs Mapping', value: statusCounts('Needs Mapping'), icon: HelpCircle, filterKey: 'none' as const },
    { title: 'Missing Client Belongs Data', value: rangeRows.filter(r => {
      const oc = officeLookupState[r.taxOffice];
      return oc && (oc.clients_belongs_data === 'true') && !r.clientBelongsTo;
    }).length, icon: AlertTriangle, filterKey: 'missingBelongs' as const },
    { title: 'No Preparer', value: noPreparerCount, icon: UserX, filterKey: 'noPreparer' as const },
    { title: 'No Office', value: noOfficeCount, icon: Building2, filterKey: 'noOffice' as const },
  ];

  // Derive unique Tax Office values for Office filter
  const officeFilterOptions = Array.from(new Set(rangeRows.map(r => r.taxOffice).filter(Boolean))).sort().map(o => ({ value: o, label: o }));

  const handleDeleteAll = async () => {
    setLoading(true);
    const { data: uploads } = await supabase.from('uploads').select('id').eq('type', 'Payroll Report').eq('week_label', selectedWeek);
    let removedUploads = 0;
    if (uploads && uploads.length > 0) {
      const ids = uploads.map(u => u.id);
      removedUploads = ids.length;
      for (let i = 0; i < ids.length; i += 10) {
        await supabase.from('upload_rows').delete().in('upload_id', ids.slice(i, i + 10));
      }
      for (let i = 0; i < ids.length; i += 10) {
        await supabase.from('uploads').delete().in('id', ids.slice(i, i + 10));
      }
    }
    setRows([]);
    setLoading(false);
    await logAudit({ action: 'delete', entityType: 'payroll_data', entityLabel: selectedWeek, summary: `Deleted ALL payroll data (${removedUploads} upload(s)) for ${selectedWeek}.` });
  };
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const filtered = rangeRows.filter(r => {
    if (tab !== 'All' && r.status !== tab) return false;
    if (officeFilter.length > 0 && !officeFilter.includes(r.taxOffice)) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.taxpayerFirstName.toLowerCase().includes(s) || r.taxpayerLastName.toLowerCase().includes(s) || r.ptin.toLowerCase().includes(s) || r.efin.includes(s) || r.preparer.toLowerCase().includes(s);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const pagedColumns = columns.map(c => c.key === '_rowNum' ? { ...c, render: (_r: PayrollRow, i?: number) => (safePage - 1) * perPage + (i ?? 0) + 1 } : c);

  const dialogRows = scoreDialog === 'noPreparer' ? rangeRows.filter(r => !r.preparer) : scoreDialog === 'noOffice' ? rangeRows.filter(r => !r.taxOffice) : scoreDialog === 'missingBelongs' ? rangeRows.filter(r => {
    const oc = officeLookupState[r.taxOffice];
    return oc && (oc.clients_belongs_data === 'true') && !r.clientBelongsTo;
  }) : [];
  const dialogColumnsWithNums = noPreparerColumns.map((c, idx) => idx === 0 ? { ...c, render: (_r: PayrollRow, i?: number) => (i ?? 0) + 1 } : c);
  const dialogTitle = scoreDialog === 'noPreparer' ? 'Rows Without Preparer' : scoreDialog === 'noOffice' ? 'Rows Without Office' : 'Rows Missing Client Belongs Data';

  return (
    <div>
      <PageHeader title="Payroll Processing" description="Review, map, calculate, and distribute payroll rows" actions={
        <div className="flex flex-wrap gap-2 items-center">
          {rangeActive ? (
            <Badge variant="secondary" className="gap-1.5">
              <CalendarIcon className="h-3 w-3" />
              Funding: {dateFrom ? format(dateFrom, 'MMM d, yyyy') : '…'} – {dateTo ? format(dateTo, 'MMM d, yyyy') : '…'}
              <span className="text-muted-foreground">({rangeRows.length} rows)</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              No funding range set
            </Badge>
          )}
          <Button variant="destructive" className="gap-2" onClick={() => setDeleteAllOpen(true)} disabled={!selectedWeek}><Trash2 className="h-4 w-4" /> Delete All</Button>
          <Button variant="outline" className="gap-2"><Calculator className="h-4 w-4" /> Calculate All</Button>
        </div>
      } />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.title} className={kpi.filterKey !== 'none' ? 'cursor-pointer' : ''}
            onClick={() => { if (kpi.filterKey !== 'none') setScoreDialog(kpi.filterKey); }}>
            <KpiCard title={kpi.title} value={kpi.value} icon={kpi.icon} />
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={v => { setTab(v); setPage(1); }}>
        <FilterBar search={search} onSearchChange={s => { setSearch(s); setPage(1); }} searchPlaceholder="Search by name, PTIN, EFIN..." filters={[
          { label: 'Office', options: officeFilterOptions, multi: true, values: officeFilter, onValuesChange: (v: string[]) => { setOfficeFilter(v); setPage(1); } },
        ]} />
        {loading ? (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading payroll data...
          </div>
        ) : (
          <>
            <DataTable columns={pagedColumns} data={paged} onRowClick={setSelectedRow} emptyMessage="No payroll rows match the selected filters." />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{[25,50,100,200].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
                <span>Page {safePage} of {totalPages} ({filtered.length} rows)</span>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Tabs>
      <Dialog open={!!scoreDialog} onOpenChange={open => { if (!open) setScoreDialog(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle} ({dialogRows.length})</DialogTitle>
          </DialogHeader>
          {scoreDialog === 'missingBelongs' ? (
            <MissingBelongsTable rows={dialogRows} onUpdate={(rowId, value) => {
              setRows(prev => prev.map(r => r.id === rowId ? { ...r, clientBelongsTo: value } : r));
            }} />
          ) : (
            <DataTable columns={dialogColumnsWithNums} data={dialogRows} emptyMessage="No rows found." />
          )}
        </DialogContent>
      </Dialog>
      <DetailDrawer open={!!selectedRow} onClose={() => setSelectedRow(null)} title="Payroll Row Detail">
        {selectedRow && (
          <div className="space-y-5">
            <div className="flex items-center gap-2"><StatusBadge status={selectedRow.status} /><span className="text-sm text-muted-foreground">Batch {selectedRow.batch}</span></div>

            <DetailSection title="Taxpayer Info">
              <DetailField label="First Name" value={selectedRow.taxpayerFirstName} />
              <DetailField label="Last Name" value={selectedRow.taxpayerLastName} />
              <DetailField label="SSN" value={`•••${selectedRow.ssnLast4}`} />
              <DetailField label="DOB" value={selectedRow.taxpayerDob} />
              <DetailField label="Address" value={selectedRow.taxpayerAddress} />
              <DetailField label="City" value={selectedRow.taxpayerCity} />
              <DetailField label="State" value={selectedRow.taxpayerState} />
              <DetailField label="Zip" value={selectedRow.taxpayerZipCode} />
              <DetailField label="Spouse Name" value={selectedRow.spouseName} />
              <DetailField label="Spouse DOB" value={selectedRow.spouseDob} />
            </DetailSection>

            <DetailSection title="Identifiers & EFINs">
              <DetailField label="EFIN" value={selectedRow.efin} />
              <DetailField label="Parent EFIN" value={selectedRow.parentEfin} />
              <DetailField label="Group EFIN" value={selectedRow.groupEfin} />
              <DetailField label="PTIN" value={selectedRow.ptin} />
              <DetailField label="Disbursement Type" value={selectedRow.disbursementType} />
              <DetailField label="Tax Customer Acct#" value={selectedRow.taxCustomerAccountNumber} />
              <DetailField label="Card Number" value={selectedRow.cardNumber} />
              <DetailField label="Check Status" value={selectedRow.checkStatus} />
              <DetailField label="Bank Account#" value={selectedRow.bankAccountNumber} />
              <DetailField label="Bank Routing#" value={selectedRow.bankRoutingNumber} />
            </DetailSection>

            <DetailSection title="Dates">
              <DetailField label="Application Date" value={selectedRow.applicationDate} />
              <DetailField label="Funding Date" value={selectedRow.fundingDate} />
              <DetailField label="Funding Type" value={selectedRow.fundingType} />
            </DetailSection>

            <DetailSection title="Refund & Repayment">
              <DetailMoney label="Expected Refund" value={selectedRow.expectedRefund} />
              <DetailMoney label="Actual Refund" value={selectedRow.actualRefund} />
              <DetailMoney label="Customer Disbursement" value={selectedRow.customerDisbursementAmount} />
              <DetailMoney label="Refund Offset" value={selectedRow.refundOffset} />
              <DetailMoney label="Advance Repayment" value={selectedRow.advanceRepayment} />
              <DetailMoney label="Prior Year Loan Debt" value={selectedRow.priorYearLoanDebt} />
              <DetailMoney label="Refund Product Fee" value={selectedRow.refundProductFee} />
            </DetailSection>

            <DetailSection title="Tax Prep Fees">
              <DetailMoney label="Expected Tax Prep Fee(s)" value={selectedRow.expectedTaxPrepFee} />
              <DetailMoney label="Received Tax Prep Fee(s)" value={selectedRow.receivedTaxPrepFee} />
              <DetailMoney label="High Prep Fee" value={selectedRow.highPrepFee} />
              <DetailMoney label="Tax Prep After HP Fee" value={selectedRow.taxPrepAfterHpFee} />
              <DetailField label="EFIN Receiving Prep Fee" value={selectedRow.efinReceivingPrepFee} />
            </DetailSection>

            <DetailSection title="Add-On, E-File, SB, Transmitter Fees">
              <DetailMoney label="Add On Fee Amount" value={selectedRow.addOnFeeAmount} />
              <DetailField label="EFIN Receiving Add On Fee" value={selectedRow.efinReceivingAddOnFee} />
              <DetailMoney label="E-File Fee(s)" value={selectedRow.eFileFee} />
              <DetailField label="EFIN Receiving E-File Fee" value={selectedRow.efinReceivingEFileFee} />
              <DetailMoney label="Service Bureau Fee" value={selectedRow.serviceBureauFee} />
              <DetailField label="EFIN Receiving SB Fee" value={selectedRow.efinReceivingServiceBureauFee} />
              <DetailMoney label="Transmitter Fee" value={selectedRow.transmitterFee} />
              <DetailMoney label="Royalty Fee" value={selectedRow.royaltyFee} />
              <DetailField label="EFIN Receiving Royalty Fee" value={selectedRow.efinReceivingRoyaltyFee} />
            </DetailSection>

            <DetailSection title="ERO & Other Fees">
              <DetailMoney label="ERO3 Fee" value={selectedRow.ero3Fee} />
              <DetailMoney label="ERO4 Fee" value={selectedRow.ero4Fee} />
              <DetailField label="EFIN Receiving ERO3 Fee" value={selectedRow.efinReceivingEro3Fee} />
              <DetailField label="EFIN Receiving ERO4 Fee" value={selectedRow.efinReceivingEro4Fee} />
              <DetailMoney label="Check Fee" value={selectedRow.checkFee} />
              <DetailMoney label="Check Fee Rebate" value={selectedRow.checkFeeRebate} />
              <DetailField label="EFIN Receiving Check Fee Rebate" value={selectedRow.efinReceivingCheckFeeRebate} />
              <DetailMoney label="Doc Prep Fee" value={selectedRow.docPrepFee} />
              <DetailMoney label="Doc Prep Fee After Bank Fee" value={selectedRow.docPrepFeeAfterBankFee} />
              <DetailField label="EFIN Receiving Doc Prep Fee" value={selectedRow.efinReceivingDocPrepFee} />
            </DetailSection>

            <DetailSection title="Computed / Payout">
              <DetailField label="Advance Requested" value={selectedRow.advanceRequested ? 'True' : 'False'} />
              <DetailMoney label="After Advance" value={selectedRow.afterAdvance} />
              <DetailField label="Tax Office" value={selectedRow.taxOffice} />
              <DetailMoney label="Pay" value={selectedRow.pay} />
              <DetailField label="Preparer" value={selectedRow.preparer} />
              <DetailField label="Client Belongs To" value={selectedRow.clientBelongsTo} />
              <DetailMoney label="Preparer Share" value={selectedRow.preparerShare} />
            </DetailSection>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm">Re-map</Button>
              <Button variant="outline" size="sm">Apply Advance</Button>
              <Button size="sm">Calculate</Button>
            </div>
          </div>
        )}
      </DetailDrawer>
      <ConfirmDeleteDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Delete all payroll data?"
        entityName={selectedWeek}
        description={<>This permanently deletes <strong>all uploaded payroll rows</strong> for <strong>{selectedWeek}</strong>. This cannot be undone.</>}
        confirmLabel="Delete all data"
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
