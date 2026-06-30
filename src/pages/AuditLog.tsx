import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface Row {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  summary: string;
  created_at: string;
}

const actionStatus: Record<string, string> = { create: 'Active', update: 'Calculated', delete: 'Failed' };

export default function AuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState<string>('all');
  const [entityType, setEntityType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actor))).sort(), [rows]);
  const entityTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.entity_type))).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (actor !== 'all' && r.actor !== actor) return false;
    if (entityType !== 'all' && r.entity_type !== entityType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${r.actor} ${r.action} ${r.entity_label} ${r.summary} ${r.entity_type}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const columns: Column<Row>[] = [
    { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'actor', header: 'Who' },
    { key: 'action', header: 'Action', render: (r) => <StatusBadge status={actionStatus[r.action] || r.action} /> },
    { key: 'entity_type', header: 'Type' },
    { key: 'entity_label', header: 'Entity', render: (r) => r.entity_label || <span className="text-muted-foreground">—</span> },
    { key: 'summary', header: 'Summary', className: 'max-w-[420px] truncate' },
  ];

  return (
    <div>
      <PageHeader title="Change History" description="Every change made in the system: who, what, and when" />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search history..." />
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            {entityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground p-6">Loading change history…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6">No history yet.</p>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
