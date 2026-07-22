import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatMoney as fmt } from '@/lib/utils';
import {
  fetchReferralPayouts,
  fetchReferralOfficeMappings,
  type ReferralPayout,
  type ReferralOfficeMapping,
} from '@/services/referralPayouts';

interface Props {
  officeScope: string;
  onTotalChange?: (total: number) => void;
  onExportData?: (rows: { referrer: string; amount: number; status: string; date: string }[]) => void;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

export function ReferralPayoutsTable({ officeScope, onTotalChange, onExportData }: Props) {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<ReferralPayout[]>([]);
  const [mappings, setMappings] = useState<ReferralOfficeMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, m] = await Promise.all([fetchReferralPayouts(), fetchReferralOfficeMappings()]);
        if (!cancelled) { setPayouts(p); setMappings(m); }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load referral payouts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const officeByReferrer = useMemo(() => {
    const map: Record<string, string> = {};
    mappings.forEach(m => { map[norm(m.referrer_name)] = m.office_name; });
    return map;
  }, [mappings]);

  const rows = useMemo(
    () => payouts.filter(p => officeByReferrer[norm(p.referrerName)] === officeScope),
    [payouts, officeByReferrer, officeScope],
  );

  const total = useMemo(
    () => rows.filter(r => norm(r.status) === 'paid').reduce((s, r) => s + (r.amount || 0), 0),
    [rows],
  );

  useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);
  useEffect(() => {
    onExportData?.(rows.map(r => ({
      referrer: r.referrerName,
      amount: r.amount,
      status: r.status,
      date: r.date ? new Date(r.date).toLocaleDateString() : '',
    })));
  }, [rows, onExportData]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-xs text-destructive">
        Referral Payouts: {error}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden w-full">
      <div
        className="px-3 py-2 border-b border-border font-semibold text-sm"
        style={{ backgroundColor: 'hsl(25 90% 75%)' }}
      >
        Referral Payouts
      </div>
      <div className="grid grid-cols-[1fr_90px_100px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        <span>Referrer</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Status</span>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
            No referral payouts mapped to {officeScope || 'this office'}. Assign referrers to offices from the Referral Program page.
          </div>
        ) : (
          rows.map((r, idx) => (
            <div
              key={r.id}
              className={idx % 2 === 1 ? 'grid grid-cols-[1fr_90px_100px] gap-2 px-3 py-1.5 text-sm bg-muted/30' : 'grid grid-cols-[1fr_90px_100px] gap-2 px-3 py-1.5 text-sm'}
            >
              <span className="truncate">{r.referrerName || '(Unknown)'}</span>
              <span className="font-mono text-right">{fmt(r.amount)}</span>
              <span className="text-right capitalize text-muted-foreground">{r.status}</span>
            </div>
          ))
        )}
      </div>
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_90px_100px] gap-2 px-3 py-2 bg-primary/10 border-t border-border">
          <span className="text-sm font-semibold">Total Paid</span>
          <span className="font-mono font-bold text-sm text-right col-span-2">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
