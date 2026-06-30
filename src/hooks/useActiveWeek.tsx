import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PayrollWeek {
  id: string;
  label: string;
  start_date: string;
  is_active: boolean;
  funding_date_from?: string | null;
  funding_date_to?: string | null;
}

interface ActiveWeekContextValue {
  weeks: PayrollWeek[];
  selectedWeek: string; // label of week to view
  activeWeek: string;   // label of currently-active (newest) week, where new uploads go
  setSelectedWeek: (label: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  selectedWeekRange: { from: string | null; to: string | null } | null;
}

const ActiveWeekContext = createContext<ActiveWeekContextValue | null>(null);

const STORAGE_KEY = 'hvt_selected_week';

export function ActiveWeekProvider({ children }: { children: ReactNode }) {
  const [weeks, setWeeks] = useState<PayrollWeek[]>([]);
  const [selectedWeek, setSelectedWeekState] = useState<string>('');
  const [activeWeek, setActiveWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('payroll_weeks')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) {
      console.error('Failed to load payroll weeks', error);
      setLoading(false);
      return;
    }
    const list = (data || []) as PayrollWeek[];
    setWeeks(list);
    const active = list.find(w => w.is_active)?.label || list[0]?.label || '';
    setActiveWeek(active);
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored && list.some(w => w.label === stored) ? stored : active;
    setSelectedWeekState(initial);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setSelectedWeek = useCallback((label: string) => {
    setSelectedWeekState(label);
    localStorage.setItem(STORAGE_KEY, label);
  }, []);

  return (
    <ActiveWeekContext.Provider value={{
      weeks,
      selectedWeek,
      activeWeek,
      setSelectedWeek,
      refresh,
      loading,
      selectedWeekRange: (() => {
        const w = weeks.find(x => x.label === selectedWeek);
        if (!w) return null;
        if (!w.funding_date_from && !w.funding_date_to) return null;
        return { from: w.funding_date_from || null, to: w.funding_date_to || null };
      })(),
    }}>
      {children}
    </ActiveWeekContext.Provider>
  );
}

export function useActiveWeek() {
  const ctx = useContext(ActiveWeekContext);
  if (!ctx) throw new Error('useActiveWeek must be used within ActiveWeekProvider');
  return ctx;
}

/**
 * Helper: fetch upload IDs of a given type for the currently selected week.
 * Use this to filter upload_rows queries.
 */
export async function fetchUploadIdsForWeek(type: string, weekLabel: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('uploads')
    .select('id')
    .eq('type', type)
    .eq('week_label', weekLabel);
  if (error) {
    console.error('fetchUploadIdsForWeek error', error);
    return [];
  }
  return (data || []).map(r => r.id);
}
