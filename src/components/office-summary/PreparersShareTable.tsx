import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { Loader2, Palette, StickyNote, History } from 'lucide-react';
import { cn, formatMoney as fmt } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { fetchAllRows, fetchPayrollLookups, fundingMonthKey, makeFundingRangeFilter, preparerFee, processPayrollRow, type PayrollLookups } from '@/services/payrollRowProcessor';
import { toast } from 'sonner';
import { officeMatches } from '@/services/types';
import { getConsolidatedOffices } from '@/services/types';
import { SourceTotalBadge } from './SourceTotalBadge';

interface Props {
  officeScope: string;
  onTotalChange?: (total: number) => void;
  onExportData?: (rows: { name: string; fee: number; net: number }[]) => void;
}

// Manual edits live in preparer_share_state (one row per key below) so every
// admin sees the same totals. Last save wins if two admins edit one map at once.
const STATE_PREFIXES = [
  'preparerFeeOverrides:', 'preparerFeeColors:', 'preparerFeeNotes:', 'preparerFeeHistory:',
  'preparerShareOverrides:', 'preparerShareColors:', 'preparerShareNotes:',
];
// Not in the generated Supabase types yet.
const stateTable = () => (supabase as any).from('preparer_share_state');

async function saveState(key: string, value: unknown) {
  const { error } = await stateTable().upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) toast.error(`Could not save preparer share edit: ${error.message}`);
}

// One-time move of edits this browser saved before they were stored in the
// database. Never overwrites a key the database already has.
let localImport: Promise<void> | null = null;
function importLocalState(): Promise<void> {
  if (!localImport) {
    localImport = (async () => {
      const rows: { key: string; value: unknown }[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !STATE_PREFIXES.some(p => key.startsWith(p))) continue;
          const value = JSON.parse(localStorage.getItem(key) || '{}');
          if (value && Object.keys(value).length > 0) rows.push({ key, value });
        }
      } catch { return; }
      if (rows.length > 0) await stateTable().upsert(rows, { onConflict: 'key', ignoreDuplicates: true });
    })();
  }
  return localImport;
}


export function PreparersShareTable({ officeScope, onTotalChange, onExportData }: Props) {
  const { selectedWeek, selectedWeekRange } = useActiveWeek();
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<PayrollLookups | null>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [scopeEfins, setScopeEfins] = useState<Set<string>>(new Set());
  const [consolidatedOfficeNames, setConsolidatedOfficeNames] = useState<Set<string>>(new Set());
  const [feeOverrides, setFeeOverrides] = useState<Record<string, number>>({});
  const [feeColors, setFeeColors] = useState<Record<string, 'default' | 'purple'>>({});
  const [feeNotes, setFeeNotes] = useState<Record<string, string>>({});
  const [feeHistory, setFeeHistory] = useState<Record<string, { actor: string; at: string; action: string; detail?: string }[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingShare, setEditingShare] = useState<string | null>(null);
  const [editShareValue, setEditShareValue] = useState<string>('');
  const [shareOverrides, setShareOverrides] = useState<Record<string, number>>({});
  const [shareColors, setShareColors] = useState<Record<string, 'default' | 'purple'>>({});
  const [shareNotes, setShareNotes] = useState<Record<string, string>>({});
  const [shareNoteEditing, setShareNoteEditing] = useState<string | null>(null);
  const [shareNoteDraft, setShareNoteDraft] = useState<string>('');
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const overrideKey = useMemo(
    () => `preparerFeeOverrides:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const colorKey = useMemo(
    () => `preparerFeeColors:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const noteKey = useMemo(
    () => `preparerFeeNotes:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const historyKey = useMemo(
    () => `preparerFeeHistory:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const shareOverrideKey = useMemo(
    () => `preparerShareOverrides:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const shareColorKey = useMemo(
    () => `preparerShareColors:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );
  const shareNoteKey = useMemo(
    () => `preparerShareNotes:${officeScope || 'all'}:${selectedWeek || 'none'}`,
    [officeScope, selectedWeek],
  );

  useEffect(() => {
    let cancelled = false;
    setFeeOverrides({}); setFeeColors({}); setFeeNotes({}); setFeeHistory({});
    setShareOverrides({}); setShareColors({}); setShareNotes({});
    (async () => {
      await importLocalState();
      const { data, error } = await stateTable()
        .select('key, value')
        .in('key', [overrideKey, colorKey, noteKey, historyKey, shareOverrideKey, shareColorKey, shareNoteKey]);
      if (cancelled) return;
      if (error) { toast.error(`Preparer share edits failed to load: ${error.message}`); return; }
      const byKey = new Map<string, any>((data || []).map((r: any) => [r.key, r.value]));
      const get = (k: string) => byKey.get(k) || {};
      setFeeOverrides(get(overrideKey));
      setFeeColors(get(colorKey));
      setFeeNotes(get(noteKey));
      setFeeHistory(get(historyKey));
      setShareOverrides(get(shareOverrideKey));
      setShareColors(get(shareColorKey));
      setShareNotes(get(shareNoteKey));
    })();
    return () => { cancelled = true; };
  }, [overrideKey, colorKey, noteKey, historyKey, shareOverrideKey, shareColorKey, shareNoteKey]);

  const saveOverrides = (next: Record<string, number>) => {
    setFeeOverrides(next);
    saveState(overrideKey, next);
  };
  const saveShareOverrides = (next: Record<string, number>) => {
    setShareOverrides(next);
    saveState(shareOverrideKey, next);
  };
  const saveShareColors = (next: Record<string, 'default' | 'purple'>) => {
    setShareColors(next);
    saveState(shareColorKey, next);
  };
  const saveShareNotes = (next: Record<string, string>) => {
    setShareNotes(next);
    saveState(shareNoteKey, next);
  };
  const saveColors = (next: Record<string, 'default' | 'purple'>) => {
    setFeeColors(next);
    saveState(colorKey, next);
  };
  const saveNotes = (next: Record<string, string>) => {
    setFeeNotes(next);
    saveState(noteKey, next);
  };
  const appendHistory = (name: string, action: string, detail?: string) => {
    const actor = (typeof window !== 'undefined' && localStorage.getItem('hvt_user')) || 'anonymous';
    const entry = { actor, at: new Date().toISOString(), action, detail };
    const next = { ...feeHistory, [name]: [entry, ...(feeHistory[name] || [])].slice(0, 50) };
    setFeeHistory(next);
    saveState(historyKey, next);
  };

  // Build EFIN set for the scope office + all descendants that share an EFIN.
  useEffect(() => {
    if (!officeScope) { setScopeEfins(new Set()); setConsolidatedOfficeNames(new Set()); return; }
    (async () => {
      const { data } = await supabase
        .from('offices')
        .select('office_name, parent_office, primary_efin')
        .eq('active', true);
      if (!data) return;
      const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
      const canon = new Map<string, string>();
      data.forEach((o: any) => { if (o.office_name) canon.set(norm(o.office_name), o.office_name); });
      const parentMap: Record<string, string> = {};
      const efinMap: Record<string, string> = {};
      data.forEach((o: any) => {
        const child = o.office_name;
        const resolvedParent = o.parent_office ? canon.get(norm(o.parent_office)) || '' : '';
        if (child && resolvedParent && resolvedParent !== child) parentMap[child] = resolvedParent;
        if (child) efinMap[child] = (o.primary_efin || '').trim();
      });
      const isDescendant = (child: string): boolean => {
        let cur = parentMap[child];
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          if (cur === officeScope) return true;
          seen.add(cur);
          cur = parentMap[cur];
        }
        return false;
      };
      const offices = new Set<string>(getConsolidatedOffices(officeScope));
      const scopeEfin = efinMap[officeScope];
      if (scopeEfin) {
        Object.entries(efinMap).forEach(([o, e]) => {
          if (o !== officeScope && e && e === scopeEfin && isDescendant(o)) offices.add(o);
        });
      }
      const efins = new Set<string>();
      offices.forEach(o => { const e = efinMap[o]; if (e) efins.add(e); });
      setConsolidatedOfficeNames(new Set([...offices].map(norm)));
      setScopeEfins(efins);
    })();
  }, [officeScope]);

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const lk = await fetchPayrollLookups(selectedWeek);
      const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .eq('type', 'Payroll Report')
        .eq('week_label', selectedWeek);

      if (!uploads || uploads.length === 0) {
        if (!cancelled) { setLookups(lk); setRows([]); setLoading(false); }
        return;
      }

      const all = await fetchAllRows(uploads.map(u => u.id));

      // Apply Funding Date range filter so preparer share aligns with the
      // backend tiles / Source Rows panel (which scope by the same range).
      let filtered = all;
      const inRange = makeFundingRangeFilter(selectedWeekRange?.from, selectedWeekRange?.to);
      if (inRange) {
        filtered = all.filter(r => inRange(r['Funding Date'] ?? r['FUNDING_DATE'] ?? r['funding_date']));
      }
      if (!cancelled) { setLookups(lk); setRows(filtered); setLoading(false); }
    })().catch(err => {
      if (cancelled) return;
      setRows([]);
      setLoading(false);
      toast.error(`Preparer share failed to load: ${err.message || err}`);
    });
    return () => { cancelled = true; };
  }, [officeScope, selectedWeek, selectedWeekRange?.from, selectedWeekRange?.to]);

  const totals = useMemo(() => {
    if (!lookups) return [] as { name: string; total: number; count: number; monthCount: number }[];
    const acc: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const months: Record<string, Set<string>> = {};
    const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
    // PTIN scope: preparers whose CURRENT tax_office is in the consolidated
    // scope. Used to attribute payroll rows by PTIN so client rows follow
    // the preparer when they change offices.
    const scopePtins = new Set<string>();
    if (officeScope && lookups) {
      Object.entries(lookups.ptinToPreparers).forEach(([ptinKey, arr]) => {
        const k = String(ptinKey || '').trim().toLowerCase();
        if (!k) return;
        if ((arr || []).some((p: any) => consolidatedOfficeNames.has(norm(p.tax_office || '')))) {
          scopePtins.add(k);
        }
      });
    }
    for (const r of rows) {
      const processed = processPayrollRow(r, lookups);
      if (officeScope) {
        const ptin = String(r['PTIN'] || '').trim().toLowerCase();
        if (!ptin || !scopePtins.has(ptin)) continue;
      }
      const name = processed.preparer || '(Unknown)';
      acc[name] = (acc[name] || 0) + processed.preparerShare;
      counts[name] = (counts[name] || 0) + 1;
      const mk = fundingMonthKey(r['Funding Date'] ?? r['FUNDING_DATE'] ?? r['funding_date']);
      if (mk) {
        if (!months[name]) months[name] = new Set();
        months[name].add(mk);
      }
    }
    return Object.entries(acc)
      .map(([name, total]) => ({ name, total, count: counts[name] || 0, monthCount: months[name]?.size || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [rows, lookups, officeScope, consolidatedOfficeNames]);

  const netTotals = useMemo(
    () => totals.map(t => {
      let fee = preparerFee(officeScope, t.total, t.monthCount);
      if (Object.prototype.hasOwnProperty.call(feeOverrides, t.name)) {
        fee = feeOverrides[t.name];
      }
      const grossOverride = Object.prototype.hasOwnProperty.call(shareOverrides, t.name)
        ? shareOverrides[t.name]
        : null;
      const gross = grossOverride !== null ? grossOverride : t.total;
      const net = gross - fee;
      return { ...t, fee, net, gross };
    }),
    [totals, officeScope, feeOverrides, shareOverrides],
  );
  const grandTotal = netTotals.reduce((s, t) => s + t.net, 0);

  useEffect(() => {
    onTotalChange?.(grandTotal);
  }, [grandTotal, onTotalChange]);

  useEffect(() => {
    onExportData?.(netTotals.map(t => ({ name: t.name, fee: t.fee, net: t.net })));
  }, [netTotals, onExportData]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden w-full">
      <div
        className="px-3 py-2 border-b border-border font-semibold text-sm"
        style={{ backgroundColor: 'hsl(280 60% 80%)' }}
      >
        Preparers Share
      </div>
      <div className="grid grid-cols-[1fr_90px_110px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        <span>Preparer</span>
        <span className="text-right">Fee</span>
        <span className="text-right">Preparer Share</span>
      </div>
      <div className="divide-y divide-border">
        {netTotals.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
            No preparer share data for {officeScope || 'this office'}.
          </div>
        ) : (
          netTotals.map((t, idx) => {
            const isOverridden = Object.prototype.hasOwnProperty.call(feeOverrides, t.name);
            const explicitColor = feeColors[t.name];
            const effectiveColor = explicitColor ?? (isOverridden ? 'purple' : 'default');
            const note = feeNotes[t.name] || '';
            return (
              <div
                key={t.name}
                className={cn(
                  'grid grid-cols-[1fr_90px_110px] gap-2 px-3 py-1.5 text-sm',
                  idx % 2 === 1 && 'bg-muted/30',
                )}
              >
                <span className="truncate flex items-center gap-1">
                  {t.name}
                  {note && <StickyNote className="h-3 w-3 text-purple-500 shrink-0" aria-label="Has note" />}
                </span>
                {editing === t.name ? (
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      const parsed = parseFloat(editValue);
                      const next = { ...feeOverrides };
                      const prevVal = t.fee;
                      if (!isNaN(parsed) && parsed !== prevVal) {
                        next[t.name] = parsed;
                        saveOverrides(next);
                        appendHistory(t.name, 'Edited fee', `${fmt(prevVal)} → ${fmt(parsed)}`);
                      } else if (isNaN(parsed) && Object.prototype.hasOwnProperty.call(feeOverrides, t.name)) {
                        delete next[t.name];
                        saveOverrides(next);
                        appendHistory(t.name, 'Reset fee override');
                      }
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setEditing(null); }
                    }}
                    className="font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-sm w-full"
                  />
                ) : (
                  <Popover
                    onOpenChange={(open) => {
                      if (open) {
                        setNoteEditing(t.name);
                        setNoteDraft(note);
                      } else if (noteEditing === t.name) {
                        setNoteEditing(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditing(t.name);
                          setEditValue(String(t.fee));
                        }}
                        className={cn(
                          'font-mono text-right hover:bg-muted/50 rounded px-1 -mx-1 cursor-pointer',
                          effectiveColor === 'purple' && 'text-purple-600 dark:text-purple-400 font-semibold',
                        )}
                        title="Click to view note · double-click to edit fee"
                      >
                        {fmt(t.fee)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 space-y-3" align="end">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Note</div>
                        {note ? (
                          <div className="text-sm whitespace-pre-wrap rounded border border-border bg-muted/30 p-2">
                            {note}
                          </div>
                        ) : (
                          <div className="text-xs italic text-muted-foreground">No note yet.</div>
                        )}
                        <Textarea
                          value={noteEditing === t.name ? noteDraft : note}
                          onChange={(e) => {
                            setNoteEditing(t.name);
                            setNoteDraft(e.target.value);
                          }}
                          placeholder="Add a note…"
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          {note && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = { ...feeNotes };
                                delete next[t.name];
                                saveNotes(next);
                                setNoteDraft('');
                                appendHistory(t.name, 'Cleared note');
                              }}
                            >
                              Clear
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              const next = { ...feeNotes };
                              const v = noteDraft.trim();
                              const prev = feeNotes[t.name] || '';
                              if (v) next[t.name] = v;
                              else delete next[t.name];
                              saveNotes(next);
                              if (v && v !== prev) appendHistory(t.name, prev ? 'Updated note' : 'Added note', v);
                              else if (!v && prev) appendHistory(t.name, 'Cleared note');
                            }}
                          >
                            Save note
                          </Button>
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Palette className="h-3 w-3" /> Value color
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={effectiveColor === 'default' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              if (effectiveColor !== 'default') {
                                saveColors({ ...feeColors, [t.name]: 'default' });
                                appendHistory(t.name, 'Changed color', 'Default');
                              }
                            }}
                          >
                            Default
                          </Button>
                          <Button
                            type="button"
                            variant={effectiveColor === 'purple' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              if (effectiveColor !== 'purple') {
                                saveColors({ ...feeColors, [t.name]: 'purple' });
                                appendHistory(t.name, 'Changed color', 'Purple');
                              }
                            }}
                          >
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">Purple</span>
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => { setEditing(t.name); setEditValue(String(t.fee)); }}
                        >
                          Edit fee value
                        </Button>
                      </div>
                      <div className="border-t border-border pt-2 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <History className="h-3 w-3" /> Edit history
                        </div>
                        {(feeHistory[t.name]?.length ?? 0) === 0 ? (
                          <div className="text-xs italic text-muted-foreground">No edits yet.</div>
                        ) : (
                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                            {feeHistory[t.name].map((h, i) => (
                              <div key={i} className="text-xs border border-border rounded bg-muted/30 px-2 py-1">
                                <div className="flex justify-between gap-2">
                                  <span className="font-medium truncate">{h.action}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {new Date(h.at).toLocaleString()}
                                  </span>
                                </div>
                                {h.detail && <div className="text-muted-foreground truncate">{h.detail}</div>}
                                <div className="text-[10px] text-muted-foreground">by {h.actor}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {editingShare === t.name ? (
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={editShareValue}
                    onChange={(e) => setEditShareValue(e.target.value)}
                    onBlur={() => {
                      const parsed = parseFloat(editShareValue);
                      const next = { ...shareOverrides };
                      const prevVal = (t as any).gross ?? t.total;
                      if (editShareValue.trim() === '') {
                        if (Object.prototype.hasOwnProperty.call(shareOverrides, t.name)) {
                          delete next[t.name];
                          saveShareOverrides(next);
                          appendHistory(t.name, 'Reset share override');
                        }
                      } else if (!isNaN(parsed) && parsed !== prevVal) {
                        next[t.name] = parsed;
                        saveShareOverrides(next);
                        appendHistory(t.name, 'Edited gross share', `${fmt(prevVal)} → ${fmt(parsed)} (net ${fmt(parsed - t.fee)})`);
                      }
                      setEditingShare(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingShare(null);
                    }}
                    className="font-mono text-right bg-background border border-border rounded px-1 py-0.5 text-sm w-full"
                  />
                ) : (() => {
                  const sNote = shareNotes[t.name] || '';
                  const sIsOverridden = Object.prototype.hasOwnProperty.call(shareOverrides, t.name);
                  const sExplicit = shareColors[t.name];
                  const sEffective = sExplicit ?? (sIsOverridden ? 'purple' : 'default');
                  return (
                  <Popover
                    onOpenChange={(open) => {
                      if (open) { setShareNoteEditing(t.name); setShareNoteDraft(sNote); }
                      else if (shareNoteEditing === t.name) setShareNoteEditing(null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingShare(t.name);
                          setEditShareValue(String((t as any).gross ?? t.total));
                        }}
                        className={cn(
                          'font-mono text-right hover:bg-muted/50 rounded px-1 -mx-1 cursor-pointer flex items-center justify-end gap-1',
                          sEffective === 'purple' && 'text-purple-600 dark:text-purple-400 font-semibold',
                        )}
                        title="Click to view note · double-click to edit share"
                      >
                        {sNote && <StickyNote className="h-3 w-3 text-purple-500 shrink-0" aria-label="Has note" />}
                        {fmt(t.net)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 space-y-3" align="end">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Note</div>
                        {sNote ? (
                          <div className="text-sm whitespace-pre-wrap rounded border border-border bg-muted/30 p-2">{sNote}</div>
                        ) : (
                          <div className="text-xs italic text-muted-foreground">No note yet.</div>
                        )}
                        <Textarea
                          value={shareNoteEditing === t.name ? shareNoteDraft : sNote}
                          onChange={(e) => { setShareNoteEditing(t.name); setShareNoteDraft(e.target.value); }}
                          placeholder="Add a note…"
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          {sNote && (
                            <Button variant="ghost" size="sm" onClick={() => {
                              const next = { ...shareNotes };
                              delete next[t.name];
                              saveShareNotes(next);
                              setShareNoteDraft('');
                              appendHistory(t.name, 'Cleared share note');
                            }}>Clear</Button>
                          )}
                          <Button size="sm" onClick={() => {
                            const next = { ...shareNotes };
                            const v = shareNoteDraft.trim();
                            const prev = shareNotes[t.name] || '';
                            if (v) next[t.name] = v; else delete next[t.name];
                            saveShareNotes(next);
                            if (v && v !== prev) appendHistory(t.name, prev ? 'Updated share note' : 'Added share note', v);
                            else if (!v && prev) appendHistory(t.name, 'Cleared share note');
                          }}>Save note</Button>
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Palette className="h-3 w-3" /> Value color
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant={sEffective === 'default' ? 'default' : 'outline'} size="sm" className="flex-1"
                            onClick={() => {
                              if (sEffective !== 'default') {
                                saveShareColors({ ...shareColors, [t.name]: 'default' });
                                appendHistory(t.name, 'Changed share color', 'Default');
                              }
                            }}>Default</Button>
                          <Button type="button" variant={sEffective === 'purple' ? 'default' : 'outline'} size="sm" className="flex-1"
                            onClick={() => {
                              if (sEffective !== 'purple') {
                                saveShareColors({ ...shareColors, [t.name]: 'purple' });
                                appendHistory(t.name, 'Changed share color', 'Purple');
                              }
                            }}>
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">Purple</span>
                          </Button>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="w-full"
                          onClick={() => { setEditingShare(t.name); setEditShareValue(String((t as any).gross ?? t.total)); }}>
                          Edit gross share (fee auto-deducted)
                        </Button>
                      </div>
                      <div className="border-t border-border pt-2 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <History className="h-3 w-3" /> Edit history
                        </div>
                        {(feeHistory[t.name]?.length ?? 0) === 0 ? (
                          <div className="text-xs italic text-muted-foreground">No edits yet.</div>
                        ) : (
                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                            {feeHistory[t.name].map((h, i) => (
                              <div key={i} className="text-xs border border-border rounded bg-muted/30 px-2 py-1">
                                <div className="flex justify-between gap-2">
                                  <span className="font-medium truncate">{h.action}</span>
                                  <span className="text-muted-foreground shrink-0">{new Date(h.at).toLocaleString()}</span>
                                </div>
                                {h.detail && <div className="text-muted-foreground truncate">{h.detail}</div>}
                                <div className="text-[10px] text-muted-foreground">by {h.actor}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>
      {netTotals.length > 0 && (
        <div className="grid grid-cols-[1fr_90px_110px] gap-2 px-3 py-2 bg-primary/10 border-t border-border">
          <span className="text-sm font-semibold flex items-center gap-2">
            Total
            <SourceTotalBadge officeScope={officeScope} field="__pshare" tableValue={grandTotal} />
          </span>
          <span className="font-mono text-right text-sm">{fmt(netTotals.reduce((s, t) => s + t.fee, 0))}</span>
          <span className="font-mono font-bold text-sm text-right">{fmt(grandTotal)}</span>
        </div>
      )}
    </div>
  );
}
