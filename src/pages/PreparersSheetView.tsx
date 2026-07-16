import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/utils';
import { getActiveAccountId } from '@/contexts/AccountContext';
import { PreparerEditDialog, type Preparer } from '@/components/preparers/PreparerEditDialog';

// Mirrors the column order of the source PTIN List spreadsheet, plus a
// Status column for the active/inactive flag that only exists in-app.
const columns: Column<Preparer>[] = [
  { key: 'ptin', header: 'PTIN #', mono: true, sortable: true },
  { key: 'contractor', header: 'Contractor', sortable: true },
  { key: 'main_office', header: 'Main Office', sortable: true },
  { key: 'tax_office', header: 'Tax Office', sortable: true },
  { key: 'efin', header: 'EFIN', mono: true },
  { key: 'efin2', header: 'EFIN2', mono: true },
  { key: 'share_percent', header: 'Share %', mono: true, render: (r) => `${r.share_percent}%` },
  { key: 'shared_efin_percent', header: 'Shared EFIN (%)', mono: true, render: (r) => r.shared_efin_percent ? `${r.shared_efin_percent}%` : '' },
  { key: 'roles', header: 'Roles' },
  { key: 'preparer_client_percent', header: 'Preparer Client %', mono: true, render: (r) => `${r.preparer_client_percent}%` },
  { key: 'office_flat_rate', header: 'Office Flat Rate', mono: true, render: (r) => formatMoney(r.office_flat_rate, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) },
  { key: 'landing_tab', header: 'Landing Tab' },
  { key: 'availed_payroll', header: 'Availed Payroll', mono: true, render: (r) => r.availed_payroll ? formatMoney(r.availed_payroll, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '' },
  { key: 'notes', header: 'Notes' },
  { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'Active' : 'Inactive'} /> },
];

export default function PreparersSheetView() {
  const [search, setSearch] = useState('');
  const [preparers, setPreparers] = useState<Preparer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Preparer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadPreparers = useCallback(async () => {
    const acct = getActiveAccountId();
    let all: Preparer[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      let q = supabase.from('preparers').select('*');
      if (acct) q = q.eq('account_id', acct);
      const { data, error } = await q.order('main_office').order('tax_office').order('contractor').range(from, from + pageSize - 1);
      if (error) { console.error(error); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data as Preparer[]);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setPreparers(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadPreparers(); }, [loadPreparers]);

  const filtered = preparers.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [p.ptin, p.contractor, p.main_office, p.tax_office, p.efin, p.efin2, p.roles, p.notes]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  const isFormOpen = addOpen || !!editItem;

  return (
    <div>
      <PageHeader
        title="Master PTIN (Sheet View)"
        description="Full preparer roster in one flat table — every column from the source PTIN List spreadsheet."
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Preparer
          </Button>
        }
      />

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by PTIN, name, office, EFIN..." />

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading preparers...
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={setEditItem} emptyMessage="No preparers found." />
      )}

      <PreparerEditDialog
        open={isFormOpen}
        editItem={editItem}
        onOpenChange={(open) => { if (!open) { setEditItem(null); setAddOpen(false); } }}
        onSaved={loadPreparers}
      />
    </div>
  );
}
