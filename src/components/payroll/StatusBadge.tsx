import { cn } from '@/lib/utils';

type StatusType =
  | 'Uploaded' | 'Validated' | 'Imported' | 'Needs Mapping'
  | 'Missing PTIN' | 'No Match' | 'Ready' | 'Advance Applied'
  | 'Calculated' | 'Distributed' | 'Sent' | 'Failed' | 'Archived'
  | 'Active' | 'Inactive' | 'Matched' | 'Unmatched' | 'Deducted'
  | 'Duplicate' | 'Pending' | 'Completed' | 'Paid' | 'Partial';

const statusStyles: Record<string, string> = {
  Ready: 'bg-status-positive-bg text-status-positive',
  Validated: 'bg-status-positive-bg text-status-positive',
  Sent: 'bg-status-positive-bg text-status-positive',
  Distributed: 'bg-status-positive-bg text-status-positive',
  Active: 'bg-status-positive-bg text-status-positive',
  Matched: 'bg-status-positive-bg text-status-positive',
  Deducted: 'bg-status-positive-bg text-status-positive',
  Completed: 'bg-status-positive-bg text-status-positive',
  Paid: 'bg-status-positive-bg text-status-positive',
  Failed: 'bg-status-negative-bg text-status-negative',
  'Missing PTIN': 'bg-status-negative-bg text-status-negative',
  'No Match': 'bg-status-negative-bg text-status-negative',
  Inactive: 'bg-status-negative-bg text-status-negative',
  Unmatched: 'bg-status-negative-bg text-status-negative',
  'Needs Mapping': 'bg-status-warning-bg text-status-warning',
  Pending: 'bg-status-warning-bg text-status-warning',
  'Advance Applied': 'bg-status-warning-bg text-status-warning',
  Partial: 'bg-status-warning-bg text-status-warning',
  Duplicate: 'bg-status-warning-bg text-status-warning',
  Imported: 'bg-status-info-bg text-status-info',
  Calculated: 'bg-status-info-bg text-status-info',
  Uploaded: 'bg-status-info-bg text-status-info',
  Archived: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status, className }: { status: StatusType | string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap',
      statusStyles[status] || 'bg-muted text-muted-foreground',
      className
    )}>
      {status}
    </span>
  );
}
