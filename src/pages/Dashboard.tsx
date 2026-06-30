import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { StatusBadge } from '@/components/payroll/StatusBadge';
import { bucketRows, backendRows, advanceMaster, clientData, rawImports, processingLogs, feeIntercepts, preparerLookups } from '@/data/payrollData';
import { WORKFLOW_STEPS, WorkflowAction } from '@/services/workflowEngine';
import { ALL_OFFICES } from '@/services/types';
import { buildOfficeReport } from '@/services/calculationEngine';
import { DollarSign, Users, Building2, AlertTriangle, Banknote, Shield, Mail, Copy, Upload, FileText, Activity, Archive, RefreshCw, Truck, RotateCcw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatMoney } from '@/lib/utils';

const iconMap: Record<string, any> = {
  FileText, DollarSign, Banknote, RefreshCw, Truck, Mail, Archive, RotateCcw, Shield,
};

const weeklyTrend = [
  { week: 'W5', total: 42500, payout: 28900 },
  { week: 'W6', total: 48200, payout: 33100 },
  { week: 'W7', total: 51800, payout: 35600 },
  { week: 'W8', total: 55300, payout: 38200 },
  { week: 'W9', total: 61200, payout: 42800 },
  { week: 'W10', total: 67800, payout: 47300 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<WorkflowAction | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const totalReceived = bucketRows.reduce((s, r) => s + r.received_tax_prep_fees, 0);
  const totalPayout = bucketRows.reduce((s, r) => s + r.pay, 0);
  const unresolvedRows = bucketRows.filter(r => ['ptin_not_found', 'no_match', 'missing_office'].includes(r.status)).length;
  const totalAdvances = advanceMaster.reduce((s, a) => s + a.advance_amount, 0);
  const totalFeeIntercept = feeIntercepts.reduce((s, v) => s + v.intercept_amount, 0);
  const officesProcessed = new Set(bucketRows.filter(r => r.status === 'distributed' || r.status === 'calculated').map(r => r.tax_office)).size;

  const kpis = [
    { title: 'Total Payroll This Week', value: formatMoney(totalReceived, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: DollarSign, trend: { value: 10.8, label: 'vs last week' } },
    { title: 'Total Preparer Payout', value: formatMoney(totalPayout, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Users, trend: { value: 10.5, label: 'vs last week' } },
    { title: 'Offices Processed', value: `${officesProcessed} / ${ALL_OFFICES.length}`, icon: Building2 },
    { title: 'Unresolved Rows', value: unresolvedRows, icon: AlertTriangle },
    { title: 'Advances Total', value: formatMoney(totalAdvances, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Banknote },
    { title: 'Fee Intercept Total', value: formatMoney(totalFeeIntercept, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Shield },
    { title: 'Imports This Week', value: rawImports.length, icon: Upload },
    { title: 'Duplicate Clients', value: clientData.filter(c => c.duplicate_marker).length, icon: Copy },
  ];

  const exceptions = bucketRows.filter(r => ['ptin_not_found', 'no_match', 'missing_office'].includes(r.status));

  const payoutByOffice = ALL_OFFICES.map(o => ({
    office: o.length > 10 ? o.slice(0, 8) + '…' : o,
    payout: bucketRows.filter(r => r.tax_office === o).reduce((s, r) => s + r.pay, 0),
  })).filter(o => o.payout > 0).sort((a, b) => b.payout - a.payout);

  const handleRunAction = (action: WorkflowAction) => {
    const step = WORKFLOW_STEPS.find(s => s.action === action);
    if (step?.requiresConfirmation) {
      setConfirmAction(action);
    } else {
      simulateRun(action);
    }
  };

  const simulateRun = (action: WorkflowAction) => {
    setConfirmAction(null);
    setRunningAction(action);
    setTimeout(() => setRunningAction(null), 2000);
  };

  const confirmStep = WORKFLOW_STEPS.find(s => s.action === confirmAction);

  return (
    <div>
      <PageHeader title="Control Center" description="Payroll operations overview — Week 10, 2024" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
      </div>
      <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-6">
        <h3 className="text-sm font-medium mb-4">Workflow Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKFLOW_STEPS.map(step => {
            const Icon = iconMap[step.icon] || Activity;
            const isRunning = runningAction === step.action;
            return (
              <button key={step.action} onClick={() => handleRunAction(step.action)} disabled={isRunning}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${step.destructive ? 'border-status-negative/20 hover:bg-status-negative-bg' : 'border-border hover:bg-surface-ash'} ${isRunning ? 'opacity-60' : ''}`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${step.destructive ? 'bg-status-negative-bg' : 'bg-primary/10'}`}>
                  <Icon className={`h-4 w-4 ${step.destructive ? 'text-status-negative' : 'text-primary'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{isRunning ? 'Running...' : step.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-medium mb-4">Weekly Payroll Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), '']} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Total" />
              <Line type="monotone" dataKey="payout" stroke="hsl(var(--status-positive))" strokeWidth={2} dot={{ r: 3 }} name="Payout" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-medium mb-4">Payout by Office</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={payoutByOffice}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="office" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(value: number) => [formatMoney(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), 'Payout']} />
              <Bar dataKey="payout" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-medium mb-4">Action Needed ({exceptions.length} items)</h3>
          <div className="space-y-2">
            {exceptions.map(row => (
              <div key={row.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-ash">
                <div className="flex items-center gap-3">
                  <StatusBadge status={row.status === 'ptin_not_found' ? 'Missing PTIN' : row.status === 'no_match' ? 'No Match' : 'Needs Mapping'} />
                  <span className="text-sm font-medium">{row.taxpayer_first_name} {row.taxpayer_last_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">•••{row.taxpayer_ssn_last4}</span>
                </div>
                <span className="text-xs text-muted-foreground">{row.notes || row.status}</span>
              </div>
            ))}
            {exceptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No exceptions — all rows resolved.</p>}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h3 className="text-sm font-medium mb-4">Recent Processing</h3>
          <div className="space-y-2">
            {processingLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium truncate max-w-[180px]">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.started_at}</p>
                </div>
                <StatusBadge status={log.status === 'completed' ? 'Completed' : log.status === 'failed' ? 'Failed' : 'Active'} />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => navigate('/processing-logs')}>View All Logs</Button>
        </div>
      </div>
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmStep?.label}</DialogTitle>
            <DialogDescription>{confirmStep?.description}</DialogDescription>
          </DialogHeader>
          {confirmStep?.destructive && (
            <div className="bg-status-negative-bg border border-status-negative/20 rounded-lg p-3">
              <p className="text-sm text-status-negative font-medium">⚠ This action may modify or clear data. Proceed with caution.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant={confirmStep?.destructive ? 'destructive' : 'default'} onClick={() => simulateRun(confirmAction!)}>Confirm & Run</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
