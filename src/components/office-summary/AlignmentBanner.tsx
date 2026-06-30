import { useAlignmentOptional } from '@/contexts/AlignmentContext';
import { formatMoney } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const fmt = (n: number) => (n < 0 ? `-${formatMoney(Math.abs(n))}` : formatMoney(n));

export function AlignmentBanner({ office }: { office: string }) {
  const ctx = useAlignmentOptional();
  if (!ctx || !office) return null;
  // Ignore SB Fees / Service Bureau divergences — known noisy field that
  // shouldn't trigger the alignment banner on every payroll run.
  const isIgnored = (label: string) => {
    const l = (label || '').toLowerCase();
    return l.includes('sb fee') || l.includes('service bureau');
  };
  const diffs = ctx.getDiffs(office).filter(d => !isIgnored(d.label));
  if (diffs.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <AlertTitle>
            Alignment mismatch — {diffs.length} field{diffs.length === 1 ? '' : 's'} diverge from Source Rows
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {diffs.map(d => (
                <li key={d.label} className="tabular-nums">
                  <span className="font-medium">{d.label}</span>
                  {' '}— Summary {fmt(d.summaryTotal)} vs Source {fmt(d.sourceTotal)}
                  {' '}(Δ {fmt(d.delta)})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs shrink-0"
          onClick={() => ctx.triggerRefresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Re-run
        </Button>
      </div>
    </Alert>
  );
}