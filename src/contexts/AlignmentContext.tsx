import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SourceTotal { key: string; label: string; total: number; }
export interface TableTotal { id: string; title: string; total: number; }
export interface AlignmentDiff {
  label: string;
  sourceTotal: number;
  summaryTotal: number;
  delta: number;
  summaryTitle: string;
}

interface Ctx {
  refreshTick: number;
  triggerRefresh: () => void;
  reportSourceTotals: (office: string, totals: SourceTotal[]) => void;
  reportTableTotal: (office: string, id: string, title: string, total: number) => void;
  getDiffs: (office: string) => AlignmentDiff[];
  getSourceTotals: (office: string) => SourceTotal[];
  getSourceTotalForField: (office: string, fieldText: string) => SourceTotal | null;
}

const AlignmentContext = createContext<Ctx | null>(null);

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Map a Source-Rows money-column key to accepted normalized title fragments
// that a user-defined summary table might use for the same field.
const FIELD_ALIASES: Record<string, string[]> = {
  __received: ['receivedtaxprepfees', 'receivedtaxprep', 'received'],
  __pay: ['paytotalfrontendmoney', 'pay', 'totalfrontendmoney', 'frontendmoney'],
  'highprepfee': ['highprepfee', 'highprep'],
  __pshare: ['preparershare', 'preparersshare', 'preparersshare'],
  '__fee:e-filefee(s)': ['efilefees', 'efile'],
  '__fee:servicebureaufee': ['servicebureaufee', 'servicebureau'],
  '__fee:ero3fee': ['ero3fee', 'ero3'],
  '__fee:transmitterfee': ['transmitterfee', 'transmitter'],
  '__fee:e-file-efin': ['efileefin', 'efileefintile'],
  '__fee:ero3-efin': ['ero3efin', 'ero3efintile'],
};

function aliasesForSourceKey(key: string): string[] {
  const k = norm(key);
  for (const [bucket, list] of Object.entries(FIELD_ALIASES)) {
    if (norm(bucket) === k) return list;
  }
  return [k];
}

export function AlignmentProvider({ children }: { children: ReactNode }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [sourceMap, setSourceMap] = useState<Record<string, SourceTotal[]>>({});
  const [tableMap, setTableMap] = useState<Record<string, Record<string, TableTotal>>>({});
  const lastNotifiedSig = useRef<Record<string, string>>({});

  const reportSourceTotals = useCallback((office: string, totals: SourceTotal[]) => {
    if (!office) return;
    setSourceMap(prev => {
      const cur = prev[office] || [];
      if (
        cur.length === totals.length &&
        cur.every((t, i) => t.key === totals[i].key && t.total === totals[i].total)
      ) return prev;
      return { ...prev, [office]: totals };
    });
  }, []);

  const reportTableTotal = useCallback((office: string, id: string, title: string, total: number) => {
    if (!office) return;
    setTableMap(prev => {
      const cur = prev[office] || {};
      const existing = cur[id];
      if (existing && existing.title === title && existing.total === total) return prev;
      return { ...prev, [office]: { ...cur, [id]: { id, title, total } } };
    });
  }, []);

  const computeDiffs = useCallback((office: string): AlignmentDiff[] => {
    const srcs = sourceMap[office] || [];
    const tables = Object.values(tableMap[office] || {});
    const diffs: AlignmentDiff[] = [];
    for (const s of srcs) {
      const aliases = aliasesForSourceKey(s.key);
      const match = tables.find(t => {
        const nt = norm(t.title);
        if (!nt) return false;
        return aliases.some(a => nt === a || nt.includes(a) || a.includes(nt));
      });
      if (!match) continue;
      const delta = match.total - s.total;
      if (Math.abs(delta) > 0.01) {
        diffs.push({
          label: s.label,
          sourceTotal: s.total,
          summaryTotal: match.total,
          delta,
          summaryTitle: match.title,
        });
      }
    }
    return diffs;
  }, [sourceMap, tableMap]);

  const getDiffs = useCallback((o: string) => computeDiffs(o), [computeDiffs]);
  const getSourceTotals = useCallback((o: string) => sourceMap[o] || [], [sourceMap]);
  const getSourceTotalForField = useCallback((office: string, fieldText: string): SourceTotal | null => {
    const srcs = sourceMap[office] || [];
    if (srcs.length === 0 || !fieldText) return null;
    const nf = norm(fieldText);
    if (!nf) return null;
    // Try direct match on source label, then alias-bucket lookup.
    for (const s of srcs) {
      if (norm(s.label) === nf) return s;
    }
    for (const s of srcs) {
      const aliases = aliasesForSourceKey(s.key);
      if (aliases.some(a => nf === a || nf.includes(a) || a.includes(nf))) return s;
    }
    return null;
  }, [sourceMap]);
  const triggerRefresh = useCallback(() => setRefreshTick(t => t + 1), []);

  // Realtime: any change to uploads bumps a tick so panels refetch.
  useEffect(() => {
    const ch = supabase
      .channel('alignment-uploads-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'uploads' },
        () => setRefreshTick(t => t + 1),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Persist a notification when divergences appear (debounced, deduped).
  useEffect(() => {
    const t = setTimeout(async () => {
      for (const office of Object.keys(sourceMap)) {
        // Ignore SB Fees / Service Bureau — known noisy field, suppress notifications.
        const diffs = computeDiffs(office).filter(d => {
          const l = (d.label || '').toLowerCase();
          return !l.includes('sb fee') && !l.includes('service bureau');
        });
        const sig = diffs
          .map(d => `${norm(d.label)}:${d.delta.toFixed(2)}`)
          .sort()
          .join('|');
        if (!sig) continue;
        if (lastNotifiedSig.current[office] === sig) continue;
        lastNotifiedSig.current[office] = sig;
        try {
          await supabase.from('notifications').insert({
            type: 'warning',
            title: `Alignment mismatch — ${office}`,
            description: `${diffs.length} field(s) diverge from Source Rows`,
            metadata: { office, diffs } as any,
          });
        } catch {
          // best-effort; ignore failures
        }
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [sourceMap, tableMap, computeDiffs]);

  return (
    <AlignmentContext.Provider
      value={{
        refreshTick,
        triggerRefresh,
        reportSourceTotals,
        reportTableTotal,
        getDiffs,
        getSourceTotals,
        getSourceTotalForField,
      }}
    >
      {children}
    </AlignmentContext.Provider>
  );
}

export function useAlignment() {
  const ctx = useContext(AlignmentContext);
  if (!ctx) throw new Error('useAlignment must be used within AlignmentProvider');
  return ctx;
}

export function useAlignmentOptional() {
  return useContext(AlignmentContext);
}