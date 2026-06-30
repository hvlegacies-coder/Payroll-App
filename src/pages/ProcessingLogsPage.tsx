import { useState } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { FilterBar } from '@/components/payroll/FilterBar';
import { processingLogs } from '@/data/payrollData';
import type { ProcessingLog } from '@/services/types';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusMap: Record<string, string> = { completed: 'Completed', failed: 'Failed', running: 'Active', cancelled: 'Inactive' };
const columns: Column<ProcessingLog>[] = [
  { key: 'action', header: 'Action' },
  { key: 'status', header: 'Status', render: r => <StatusBadge status={statusMap[r.status] || r.status} /> },
  { key: 'user', header: 'User' }, { key: 'started_at', header: 'Started' }, { key: 'completed_at', header: 'Completed' },
  { key: 'rows_affected', header: 'Rows', mono: true },
  { key: 'details', header: 'Details', className: 'max-w-[300px] truncate' },
  { key: 'error_message', header: 'Error', render: r => r.error_message ? <span className="text-xs text-status-negative">{r.error_message}</span> : '—' },
];

export default function ProcessingLogsPage() {
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const filtered = processingLogs.filter(l => { if (tab === 'Completed' && l.status !== 'completed') return false; if (tab === 'Failed' && l.status !== 'failed') return false; if (search) return l.action.toLowerCase().includes(search.toLowerCase()) || l.details.toLowerCase().includes(search.toLowerCase()); return true; });

  return (
    <div>
      <PageHeader title="Processing Logs" description="Each workflow run and its outcome" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Runs" value={processingLogs.length} icon={Activity} />
        <KpiCard title="Completed" value={processingLogs.filter(l => l.status === 'completed').length} icon={CheckCircle} />
        <KpiCard title="Failed" value={processingLogs.filter(l => l.status === 'failed').length} icon={XCircle} />
        <KpiCard title="Total Rows Affected" value={processingLogs.reduce((s, l) => s + l.rows_affected, 0)} icon={Clock} />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-surface-ash">{['All', 'Completed', 'Failed'].map(t => <TabsTrigger key={t} value={t} className="text-xs">{t}</TabsTrigger>)}</TabsList>
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search logs..." />
        <DataTable columns={columns} data={filtered} emptyMessage="No processing logs found." />
      </Tabs>
    </div>
  );
}
