import { useState } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { FilterBar } from '@/components/payroll/FilterBar';
import { weeklyHistory } from '@/data/payrollData';
import type { WeeklyHistory } from '@/services/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Archive, Calendar, TrendingUp, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney } from '@/lib/utils';

const weeks = [...new Set(weeklyHistory.map(h => h.week_label))].sort();
const fmt = (n: number) => formatMoney(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const columns: Column<WeeklyHistory>[] = [
  { key: 'week_label', header: 'Week' }, { key: 'office_name', header: 'Office' },
  { key: 'total_received', header: 'Total Received', mono: true, render: r => fmt(r.total_received) },
  { key: 'total_fees', header: 'Total Fees', mono: true, render: r => fmt(r.total_fees) },
  { key: 'agi', header: 'AGI', mono: true, render: r => fmt(r.agi) },
  { key: 'backend_money', header: 'Backend', mono: true, render: r => fmt(r.backend_money) },
  { key: 'net_pay', header: 'Net Pay', mono: true, render: r => fmt(r.net_pay) },
];

export default function WeeklyHistoryPage() {
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = weeklyHistory.filter(h => { if (selectedWeek !== 'all' && h.week_label !== selectedWeek) return false; if (search) return h.office_name.toLowerCase().includes(search.toLowerCase()); return true; });
  const totalReceived = filtered.reduce((s, h) => s + h.total_received, 0);
  const totalNetPay = filtered.reduce((s, h) => s + h.net_pay, 0);
  const chartData = weeks.map(w => { const weekRows = weeklyHistory.filter(h => h.week_label === w); return { week: w, received: weekRows.reduce((s, r) => s + r.total_received, 0), netPay: weekRows.reduce((s, r) => s + r.net_pay, 0) }; });

  return (
    <div>
      <PageHeader title="Weekly History" description="Archive snapshots by week — office comparison and drilldown" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Archived Weeks" value={weeks.length} icon={Archive} />
        <KpiCard title="Total Records" value={weeklyHistory.length} icon={Calendar} />
        <KpiCard title="Total Received" value={fmt(totalReceived)} icon={TrendingUp} />
        <KpiCard title="Total Net Pay" value={fmt(totalNetPay)} icon={Building2} />
      </div>
      <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-6">
        <h3 className="text-sm font-medium mb-4">Weekly Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => [formatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), '']} />
            <Bar dataKey="received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Received" />
            <Bar dataKey="netPay" fill="hsl(var(--status-positive))" radius={[4, 4, 0, 0]} name="Net Pay" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Tabs value={selectedWeek} onValueChange={setSelectedWeek}>
        <TabsList className="mb-4 bg-surface-ash">
          <TabsTrigger value="all" className="text-xs">All Weeks</TabsTrigger>
          {weeks.map(w => <TabsTrigger key={w} value={w} className="text-xs">{w}</TabsTrigger>)}
        </TabsList>
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search offices..." />
        <DataTable columns={columns} data={filtered} emptyMessage="No history records found." />
      </Tabs>
    </div>
  );
}
