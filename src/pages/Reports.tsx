import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { FilterBar } from '@/components/payroll/FilterBar';
import { weeklyPayrollTrend } from '@/data/mockData';
import { DollarSign, Users, Banknote, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/utils';

const officeSummary = [
  { office: 'Higher View', payroll: 18200, payout: 12450, advances: 800, fees: 450 },
  { office: 'PowerPlay', payroll: 15800, payout: 10920, advances: 1200, fees: 600 },
  { office: 'Main Event', payroll: 12400, payout: 9870, advances: 500, fees: 350 },
  { office: 'S & C', payroll: 10600, payout: 8340, advances: 1300, fees: 500 },
  { office: 'King J HQ', payroll: 22800, payout: 18920, advances: 750, fees: 400 },
  { office: 'D & D', payroll: 5200, payout: 4200, advances: 250, fees: 100 },
];

export default function Reports() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => officeSummary.filter((r) => r.office.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  const totals = useMemo(
    () => filtered.reduce(
      (a, r) => ({
        payroll: a.payroll + r.payroll,
        payout: a.payout + r.payout,
        advances: a.advances + r.advances,
        fees: a.fees + r.fees,
      }),
      { payroll: 0, payout: 0, advances: 0, fees: 0 },
    ),
    [filtered],
  );

  const kpis = [
    { title: 'Total Payroll', value: formatMoney(totals.payroll, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: DollarSign },
    { title: 'Total Payout', value: formatMoney(totals.payout, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Users },
    { title: 'Advance Deductions', value: formatMoney(totals.advances, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Banknote },
    { title: 'Fee Intercepts', value: formatMoney(totals.fees, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Shield },
  ];

  const handleExport = () => {
    const headers = ['Office', 'Payroll', 'Payout', 'Advances', 'Fees'];
    const rows = filtered.map((r) => [r.office, r.payroll, r.payout, r.advances, r.fees]);
    const parts: string[] = [
      'Office Summary',
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ];
    if (weeklyPayrollTrend.length > 0) {
      const trendHeaders = ['Week', 'Total', 'Payout', 'Advances'];
      const trendRows = weeklyPayrollTrend.map((w: any) => [w.week, w.total ?? '', w.payout ?? '', w.advances ?? '']);
      parts.push('', 'Weekly Payroll Trend', trendHeaders.join(','), ...trendRows.map((r) => r.join(',')));
    }
    const csv = parts.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Reports exported');
  };

  return (
    <div>
      <PageHeader title="Reports" description="Executive reporting and analytics" actions={<Button className="gap-2" onClick={handleExport}><Download className="h-4 w-4" /> Export All Reports</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search reports..." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{kpis.map(k => <KpiCard key={k.title} {...k} />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-medium mb-4">Payroll Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyPayrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), '']} />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} name="Total" />
              <Area type="monotone" dataKey="payout" stroke="hsl(var(--status-positive))" fill="hsl(var(--status-positive) / 0.1)" strokeWidth={2} name="Payout" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-medium mb-4">Advance Deductions by Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyPayrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), '']} />
              <Bar dataKey="advances" fill="hsl(var(--status-warning))" radius={[4, 4, 0, 0]} name="Advances" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-5 shadow-card">
        <h3 className="text-sm font-medium mb-4">Weekly Office Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 text-xs font-medium text-muted-foreground">Office</th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">Payroll</th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">Payout</th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">Advances</th>
              <th className="text-right py-2 text-xs font-medium text-muted-foreground">Fees</th>
            </tr></thead>
            <tbody>{filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No offices match your search.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.office} className="border-b border-border last:border-0">
                <td className="py-2 font-medium">{row.office}</td>
                <td className="py-2 text-right font-mono">${row.payroll.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">${row.payout.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">${row.advances.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">${row.fees.toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
