import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Clock, Calendar, Download, Loader2, ScanSearch } from 'lucide-react';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatMoney } from '@/lib/utils';
import { exportSectionsCsv } from '@/lib/exportReports';
import { fetchReferralPayouts, type ReferralPayout } from '@/services/referralPayouts';

const TABS = ['All', 'Pending', 'Processing', 'Paid'] as const;
type Tab = typeof TABS[number];

const titleCase = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function ReferralPayoutsView() {
  const [payouts, setPayouts] = useState<ReferralPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [detailPayout, setDetailPayout] = useState<ReferralPayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReferralPayouts();
        if (!cancelled) setPayouts(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load referral payouts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalPaid = useMemo(
    () => payouts.filter(p => p.status.toLowerCase() === 'paid').reduce((s, p) => s + (p.amount || 0), 0),
    [payouts],
  );
  const totalPending = useMemo(
    () => payouts.filter(p => p.status.toLowerCase() === 'pending').reduce((s, p) => s + (p.amount || 0), 0),
    [payouts],
  );
  const thisMonthCount = useMemo(() => payouts.filter(p => isThisMonth(p.date)).length, [payouts]);

  const filtered = useMemo(() => {
    return payouts.filter(p => {
      if (tab !== 'All' && p.status.toLowerCase() !== tab.toLowerCase()) return false;
      if (search && !p.referrerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [payouts, tab, search]);

  const columns: Column<ReferralPayout>[] = [
    { key: 'date', header: 'Date', render: (r) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'referrerName', header: 'Referrer' },
    { key: 'amount', header: 'Amount', mono: true, render: (r) => formatMoney(r.amount) },
    { key: 'method', header: 'Method' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={titleCase(r.status)} /> },
    {
      key: 'details', header: 'Details', className: 'text-right',
      render: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); setDetailPayout(r); }}
        >
          <ScanSearch className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleExport = () => {
    exportSectionsCsv(
      [{
        title: 'Referral Payouts',
        columns: ['Date', 'Referrer', 'Amount', 'Method', 'Status'],
        rows: filtered.map(p => [
          p.date ? new Date(p.date).toLocaleDateString() : '',
          p.referrerName,
          formatMoney(p.amount),
          p.method,
          p.status,
        ]),
      }],
      `referral-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-sm text-destructive">
        Failed to load referral payouts: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Payouts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{payouts.length} payout report{payouts.length === 1 ? '' : 's'}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={loading || filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Paid" value={formatMoney(totalPaid)} icon={DollarSign} />
        <KpiCard title="Pending" value={formatMoney(totalPending)} icon={Clock} />
        <KpiCard title="This Month" value={thisMonthCount} icon={Calendar} />
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by referrer..."
        className="max-w-sm h-9 bg-card"
      />

      <div className="flex gap-2">
        {TABS.map(t => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'default' : 'secondary'}
            className="h-8 rounded-full text-xs"
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No referral payouts found." />
      )}

      <Dialog open={!!detailPayout} onOpenChange={(o) => !o && setDetailPayout(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payout details</DialogTitle>
            <DialogDescription>Referrals included in this payout.</DialogDescription>
          </DialogHeader>
          {detailPayout && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Referrer</p>
                  <p className="text-sm font-semibold">{detailPayout.referrerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-sm font-semibold">{formatMoney(detailPayout.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="text-sm font-semibold">{detailPayout.method || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={titleCase(detailPayout.status)} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Included referrals ({detailPayout.referrals.length})
                </p>
                {detailPayout.referrals.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No referral detail available.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {detailPayout.referrals.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.name || '(Unknown)'}</p>
                          {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-mono">{formatMoney(r.amount)}</span>
                          <StatusBadge status={titleCase(r.status)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
