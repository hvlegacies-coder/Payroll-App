import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ReactNode, useState, useRef, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index?: number) => ReactNode;
  className?: string;
  mono?: boolean;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({ columns, data, onRowClick, emptyMessage = 'No data available.' }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  }, []);

  const toggleHighlighted = useCallback((rowKey: string) => {
    setHighlightedKeys(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const sorted = sortKey && sortDir ? [...data].sort((a, b) => {
    const aVal = a[sortKey] ?? '';
    const bVal = b[sortKey] ?? '';
    const aDate = new Date(aVal);
    const bDate = new Date(bVal);
    if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
      return sortDir === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  }) : data;

  if (data.length === 0) {
    return (
      <div className="border border-border rounded-xl p-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 bg-surface-ash border-b border-border">
        {highlightedKeys.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs mr-1"
            onClick={() => setHighlightedKeys(new Set())}
          >
            <X className="h-3 w-3 mr-1" />
            Clear selection ({highlightedKeys.size})
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll('left')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll('right')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-auto max-h-[calc(100vh-220px)] relative" ref={scrollRef}>
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-surface-ash [&_tr]:border-b">
            <TableRow className="bg-surface-ash hover:bg-surface-ash">
              <TableHead className="sticky top-0 z-30 w-10 min-w-10 bg-surface-ash px-3" />
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'sticky top-0 z-30 text-xs font-medium text-muted-foreground whitespace-nowrap bg-surface-ash',
                    col.sortable && 'cursor-pointer select-none',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => {
              const rowKey = String(row.id ?? i);
              const isHighlighted = highlightedKeys.has(rowKey);
              return (
                <TableRow
                  key={rowKey}
                  onDoubleClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors cursor-pointer',
                    isHighlighted ? 'bg-primary/15 hover:bg-primary/20' : 'hover:bg-surface-ash',
                  )}
                >
                  <TableCell className={cn('px-3 py-2', isHighlighted && 'bg-primary/15')}>
                    <Checkbox
                      checked={isHighlighted}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={() => toggleHighlighted(rowKey)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(
                      'text-sm whitespace-nowrap',
                      col.mono && 'font-mono text-xs',
                      isHighlighted && 'bg-primary/15',
                      col.className,
                    )}>
                      {col.render ? col.render(row, i) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
