import { useAlignmentOptional } from '@/contexts/AlignmentContext';
import { cn, formatMoney as fmt } from '@/lib/utils';

interface Props {
  officeScope?: string;
  /** Either a label text (resolved via aliases) or an explicit source key like `__pshare` / `__fee:E-File Fee(s)`. */
  field: string;
  /** Current table value to compare against the source total. */
  tableValue: number;
  className?: string;
}

/**
 * Small "Source: $X" chip showing the matching SourceRowsPanel total for a
 * given field/table on the same office page. Tinted destructive when the
 * table value diverges from the source total by more than $0.01.
 */
export function SourceTotalBadge({ officeScope, field, tableValue, className }: Props) {
  const ctx = useAlignmentOptional();
  if (!ctx || !officeScope || !field) return null;
  // Explicit source key lookup first (e.g. "__fee:E-File Fee(s)" or "__pshare").
  let src = null as ReturnType<typeof ctx.getSourceTotalForField> | null;
  if (field.startsWith('__')) {
    const all = ctx.getSourceTotals(officeScope);
    src = all.find(s => s.key === field) || null;
  }
  if (!src) src = ctx.getSourceTotalForField(officeScope, field);
  if (!src) return null;
  const delta = tableValue - src.total;
  const mismatch = Math.abs(delta) > 0.01;
  return (
    <span
      title={mismatch ? `Source ${fmt(src.total)} · Δ ${delta >= 0 ? '+' : ''}${fmt(delta)}` : `Matches Source Rows`}
      className={cn(
        'inline-flex items-center text-[10px] font-mono tabular-nums border rounded px-1.5 py-0.5 whitespace-nowrap',
        mismatch
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/40 text-muted-foreground',
        className,
      )}
    >
      src {fmt(src.total)}
    </span>
  );
}