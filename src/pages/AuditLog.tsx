import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { FilterBar } from '@/components/payroll/FilterBar';
import { DataTable, Column } from '@/components/payroll/DataTable';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
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
  const [detailRow, setDetailRow] = useState<Row | null>(null);

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
    {
      key: 'view',
      header: '',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => { e.stopPropagation(); setDetailRow(r); }}
          aria-label="View full details"
          title="View full details"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ),
    },
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
        <DataTable columns={columns} data={filtered} onRowClick={(row) => setDetailRow(row)} />
      )}

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Details</DialogTitle>
            <DialogDescription>Full record of this change — who, what, and when.</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">When</span>
                <span className="text-right">{new Date(detailRow.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Who</span>
                <span className="font-medium text-right">{detailRow.actor}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Action</span>
                <StatusBadge status={actionStatus[detailRow.action] || detailRow.action} />
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Type</span>
                <span className="text-right">{detailRow.entity_type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Entity</span>
                <span className="text-right">{detailRow.entity_label || '—'}</span>
              </div>
              {detailRow.entity_id && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Entity ID</span>
                  <span className="font-mono text-xs text-right break-all">{detailRow.entity_id}</span>
                </div>
              )}
              <div className="border-t border-border pt-3">
                <p className="text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap leading-relaxed">{detailRow.summary || '—'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
