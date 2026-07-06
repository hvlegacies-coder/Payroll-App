import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { SummaryTable } from '@/components/office-summary/SummaryTable';
import { BackendFeeTable } from '@/components/office-summary/BackendFeeTable';
import { PreparersShareTable } from '@/components/office-summary/PreparersShareTable';
import { SourceRowsPanel } from '@/components/office-summary/SourceRowsPanel';
import { AlignmentBanner } from '@/components/office-summary/AlignmentBanner';
import type { SummaryTableConfig } from '@/components/office-summary/types';
import { Button } from '@/components/ui/button';
import { Plus, Save, Download, FileText, FileSpreadsheet } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { exportSectionsCsv, exportSectionsPdf, type ExportSection } from '@/lib/exportReports';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { useAuth } from '@/contexts/AuthContext';
import { HideableBlock, HiddenTablesBar } from '@/components/sub-layouts/visibility';
import { BUILTIN_KEYS, bfKey, isBfKey, bfFeeFromKey } from '@/components/sub-layouts/types';
import { formatMoney } from '@/lib/utils';
import { ensureTotalsTemplateFields } from '@/config/subSummaryTables';

const AGENCY_ADMIN_SLUG = '__agency__';        // legacy slug — admin-view hides
const AGENCY_OFFICES_SLUG = '__agency_offices__'; // hides propagated to offices

export default function OfficeSummary() {
  const [tables, setTables] = useState<SummaryTableConfig[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('[]');
  const [officeScope, setOfficeScope] = useState<string>('');
  const [officeOptions, setOfficeOptions] = useState<string[]>([]);
  const [tableTotals, setTableTotals] = useState<Record<string, number>>({});
  const [preparersShareTotal, setPreparersShareTotal] = useState<number>(0);
  const [feeTotals, setFeeTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { selectedWeek } = useActiveWeek();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [officesHiddenKeys, setOfficesHiddenKeys] = useState<string[]>([]);

  // Load agency-level hidden table keys for this office (admin + offices scope)
  useEffect(() => {
    if (!officeScope) { setHiddenKeys([]); setOfficesHiddenKeys([]); return; }
    let cancelled = false;
    (async () => {
      const [{ data: adminRow }, { data: officesRow }] = await Promise.all([
        (supabase as any)
          .from('sub_account_table_visibility')
          .select('hidden_keys')
          .eq('slug', AGENCY_ADMIN_SLUG)
          .eq('office_name', officeScope)
          .maybeSingle(),
        (supabase as any)
          .from('sub_account_table_visibility')
          .select('hidden_keys')
          .eq('slug', AGENCY_OFFICES_SLUG)
          .eq('office_name', officeScope)
          .maybeSingle(),
      ]);
      if (!cancelled) {
        setHiddenKeys(((adminRow?.hidden_keys as unknown) as string[]) || []);
        setOfficesHiddenKeys(((officesRow?.hidden_keys as unknown) as string[]) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [officeScope]);

  const persistHidden = async (slug: string, next: string[]) => {
    await (supabase as any)
      .from('sub_account_table_visibility')
      .upsert(
        { slug, office_name: officeScope, hidden_keys: next, updated_at: new Date().toISOString() },
        { onConflict: 'slug,office_name' },
      );
  };

  const onToggleHiddenScoped = async (
    key: string,
    scope: 'admin' | 'offices',
  ) => {
    if (!officeScope) return;
    if (scope === 'admin') {
      const next = hiddenKeys.includes(key)
        ? hiddenKeys.filter((k) => k !== key)
        : [...hiddenKeys, key];
      setHiddenKeys(next);
      await persistHidden(AGENCY_ADMIN_SLUG, next);
    } else {
      const next = officesHiddenKeys.includes(key)
        ? officesHiddenKeys.filter((k) => k !== key)
        : [...officesHiddenKeys, key];
      setOfficesHiddenKeys(next);
      await persistHidden(AGENCY_OFFICES_SLUG, next);
    }
  };

  const onUnhideAdmin = (key: string) => onToggleHiddenScoped(key, 'admin');
  const onUnhideOffices = (key: string) => onToggleHiddenScoped(key, 'offices');

  // Export data collectors
  const summaryDataRef = useRef<Record<string, { title: string; rows: { label: string; operator?: string; value: number }[]; total: number }>>({});
  const preparersDataRef = useRef<{ name: string; fee: number; net: number }[]>([]);
  const backendDataRef = useRef<{ feeType: string; rows: { office: string; amount: number }[]; total: number }[]>([]);
  const sourceDataRef = useRef<Record<string, { columns: { key: string; header: string; money?: boolean }[]; rows: Record<string, any>[] }>>({});

  const fmtMoney = formatMoney;

  const buildSections = (): ExportSection[] => {
    const sections: ExportSection[] = [];

    // Custom summary tables, in user order
    tables.forEach(t => {
      const data = summaryDataRef.current[t.id];
      if (!data) return;
      sections.push({
        title: data.title,
        columns: ['Field', 'Operator', 'Value'],
        rows: [
          ...data.rows.map(r => [r.label, r.operator ?? '', fmtMoney(r.value)] as (string | number)[]),
          ['Total', '', fmtMoney(data.total)],
        ],
      });
    });

    // Preparers Share
    if (preparersDataRef.current.length > 0) {
      const totalFee = preparersDataRef.current.reduce((s, r) => s + r.fee, 0);
      const totalNet = preparersDataRef.current.reduce((s, r) => s + r.net, 0);
      sections.push({
        title: 'Preparers Share',
        columns: ['Preparer', 'Fee', 'Preparer Share'],
        rows: [
          ...preparersDataRef.current.map(r => [r.name, fmtMoney(r.fee), fmtMoney(r.net)] as (string | number)[]),
          ['Total', fmtMoney(totalFee), fmtMoney(totalNet)],
        ],
      });
    }

    // Backend Fee tiles
    backendDataRef.current.forEach(tile => {
      if (tile.rows.length === 0) return;
      sections.push({
        title: `Backend Fee — ${tile.feeType}`,
        columns: ['Office', 'Amount'],
        rows: [
          ...tile.rows.map(r => [r.office, fmtMoney(r.amount)] as (string | number)[]),
          ['Total', fmtMoney(tile.total)],
        ],
      });
    });

    // Source rows (full filtered set) for each tab the user has loaded
    (['payroll', 'backend'] as const).forEach(tab => {
      const data = sourceDataRef.current[tab];
      if (!data || data.rows.length === 0) return;
      const getVal = (row: Record<string, any>, key: string) => {
        if (row[key] !== undefined) return row[key];
        const norm = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        for (const k of Object.keys(row)) {
          if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === norm) return row[k];
        }
        return '';
      };
      const parseNum = (v: any) => {
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'number') return v;
        return Number(String(v).replace(/[$,]/g, '')) || 0;
      };
      sections.push({
        title: `Source Rows — ${tab === 'payroll' ? 'Payroll' : 'Backend Money'}`,
        columns: data.columns.map(c => c.header),
        rows: data.rows.map(r =>
          data.columns.map(c => {
            const v = c.key.startsWith('__') ? r[c.key] : getVal(r, c.key);
            if (c.money) return fmtMoney(parseNum(v));
            return v == null ? '' : String(v);
          }),
        ),
      });
    });

    return sections;
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const sections = buildSections();
    if (sections.length === 0) {
      toast({ title: 'Nothing to export', description: 'No data is loaded yet.', variant: 'destructive' });
      return;
    }
    const stamp = (selectedWeek || new Date().toISOString().slice(0, 10)).replace(/[^\w-]+/g, '_');
    const base = `office-summary-${(officeScope || 'all').replace(/[^\w-]+/g, '_')}-${stamp}`;
    if (format === 'csv') {
      exportSectionsCsv(sections, `${base}.csv`);
    } else {
      exportSectionsPdf(sections, `${base}.pdf`, `Office Summary — ${officeScope} (${selectedWeek || ''})`);
    }
    toast({ title: 'Export ready', description: `${sections.length} section(s) exported as ${format.toUpperCase()}.` });
  };

  // Load tables from database when office changes
  useEffect(() => {
    setTableTotals({});
    setPreparersShareTotal(0);
    setFeeTotals({});
    if (!officeScope) {
      setTables([]);
      setSavedSnapshot('[]');
      return;
    }
    setTables([]);
    setLoading(true);
    supabase
      .from('office_summary_configs')
      .select('tables')
      .eq('office_name', officeScope)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
          setTables([]);
          setSavedSnapshot('[]');
        } else {
          // Higher View is excluded from the auto SB+ERO3+EFile template field —
          // it only auto-populates for sub-offices.
          const loaded = (data?.tables as unknown as SummaryTableConfig[]) || [];
          setTables(loaded);
          setSavedSnapshot(JSON.stringify(loaded));
        }
        setLoading(false);
      });
  }, [officeScope]);

  const isDirty = JSON.stringify(tables) !== savedSnapshot;

  const handleSave = async () => {
    if (!officeScope) return;
    setSaving(true);
    const serialized = JSON.stringify(tables);
    const { error } = await supabase
      .from('office_summary_configs')
      .upsert(
        { office_name: officeScope, tables: tables as any, updated_at: new Date().toISOString() },
        { onConflict: 'office_name' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setSavedSnapshot(serialized);
    toast({ title: 'Saved', description: `Tables saved for ${officeScope}.` });
  };

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    supabase.from('offices')
      .select('office_name, process_frontend')
      .eq('active', true)
      .eq('process_frontend', true)
      .order('office_name')
      .then(({ data }) => {
        if (data) setOfficeOptions(data.map((o: any) => o.office_name).filter(Boolean));
      });
  }, []);

  const addTable = () => {
    const newTable: SummaryTableConfig = {
      id: `table_${Date.now()}`,
      title: `Table ${tables.length + 1}`,
      fields: [],
      filters: { efin: '', taxOffice: '', preparer: '' },
    };
    setTables(prev => [...prev, newTable]);
  };

  const updateTable = (id: string, config: SummaryTableConfig) => {
    setTables(prev => prev.map(t => t.id === id ? config : t));
  };

  const deleteTable = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const reorderTables = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setTables(prev => {
      const srcIdx = prev.findIndex(t => t.id === sourceId);
      const tgtIdx = prev.findIndex(t => t.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Office Summary"
        description="Build custom summary tables from Payroll, Backend Money, and Fee Intercept data"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={!officeScope}>
                  <Download className="h-4 w-4" /> Export All Reports
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="h-4 w-4 mr-2" /> Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={isDirty ? 'default' : 'outline'}
              className="gap-2"
              onClick={handleSave}
              disabled={!officeScope || !isDirty || saving}
            >
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : isDirty ? 'Save Changes' : 'Saved'}
            </Button>
            <Button className="gap-2" onClick={addTable} disabled={!officeScope} variant="outline">
              <Plus className="h-4 w-4" /> Add Table
            </Button>
          </div>
        }
      />

      {/* Office navigation bar (process_frontend offices only) */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-card border border-border rounded-xl">
        <span className="text-sm font-medium text-muted-foreground mr-1">Office:</span>
        {officeOptions.map(o => (
          <Button
            key={o}
            size="sm"
            variant={officeScope === o ? 'default' : 'outline'}
            className="text-xs h-8"
            onClick={() => setOfficeScope(o)}
          >
            {o}
          </Button>
        ))}
        {officeScope && (
          <Button size="sm" variant="ghost" className="text-xs h-8 ml-auto" onClick={() => setOfficeScope('')}>
            Clear
          </Button>
        )}
      </div>

      {!officeScope ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">Select an office above to view or create summary tables.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <AlignmentBanner office={officeScope} />
          <HiddenTablesBar
            isAdmin={isAdmin}
            hiddenKeys={hiddenKeys}
            summaryTables={tables}
            onUnhide={onUnhideAdmin}
            label="Hidden (Admin)"
          />
          <HiddenTablesBar
            isAdmin={isAdmin}
            hiddenKeys={officesHiddenKeys}
            summaryTables={tables}
            onUnhide={onUnhideOffices}
            label="Hidden (Offices)"
          />
          {tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground mb-4">No custom tables yet for <strong>{officeScope}</strong>.</p>
              <Button onClick={addTable} className="gap-2">
                <Plus className="h-4 w-4" /> Add Table
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {tables.filter(t => !hiddenKeys.includes(t.id)).map(t => {
                const autoSiblings = [
                  { id: '__pshare__', title: 'Preparers Share', total: preparersShareTotal },
                  { id: '__bf_efile', title: 'E-File Fee(s)', total: feeTotals['E-File Fee(s)'] ?? 0 },
                  { id: '__bf_sbf', title: 'Service Bureau Fee', total: feeTotals['Service Bureau Fee'] ?? 0 },
                  { id: '__bf_ero3', title: 'ERO3Fee', total: feeTotals['ERO3Fee'] ?? 0 },
                  { id: '__bf_xmit', title: 'Transmitter Fee', total: feeTotals['Transmitter Fee'] ?? 0 },
                  { id: '__bf_efile_efin', title: 'E-File-EFIN', total: feeTotals['E-File-EFIN'] ?? 0 },
                  { id: '__bf_ero3_efin', title: 'ERO3-EFIN', total: feeTotals['ERO3-EFIN'] ?? 0 },
                ];
                const userSiblings = tables
                  .filter(other => other.id !== t.id)
                  .map(other => ({ id: other.id, title: other.title, total: tableTotals[other.id] ?? 0 }));
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={e => {
                      setDraggingId(t.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', t.id);
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggingId && draggingId !== t.id) setDragOverId(t.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === t.id) setDragOverId(null);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
                      if (sourceId) reorderTables(sourceId, t.id);
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    className={[
                      'transition-all',
                      draggingId === t.id ? 'opacity-50' : '',
                      dragOverId === t.id ? 'ring-2 ring-primary rounded-xl' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <HideableBlock isAdmin={isAdmin} itemKey={t.id} onHideScoped={onToggleHiddenScoped}>
                      <SummaryTable
                        config={t}
                        onChange={c => updateTable(t.id, c)}
                        onDelete={() => deleteTable(t.id)}
                        officeScope={officeScope}
                        siblingTables={[...userSiblings, ...autoSiblings]}
                        onTotalChange={total => setTableTotals(prev => prev[t.id] === total ? prev : { ...prev, [t.id]: total })}
                        onExportData={data => { summaryDataRef.current[t.id] = data; }}
                      />
                    </HideableBlock>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pre-existing auto-generated tables — placed at the bottom */}
          {!hiddenKeys.includes(BUILTIN_KEYS.preparersShare) && (
            <HideableBlock isAdmin={isAdmin} itemKey={BUILTIN_KEYS.preparersShare} onHideScoped={onToggleHiddenScoped}>
              <PreparersShareTable
                officeScope={officeScope}
                onTotalChange={total => setPreparersShareTotal(prev => prev === total ? prev : total)}
                onExportData={rows => { preparersDataRef.current = rows; }}
              />
            </HideableBlock>
          )}
          <BackendFeeTable
            officeScope={officeScope}
            hiddenFeeTypes={hiddenKeys.filter(isBfKey).map(bfFeeFromKey)}
            onHideFee={isAdmin ? (f) => onToggleHiddenScoped(bfKey(f), 'admin') : undefined}
            onTotalsChange={totals => setFeeTotals(prev => {
              const same = Object.keys(totals).every(k => prev[k] === (totals as any)[k]);
              return same ? prev : { ...prev, ...totals };
            })}
            onExportData={tiles => { backendDataRef.current = tiles; }}
          />
          {!hiddenKeys.includes(BUILTIN_KEYS.sourceRows) && (
            <HideableBlock isAdmin={isAdmin} itemKey={BUILTIN_KEYS.sourceRows} onHideScoped={onToggleHiddenScoped}>
              <SourceRowsPanel
                officeScope={officeScope}
                onExportData={data => { sourceDataRef.current[data.tab] = { columns: data.columns, rows: data.rows }; }}
              />
            </HideableBlock>
          )}
        </div>
      )}
    </div>
  );
}
