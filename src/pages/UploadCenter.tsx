import { useState, useRef, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { Button } from '@/components/ui/button';
import { Upload, FileText, DollarSign, Users, Mail, Shield, CheckCircle2, AlertTriangle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { parseFile, validateHeaders, getExpectedHeaders, type ParsedFile } from '@/services/fileParser';
import { toast } from 'sonner';
import { fuzzySimilarity } from '@/services/fuzzyMatch';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { generatePreparerWeeklyReports } from '@/services/preparerReportGenerator';

/**
 * SHA-256 hash of file bytes, hex-encoded. Used to detect when the exact
 * same file is being re-imported (Item 4: duplicate upload prevention).
 */
async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const EXCEL_ACCEPTS = '.csv,.xlsx,.xls,.xlsb,.xlsm';

const ALL_UPLOAD_TYPES = [
  { label: 'Payroll Report', displayLabel: 'Disbursement Listing', desc: 'Weekly disbursement listing from Drake — primary source of preparer pay, fees, and net checks issued for the week (sent by Julius).', icon: FileText, accept: EXCEL_ACCEPTS, adminOnly: false },
  { label: 'Backend Money Report', desc: 'Backend office report capturing add-on fees, software fees, and net backend money owed back to each office (sent by Julius).', icon: DollarSign, accept: EXCEL_ACCEPTS, adminOnly: false },
  { label: 'Advance Report', desc: 'Taxpayer advance / loan status report — tracks funded, pending, and denied taxpayer loans used to reconcile advances against disbursements (sent by Julius).', icon: Shield, accept: EXCEL_ACCEPTS, adminOnly: true },
  { label: 'Client Data Report', desc: 'Master client records and tax return data used to match taxpayers to preparers and validate fee, refund, and status fields (sent by Julius).', icon: Users, accept: EXCEL_ACCEPTS, adminOnly: false },
  { label: 'Client Email Report', desc: 'Client contact enrichment file — adds verified emails and phone numbers to client records for earnings reports and notifications (sent by Julius).', icon: Mail, accept: EXCEL_ACCEPTS, adminOnly: false },
  { label: 'Fee Intercept Report', desc: 'SubOffice fee intercept / daily deposit summary — reconciles intercepted fees per sub-office against expected backend totals.', icon: DollarSign, accept: EXCEL_ACCEPTS, adminOnly: true },
];

type UploadStep = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

interface UploadState {
  step: UploadStep;
  file: File | null;
  uploadType: string;
  parsed: ParsedFile | null;
  validation: { valid: boolean; missing: string[]; extra: string[] } | null;
  progress: number;
}

interface UploadRecord {
  id: string;
  filename: string;
  type: string;
  uploadedBy: string;
  uploadedDate: string;
  rowsDetected: number;
  status: string;
}

export default function UploadCenter() {
  const { selectedWeek, activeWeek } = useActiveWeek();
  const [search, setSearch] = useState('');
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UploadState>({ step: 'idle', file: null, uploadType: '', parsed: null, validation: null, progress: 0 });
  const [previewRow, setPreviewRow] = useState<UploadRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = localStorage.getItem('hvt_user') === 'Payroll' || !localStorage.getItem('hvt_user');
  const uploadTypes = isAdmin ? ALL_UPLOAD_TYPES : ALL_UPLOAD_TYPES.filter(t => !t.adminOnly);

  // Load upload history from database (filtered by selected week)
  const loadUploads = useCallback(async () => {
    if (!selectedWeek) return;
    const acct = (typeof window !== 'undefined') ? localStorage.getItem('hvt_account_id') : null;
    let q = supabase.from('uploads').select('*').eq('week_label', selectedWeek);
    if (acct) q = q.eq('account_id', acct);
    const { data, error } = await q.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load uploads:', error);
      return;
    }

    const records: UploadRecord[] = (data || []).map((r: any) => ({
      id: r.id,
      filename: r.filename,
      type: r.type,
      uploadedBy: r.uploaded_by,
      uploadedDate: new Date(r.uploaded_date).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
      rowsDetected: r.rows_detected,
      status: r.status,
    }));

    setUploadHistory(records);
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const filtered = uploadHistory.filter(u => u.filename.toLowerCase().includes(search.toLowerCase()) || u.type.toLowerCase().includes(search.toLowerCase()));

  const handleFileSelect = useCallback(async (file: File, uploadType: string) => {
    setState({ step: 'parsing', file, uploadType, parsed: null, validation: null, progress: 10 });

    try {
      const parsed = await parseFile(file, uploadType);
      setState(s => ({ ...s, progress: 50 }));

      if (parsed.errors.length > 0) {
        setState(s => ({ ...s, step: 'error', parsed, progress: 100 }));
        toast.error(`File parsing failed: ${parsed.errors[0]}`);
        return;
      }

      const validation = validateHeaders(parsed, uploadType);
      setState(s => ({ ...s, step: 'preview', parsed, validation, progress: 100 }));
    } catch {
      setState(s => ({ ...s, step: 'error', progress: 100 }));
      toast.error('Failed to parse file');
    }
  }, []);

  const triggerUpload = (type: string, accept: string) => {
    setState(s => ({ ...s, uploadType: type }));
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.value = '';
      fileInputRef.current.onclick = null;
      fileInputRef.current.onchange = (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) handleFileSelect(f, type);
      };
      fileInputRef.current.click();
    }
  };

  const handleImport = async () => {
    if (!state.parsed || !state.file) return;
    setState(s => ({ ...s, step: 'importing', progress: 10 }));

    try {
      let rowsToInsert = state.parsed.rows;
      let dupCount = 0;

      // Duplicate-file guard: hash the bytes and short-circuit if an
      // upload with the same (account, type, week, hash) already exists.
      const fileHash = await sha256OfFile(state.file);
      const accountId =
        typeof window !== 'undefined'
          ? localStorage.getItem('hvt_account_id')
          : null;
      let dupQuery = supabase
        .from('uploads')
        .select('id, filename')
        .eq('type', state.uploadType)
        .eq('week_label', activeWeek)
        .eq('source_file_hash', fileHash);
      if (accountId) dupQuery = dupQuery.eq('account_id', accountId);
      const { data: existingDup } = await dupQuery.maybeSingle();
      if (existingDup) {
        setState(s => ({ ...s, step: 'preview', progress: 100 }));
        toast.warning(
          'This data may have already been imported. Please review before confirming.',
          { description: `Matching upload found: ${existingDup.filename}` },
        );
        return;
      }

      // Advance Report deduplication: remove dupes within file AND against existing DB rows
      if (state.uploadType === 'Advance Report') {
        const normalize = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
        const getField = (row: Record<string, any>, target: string) => {
          for (const k of Object.keys(row)) {
            if (normalize(k) === target) return String(row[k] ?? '').trim();
          }
          return '';
        };

        // 1. Deduplicate within the file itself
        const seen: { ssn: string; lastName: string; firstName: string }[] = [];
        const uniqueRows: typeof rowsToInsert = [];
        for (const row of rowsToInsert) {
          const entry = { ssn: getField(row, 'SSN'), lastName: getField(row, 'LAST_NAME'), firstName: getField(row, 'FIRST_NAME') };
          const isDup = seen.some(s =>
            s.ssn === entry.ssn &&
            fuzzySimilarity(s.lastName, entry.lastName) >= 0.85 &&
            fuzzySimilarity(s.firstName, entry.firstName) >= 0.85
          );
          if (isDup) { dupCount++; } else { seen.push(entry); uniqueRows.push(row); }
        }
        rowsToInsert = uniqueRows;

        // 2. Deduplicate against existing DB rows for Advance Report uploads in the active week
        const { data: existingUploads } = await supabase
          .from('uploads')
          .select('id')
          .eq('type', 'Advance Report')
          .eq('week_label', activeWeek);

        if (existingUploads && existingUploads.length > 0) {
          const existingIds = existingUploads.map(u => u.id);
          const existingRows: any[] = [];
          for (let i = 0; i < existingIds.length; i += 10) {
            const batch = existingIds.slice(i, i + 10);
            const { data } = await supabase
              .from('upload_rows')
              .select('row_data')
              .in('upload_id', batch);
            if (data) existingRows.push(...data);
          }

          const existingEntries = existingRows.map(r => {
            const d = r.row_data as Record<string, any>;
            return { ssn: getField(d, 'SSN'), lastName: getField(d, 'LAST_NAME'), firstName: getField(d, 'FIRST_NAME') };
          });

          const deduped: typeof rowsToInsert = [];
          for (const row of rowsToInsert) {
            const entry = { ssn: getField(row, 'SSN'), lastName: getField(row, 'LAST_NAME'), firstName: getField(row, 'FIRST_NAME') };
            const isDup = existingEntries.some(e =>
              e.ssn === entry.ssn &&
              fuzzySimilarity(e.lastName, entry.lastName) >= 0.85 &&
              fuzzySimilarity(e.firstName, entry.firstName) >= 0.85
            );
            if (isDup) { dupCount++; } else { deduped.push(row); }
          }
          rowsToInsert = deduped;
        }

        setState(s => ({ ...s, progress: 30 }));
      }

      // 1. Create upload record
      const { data: uploadRecord, error: uploadError } = await supabase
        .from('uploads')
        .insert({
          filename: state.file.name,
          type: state.uploadType,
          uploaded_by: isAdmin ? 'Admin' : 'Office Owner',
          rows_detected: rowsToInsert.length,
          status: 'Validated',
          week_label: activeWeek,
          source_file_hash: fileHash,
          ...(typeof window !== 'undefined' && localStorage.getItem('hvt_account_id') ? { account_id: localStorage.getItem('hvt_account_id') } : {}),
        })
        .select()
        .single();

      if (uploadError || !uploadRecord) {
        throw new Error(uploadError?.message || 'Failed to create upload record');
      }

      setState(s => ({ ...s, progress: 40 }));

      // 2. Insert rows in batches of 500
      const batchSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize).map((row, idx) => ({
          upload_id: uploadRecord.id,
          row_index: i + idx,
          row_data: row,
        }));

        const { error: rowError } = await supabase
          .from('upload_rows')
          .insert(batch);

        if (rowError) {
          console.error('Row insert error:', rowError);
          throw new Error(`Failed to insert rows: ${rowError.message}`);
        }

        const progress = 40 + ((i + batchSize) / rowsToInsert.length) * 55;
        setState(s => ({ ...s, progress: Math.min(progress, 95) }));
      }

      setState({ step: 'done', file: null, uploadType: '', parsed: null, validation: null, progress: 100 });
      const dupMsg = dupCount > 0 ? ` (${dupCount} duplicate(s) removed)` : '';
      toast.success(`${state.file.name} imported — ${rowsToInsert.length} rows saved${dupMsg}`);
      loadUploads();

      // Auto-(re)generate preparer weekly earnings whenever a Payroll Report is imported,
      // so MyEarnings stays in sync with the latest payroll data for this week.
      if (state.uploadType === 'Payroll Report') {
        try {
          const result = await generatePreparerWeeklyReports(activeWeek);
          if (result.preparersUpdated > 0) {
            toast.success(`Updated ${result.preparersUpdated} preparer earnings report(s) for "${activeWeek}".`);
          }
        } catch (err: any) {
          console.error('Preparer earnings auto-generation failed', err);
          toast.warning(`Payroll imported, but preparer earnings update failed: ${err.message || err}`);
        }
      }
    } catch (err: any) {
      setState(s => ({ ...s, step: 'error', progress: 100 }));
      toast.error(`Import failed: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: rowsErr } = await supabase.from('upload_rows').delete().eq('upload_id', deleteTarget.id);
      if (rowsErr) throw rowsErr;
      const { error: upErr } = await supabase.from('uploads').delete().eq('id', deleteTarget.id);
      if (upErr) throw upErr;
      toast.success(`${deleteTarget.filename} deleted — re-upload from the cards above to recalculate.`);
      const wasPayroll = deleteTarget.type === 'Payroll Report';
      setDeleteTarget(null);
      await loadUploads();
      if (wasPayroll && activeWeek) {
        try {
          const result = await generatePreparerWeeklyReports(activeWeek);
          if (result.preparersUpdated > 0) {
            toast.success(`Recalculated ${result.preparersUpdated} preparer earnings report(s).`);
          }
        } catch (err: any) {
          toast.warning(`Deleted, but preparer earnings recalculation failed: ${err.message || err}`);
        }
      }
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<UploadRecord>[] = [
    { key: 'filename', header: 'File Name' },
    { key: 'type', header: 'Type' },
    { key: 'uploadedBy', header: 'Uploaded By' },
    { key: 'uploadedDate', header: 'Date' },
    { key: 'rowsDetected', header: 'Rows', mono: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'id',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
          aria-label="Delete upload"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];


  return (
    <div>
      <input type="file" ref={fileInputRef} className="hidden" />
      <PageHeader title="Upload Center" description="Upload and manage payroll data files for payroll runs" />

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <strong>Office Owner Access</strong> — You can upload Payroll, Backend Money, Client Data, and Client Email reports for your office.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {uploadTypes.map((type) => (
          <div key={type.label} className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-elevated transition-shadow">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><type.icon className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium">{(type as any).displayLabel || type.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Accepts: {type.accept}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4 gap-2" onClick={() => triggerUpload(type.label, type.accept)}>
              <Upload className="h-3 w-3" /> Upload File
            </Button>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-3">Upload History</h3>
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search uploads..." />
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading uploads...
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(row) => setPreviewRow(row)} />
      )}

      {/* Historical row preview dialog */}
      <Dialog open={!!previewRow} onOpenChange={() => setPreviewRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Details</DialogTitle>
            <DialogDescription>Details for the selected upload record.</DialogDescription>
          </DialogHeader>
          {previewRow && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-mono">{previewRow.filename}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{previewRow.type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Uploaded By</span><span>{previewRow.uploadedBy}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{previewRow.uploadedDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rows</span><span className="font-mono">{previewRow.rowsDetected}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={previewRow.status} /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File upload preview/import dialog */}
      <Dialog open={state.step !== 'idle' && state.step !== 'done'} onOpenChange={() => setState({ step: 'idle', file: null, uploadType: '', parsed: null, validation: null, progress: 0 })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {state.step === 'parsing' && 'Parsing File...'}
              {state.step === 'preview' && 'File Preview & Validation'}
              {state.step === 'importing' && 'Importing...'}
              {state.step === 'error' && 'Upload Error'}
            </DialogTitle>
            <DialogDescription>
              {state.file?.name} → {state.uploadType}
            </DialogDescription>
          </DialogHeader>

          {(state.step === 'parsing' || state.step === 'importing') && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">{state.step === 'parsing' ? 'Parsing file contents...' : 'Saving rows to database...'}</span>
              </div>
              <Progress value={state.progress} className="h-2" />
            </div>
          )}

          {state.step === 'error' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-medium">File could not be processed</span>
              </div>
              {state.parsed?.errors.map((err, i) => (
                <p key={i} className="text-sm text-destructive/80 pl-7">{err}</p>
              ))}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setState({ step: 'idle', file: null, uploadType: '', parsed: null, validation: null, progress: 0 })}>Close</Button>
              </div>
            </div>
          )}

          {state.step === 'preview' && state.parsed && state.validation && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Detected Headers ({state.parsed.headers.length})</p>
                <div className="flex flex-wrap gap-1">
                  {state.parsed.headers.map(h => {
                    const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '').replace(/^_+/, '');
                    const expected = getExpectedHeaders(state.uploadType).map(normalize);
                    const isExpected = expected.includes(normalize(h));
                    return (
                      <span key={h} className={`text-xs px-2 py-0.5 rounded border font-mono ${isExpected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border'}`}>{h}</span>
                    );
                  })}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Validation Summary</p>
                <div className="space-y-1.5">
                  <p className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> {state.parsed.rowCount} rows detected</p>
                  {state.validation.valid ? (
                    <p className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> All required headers present</p>
                  ) : (
                    <>
                      <p className="text-sm flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /> Missing required headers:</p>
                      <div className="flex flex-wrap gap-1 pl-6">
                        {state.validation.missing.map(h => (
                          <span key={h} className="text-xs px-2 py-0.5 bg-destructive/10 border border-destructive/30 rounded font-mono text-destructive">{h}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {state.validation.extra.length > 0 && (
                    <p className="text-sm flex items-center gap-2 text-yellow-600 dark:text-yellow-400"><AlertTriangle className="h-4 w-4" /> {state.validation.extra.length} extra column(s) detected</p>
                  )}
                </div>
              </div>

              {state.parsed.rows.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sample Data (first 5 rows)</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>{state.parsed.headers.slice(0, 6).map(h => <th key={h} className="text-left p-1 font-medium border-b border-border">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {state.parsed.rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>{state.parsed!.headers.slice(0, 6).map(h => <td key={h} className="p-1 font-mono border-b border-border/50">{String(row[h] ?? '')}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setState({ step: 'idle', file: null, uploadType: '', parsed: null, validation: null, progress: 0 })}>Cancel</Button>
                <Button onClick={handleImport} disabled={!state.validation.valid}>
                  {state.validation.valid ? 'Import File' : 'Fix Headers to Import'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete uploaded file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>This will remove <span className="font-mono">{deleteTarget.filename}</span> and its {deleteTarget.rowsDetected} row(s). Calculations will update automatically. Re-upload from the cards above to recalculate with new data.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
