import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { Building2, Plus, Save, Loader2, Upload, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LookupManagement from './LookupManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { logAudit } from '@/services/auditLog';
import { getActiveAccountId } from '@/contexts/AccountContext';
import { Progress } from '@/components/ui/progress';
import { parseFile } from '@/services/fileParser';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Office {
  id: string;
  office_name: string;
  primary_efin: string;
  secondary_efin: string;
  extra_efins: string[];
  share_percent: number;
  process_advance: boolean;
  process_frontend: boolean;
  process_backend: boolean;
  process_preparers_share: boolean;
  parent_office: string;
  clients_belongs_data: string;
  notes: string;
  active: boolean;
  default_preparers_share: string;
}

const FIELD_LABELS: { key: keyof Office; label: string; type?: 'number' | 'boolean' | 'select' }[] = [
  { key: 'office_name', label: 'Office Name' },
  { key: 'primary_efin', label: 'Primary EFIN' },
  { key: 'secondary_efin', label: 'Secondary EFIN' },
  { key: 'share_percent', label: 'Share %', type: 'number' },
  { key: 'process_advance', label: 'Process Advance', type: 'boolean' },
  { key: 'process_frontend', label: 'Process Front End', type: 'boolean' },
  { key: 'process_backend', label: 'Process Backend', type: 'boolean' },
  { key: 'process_preparers_share', label: 'Process Preparers Share', type: 'boolean' },
  { key: 'parent_office', label: 'Parent Office', type: 'select' },
  { key: 'clients_belongs_data', label: 'Clients Belongs Data', type: 'boolean' },
];

const getColumns = (onDelete: (o: Office, e: React.MouseEvent) => void): Column<Office>[] => [
  { key: 'office_name', header: 'Office' },
  { key: 'primary_efin', header: 'Primary EFIN', mono: true },
  { key: 'secondary_efin', header: 'Secondary EFIN', mono: true },
  { key: 'share_percent', header: 'Share %', mono: true, render: (r) => `${r.share_percent}%` },
  { key: 'process_advance', header: 'Process Advance', render: (r) => r.process_advance ? 'Yes' : 'No' },
  { key: 'process_frontend', header: 'Process Front End', render: (r) => r.process_frontend ? 'Yes' : 'No' },
  { key: 'process_backend', header: 'Process Backend', render: (r) => r.process_backend ? 'Yes' : 'No' },
  { key: 'process_preparers_share', header: 'Process Preparers Share', render: (r) => r.process_preparers_share ? 'Yes' : 'No' },
  { key: 'parent_office', header: 'Parent Office' },
  { key: 'clients_belongs_data', header: 'Clients Belongs Data', render: (r) => r.clients_belongs_data === 'true' || (r.clients_belongs_data as any) === true ? 'Yes' : 'No' },
  { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'Active' : 'Inactive'} /> },
  { key: 'id' as keyof Office, header: '', render: (r) => (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => onDelete(r, e)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  )},
];

const emptyOffice: Omit<Office, 'id'> = {
  office_name: '', primary_efin: '', secondary_efin: '', extra_efins: [], share_percent: 0,
  process_advance: false, process_frontend: false, process_backend: false, process_preparers_share: false,
  parent_office: '', clients_belongs_data: '', notes: '', active: true, default_preparers_share: '',
};

export default function Offices() {
  const [search, setSearch] = useState('');
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Office | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<Office, 'id'>>(emptyOffice);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Office | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadOffices = useCallback(async () => {
    const acct = getActiveAccountId();
    let q = supabase.from('offices').select('*');
    if (acct) q = q.eq('account_id', acct);
    const { data, error } = await q.order('parent_office').order('office_name');
    if (error) { console.error(error); return; }
    setOffices((data || []) as Office[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadOffices(); }, [loadOffices]);

  const filtered = offices.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.office_name.toLowerCase().includes(s) || o.primary_efin.includes(s) || o.secondary_efin.includes(s);
  });

  const kpis = [
    { title: 'Total Offices', value: offices.length, icon: Building2 },
    { title: 'Active', value: offices.filter(o => o.active).length, icon: Building2 },
  ];

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    try {
      const parsed = await parseFile(file);
      if (parsed.errors.length > 0) { toast.error(parsed.errors[0]); setUploading(false); return; }
      setUploadProgress(30);

      const headerMap: Record<string, string> = {};
      parsed.headers.forEach(h => {
        const norm = h.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
        if (norm.includes('OFFICE') && !norm.includes('FLAT')) headerMap['office_name'] = h;
        else if (norm.includes('PRIMARY') || (norm === 'EFIN' && !headerMap['primary_efin'])) headerMap['primary_efin'] = h;
        else if (norm.includes('SECONDARY') || norm === 'EFIN2') headerMap['secondary_efin'] = h;
        else if (norm.includes('SHARE')) headerMap['share_percent'] = h;
        else if (norm.includes('ADVANCE')) headerMap['process_advance'] = h;
        else if (norm.includes('CLIENT') || norm.includes('BELONGS')) headerMap['clients_belongs_data'] = h;
        else if (norm === 'NOTES') headerMap['notes'] = h;
      });

      if (!headerMap['office_name']) {
        toast.error('Missing required column: Office Name');
        setUploading(false);
        return;
      }

      const parseNum = (v: any): number => {
        if (v === undefined || v === null || v === '') return 0;
        const s = String(v).replace(/[%$,]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };

      const rows = parsed.rows.map(row => ({
        office_name: String(row[headerMap['office_name']] ?? '').trim(),
        primary_efin: String(row[headerMap['primary_efin']] ?? '').trim(),
        secondary_efin: String(row[headerMap['secondary_efin']] ?? '').trim(),
        share_percent: parseNum(row[headerMap['share_percent']]),
        process_advance: String(row[headerMap['process_advance']] ?? '').toLowerCase() === 'yes' || String(row[headerMap['process_advance']] ?? '').toLowerCase() === 'true',
        clients_belongs_data: String(row[headerMap['clients_belongs_data']] ?? '').trim(),
        notes: String(row[headerMap['notes']] ?? '').trim(),
        active: true,
      })).filter(r => r.office_name);

      const batchSize = 500;
      const acct = getActiveAccountId();
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({ ...r, ...(acct ? { account_id: acct } : {}) }));
        const { error } = await supabase.from('offices').insert(batch);
        if (error) { toast.error(`Insert error: ${error.message}`); setUploading(false); return; }
        setUploadProgress(30 + ((i + batchSize) / rows.length) * 65);
      }

      toast.success(`${rows.length} offices imported successfully`);
      await logAudit({ action: 'create', entityType: 'office', summary: `Imported ${rows.length} offices via upload.` });
      setUploading(false);
      setUploadProgress(100);
      loadOffices();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.office_name) { toast.error('Office Name is required'); return; }
    setSaving(true);
    try {
      // Convert clients_belongs_data to string for DB text column
      const payload = {
        ...formData,
        clients_belongs_data: String(formData.clients_belongs_data ?? ''),
        updated_at: new Date().toISOString(),
      };
      if (editItem) {
        const { id: _ignoreId, ...updateData } = payload as any;
        const { error } = await supabase.from('offices').update(updateData).eq('id', editItem.id);
        if (error) throw error;
        toast.success('Office updated');
        await logAudit({ action: 'update', entityType: 'office', entityId: editItem.id, entityLabel: editItem.office_name, summary: `Updated office "${editItem.office_name}".` });
      } else {
        const acct = getActiveAccountId();
        const { data: ins, error } = await supabase.from('offices').insert({ ...formData, ...(acct ? { account_id: acct } : {}) } as any).select().single();
        if (error) throw error;
        toast.success('Office added');
        await logAudit({ action: 'create', entityType: 'office', entityId: (ins as any)?.id, entityLabel: formData.office_name, summary: `Created office "${formData.office_name}".` });
      }
      setEditItem(null);
      setAddOpen(false);
      setFormData(emptyOffice);
      loadOffices();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (o: Office) => {
    // Normalize clients_belongs_data from string to boolean-like for the Switch
    const normalized = { ...o, clients_belongs_data: o.clients_belongs_data === 'true' || (o.clients_belongs_data as any) === true ? 'true' : '' };
    setFormData(normalized);
    setEditItem(o);
  };
  const openAdd = () => { setFormData(emptyOffice); setEditItem(null); setAddOpen(true); };
  const isFormOpen = addOpen || !!editItem;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('offices').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`"${deleteTarget.office_name}" deleted`);
      await logAudit({ action: 'delete', entityType: 'office', entityId: deleteTarget.id, entityLabel: deleteTarget.office_name, summary: `Deleted office "${deleteTarget.office_name}".` });
      setDeleteTarget(null);
      loadOffices();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const onDeleteClick = (o: Office, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(o);
  };

  const columns = getColumns(onDeleteClick);

  return (
    <div>
      <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      <PageHeader title="Master PTIN (Office)" description="Manage office profiles and backend fee configurations" actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload Offices
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Office
          </Button>
        </div>
      } />

      <Tabs defaultValue="offices" className="mt-2">
        <TabsList className="mb-4">
          <TabsTrigger value="offices">Offices</TabsTrigger>
          <TabsTrigger value="backend-fees">Backend Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="offices">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {kpis.map(k => <KpiCard key={k.title} {...k} />)}
          </div>

          {uploading && (
            <div className="mb-4 p-4 bg-card rounded-xl border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Importing offices...</div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by office name, EFIN..." />

          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading offices...
            </div>
          ) : (
            <DataTable columns={columns} data={filtered} onRowClick={openEdit} />
          )}
        </TabsContent>

        <TabsContent value="backend-fees">
          <LookupManagement embedded />
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setEditItem(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Office' : 'Add New Office'}</DialogTitle>
            <DialogDescription>{editItem ? `Editing ${editItem.office_name}` : 'Fill in office details'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {FIELD_LABELS.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">{f.label}{f.key === 'office_name' && ' *'}</label>
                {f.type === 'boolean' ? (
                  <div className="mt-2">
                    <Switch
                      checked={f.key === 'clients_belongs_data' ? formData[f.key] === 'true' : !!formData[f.key as keyof typeof formData]}
                      onCheckedChange={checked => setFormData(prev => ({ ...prev, [f.key]: f.key === 'clients_belongs_data' ? (checked ? 'true' : '') : checked }))}
                    />
                  </div>
                ) : f.type === 'select' ? (
                  <Select
                    value={String(formData[f.key as keyof typeof formData] ?? '') || '__none__'}
                    onValueChange={val => setFormData(prev => ({ ...prev, [f.key]: val === '__none__' ? '' : val }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select office..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {offices.map(o => (
                        <SelectItem key={o.id} value={o.office_name}>{o.office_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type || 'text'}
                    value={String(formData[f.key as keyof typeof formData] ?? '')}
                    onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="mt-1 font-mono text-sm"
                  />
                )}
              </div>
            ))}
            {formData.process_preparers_share && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Default Preparers Share</label>
                <RadioGroup
                  value={formData.default_preparers_share || 'preparer_client_percent'}
                  onValueChange={val => setFormData(prev => ({ ...prev, default_preparers_share: val }))}
                  className="flex gap-6 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="preparer_client_percent" id="dps_pcp" />
                    <Label htmlFor="dps_pcp">Preparer Client %</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="office_flat_rate" id="dps_ofr" />
                    <Label htmlFor="dps_ofr">Office Flat Rate</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Extra EFINs (comma-separated)</label>
              <Input
                value={(formData.extra_efins || []).join(', ')}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  extra_efins: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                }))}
                className="mt-1 font-mono text-sm"
                placeholder="e.g. 387641, 390000"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Additional EFINs included in this office's Source Rows and tile totals.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button variant="outline" onClick={() => { setEditItem(null); setAddOpen(false); }}>Cancel</Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? 'Save Changes' : 'Add Office'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete office?"
        entityName={deleteTarget?.office_name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
