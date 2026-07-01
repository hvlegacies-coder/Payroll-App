import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Loader2, CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronDown, ChevronRight, ArrowRight, RefreshCw,
} from 'lucide-react';
import { runPayrollVerification, type VerificationReport, type VerificationCheck } from '@/services/payrollVerification';

// ── Check Card ───────────────────────────────────────────────────────────────

function CheckCard({ check }: { check: VerificationCheck }) {
  const [expanded, setExpanded] = useState(false);

  const iconMap = {
    pass:  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />,
    warn:  <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />,
    fail:  check.severity === 'error'
             ? <XCircle className="h-5 w-5 text-destructive shrink-0" />
             : <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />,
    skip:  <Info className="h-5 w-5 text-muted-foreground shrink-0" />,
  };

  const borderMap = {
    pass: 'border-border',
    warn: 'border-yellow-400/40',
    fail: check.severity === 'error' ? 'border-destructive/40' : 'border-yellow-400/40',
    skip: 'border-border',
  };

  const bgMap = {
    pass: '',
    warn: 'bg-yellow-50/30 dark:bg-yellow-900/10',
    fail: check.severity === 'error' ? 'bg-destructive/5' : 'bg-yellow-50/30 dark:bg-yellow-900/10',
    skip: 'bg-muted/20',
  };

  return (
    <div className={`rounded-lg border ${borderMap[check.status]} ${bgMap[check.status]} p-4 space-y-2`}>
      <div className="flex items-start gap-3">
        {iconMap[check.status]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold leading-tight">{check.title}</span>
            {check.affectedCount > 0 && (
              <Badge
                variant={check.severity === 'error' ? 'destructive' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {check.affectedCount} affected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{check.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {check.fixPath && check.fixLabel && (
            <Link to={check.fixPath}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                {check.fixLabel}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
          {check.details.length > 0 && (
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && check.details.length > 0 && (
        <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-border pl-3 max-h-48 overflow-y-auto">
          {check.details.map((d, i) => (
            <p key={i} className="text-[11px] font-mono text-muted-foreground leading-relaxed">{d}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category Section ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  uploads: 'File Uploads',
  preparer_matching: 'Preparer Matching',
  data_quality: 'Data Quality',
};

function CategorySection({ category, checks }: { category: string; checks: VerificationCheck[] }) {
  const issues = checks.filter(c => c.status === 'fail' || c.status === 'warn');
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABELS[category] ?? category}
        </h4>
        {issues.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{issues.length} issue{issues.length > 1 ? 's' : ''}</Badge>
        )}
      </div>
      <div className="space-y-2">
        {checks.map(c => <CheckCard key={c.id} check={c} />)}
      </div>
    </div>
  );
}

// ── Verification Panel ────────────────────────────────────────────────────────

interface Props {
  weekLabel: string | null;
}

export function VerificationPanel({ weekLabel }: Props) {
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const runVerification = async () => {
    if (!weekLabel) return;
    setRunning(true);
    setRunError(null);
    try {
      const result = await runPayrollVerification(weekLabel);
      setReport(result);
    } catch (err: any) {
      setRunError(err?.message ?? 'Verification failed unexpectedly.');
    } finally {
      setRunning(false);
    }
  };

  if (!weekLabel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No payroll week selected.</p>
        <p className="text-xs text-muted-foreground">Select an active payroll week in Settings to run verification.</p>
      </div>
    );
  }

  // Group checks by category (in display order)
  const categories = ['uploads', 'preparer_matching', 'data_quality'];
  const grouped = categories.map(cat => ({
    category: cat,
    checks: (report?.checks ?? []).filter(c => c.category === cat),
  }));

  const hasErrors = (report?.errorCount ?? 0) > 0;
  const hasWarnings = (report?.warningCount ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Pre-Payroll Verification
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scanning week: <span className="font-medium">{weekLabel}</span>
          </p>
        </div>
        <Button
          onClick={runVerification}
          disabled={running}
          size="sm"
          className="gap-1.5 shrink-0"
          variant={report ? 'outline' : 'default'}
        >
          {running
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
            : report
              ? <><RefreshCw className="h-3.5 w-3.5" /> Re-Run</>
              : <><ShieldCheck className="h-3.5 w-3.5" /> Run Verification</>
          }
        </Button>
      </div>

      {/* Initial prompt */}
      {!report && !running && !runError && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-dashed border-border rounded-xl bg-muted/20">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Ready to verify</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Run Verification" to scan uploads, preparers, and data quality before running payroll.
            </p>
          </div>
        </div>
      )}

      {/* Running state */}
      {running && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Scanning payroll data…</p>
          <p className="text-xs text-muted-foreground">Checking uploads, preparer mappings, and data quality.</p>
        </div>
      )}

      {/* Error */}
      {runError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Verification failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">{runError}</p>
          </div>
        </div>
      )}

      {/* Report */}
      {report && !running && (
        <>
          {/* Status banner */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            hasErrors
              ? 'border-destructive/40 bg-destructive/5'
              : hasWarnings
                ? 'border-yellow-400/40 bg-yellow-50/30 dark:bg-yellow-900/10'
                : 'border-green-500/30 bg-green-50/30 dark:bg-green-900/10'
          }`}>
            {hasErrors
              ? <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              : hasWarnings
                ? <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                : <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {hasErrors
                  ? `${report.errorCount} error${report.errorCount > 1 ? 's' : ''} found — fix before running payroll`
                  : hasWarnings
                    ? `${report.warningCount} warning${report.warningCount > 1 ? 's' : ''} — review before running payroll`
                    : 'All checks passed — ready to run payroll'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {report.totalRows > 0 && `${report.totalRows.toLocaleString()} payroll rows scanned · `}
                Verified at {report.ranAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>

            {/* KPI badges */}
            <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
              {report.errorCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {report.errorCount} Error{report.errorCount > 1 ? 's' : ''}
                </Badge>
              )}
              {report.warningCount > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  {report.warningCount} Warning{report.warningCount > 1 ? 's' : ''}
                </Badge>
              )}
              {!hasErrors && !hasWarnings && (
                <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  All Clear
                </Badge>
              )}
            </div>
          </div>

          {/* Check categories */}
          <div className="space-y-6">
            {grouped.map(({ category, checks }) =>
              checks.length > 0 ? (
                <CategorySection key={category} category={category} checks={checks} />
              ) : null
            )}
          </div>
        </>
      )}
    </div>
  );
}
