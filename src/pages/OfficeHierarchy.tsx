import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { Building2, Loader2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Office {
  id: string;
  office_name: string;
  primary_efin: string;
  share_percent: number;
  parent_office: string;
  active: boolean;
}

interface TreeNode {
  office: Office;
  children: TreeNode[];
}

function normalize(s: string) {
  return s.replace(/\s+/g, '').toLowerCase();
}

function buildTree(offices: Office[]): TreeNode[] {
  const canonMap = new Map<string, string>();
  offices.forEach(o => canonMap.set(normalize(o.office_name), o.office_name));

  const childrenMap = new Map<string, TreeNode[]>();
  const roots: TreeNode[] = [];
  const sorted = [...offices].sort((a, b) => a.office_name.localeCompare(b.office_name));

  sorted.forEach(o => {
    const node: TreeNode = { office: o, children: [] };
    const rawParent = o.parent_office?.trim();
    const resolvedParent = rawParent ? canonMap.get(normalize(rawParent)) : undefined;
    const isSelfRef = resolvedParent === o.office_name;
    if (!resolvedParent || isSelfRef) {
      roots.push(node);
    } else {
      if (!childrenMap.has(resolvedParent)) childrenMap.set(resolvedParent, []);
      childrenMap.get(resolvedParent)!.push(node);
    }
  });

  function attach(nodes: TreeNode[]) {
    nodes.forEach(n => {
      n.children = childrenMap.get(n.office.office_name) || [];
      attach(n.children);
    });
  }
  attach(roots);
  return roots;
}

function countAll(node: TreeNode): number {
  let c = node.children.length;
  node.children.forEach(ch => (c += countAll(ch)));
  return c;
}

function nodeMatches(node: TreeNode, q: string): boolean {
  if (node.office.office_name.toLowerCase().includes(q)) return true;
  return node.children.some(c => nodeMatches(c, q));
}

/* ─── Org Card ─── */
function OrgCard({
  node,
  depth,
  search,
}: {
  node: TreeNode;
  depth: number;
  search: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const total = countAll(node);
  const matches = search ? node.office.office_name.toLowerCase().includes(search) : true;
  const childMatches = search ? nodeMatches(node, search) : true;
  if (search && !matches && !childMatches) return null;

  const isRoot = depth === 0;

  return (
    <div className="flex flex-col items-center min-w-0">
      {/* Card */}
      <div
        onClick={() => hasChildren && setExpanded(p => !p)}
        className={cn(
          'relative flex items-center gap-2 border rounded-lg px-3 py-2 shadow-sm transition-all whitespace-nowrap',
          hasChildren && 'cursor-pointer hover:shadow-md',
          isRoot
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border hover:border-primary/30',
          search && matches && 'ring-2 ring-primary/50',
        )}
      >
        <Building2 className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          isRoot ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )} />
        <span className={cn(
          'text-[13px]',
          isRoot ? 'font-bold' : hasChildren ? 'font-semibold text-foreground' : 'font-medium text-foreground/85'
        )}>
          {node.office.office_name}
        </span>
        {hasChildren && (
          expanded
            ? <ChevronDown className={cn('h-3 w-3', isRoot ? 'text-primary-foreground/50' : 'text-muted-foreground')} />
            : <ChevronRight className={cn('h-3 w-3', isRoot ? 'text-primary-foreground/50' : 'text-muted-foreground')} />
        )}
      </div>

      {hasChildren && !expanded && (
        <span className="text-[10px] text-muted-foreground mt-1">{total} {total === 1 ? 'office' : 'offices'}</span>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <ChildrenGroup node={node} depth={depth} search={search} />
      )}
    </div>
  );
}

/* ─── Children connector + layout ─── */
function ChildrenGroup({
  node,
  depth,
  search,
}: {
  node: TreeNode;
  depth: number;
  search: string;
}) {
  const filtered = node.children.filter(c => {
    if (!search) return true;
    return nodeMatches(c, search);
  });

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Vertical line from parent */}
      <div className="w-px h-5 bg-border" />

      {/* Horizontal bar + children */}
      <div className="relative">
        {/* Horizontal connector bar */}
        {filtered.length > 1 && (
          <div className="absolute top-0 left-0 right-0 flex">
            <div className="flex-1" />
            {/* The bar spans from the center of the first child to the center of the last */}
          </div>
        )}

        <div className="flex items-start gap-1">
          {filtered.map((child, idx) => (
            <div key={child.office.id} className="flex flex-col items-center relative">
              {/* Connector pieces */}
              {filtered.length > 1 && (
                <div className="relative w-full h-0">
                  {/* Horizontal segment */}
                  <div className={cn(
                    'absolute top-0 h-px bg-border',
                    idx === 0 ? 'left-1/2 right-0' :
                    idx === filtered.length - 1 ? 'left-0 right-1/2' :
                    'left-0 right-0'
                  )} />
                </div>
              )}
              {/* Vertical drop to card */}
              <div className="w-px h-5 bg-border" />
              <OrgCard node={child} depth={depth + 1} search={search} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function OfficeHierarchy() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('offices')
      .select('id, office_name, primary_efin, share_percent, parent_office, active');
    if (error) { console.error(error); return; }
    setOffices((data || []) as Office[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const roots = buildTree(offices);
  const q = search.toLowerCase();

  return (
    <div>
      <PageHeader title="Office Hierarchy" description="Organizational structure based on parent-child office relationships" />

      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading hierarchy…
        </div>
      ) : (
        <>
          <div className="mb-6 max-w-xs relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search offices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="bg-card border border-border rounded-xl p-8 overflow-x-auto">
            {roots.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No offices found.</p>
            ) : (
              <div className="inline-flex flex-col items-center min-w-full">
                {roots.map((node) => (
                  <div key={node.office.id} className="mb-6">
                    <OrgCard node={node} depth={0} search={q} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
