import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { DollarSign, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { formatMoney } from '@/lib/utils';

interface FeeInterceptRow {
  id: string;
  groupEfin: string;
  parentEfin: string;
  efin: string;
  totalTpFees: number;
  highPrepFee: number;
  totalPrepAfterHpFee: number;
  totalEfileFees: number;
  totalSbFees: number;
  totalOtherFees: number;
  grossFees: number;
  totalFeeIntercept: number;
  tpFeePartiallyFunded: number;
  tpFeeFullyFunded: number;
  accountLast4: string;
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

const columns: Column<FeeInterceptRow>[] = [
  { key: 'efin', header: 'EFIN', mono: true },
  { key: 'groupEfin', header: 'Group EFIN', mono: true },
  { key: 'parentEfin', header: 'Parent EFIN', mono: true },
  { key: 'accountLast4', header: 'Account Last 4', mono: true },
  { key: 'totalTpFees', header: 'Total TP Fees', mono: true, render: (r) => formatMoney(r.totalTpFees) },
  { key: 'highPrepFee', header: 'High Prep Fee', mono: true, render: (r) => formatMoney(r.highPrepFee) },
  { key: 'grossFees', header: 'Gross Fees', mono: true, render: (r) => formatMoney(r.grossFees) },
  { key: 'totalFeeIntercept', header: 'Fee Intercept', mono: true, render: (r) => formatMoney(r.totalFeeIntercept) },
  { key: 'tpFeePartiallyFunded', header: 'Partially Funded', mono: true },
  { key: 'tpFeeFullyFunded', header: 'Fully Funded', mono: true },
  { key: 'dateIngested', header: 'Date Ingested', sortable: true },
];

export default function FeeIntercept() {
  const { selectedWeek } = useActiveWeek();
  const [rows, setRows] = useState<FeeInterceptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FeeInterceptRow | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    const { data: uploads } = await supabase
      .from('uploads')
      .select('id, uploaded_date')
      .eq('type', 'Fee Intercept Report')
      .eq('week_label', selectedWeek);

    if (!uploads || uploads.length === 0) { setRows([]); setLoading(false); return; }

    const uploadMap: Record<string, string> = {};
    uploads.forEach(u => { uploadMap[u.id] = u.uploaded_date; });
    const uploadIds = uploads.map(u => u.id);

    let allUploadRows: any[] = [];
    for (let i = 0; i < uploadIds.length; i += 10) {
      const batch = uploadIds.slice(i, i + 10);
      const { data } = await supabase
        .from('upload_rows')
        .select('*')
        .in('upload_id', batch);
      if (data) allUploadRows.push(...data);
    }

    const mapped: FeeInterceptRow[] = allUploadRows.map((ur, idx) => {
      const d = ur.row_data as Record<string, any>;
      return {
        id: ur.id || `fi-${idx}`,
        groupEfin: getVal(d, 'GROUP_EFIN'),
        parentEfin: getVal(d, 'PARENT_EFIN'),
        efin: getVal(d, 'EFIN'),
        totalTpFees: getNum(d, 'TOTAL_TP_FEES'),
        highPrepFee: getNum(d, 'HIGH_PREP_FEE'),
        totalPrepAfterHpFee: getNum(d, 'TOTAL_PREP_AFTER_HP_FEE'),
        totalEfileFees: getNum(d, 'TOTAL_EFILE_FEES'),
        totalSbFees: getNum(d, 'TOTAL_SB_FEES'),
        totalOtherFees: getNum(d, 'TOTAL_OTHER_FEES'),
        grossFees: getNum(d, 'GROSS_FEES'),
        totalFeeIntercept: getNum(d, 'TOTAL_FEE_INTERCEPT'),
        tpFeePartiallyFunded: getNum(d, '_TP_FEE_PARTIALLY_FUNDED', 'TP_FEE_PARTIALLY_FUNDED'),
        tpFeeFullyFunded: getNum(d, '_TP_FEE_FULLY_FUNDED', 'TP_FEE_FULLY_FUNDED'),
        accountLast4: getVal(d, 'ACCOUNT_LAST_4'),
        dateIngested: uploadMap[ur.upload_id] ? new Date(uploadMap[ur.upload_id]).toLocaleDateString() : '',
      };
    });

    setRows(mapped);
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = rows.filter(r =>
    !search || [r.efin, r.groupEfin, r.parentEfin, r.accountLast4].some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  const totalGross = rows.reduce((s, r) => s + r.grossFees, 0);
  const totalIntercept = rows.reduce((s, r) => s + r.totalFeeIntercept, 0);

  const drawerFields = selected ? [
    { label: 'EFIN', value: selected.efin },
    { label: 'Group EFIN', value: selected.groupEfin },
    { label: 'Parent EFIN', value: selected.parentEfin },
    { label: 'Account Last 4', value: selected.accountLast4 },
    { label: 'Total TP Fees', value: formatMoney(selected.totalTpFees) },
    { label: 'High Prep Fee', value: formatMoney(selected.highPrepFee) },
    { label: 'Total Prep After HP Fee', value: formatMoney(selected.totalPrepAfterHpFee) },
    { label: 'Total EFile Fees', value: formatMoney(selected.totalEfileFees) },
    { label: 'Total SB Fees', value: formatMoney(selected.totalSbFees) },
    { label: 'Total Other Fees', value: formatMoney(selected.totalOtherFees) },
    { label: 'Gross Fees', value: formatMoney(selected.grossFees) },
    { label: 'Total Fee Intercept', value: formatMoney(selected.totalFeeIntercept) },
    { label: '# TP Fee Partially Funded', value: String(selected.tpFeePartiallyFunded) },
    { label: '# TP Fee Fully Funded', value: String(selected.tpFeeFullyFunded) },
    { label: 'Date Ingested', value: selected.dateIngested },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Intercept" description="SubOffice summary fee intercept data from uploaded reports" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Records" value={rows.length} icon={FileText} />
        <KpiCard title="Total Gross Fees" value={formatMoney(totalGross)} icon={DollarSign} />
        <KpiCard title="Total Fee Intercept" value={formatMoney(totalIntercept)} icon={DollarSign} />
      </div>

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by EFIN or Account Last 4..." />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={setSelected} />
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Fee Intercept Detail"
      >
        {selected && (
          <div className="space-y-3">
            {drawerFields.map(f => (
              <div key={f.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium">{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
