import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { UserCheck, DollarSign, Users, Upload, Plus, Save, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight, FileBarChart, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import { formatMoney } from '@/lib/utils';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { generatePreparerWeeklyReports } from '@/services/preparerReportGenerator';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { logAudit, diffSummary } from '@/services/auditLog';
import { getActiveAccountId } from '@/contexts/AccountContext';

interface Preparer {
  id: string;
  ptin: string;
  contractor: string;
  main_office: string;
  tax_office: string;
  efin: string;
  efin2: string;
  share_percent: number;
  shared_efin_percent: number;
  roles: string;
  preparer_client_percent: number;
  office_flat_rate: number;
  landing_tab: string;
  availed_payroll: number;
  notes: string;
  active: boolean;
}

const FIELD_LABELS: { key: keyof Preparer; label: string; type?: 'number' }[] = [
  { key: 'ptin', label: 'PTIN' },
  { key: 'contractor', label: 'Contractor Name' },
  { key: 'tax_office', label: 'Office' },
  { key: 'roles', label: 'Roles' },
  { key: 'preparer_client_percent', label: 'Preparer Client %', type: 'number' },
  { key: 'office_flat_rate', label: 'Office Flat Rate', type: 'number' },
];

// All fields editable via the Add/Edit dialog — used to build a field-level
// change summary for the audit log (which field changed, old → new value).
const PREPARER_AUDIT_FIELDS: { key: keyof Preparer; label: string }[] = [
  ...FIELD_LABELS,
  { key: 'notes', label: 'Notes' },
];

const getColumns = (startIndex: number): Column<Preparer>[] => [
  { key: 'id', header: '#', render: (_r, index) => `${startIndex + (index ?? 0) + 1}` },
  { key: 'ptin', header: 'PTIN', mono: true },
  { key: 'contractor', header: 'Contractor' },
  { key: 'tax_office', header: 'Office' },
  { key: 'preparer_client_percent', header: 'Preparer Client %', mono: true, render: (r) => `${r.preparer_client_percent}%` },
  { key: 'office_flat_rate', header: 'Office Flat Rate', mono: true, render: (r) => formatMoney(r.office_flat_rate, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) },
  { key: 'roles', header: 'Roles' },
  { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'Active' : 'Inactive'} /> },
];

const emptyPreparer: Omit<Preparer, 'id'> = {
  ptin: '', contractor: '', main_office: '', tax_office: '', efin: '', efin2: '',
  share_percent: 0, shared_efin_percent: 0, roles: '', preparer_client_percent: 0,
  office_flat_rate: 0, landing_tab: '', availed_payroll: 0, notes: '', active: true,
};

export default function Preparers() {
  const { selectedWeek } = useActiveWeek();
  const [searchParams, setSearchParams] = useSearchParams();
  const vfilter = searchParams.get('vfilter') ?? '';
  const vptins = (searchParams.get('ptins') ?? '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

  const [generatingReports, setGeneratingReports] = useState(false);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState<string[]>([]);
  const [preparers, setPreparers] = useState<Preparer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Preparer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<Preparer, 'id'>>(emptyPreparer);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPreparers = useCallback(async () => {
    const acct = getActiveAccountId();
    let all: Preparer[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      let q = supabase.from('preparers').select('*');
      if (acct) q = q.eq('account_id', acct);
      const { data, error } = await q.order('tax_office').order('contractor').range(from, from + pageSize - 1);
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

  // Auto-run weekly report generator when the selected week has no preparer earnings rows yet.
  const autoGenAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedWeek) return;
    if (autoGenAttempted.current.has(selectedWeek)) return;
    if (generatingReports) return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('preparer_payroll_weeks')
        .select('id', { count: 'exact', head: true })
        .eq('week_label', selectedWeek);
      if (cancelled || error) return;
      if ((count ?? 0) > 0) return;
      autoGenAttempted.current.add(selectedWeek);
      setGeneratingReports(true);
      try {
        const result = await generatePreparerWeeklyReports(selectedWeek);
        if (result.preparersUpdated > 0) {
          toast.success(`Auto-generated ${result.preparersUpdated} preparer report(s) for "${selectedWeek}".`);
        }
      } catch (err: any) {
        console.error('Auto-generation failed', err);
      } finally {
        if (!cancelled) setGeneratingReports(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWeek, generatingReports]);

  const handleGenerateReports = async () => {
    if (!selectedWeek) {
      toast.error('Select a payroll week first');
      return;
    }
    if (!confirm(`Regenerate preparer earnings reports for "${selectedWeek}"? This will overwrite any existing report rows for this week.`)) return;
    setGeneratingReports(true);
    try {
      const result = await generatePreparerWeeklyReports(selectedWeek);
      if (result.preparersUpdated === 0) {
        toast.warning(`No payroll rows found for "${selectedWeek}". Upload a Payroll Report first.`);
      } else {
        toast.success(`Updated ${result.preparersUpdated} preparer report(s) from ${result.rowsProcessed} payroll row(s) for "${selectedWeek}".`);
      }
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message || err}`);
    } finally {
      setGeneratingReports(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const acct = getActiveAccountId();
      let dq = supabase.from('preparers').delete();
      if (acct) dq = dq.eq('account_id', acct);
      else dq = dq.neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await dq;
      if (error) throw error;
      toast.success('All preparers deleted');
      await logAudit({ action: 'delete', entityType: 'preparer', summary: 'Deleted all preparers in current account.' });
      setPreparers([]);
      setDeleteConfirmOpen(false);
      setPage(1);
      setOfficeFilter([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const officeOptions = Array.from(new Set(preparers.map((p) => p.tax_office).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map((office) => ({ value: office, label: office }));

  const filtered = preparers.filter(p => {
    const searchMatch = !search || [p.contractor, p.ptin, p.tax_office, p.efin].some(v => String(v || '').toLowerCase().includes(search.toLowerCase()));
    const officeMatch = officeFilter.length === 0 || officeFilter.includes(p.tax_office);
    let vMatch = true;
    if (vfilter === 'zero_share') vMatch = p.share_percent === 0 && p.active;
    else if (vfilter === 'no_office') vMatch = !p.tax_office && p.active;
    else if (vfilter === 'ptin_not_found') vMatch = vptins.length > 0 && vptins.includes((p.ptin ?? '').toUpperCase());
    return searchMatch && officeMatch && vMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const pageStartIndex = (currentPage - 1) * rowsPerPage;

  const kpis = [
    { title: 'Total Preparers', value: preparers.length, icon: Users },
    { title: 'Active', value: preparers.filter(p => p.active).length, icon: UserCheck },
    { title: 'Unique Offices', value: new Set(preparers.map(p => p.tax_office)).size, icon: Users },
    { title: 'Availed Payroll', value: formatMoney(preparers.reduce((s, p) => s + Number(p.availed_payroll || 0), 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: DollarSign },
  ];

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let headers: string[] = [];
      let parsedRows: Record<string, string | number>[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        headers = (lines[0] || '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        parsedRows = lines.slice(1).map((line) => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
          return row;
        });
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Fix !ref to cover all actual cells
        const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (const key of Object.keys(ws)) {
          if (key[0] === '!') continue;
          const cell = XLSX.utils.decode_cell(key);
          if (cell.r > ref.e.r) ref.e.r = cell.r;
          if (cell.c > ref.e.c) ref.e.c = cell.c;
        }
        ws['!ref'] = XLSX.utils.encode_range(ref);
        // Use default mode: first row = headers, returns objects keyed by header
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: true });
        if (jsonRows.length > 0) {
          headers = Object.keys(jsonRows[0]);
          parsedRows = jsonRows;
        }
      }

      setUploadProgress(25);

      const headerMap: Record<string, string> = {};
      headers.forEach(h => {
        const norm = h.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
        if (!headerMap.ptin && norm.includes('PTIN')) headerMap.ptin = h;
        if (!headerMap.contractor && norm === 'CONTRACTOR') headerMap.contractor = h;
        if (!headerMap.tax_office && (norm === 'TAX_OFFICE' || norm === 'OFFICE')) headerMap.tax_office = h;
        if (!headerMap.main_office && norm === 'MAIN_OFFICE') headerMap.main_office = h;
        if (!headerMap.efin2 && norm === 'EFIN2') headerMap.efin2 = h;
        if (!headerMap.efin && norm === 'EFIN') headerMap.efin = h;
        if (!headerMap.roles && norm === 'ROLES') headerMap.roles = h;
        if (!headerMap.preparer_client_percent && (norm.includes('PREPARER_CLIENT') || norm.includes('CLIENT_PERCENT'))) headerMap.preparer_client_percent = h;
        if (!headerMap.office_flat_rate && (norm.includes('OFFICE_FLAT') || norm.includes('FLAT_RATE'))) headerMap.office_flat_rate = h;
        if (!headerMap.share_percent && (norm === 'SHARE' || (norm.includes('SHARE_') && !norm.includes('SHARED')))) headerMap.share_percent = h;
        if (!headerMap.shared_efin_percent && norm.includes('SHARED_EFIN')) headerMap.shared_efin_percent = h;
        if (!headerMap.landing_tab && norm.includes('LANDING')) headerMap.landing_tab = h;
        if (!headerMap.availed_payroll && norm.includes('AVAILED')) headerMap.availed_payroll = h;
        if (!headerMap.notes && norm === 'NOTES') headerMap.notes = h;
      });

      if (!headerMap.ptin || !headerMap.contractor) {
        toast.error('Missing required columns: PTIN and CONTRACTOR');
        setUploading(false);
        return;
      }

      const parseNum = (v: any): number => {
        if (v === undefined || v === null || v === '') return 0;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[%$,]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };

      const parsePercent = (v: any): number => {
        if (v === undefined || v === null || v === '') return 0;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[%$,]/g, ''));
        if (!Number.isFinite(n)) return 0;
        return n > 0 && n <= 1 ? Math.round(n * 10000) / 100 : n;
      };

      const rows = parsedRows
        .map((row) => ({
          ptin: String(row[headerMap.ptin] ?? '').trim(),
          contractor: String(row[headerMap.contractor] ?? '').trim(),
          main_office: headerMap.main_office ? String(row[headerMap.main_office] ?? '').trim() : '',
          tax_office: headerMap.tax_office ? String(row[headerMap.tax_office] ?? '').trim() : '',
          efin: headerMap.efin ? String(row[headerMap.efin] ?? '').trim() : '',
          efin2: headerMap.efin2 ? String(row[headerMap.efin2] ?? '').trim() : '',
          share_percent: headerMap.share_percent ? parsePercent(row[headerMap.share_percent]) : 0,
          shared_efin_percent: headerMap.shared_efin_percent ? parsePercent(row[headerMap.shared_efin_percent]) : 0,
          roles: headerMap.roles ? String(row[headerMap.roles] ?? '').trim() : '',
          preparer_client_percent: headerMap.preparer_client_percent ? parsePercent(row[headerMap.preparer_client_percent]) : 0,
          office_flat_rate: headerMap.office_flat_rate ? parseNum(row[headerMap.office_flat_rate]) : 0,
          landing_tab: headerMap.landing_tab ? String(row[headerMap.landing_tab] ?? '').trim() : '',
          availed_payroll: headerMap.availed_payroll ? parseNum(row[headerMap.availed_payroll]) : 0,
          notes: headerMap.notes ? String(row[headerMap.notes] ?? '').trim() : '',
          active: true,
        }))
        .filter((r) => r.ptin || r.contractor)
        .filter((r) => r.ptin && r.contractor);

      setUploadProgress(40);

      const batchSize = 200;
      const acct = getActiveAccountId();
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({ ...r, ...(acct ? { account_id: acct } : {}) }));
        const { error } = await supabase.from('preparers').insert(batch);
        if (error) throw error;
        setUploadProgress(40 + (((i + batch.length) / rows.length) * 55));
      }

      toast.success(`${rows.length} preparers imported successfully`);
      await logAudit({ action: 'create', entityType: 'preparer', summary: `Imported ${rows.length} preparers via PTIN list upload.` });
      setUploadProgress(100);
      await loadPreparers();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // --- Save (add or edit) ---
  const handleSave = async () => {
    if (!formData.ptin || !formData.contractor) { toast.error('PTIN and Contractor are required'); return; }
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase.from('preparers').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editItem.id);
        if (error) throw error;
        toast.success('Preparer updated');
        const changes = diffSummary<Preparer>(editItem, formData, PREPARER_AUDIT_FIELDS);
        await logAudit({
          action: 'update',
          entityType: 'preparer',
          entityId: editItem.id,
          entityLabel: editItem.contractor,
          summary: changes ? `Updated preparer "${editItem.contractor}" — ${changes}` : `Updated preparer "${editItem.contractor}" (no field changes).`,
        });
      } else {
        const acct = getActiveAccountId();
        const { data: ins, error } = await supabase.from('preparers').insert({ ...formData, ...(acct ? { account_id: acct } : {}) } as any).select().single();
        if (error) throw error;
        toast.success('Preparer added');
        await logAudit({ action: 'create', entityType: 'preparer', entityId: (ins as any)?.id, entityLabel: formData.contractor, summary: `Created preparer "${formData.contractor}".` });
      }
      setEditItem(null);
      setAddOpen(false);
      setFormData(emptyPreparer);
      loadPreparers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Preparer) => {
    setFormData({ ...p });
    setEditItem(p);
  };

  const openAdd = () => {
    setFormData(emptyPreparer);
    setEditItem(null);
    setAddOpen(true);
  };

  const isFormOpen = addOpen || !!editItem;

  return (
    <div>
      <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls,.xlsb,.xlsm,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      <PageHeader title="Preparers" description={`Manage tax preparer profiles and payout rates — ${selectedWeek || 'no week selected'}`} actions={
        <div className="flex gap-2 flex-wrap">
          <Button variant="destructive" className="gap-2" onClick={() => setDeleteConfirmOpen(true)} disabled={preparers.length === 0}>
            <Trash2 className="h-4 w-4" /> Delete All
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleGenerateReports} disabled={generatingReports || !selectedWeek}>
            {generatingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
            {generatingReports ? 'Generating…' : 'Generate Reports for Week'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload PTIN List
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Preparer
          </Button>
        </div>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => <KpiCard key={k.title} {...k} />)}
      </div>

      {uploading && (
        <div className="mb-4 p-4 bg-card rounded-xl border border-border space-y-2">
          <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Importing preparers...</div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Verification filter banner */}
      {vfilter && (
        <div className="mb-4 flex items-start gap-3 p-3 rounded-lg border border-yellow-400/50 bg-yellow-50/40 dark:bg-yellow-900/15">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {vfilter === 'zero_share' && (
              <>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Filtered: Preparers with 0% share rate</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                  These {filtered.length} active preparer{filtered.length !== 1 ? 's' : ''} have share_percent = 0 and will earn $0 this payroll week. Click a row to set their share %.
                </p>
              </>
            )}
            {vfilter === 'no_office' && (
              <>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Filtered: Preparers with no office assignment</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                  These {filtered.length} active preparer{filtered.length !== 1 ? 's' : ''} have no tax office set. Their rows will be excluded from office totals. Click a row to assign an office.
                </p>
              </>
            )}
            {vfilter === 'ptin_not_found' && (
              <>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  {vptins.length} PTIN{vptins.length !== 1 ? 's' : ''} from the Payroll Report not found in Preparers
                </p>
                <p className="text-xs font-mono text-yellow-700 dark:text-yellow-300 mt-0.5 break-all">
                  {vptins.join(' · ')}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Use "Add Preparer" to register each one. Rows with these PTINs will be excluded from payroll until they are added.
                </p>
              </>
            )}
          </div>
          <button
            className="shrink-0 text-yellow-600 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
            onClick={() => setSearchParams({})}
            aria-label="Clear verification filter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by PTIN, name, office, EFIN..."
        filters={[
          {
            label: 'Office',
            multi: true,
            values: officeFilter,
            onValuesChange: (values) => { setOfficeFilter(values); setPage(1); },
            options: officeOptions,
          },
        ]}
      />

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading preparers...
        </div>
      ) : (
        <>
          <DataTable columns={getColumns(pageStartIndex)} data={paginatedData} onRowClick={openEdit} />
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200, 500].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>{filtered.length} total</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete all preparers?"
        entityName={`${preparers.length} preparers`}
        confirmLabel="Delete all"
        onConfirm={handleDeleteAll}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setEditItem(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Preparer' : 'Add New Preparer'}</DialogTitle>
            <DialogDescription>{editItem ? `Editing ${editItem.contractor}` : 'Fill in all fields to add a new preparer'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {FIELD_LABELS.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">{f.label}{(f.key === 'ptin' || f.key === 'contractor') && ' *'}</label>
                <Input
                  type={f.type || 'text'}
                  value={String(formData[f.key as keyof typeof formData] ?? '')}
                  onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button variant="outline" onClick={() => { setEditItem(null); setAddOpen(false); }}>Cancel</Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? 'Save Changes' : 'Add Preparer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
