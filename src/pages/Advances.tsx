import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Banknote, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { isAdvanceDuplicate } from '@/services/fuzzyMatch';
import { formatMoney } from '@/lib/utils';

interface AdvanceRow {
  id: string;
  groupEfin: string;
  parentEfin: string;
  officeEfin: string;
  ptin: string;
  applicationDate: string;
  decisionDate: string;
  loanType: string;
  requestedLoanLevel: string;
  status: string;
  lastName: string;
  firstName: string;
  ssn: string;
  ssnLast4: string;
  loanDisbType: string;
  advanceAmount: number;
  outstandingBalance: number;
  marketingFee: number;
  repaymentStatus: string;
  irsAckDate: string;
  loanPaidDate: string;
  dateIngested: string;
}

function normalizeKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
}

function getVal(row: Record<string, any>, ...keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = normalizeKey(k);
    for (const target of keys) {
      if (norm === target) return String(row[k] ?? '');
    }
  }
  return '';
}

function getNum(row: Record<string, any>, ...keys: string[]): number {
  const v = getVal(row, ...keys);
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

const tabs = ['All', 'Matched', 'Unmatched', 'Deducted'];

export default function Advances() {
  const { selectedWeek } = useActiveWeek();
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdvanceRow | null>(null);
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    // Get all Advance Report uploads for the selected week
    const { data: uploads } = await supabase
      .from('uploads')
      .select('id, uploaded_date')
      .eq('type', 'Advance Report')
      .eq('week_label', selectedWeek)
      .order('uploaded_date', { ascending: true });

    if (!uploads || uploads.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const uploadMap = new Map(uploads.map(u => [u.id, u.uploaded_date]));
    const uploadIds = uploads.map(u => u.id);

    // Fetch all rows for these uploads
    const allRows: any[] = [];
    for (let i = 0; i < uploadIds.length; i += 10) {
      const batch = uploadIds.slice(i, i + 10);
      const { data } = await supabase
        .from('upload_rows')
        .select('*')
        .in('upload_id', batch)
        .order('row_index', { ascending: true });
      if (data) allRows.push(...data);
    }

    // Map raw rows to AdvanceRow
    const mapped: AdvanceRow[] = allRows.map((r, idx) => {
      const d = r.row_data as Record<string, any>;
      const ssn = getVal(d, 'SSN');
      return {
        id: r.id || `adv-${idx}`,
        groupEfin: getVal(d, 'GROUP_EFIN'),
        parentEfin: getVal(d, 'PARENT_EFIN'),
        officeEfin: getVal(d, 'OFFICE_EFIN'),
        ptin: getVal(d, 'PTIN'),
        applicationDate: getVal(d, 'APPLICATION_DATE'),
        decisionDate: getVal(d, 'DECISION_DATE'),
        loanType: getVal(d, 'LOAN_TYPE'),
        requestedLoanLevel: getVal(d, 'REQUESTED_LOAN_LEVEL'),
        status: getVal(d, 'STATUS') || 'Unmatched',
        lastName: getVal(d, 'LAST_NAME'),
        firstName: getVal(d, 'FIRST_NAME'),
        ssn,
        ssnLast4: maskSsn(ssn),
        loanDisbType: getVal(d, 'LOAN_DISB_TYPE'),
        advanceAmount: getNum(d, 'ADVANCE_AMOUNT'),
        outstandingBalance: getNum(d, 'OUTSTANDING_LOAN_BALANCE'),
        marketingFee: getNum(d, 'MARKETING_FEE'),
        repaymentStatus: getVal(d, 'REPAYMENT_STATUS'),
        irsAckDate: getVal(d, 'IRS_ACK_DATE'),
        loanPaidDate: getVal(d, 'LOAN_PAID_DATE'),
        dateIngested: uploadMap.get(r.upload_id)
          ? new Date(uploadMap.get(r.upload_id)!).toLocaleDateString('en-US')
          : '',
      };
    });

    // Deduplication: remove duplicates based on SSN + fuzzy name (85%), keep first occurrence
    const unique: AdvanceRow[] = [];
    for (const row of mapped) {
      const isDup = unique.some(u => isAdvanceDuplicate(u, row, 0.85));
      if (!isDup) unique.push(row);
    }

    setRows(unique);
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => { loadData(); }, [loadData]);

  const kpis = [
    { title: 'Total Advances', value: rows.length, icon: Banknote },
    { title: 'Matched', value: rows.filter(a => a.status === 'Matched').length, icon: CheckCircle },
    { title: 'Unmatched', value: rows.filter(a => a.status === 'Unmatched').length, icon: XCircle },
    { title: 'Deducted', value: rows.filter(a => a.status === 'Deducted').length, icon: AlertTriangle },
  ];

  const columns: Column<AdvanceRow>[] = [
    { key: 'ptin', header: 'PTIN', mono: true },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'ssnLast4', header: 'SSN Last 4', mono: true },
    { key: 'loanType', header: 'Loan Type' },
    { key: 'advanceAmount', header: 'Amount', mono: true, render: (r) => formatMoney(r.advanceAmount) },
    { key: 'outstandingBalance', header: 'Balance', mono: true, render: (r) => formatMoney(r.outstandingBalance) },
    { key: 'repaymentStatus', header: 'Repayment', render: (r) => <StatusBadge status={r.repaymentStatus || 'N/A'} /> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'dateIngested', header: 'Date Ingested', sortable: true },
  ];

  const filtered = rows.filter(a => {
    if (tab !== 'All' && a.status !== tab) return false;
    if (search) {
      const s = search.toLowerCase();
      return a.firstName.toLowerCase().includes(s) || a.lastName.toLowerCase().includes(s) || a.ptin.includes(s) || a.ssnLast4.includes(s);
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Advances" description="Taxpayer loan status from ingested Advance Reports" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => <KpiCard key={k.title} {...k} />)}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading advance data...
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 bg-surface-ash">{tabs.map(t => <TabsTrigger key={t} value={t} className="text-xs">{t}</TabsTrigger>)}</TabsList>
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search advances..." />
          <DataTable columns={columns} data={filtered} onRowClick={setSelected} />
        </Tabs>
      )}
      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title="Advance Detail">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-sm">{selected.firstName} {selected.lastName}</span>
            </div>
            <div className="bg-surface-ash rounded-lg p-4 space-y-2 text-sm">
              <div><span className="text-muted-foreground">PTIN:</span> <span className="font-mono">{selected.ptin}</span></div>
              <div><span className="text-muted-foreground">SSN Last 4:</span> <span className="font-mono">{selected.ssnLast4}</span></div>
              <div><span className="text-muted-foreground">Group EFIN:</span> <span className="font-mono">{selected.groupEfin}</span></div>
              <div><span className="text-muted-foreground">Loan Type:</span> {selected.loanType}</div>
              <div><span className="text-muted-foreground">Loan Disb Type:</span> {selected.loanDisbType}</div>
              <div><span className="text-muted-foreground">Advance Amount:</span> <span className="font-mono">{formatMoney(selected.advanceAmount)}</span></div>
              <div><span className="text-muted-foreground">Outstanding:</span> <span className="font-mono">{formatMoney(selected.outstandingBalance)}</span></div>
              <div><span className="text-muted-foreground">Marketing Fee:</span> <span className="font-mono">{formatMoney(selected.marketingFee)}</span></div>
              <div><span className="text-muted-foreground">Repayment Status:</span> {selected.repaymentStatus}</div>
              <div><span className="text-muted-foreground">Application Date:</span> {selected.applicationDate}</div>
              <div><span className="text-muted-foreground">Decision Date:</span> {selected.decisionDate}</div>
              <div><span className="text-muted-foreground">IRS Ack Date:</span> {selected.irsAckDate}</div>
              <div><span className="text-muted-foreground">Loan Paid Date:</span> {selected.loanPaidDate}</div>
              <div><span className="text-muted-foreground">Date Ingested:</span> {selected.dateIngested}</div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm">Review Match</Button>
              <Button size="sm">Apply Deduction</Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
