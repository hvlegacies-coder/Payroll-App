import { ProcessingLog } from './types';

export type WorkflowAction =
  | 'process_payroll'
  | 'process_backend'
  | 'fill_advance_requested'
  | 'remap_bucket'
  | 'remap_backend'
  | 'distribute_bucket'
  | 'reset_week'
  | 'email_reports'
  | 'archive_weekly';

export interface WorkflowStep {
  action: WorkflowAction;
  label: string;
  description: string;
  icon: string;
  destructive: boolean;
  requiresConfirmation: boolean;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { action: 'process_payroll', label: 'Process Payroll Reports', description: 'Parse uploaded payroll files, validate headers, map PTINs, and fill bucket rows', icon: 'FileText', destructive: false, requiresConfirmation: false },
  { action: 'process_backend', label: 'Process Backend Money', description: 'Import backend money reports and map to offices using lookup table', icon: 'DollarSign', destructive: false, requiresConfirmation: false },
  { action: 'fill_advance_requested', label: 'Fill Advance Requested', description: 'Match advance records to bucket rows and apply deductions', icon: 'Banknote', destructive: false, requiresConfirmation: true },
  { action: 'remap_bucket', label: 'Re-map Bucket Rows', description: 'Re-run PTIN/EFIN matching for all unmapped bucket rows', icon: 'RefreshCw', destructive: false, requiresConfirmation: false },
  { action: 'remap_backend', label: 'Re-map Backend Rows', description: 'Re-run PTIN/EFIN matching for all unmapped backend rows', icon: 'RefreshCw', destructive: false, requiresConfirmation: false },
  { action: 'distribute_bucket', label: 'Distribute to Offices', description: 'Route calculated bucket rows to office dashboards based on landing_tab / main_office', icon: 'Truck', destructive: true, requiresConfirmation: true },
  { action: 'email_reports', label: 'Email Reports to Owners', description: 'Generate and email office-specific reports to owner email addresses', icon: 'Mail', destructive: false, requiresConfirmation: true },
  { action: 'archive_weekly', label: 'Archive Weekly Snapshot', description: 'Save current week data to history and prepare for new week', icon: 'Archive', destructive: false, requiresConfirmation: true },
  { action: 'reset_week', label: 'Reset for New Week', description: 'Clear current bucket and backend rows, reset office reports. CANNOT BE UNDONE.', icon: 'RotateCcw', destructive: true, requiresConfirmation: true },
];

export function createProcessingLog(action: WorkflowAction, user: string): ProcessingLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: WORKFLOW_STEPS.find(s => s.action === action)?.label || action,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: '',
    user,
    rows_affected: 0,
    details: '',
    error_message: '',
  };
}

export function completeProcessingLog(log: ProcessingLog, rowsAffected: number, details: string): ProcessingLog {
  return { ...log, status: 'completed', completed_at: new Date().toISOString(), rows_affected: rowsAffected, details };
}

export function failProcessingLog(log: ProcessingLog, error: string): ProcessingLog {
  return { ...log, status: 'failed', completed_at: new Date().toISOString(), error_message: error };
}
