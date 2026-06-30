import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { Button } from '@/components/ui/button';
import { DollarSign, FileDown, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { formatMoney } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { logAudit } from '@/services/auditLog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';

interface BackendRow {
  id: string;
  efin: string;
  parentEfin: string;
  groupEfin: string;
  ptin: string;
  taxpayerSsn: string;
  ssnLast4: string;
  taxpayerLastName: string;
  taxpayerFirstName: string;
  disbursementType: string;
  taxCustomerAccountNumber: string;
  cardNumber: string;
  applicationDate: string;
  fundingDate: string;
  fundingType: string;
  expectedRefund: number;
  actualRefund: number;
  customerDisbursementAmount: number;
  refundOffset: number;
  advanceRepayment: number;
  priorYearLoanDebt: number;
  refundProductFee: number;
  expectedTaxPrepFee: number;
  receivedTaxPrepFee: number;
  highPrepFee: number;
  taxPrepAfterHpFee: number;
  efinReceivingPrepFee: string;
  addOnFeeAmount: number;
  efinReceivingAddOnFee: string;
  eFileFee: number;
  efinReceivingEFileFee: string;
  serviceBureauFee: number;
  efinReceivingServiceBureauFee: string;
  transmitterFee: number;
  royaltyFee: number;
  efinReceivingRoyaltyFee: string;
  checkStatus: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  taxpayerAddress: string;
  taxpayerCity: string;
  taxpayerState: string;
  taxpayerZipCode: string;
  taxpayerDob: string;
  spouseName: string;
  spouseDob: string;
  ero3Fee: number;
  ero4Fee: number;
  efinReceivingEro3Fee: string;
  efinReceivingEro4Fee: string;
  checkFee: number;
  checkFeeRebate: number;
  efinReceivingCheckFeeRebate: string;
  docPrepFee: number;
  docPrepFeeAfterBankFee: number;
  efinReceivingDocPrepFee: string;
  taxOffice: string;
}

function mapRowData(row_data: Record<string, any>, id: string): BackendRow {
  const g = (key: string) => {
    if (row_data[key] !== undefined) return row_data[key];
    for (const k of Object.keys(row_data)) {
      if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) {
        return row_data[k];
      }
    }
    return '';
  };
  const num = (key: string) => {
    const v = g(key);
    const n = parseFloat(String(v).replace(/[$,]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const str = (key: string) => String(g(key) ?? '').trim();
  const ssn = str('Taxpayer SSN');
  const ssnLast4 = ssn.length >= 4 ? ssn.slice(-4) : ssn;

  return {
    id,
    efin: str('EFIN'),
    parentEfin: str('Parent EFIN'),
    groupEfin: str('Group EFIN'),
    ptin: str('PTIN'),
    taxpayerSsn: ssn,
    ssnLast4,
    taxpayerLastName: str('Taxpayer Last Name'),
    taxpayerFirstName: str('Taxpayer First Name'),
    disbursementType: str('Disbursement Type'),
    taxCustomerAccountNumber: str('Tax Customer Account Number'),
    cardNumber: str('Card Number'),
    applicationDate: str('Application Date'),
    fundingDate: str('Funding Date'),
    fundingType: str('Funding Type'),
    expectedRefund: num('Expected Refund'),
    actualRefund: num('Actual Refund'),
    customerDisbursementAmount: num('Customer Disbursement Amount'),
    refundOffset: num('Refund Offset'),
    advanceRepayment: num('Advance Repayment'),
    priorYearLoanDebt: num('Prior Year Loan Debt'),
    refundProductFee: num('Refund Product Fee'),
    expectedTaxPrepFee: num('Expected Tax Prep Fee(s)'),
    receivedTaxPrepFee: num('Received Tax Prep Fee(s)'),
    highPrepFee: num('High Prep Fee'),
    taxPrepAfterHpFee: num('Tax Prep After HP Fee'),
    efinReceivingPrepFee: str('EFIN Receiving Prep Fee'),
    addOnFeeAmount: num('Add On Fee Amount'),
    efinReceivingAddOnFee: str('EFIN Receiving Add On Fee'),
    eFileFee: num('E-File Fee(s)'),
    efinReceivingEFileFee: str('EFIN Receiving E-File Fee'),
    serviceBureauFee: num('Service Bureau Fee'),
    efinReceivingServiceBureauFee: str('EFIN Receiving Service Bureau Fee'),
    transmitterFee: num('Transmitter Fee'),
    royaltyFee: num('RoyaltyFee'),
    efinReceivingRoyaltyFee: str('EFIN Receiving Royalty Fee'),
    checkStatus: str('Check Status'),
    bankAccountNumber: str('Bank Account Number'),
    bankRoutingNumber: str('Bank Routing Number'),
    taxpayerAddress: str('Taxpayer Address'),
    taxpayerCity: str('Taxpayer City'),
    taxpayerState: str('Taxpayer State'),
    taxpayerZipCode: str('Taxpayer Zip Code'),
    taxpayerDob: str('Taxpayer DOB'),
    spouseName: str('Spouse Name'),
    spouseDob: str('Spouse DOB'),
    ero3Fee: num('ERO3Fee'),
    ero4Fee: num('ERO4Fee'),
    efinReceivingEro3Fee: str('EFIN Receiving ERO3 Fee'),
    efinReceivingEro4Fee: str('EFIN Receiving ERO4 Fee'),
    checkFee: num('Check Fee'),
    checkFeeRebate: num('Check Fee Rebate'),
    efinReceivingCheckFeeRebate: str('EFIN Receiving Check Fee Rebate'),
    docPrepFee: num('Doc Prep Fee'),
    docPrepFeeAfterBankFee: num('Doc Prep Fee After Bank Fee'),
    efinReceivingDocPrepFee: str('EFIN Receiving Doc Prep Fee'),
    taxOffice: '',
  };
}

const fmt = (v: number | undefined) => v != null && !isNaN(v) ? formatMoney(v) : '—';
const dash = (v: string | undefined) => v || '—';

const columns: Column<BackendRow>[] = [
  { key: 'efin', header: 'EFIN', mono: true },
  { key: 'ptin', header: 'PTIN', mono: true },
  { key: 'taxpayerLastName', header: 'Last Name' },
  { key: 'taxpayerFirstName', header: 'First Name' },
  { key: 'fundingDate', header: 'Funding Date' },
  { key: 'ssnLast4', header: 'Taxpayer SSN', mono: true, render: (r) => `•••${r.ssnLast4}` },
  { key: 'eFileFee', header: 'E-File Fee(s)', mono: true, render: (r) => fmt(r.eFileFee) },
  { key: 'serviceBureauFee', header: 'Service Bureau Fee', mono: true, render: (r) => fmt(r.serviceBureauFee) },
  { key: 'transmitterFee', header: 'Transmitter Fee', mono: true, render: (r) => fmt(r.transmitterFee) },
  { key: 'ero3Fee', header: 'ERO3Fee', mono: true, render: (r) => fmt(r.ero3Fee) },
  { key: 'taxOffice', header: 'Tax Office', render: (r) => dash(r.taxOffice) },
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

export default function BackendTable() {
  const { selectedWeek } = useActiveWeek();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<BackendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<BackendRow | null>(null);
  const [officeFilter, setOfficeFilter] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    try {
      // Get Backend Money Report uploads only for the selected week
      const { data: uploads, error: uErr } = await supabase
        .from('uploads')
        .select('id')
        .eq('type', 'Backend Money Report')
        .eq('week_label', selectedWeek);

      if (uErr || !uploads || uploads.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const uploadIds = uploads.map(u => u.id);

      // Fetch upload_rows
      let allRowData: any[] = [];
      for (let i = 0; i < uploadIds.length; i += 10) {
        const batch = uploadIds.slice(i, i + 10);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('upload_rows')
            .select('id, upload_id, row_data')
            .in('upload_id', batch)
            .range(from, from + 999);
          if (error) break;
          if (data) allRowData.push(...data);
          if (!data || data.length < 1000) break;
          from += 1000;
        }
      }

      // Fetch offices and preparers for Tax Office lookup
      const [{ data: offices }, { data: preparersData }] = await Promise.all([
        supabase.from('offices').select('office_name, primary_efin, secondary_efin, parent_office'),
        supabase.from('preparers').select('ptin, tax_office'),
      ]);

      // Build PTIN -> list of tax_office values from preparers
      const ptinToOffices: Record<string, string[]> = {};
      if (preparersData) {
        for (const p of preparersData) {
          if (p.ptin && p.tax_office) {
            const key = p.ptin.trim().toLowerCase();
            if (!ptinToOffices[key]) ptinToOffices[key] = [];
            if (!ptinToOffices[key].includes(p.tax_office)) ptinToOffices[key].push(p.tax_office);
          }
        }
      }

      // Build EFIN -> office names and parent lookup
      const efinToOffices: Record<string, string[]> = {};
      const officeParent: Record<string, string> = {};
      if (offices) {
        for (const o of offices) {
          if (o.parent_office) officeParent[o.office_name] = o.parent_office;
          for (const efin of [o.primary_efin, o.secondary_efin]) {
            if (efin) {
              if (!efinToOffices[efin]) efinToOffices[efin] = [];
              if (!efinToOffices[efin].includes(o.office_name)) efinToOffices[efin].push(o.office_name);
            }
          }
        }
      }

      const resolveTaxOffice = (efin: string, ptin: string): string => {
        // Step 1: Lookup PTIN in preparers
        const preparerOffices = ptinToOffices[ptin.trim().toLowerCase()];
        if (preparerOffices && preparerOffices.length === 1) return preparerOffices[0];
        if (preparerOffices && preparerOffices.length > 1) {
          const efinCandidates = efinToOffices[efin] || [];
          // Prioritize child/offspring office over parent
          for (const po of preparerOffices) {
            if (efinCandidates.includes(po) && officeParent[po]) return po;
          }
          for (const po of preparerOffices) {
            if (efinCandidates.includes(po)) return po;
          }
          return preparerOffices[0];
        }
        // Fallback: PTIN not found — use EFIN, prioritize child
        const efinCandidates = efinToOffices[efin] || [];
        if (efinCandidates.length === 0) return '';
        if (efinCandidates.length === 1) return efinCandidates[0];
        for (const candidate of efinCandidates) {
          if (officeParent[candidate]) return candidate;
        }
        return efinCandidates[0];
      };

      const mapped = allRowData.map(r => {
        const row = mapRowData(r.row_data as Record<string, any>, r.id);
        row.taxOffice = resolveTaxOffice(row.efin, row.ptin);
        return row;
      });
      setRows(mapped);
    } catch (err) {
      console.error('Failed to load backend rows:', err);
    }
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const totalAmount = rows.reduce((s, r) => s + r.eFileFee + r.serviceBureauFee + r.transmitterFee + r.ero3Fee, 0);

  const officeOptions = Array.from(
    new Set(rows.map(r => r.taxOffice).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = rows.filter(r => {
    if (officeFilter.length > 0 && !officeFilter.includes(r.taxOffice)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.taxpayerFirstName.toLowerCase().includes(s) || r.taxpayerLastName.toLowerCase().includes(s) || r.efin.includes(s) || r.ptin.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        title="Backend Money"
        description="Backend money staging table — separate from main payroll bucket"
        actions={
          <>
            <Button className="gap-2"><FileDown className="h-4 w-4" /> Export</Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={resetting || rows.length === 0}
              onClick={() => setResetOpen(true)}
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Reset Data
            </Button>
          </>
        }
      />
      <ConfirmDeleteDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={`Reset Backend Money for ${selectedWeek}?`}
        entityName={selectedWeek}
        description={<>This will permanently delete all Backend Money Report rows uploaded for <strong>{selectedWeek}</strong>. Other payroll weeks are not affected.</>}
        confirmLabel="Wipe backend data"
        onConfirm={async () => {
          if (!selectedWeek) return;
          setResetting(true);
          try {
            const { data: ups, error: uErr } = await supabase
              .from('uploads')
              .select('id')
              .eq('type', 'Backend Money Report')
              .eq('week_label', selectedWeek);
            if (uErr) throw uErr;
            const ids = (ups ?? []).map((u: any) => u.id);
            let removed = 0;
            if (ids.length) {
              for (let i = 0; i < ids.length; i += 50) {
                const slice = ids.slice(i, i + 50);
                const { error: rErr, count } = await supabase
                  .from('upload_rows')
                  .delete({ count: 'exact' })
                  .in('upload_id', slice);
                if (rErr) throw rErr;
                removed += count ?? 0;
              }
              const { error: dErr } = await supabase.from('uploads').delete().in('id', ids);
              if (dErr) throw dErr;
            }
            await logAudit({ action: 'delete', entityType: 'backend_data', entityLabel: selectedWeek, summary: `Reset Backend Money: removed ${removed} row(s) for ${selectedWeek}.` });
            toast({ title: 'Backend data reset', description: `${removed.toLocaleString()} row(s) removed for ${selectedWeek}.` });
            await loadRows();
          } catch (err: any) {
            toast({ title: 'Reset failed', description: err?.message ?? 'Unable to wipe backend data.', variant: 'destructive' });
            throw err;
          } finally {
            setResetting(false);
          }
        }}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Rows" value={rows.length} icon={DollarSign} />
        <KpiCard title="Total Backend Fees" value={formatMoney(totalAmount)} icon={DollarSign} />
        <KpiCard title="Offices Matched" value={rows.filter(r => r.taxOffice).length} icon={DollarSign} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading backend rows...</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Office {officeFilter.length > 0 && `(${officeFilter.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-56 bg-popover">
                {officeFilter.length > 0 && (
                  <>
                    <DropdownMenuItem onClick={() => setOfficeFilter([])} className="text-xs">
                      Clear all
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {officeOptions.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No offices</div>
                ) : officeOptions.map(o => (
                  <DropdownMenuCheckboxItem
                    key={o}
                    checked={officeFilter.includes(o)}
                    onCheckedChange={(checked) => {
                      setOfficeFilter(prev => checked ? [...prev, o] : prev.filter(x => x !== o));
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {o}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {officeFilter.map(o => (
              <Badge key={o} variant="secondary" className="gap-1">
                {o}
                <button
                  onClick={() => setOfficeFilter(prev => prev.filter(x => x !== o))}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${o}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search backend rows..." />
          <DataTable columns={columns} data={filtered} emptyMessage="No backend rows found. Upload a Backend Money Report in Upload Center." onRowClick={setSelectedRow} />
        </>
      )}

      <DetailDrawer open={!!selectedRow} onClose={() => setSelectedRow(null)} title="Backend Row Detail" width="max-w-2xl">
        {selectedRow && (
          <div className="space-y-4">
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
              <DetailField label="Tax Office" value={selectedRow.taxOffice} />
              <DetailField label="Disbursement Type" value={selectedRow.disbursementType} />
              <DetailField label="Card Number" value={selectedRow.cardNumber} />
              <DetailField label="Account #" value={selectedRow.taxCustomerAccountNumber} />
              <DetailField label="Check Status" value={selectedRow.checkStatus} />
              <DetailField label="Bank Account" value={selectedRow.bankAccountNumber} />
              <DetailField label="Bank Routing" value={selectedRow.bankRoutingNumber} />
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
              <DetailMoney label="Expected Prep Fee" value={selectedRow.expectedTaxPrepFee} />
              <DetailMoney label="Received Prep Fee" value={selectedRow.receivedTaxPrepFee} />
              <DetailMoney label="High Prep Fee" value={selectedRow.highPrepFee} />
              <DetailMoney label="After HP Fee" value={selectedRow.taxPrepAfterHpFee} />
              <DetailField label="EFIN Receiving Prep Fee" value={selectedRow.efinReceivingPrepFee} />
            </DetailSection>
            <DetailSection title="E-File / SB / Transmitter / ERO Fees">
              <DetailMoney label="E-File Fee(s)" value={selectedRow.eFileFee} />
              <DetailField label="EFIN Receiving E-File Fee" value={selectedRow.efinReceivingEFileFee} />
              <DetailMoney label="Service Bureau Fee" value={selectedRow.serviceBureauFee} />
              <DetailField label="EFIN Receiving SB Fee" value={selectedRow.efinReceivingServiceBureauFee} />
              <DetailMoney label="Transmitter Fee" value={selectedRow.transmitterFee} />
              <DetailMoney label="Royalty Fee" value={selectedRow.royaltyFee} />
              <DetailField label="EFIN Receiving Royalty Fee" value={selectedRow.efinReceivingRoyaltyFee} />
              <DetailMoney label="ERO3 Fee" value={selectedRow.ero3Fee} />
              <DetailField label="EFIN Receiving ERO3 Fee" value={selectedRow.efinReceivingEro3Fee} />
              <DetailMoney label="ERO4 Fee" value={selectedRow.ero4Fee} />
              <DetailField label="EFIN Receiving ERO4 Fee" value={selectedRow.efinReceivingEro4Fee} />
            </DetailSection>
            <DetailSection title="Add-On / Check / Doc Prep Fees">
              <DetailMoney label="Add On Fee" value={selectedRow.addOnFeeAmount} />
              <DetailField label="EFIN Receiving Add On Fee" value={selectedRow.efinReceivingAddOnFee} />
              <DetailMoney label="Check Fee" value={selectedRow.checkFee} />
              <DetailMoney label="Check Fee Rebate" value={selectedRow.checkFeeRebate} />
              <DetailField label="EFIN Receiving Check Fee Rebate" value={selectedRow.efinReceivingCheckFeeRebate} />
              <DetailMoney label="Doc Prep Fee" value={selectedRow.docPrepFee} />
              <DetailMoney label="Doc Prep After Bank Fee" value={selectedRow.docPrepFeeAfterBankFee} />
              <DetailField label="EFIN Receiving Doc Prep Fee" value={selectedRow.efinReceivingDocPrepFee} />
            </DetailSection>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
