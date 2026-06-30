import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { DetailDrawer } from '@/components/payroll/DetailDrawer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Copy, Mail, UserCheck, Loader2, Pencil, Save, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { toast } from 'sonner';
import { fuzzySimilarity } from '@/services/fuzzyMatch';
import * as XLSX from 'xlsx';

interface ClientRow {
  id: string;
  rowNum: number;
  locationName: string;
  groupName: string;
  ssnEin: string;
  clientName: string;
  createdDate: string;
  formType: string;
  filingStatus: string;
  efiledDate: string;
  acceptedDate: string;
  fundingDate: string;
  submissionId: string;
  refund: string;
  preparedBy: string;
  email: string;
  duplicateMarker: boolean;
  clientBelongsTo: string;
  dateIngested: string;
}

function formatDate(value: string): string {
  if (!value || value === 'undefined' || value === 'null') return '';

  const raw = String(value).trim();
  const numericValue = Number(raw);

  if (!Number.isNaN(numericValue) && /^\d+(\.\d+)?$/.test(raw)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const wholeDays = Math.floor(numericValue);
    const date = new Date(excelEpoch + wholeDays * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  const usDateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usDateMatch) {
    let [, month, day, year] = usDateMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(Date.UTC(Number(fullYear), Number(month) - 1, Number(day)));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

const BELONGS_TO_OPTIONS = ['', 'Preparer', 'Office'] as const;

export default function Clients() {
  const { selectedWeek } = useActiveWeek();
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClientRow>>({});
  const [dupModal, setDupModal] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [locationFilter, setLocationFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBelongsToUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

      let matched = 0;
      let unmatched = 0;
      const upserts: { ssn_ein: string; client_name: string; client_belongs_to: string; email: string }[] = [];

      for (const row of rows) {
        const answer = String(row['Answer'] || '').trim();
        if (!answer) continue;
        const rawSsn = String(row['SSN'] || '').replace(/\D/g, '');
        const last4 = rawSsn.slice(-4);
        if (!last4 || last4.length < 4) { unmatched++; continue; }
        const rawName = String(row['Name'] || '').trim();

        // Find matching client by SSN last 4 + fuzzy name
        const match = clients.find(c => {
          const clientLast4 = c.ssnEin.replace(/\D/g, '').slice(-4);
          if (clientLast4 !== last4) return false;
          if (!rawName) return true;
          return fuzzySimilarity(rawName, c.clientName) >= 0.85;
        });

        if (match) {
          matched++;
          upserts.push({
            ssn_ein: match.ssnEin,
            client_name: match.clientName,
            client_belongs_to: answer,
            email: match.email || '',
          });
        } else {
          unmatched++;
        }
      }

      // Batch upsert to client_overrides
      if (upserts.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < upserts.length; i += batchSize) {
          const batch = upserts.slice(i, i + batchSize);
          const { error } = await supabase.from('client_overrides').upsert(batch, { onConflict: 'ssn_ein,client_name' });
          if (error) throw error;
        }
        // Update local state
        setClients(prev => {
          const updated = [...prev];
          for (const u of upserts) {
            const idx = updated.findIndex(c => c.ssnEin === u.ssn_ein && c.clientName === u.client_name);
            if (idx >= 0) updated[idx] = { ...updated[idx], clientBelongsTo: u.client_belongs_to };
          }
          return updated;
        });
      }

      toast.success(`Upload complete: ${matched} matched, ${unmatched} unmatched`);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [clients]);

  const loadClients = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    try {
      // Load ALL Client Data Report uploads for the selected week
      const { data: dataUploads } = await supabase
        .from('uploads')
        .select('id, uploaded_date')
        .eq('type', 'Client Data Report')
        .eq('week_label', selectedWeek)
        .order('created_at', { ascending: false });

      if (!dataUploads || dataUploads.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const dataUploadIds = dataUploads.map(u => u.id);
      const uploadDateMap = new Map(dataUploads.map(u => [u.id, u.uploaded_date]));

      // Load ALL Client Email Report uploads for the selected week
      const { data: emailUploads } = await supabase
        .from('uploads')
        .select('id')
        .eq('type', 'Client Email Report')
        .eq('week_label', selectedWeek)
        .order('created_at', { ascending: false });

      const batchSize = 1000;
      // Load Client Data rows from ALL uploads
      let allDataRows: any[] = [];
      for (const uploadId of dataUploadIds) {
        let offset = 0;
        while (true) {
          const { data: batch } = await supabase
            .from('upload_rows')
            .select('row_data, upload_id')
            .eq('upload_id', uploadId)
            .order('row_index', { ascending: true })
            .range(offset, offset + batchSize - 1);
          if (!batch || batch.length === 0) break;
          allDataRows = allDataRows.concat(batch);
          if (batch.length < batchSize) break;
          offset += batchSize;
        }
      }

      const emailBySsn = new Map<string, string>();
      const emailByName = new Map<string, string>();

      if (emailUploads && emailUploads.length > 0) {
        const emailUploadIds = emailUploads.map(u => u.id);
        for (const uploadId of emailUploadIds) {
          let emailOffset = 0;
          while (true) {
            const { data: batch } = await supabase
              .from('upload_rows')
              .select('row_data')
              .eq('upload_id', uploadId)
              .order('row_index', { ascending: true })
              .range(emailOffset, emailOffset + batchSize - 1);
            if (!batch || batch.length === 0) break;
            for (const row of batch) {
              const d = row.row_data as Record<string, any>;
              const email = String(d['Email'] || '').trim();
              if (!email) continue;
              const ssn = normalize(String(d['SSN/EIN'] || ''));
              if (ssn) emailBySsn.set(ssn, email);
              const lastName = normalize(String(d['Last Name'] || ''));
              const firstName = normalize(String(d['First Name'] || ''));
              if (lastName && firstName) {
                emailByName.set(`${lastName} ${firstName}`, email);
              }
            }
            if (batch.length < batchSize) break;
            emailOffset += batchSize;
          }
        }
      }

      // Deduplicate across weekly uploads by SSN/EIN + Client Name
      const seen = new Set<string>();
      const ssnSeen = new Map<string, number>();
      const mapped: ClientRow[] = [];
      let rowNum = 0;

      for (let i = 0; i < allDataRows.length; i++) {
        const d = allDataRows[i].row_data as Record<string, any>;
        const ssnEin = String(d['SSN/EIN'] || '').trim();
        const clientName = String(d['Client Name'] || '').trim();
        if (!ssnEin && !clientName) continue;

        // Dedup key: normalized SSN/EIN + Client Name
        const dedupKey = `${normalize(ssnEin)}||${normalize(clientName)}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        rowNum++;
        const normSsn = normalize(ssnEin);
        const count = ssnSeen.get(normSsn) || 0;
        ssnSeen.set(normSsn, count + 1);

        let email = '';
        if (normSsn) email = emailBySsn.get(normSsn) || '';
        if (!email && clientName) {
          const nameParts = clientName.split(',').map(p => p.trim().toUpperCase());
          if (nameParts.length >= 2) {
            email = emailByName.get(`${nameParts[0]} ${nameParts[1]}`) || '';
          }
        }

        const uploadDate = uploadDateMap.get(allDataRows[i].upload_id) || '';
        mapped.push({
          id: `${i}`,
          rowNum,
          locationName: String(d['Location Name'] || '').trim(),
          groupName: String(d['Group Name'] || '').trim(),
          ssnEin,
          clientName,
          createdDate: formatDate(String(d['Created Date'] || '')),
          formType: String(d['Form Type'] || ''),
          filingStatus: String(d['Filing Status'] || ''),
          efiledDate: formatDate(String(d['E-filed Date'] || '')),
          acceptedDate: formatDate(String(d['Accepted Date'] || '')),
          fundingDate: formatDate(String(d['Funding Date'] || d['Funded Date'] || '')),
          submissionId: String(d['Submission ID'] || ''),
          refund: String(d['Refund'] || ''),
          preparedBy: String(d['Prepared By'] || '').trim(),
          email,
          duplicateMarker: false,
          clientBelongsTo: '',
          dateIngested: uploadDate ? formatDate(uploadDate) : '',
        });
      }

      for (const row of mapped) {
        const normSsn = normalize(row.ssnEin);
        if (normSsn && (ssnSeen.get(normSsn) || 0) > 1) {
          row.duplicateMarker = true;
        }
      }

      // Load persisted overrides from client_overrides table
      const { data: overrides } = await supabase
        .from('client_overrides')
        .select('ssn_ein, client_name, client_belongs_to, email');
      if (overrides) {
        const overrideMap = new Map(overrides.map(o => [`${normalize(o.ssn_ein)}||${normalize(o.client_name)}`, o]));
        for (const row of mapped) {
          const key = `${normalize(row.ssnEin)}||${normalize(row.clientName)}`;
          const ov = overrideMap.get(key);
          if (ov) {
            if (ov.client_belongs_to) row.clientBelongsTo = ov.client_belongs_to;
            if (ov.email) row.email = ov.email;
            if ((ov as any).location_name) row.locationName = (ov as any).location_name;
          }
        }
      }

      setClients(mapped);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const locationOptions = useMemo(() => {
    const locs = new Set(clients.map(c => c.locationName).filter(Boolean));
    return Array.from(locs).sort();
  }, [clients]);

  const kpis = useMemo(() => [
    { title: 'Total Clients', value: clients.length, icon: Users },
    { title: 'Duplicate Clients', value: clients.filter(c => c.duplicateMarker).length, icon: Copy },
    { title: 'Missing Emails', value: clients.filter(c => !c.email).length, icon: Mail },
    { title: 'Emails Enriched', value: clients.filter(c => !!c.email).length, icon: UserCheck },
  ], [clients]);

  const tabs = ['All', 'Duplicates', 'Missing Emails', 'Has Email'];

  const filtered = useMemo(() => {
    const result = clients.filter(c => {
      if (tab === 'Duplicates' && !c.duplicateMarker) return false;
      if (tab === 'Missing Emails' && c.email) return false;
      if (tab === 'Has Email' && !c.email) return false;
      if (locationFilter && locationFilter !== '__all__' && c.locationName !== locationFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return c.clientName.toLowerCase().includes(s) || c.locationName.toLowerCase().includes(s) || c.ssnEin.includes(s);
      }
      return true;
    });
    result.sort((a, b) => {
      const loc = a.locationName.localeCompare(b.locationName);
      if (loc !== 0) return loc;
      const name = a.clientName.localeCompare(b.clientName);
      if (name !== 0) return name;
      return a.dateIngested.localeCompare(b.dateIngested);
    });
    return result;
  }, [clients, tab, search, locationFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageNum = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePageNum - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageNum, pageSize]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [tab, search, pageSize, locationFilter]);

  const columns: Column<ClientRow>[] = [
    { key: 'rowNum', header: '#', mono: true, className: 'w-12' },
    { key: 'ssnEin', header: 'SSN/EIN', mono: true },
    { key: 'clientName', header: 'Client Name' },
    { key: 'locationName', header: 'Location' },
    { key: 'fundingDate', header: 'Funding Date', render: (r) => r.fundingDate || <span className="text-muted-foreground">—</span> },
    { key: 'clientBelongsTo', header: 'Client Belongs To', render: (r) => r.clientBelongsTo || <span className="text-muted-foreground">—</span> },
    { key: 'preparedBy', header: 'Prepared By' },
    { key: 'dateIngested', header: 'Date Ingested', sortable: true },
  ];

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, ClientRow[]>();
    for (const c of clients) {
      if (!c.duplicateMarker) continue;
      const key = normalize(c.ssnEin);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return Array.from(groups.values()).slice(0, 10);
  }, [clients]);

  return (
    <div>
      <PageHeader title="Clients" description="Client records, duplicate review, and email enrichment" actions={
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBelongsToUpload} />
          <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Client Belongs To List
          </Button>
          <Button variant="outline" onClick={() => setDupModal(true)} className="gap-2"><Copy className="h-4 w-4" /> Review Duplicates</Button>
        </div>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{kpis.map(k => <KpiCard key={k.title} {...k} />)}</div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-surface-ash">{tabs.map(t => <TabsTrigger key={t} value={t} className="text-xs">{t}</TabsTrigger>)}</TabsList>
        <div className="flex items-center gap-3 mb-4">
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search clients by name, location, or SSN..." />
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Locations</SelectItem>
              {locationOptions.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading clients...
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={paged} onRowClick={setSelected} emptyMessage="No client data found. Upload a Client Data Report first." />
            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Showing {((safePageNum - 1) * pageSize) + 1}–{Math.min(safePageNum * pageSize, filtered.length)} of {filtered.length}</span>
                <span className="mx-2">|</span>
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={safePageNum <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-muted-foreground">Page {safePageNum} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={safePageNum >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Tabs>
      <DetailDrawer open={!!selected} onClose={() => { setSelected(null); setEditing(false); }} title="Client Details">
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {!editing ? (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditing(true); setEditForm({ clientBelongsTo: selected.clientBelongsTo, email: selected.email, locationName: selected.locationName }); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : (
                <Button size="sm" className="gap-2" onClick={async () => {
                  // Persist to client_overrides table
                  try {
                    const { error } = await supabase.from('client_overrides').upsert({
                      ssn_ein: selected.ssnEin,
                      client_name: selected.clientName,
                      client_belongs_to: editForm.clientBelongsTo || '',
                      email: editForm.email || '',
                      location_name: editForm.locationName || '',
                    }, { onConflict: 'ssn_ein,client_name' });
                    if (error) throw error;
                    setClients(prev => prev.map(c => c.id === selected.id ? { ...c, ...editForm } : c));
                    setSelected(s => s ? { ...s, ...editForm } : s);
                    setEditing(false);
                    toast.success('Client updated');
                  } catch (err) {
                    console.error('Failed to save override:', err);
                    toast.error('Failed to save changes');
                  }
                }}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              )}
            </div>
            <div className="bg-surface-ash rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">{selected.clientName}</p>
              <p className="text-muted-foreground font-mono">SSN/EIN: {selected.ssnEin}</p>
              <p><span className="text-muted-foreground">Location:</span> {selected.locationName}</p>
              <p><span className="text-muted-foreground">Group:</span> {selected.groupName}</p>
              <p><span className="text-muted-foreground">Form Type:</span> {selected.formType}</p>
              <p><span className="text-muted-foreground">Filing Status:</span> {selected.filingStatus}</p>
              <p><span className="text-muted-foreground">Created Date:</span> {selected.createdDate}</p>
              <p><span className="text-muted-foreground">E-filed Date:</span> {selected.efiledDate}</p>
              <p><span className="text-muted-foreground">Accepted Date:</span> {selected.acceptedDate}</p>
              <p><span className="text-muted-foreground">Funding Date:</span> {selected.fundingDate || <span className="text-muted-foreground">—</span>}</p>
              <p><span className="text-muted-foreground">Submission ID:</span> <span className="font-mono text-xs">{selected.submissionId}</span></p>
              <p><span className="text-muted-foreground">Refund:</span> <span className="font-mono">{selected.refund}</span></p>
              <p><span className="text-muted-foreground">Prepared By:</span> {selected.preparedBy}</p>
            </div>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Select value={editForm.locationName || '__none__'} onValueChange={(v) => setEditForm(f => ({ ...f, locationName: v === '__none__' ? '' : v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select location..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {locationOptions.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Client Belongs To</Label>
                  <Select value={editForm.clientBelongsTo || ''} onValueChange={(v) => setEditForm(f => ({ ...f, clientBelongsTo: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {BELONGS_TO_OPTIONS.map(opt => (
                        <SelectItem key={opt || '_none'} value={opt || ' '}>{opt || '— None —'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter email..." />
                </div>
              </div>
            ) : (
              <div className="bg-surface-ash rounded-lg p-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Client Belongs To:</span> {selected.clientBelongsTo || <span className="text-muted-foreground">—</span>}</p>
                <p><span className="text-muted-foreground">Email:</span> {selected.email || <span className="text-status-warning">Missing</span>}</p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
      <Dialog open={dupModal} onOpenChange={setDupModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Duplicate Review ({duplicateGroups.length} groups)</DialogTitle></DialogHeader>
          {duplicateGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No duplicates detected.</p>
          ) : (
            <div className="space-y-6">
              {duplicateGroups.map((group, gi) => (
                <div key={gi}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">SSN/EIN: {group[0].ssnEin}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {group.map(c => (
                      <div key={c.id} className="bg-surface-ash rounded-lg p-3 space-y-1 text-sm">
                        <p className="font-medium">{c.clientName}</p>
                        <p><span className="text-muted-foreground">Location:</span> {c.locationName}</p>
                        <p><span className="text-muted-foreground">Prepared By:</span> {c.preparedBy}</p>
                        <p><span className="text-muted-foreground">Email:</span> {c.email || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDupModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
