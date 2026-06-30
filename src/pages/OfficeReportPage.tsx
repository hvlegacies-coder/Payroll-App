import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { FilterBar } from '@/components/payroll/FilterBar';
import { bucketRows, backendRows, feeIntercepts, preparerLookups } from '@/data/payrollData';
import { buildOfficeReport, buildPreparerShareBlock } from '@/services/calculationEngine';
import { getOfficeColor } from '@/services/distributionEngine';
import { officeMatches, type BucketRow, type PreparerShareResult } from '@/services/types';
import { DollarSign, TrendingUp, Shield, Banknote, FileDown, ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatMoney } from '@/lib/utils';

export default function OfficeReportPage() {
  const { officeName } = useParams<{ officeName: string }>();
  const navigate = useNavigate();
  const decodedOffice = decodeURIComponent(officeName || '');
  const [tab, setTab] = useState('payroll');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<BucketRow | null>(null);
  const officeRows = useMemo(() => bucketRows.filter(r => officeMatches(r.tax_office, decodedOffice)), [decodedOffice]);
  const report = useMemo(() => buildOfficeReport(decodedOffice, bucketRows, backendRows, feeIntercepts[decodedOffice] || 0, preparerLookups), [decodedOffice]);
  const preparerBlock = useMemo(() => buildPreparerShareBlock(officeRows, preparerLookups), [officeRows]);
  const officeColor = getOfficeColor(decodedOffice);
  const filteredRows = officeRows.filter(r => { if (!search) return true; const s = search.toLowerCase(); return r.taxpayer_first_name.toLowerCase().includes(s) || r.taxpayer_last_name.toLowerCase().includes(s) || r.preparer.toLowerCase().includes(s) || r.ptin.includes(s); });
  const payrollColumns: Column<BucketRow>[] = [
    { key: 'efin', header: 'EFIN', mono: true }, { key: 'ptin', header: 'PTIN', mono: true },
    { key: 'taxpayer_ssn_last4', header: 'SSN', mono: true, render: r => `•••${r.taxpayer_ssn_last4}` },
    { key: 'taxpayer_first_name', header: 'First' }, { key: 'taxpayer_last_name', header: 'Last' },
    { key: 'funding_date', header: 'Funding Date' },
    { key: 'received_tax_prep_fees', header: 'Received', mono: true, render: r => formatMoney(r.received_tax_prep_fees) },
    { key: 'pay', header: 'Pay', mono: true, render: r => formatMoney(r.pay) },
    { key: 'preparer_share', header: 'Share', mono: true, render: r => formatMoney(r.preparer_share) },
    { key: 'preparer', header: 'Preparer', render: r => r.preparer || <span className="text-muted-foreground">—</span> },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status === 'calculated' ? 'Calculated' : r.status === 'distributed' ? 'Distributed' : r.status} /> },
  ];
  const shareColumns: Column<PreparerShareResult>[] = [
    { key: 'preparer', header: 'Preparer' }, { key: 'ptin', header: 'PTIN', mono: true },
    { key: 'row_count', header: 'Returns', mono: true },
    { key: 'total_received', header: 'Total Received', mono: true, render: r => formatMoney(r.total_received) },
    { key: 'preparer_fee', header: 'Prep Fee', mono: true, render: r => formatMoney(r.preparer_fee) },
    { key: 'total_share', header: 'Total Share', mono: true, render: r => formatMoney(r.total_share) },
    { key: 'share_percent', header: 'Share %', mono: true, render: r => `${r.share_percent}%` },
  ];
  const fmt = formatMoney;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/offices')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="h-3 w-3 rounded-full" style={{ background: `hsl(${officeColor})` }} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{decodedOffice}</span>
      </div>
      <PageHeader title={`${decodedOffice} Office Report`} description="Weekly payroll summary, preparer shares, and financial breakdown" actions={<Button className="gap-2"><FileDown className="h-4 w-4" /> Export Report</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <KpiCard title="Total Received" value={fmt(report.total_received_prep_fee)} icon={DollarSign} />
        <KpiCard title="Total Fees Due" value={fmt(report.total_fees_due)} icon={Shield} />
        <KpiCard title="AGI" value={fmt(report.agi)} icon={TrendingUp} />
        <KpiCard title="Backend Money" value={fmt(report.total_backend_money)} icon={Banknote} />
        <KpiCard title="Net Pay" value={fmt(report.net_pay)} icon={DollarSign} />
        <KpiCard title="Fee Intercept" value={fmt(report.fee_intercept)} icon={Shield} />
        <KpiCard title="Transmitter Fees" value={fmt(report.total_transmitter_fee)} icon={DollarSign} />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-surface-ash">
          <TabsTrigger value="payroll" className="text-xs gap-1"><DollarSign className="h-3 w-3" /> Payroll Detail</TabsTrigger>
          <TabsTrigger value="preparers" className="text-xs gap-1"><Users className="h-3 w-3" /> Preparers Share</TabsTrigger>
        </TabsList>
        {tab === 'payroll' && (<><FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search payroll rows..." /><DataTable columns={payrollColumns} data={filteredRows} onRowClick={setSelectedRow} emptyMessage={`No payroll rows for ${decodedOffice}`} /></>)}
        {tab === 'preparers' && <DataTable columns={shareColumns} data={preparerBlock} emptyMessage="No preparer data" />}
      </Tabs>
      <DetailDrawer open={!!selectedRow} onClose={() => setSelectedRow(null)} title="Payroll Row Detail">
        {selectedRow && (
          <div className="space-y-4">
            <div className="bg-surface-ash rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">{selectedRow.taxpayer_first_name} {selectedRow.taxpayer_last_name}</p>
              <p className="text-xs text-muted-foreground font-mono">SSN •••{selectedRow.taxpayer_ssn_last4}</p>
            </div>
            <div className="bg-surface-ash rounded-lg p-4 space-y-2 text-sm">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financial</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Received:</span> <span className="font-mono">{fmt(selectedRow.received_tax_prep_fees)}</span></div>
                <div><span className="text-muted-foreground">Pay:</span> <span className="font-mono font-medium">{fmt(selectedRow.pay)}</span></div>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
