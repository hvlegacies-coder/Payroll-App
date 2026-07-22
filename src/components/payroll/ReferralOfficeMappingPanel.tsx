import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  fetchReferralPayouts,
  fetchReferralOfficeMappings,
  upsertReferralOfficeMapping,
  type ReferralPayout,
  type ReferralOfficeMapping,
} from '@/services/referralPayouts';

const UNASSIGNED = '__unassigned__';
const norm = (s: string) => (s || '').trim().toLowerCase();

export function ReferralOfficeMappingPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<ReferralPayout[]>([]);
  const [mappings, setMappings] = useState<ReferralOfficeMapping[]>([]);
  const [officeNames, setOfficeNames] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, officesRes] = await Promise.all([
        fetchReferralPayouts(),
        fetchReferralOfficeMappings(),
        supabase.from('offices').select('office_name').eq('active', true).order('office_name'),
      ]);
      setPayouts(p);
      setMappings(m);
      setOfficeNames((officesRes.data ?? []).map(o => o.office_name));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load referral data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const mappingByReferrer = useMemo(() => {
    const map: Record<string, ReferralOfficeMapping> = {};
    mappings.forEach(m => { map[norm(m.referrer_name)] = m; });
    return map;
  }, [mappings]);

  const referrers = useMemo(() => {
    const seen = new Map<string, { name: string; email: string }>();
    payouts.forEach(p => {
      if (!p.referrerName) return;
      const key = norm(p.referrerName);
      if (!seen.has(key)) seen.set(key, { name: p.referrerName, email: p.referrerEmail });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [payouts]);

  const handleAssign = async (referrerName: string, referrerEmail: string, officeName: string) => {
    setSavingKey(referrerName);
    try {
      await upsertReferralOfficeMapping(referrerName, officeName, referrerEmail);
      await load();
      toast({ title: 'Saved', description: `${referrerName} → ${officeName}` });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-xs text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Referrer → Office Mapping</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assign each referrer to a payroll office so their payout totals show up in that office's Office Summary.
        </p>
      </div>
      <div className="divide-y divide-border">
        {referrers.length === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground italic">
            No referrers found yet — they'll appear here once the referral app has payout data.
          </div>
        ) : (
          referrers.map(r => {
            const current = mappingByReferrer[norm(r.name)]?.office_name ?? '';
            return (
              <div key={r.name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm truncate">{r.name}</div>
                  {r.email && <div className="text-xs text-muted-foreground truncate">{r.email}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {savingKey === r.name && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Select
                    value={current || UNASSIGNED}
                    onValueChange={(val) => {
                      if (val === UNASSIGNED) return;
                      handleAssign(r.name, r.email, val);
                    }}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Assign office…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED} disabled>Unassigned</SelectItem>
                      {officeNames.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
