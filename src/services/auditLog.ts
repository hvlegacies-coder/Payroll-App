import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string;
  summary?: string;
}

function getActor(): string {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem("hvt_user") || "anonymous";
}

function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hvt_account_id");
}

/**
 * Builds a human-readable "field: old → new" summary of what changed between
 * two snapshots of a record, for use as the `summary` passed to logAudit.
 * Only fields whose value actually differs are included.
 */
export function diffSummary<T extends object>(
  before: Partial<T>,
  after: Partial<T>,
  fields: { key: keyof T; label: string }[],
): string {
  const parts: string[] = [];
  for (const { key, label } of fields) {
    const oldVal = before[key];
    const newVal = after[key];
    const oldStr = Array.isArray(oldVal) ? oldVal.join(', ') : oldVal == null ? '' : String(oldVal);
    const newStr = Array.isArray(newVal) ? newVal.join(', ') : newVal == null ? '' : String(newVal);
    if (oldStr !== newStr) {
      parts.push(`${label} "${oldStr || '—'}" → "${newStr || '—'}"`);
    }
  }
  return parts.join('; ');
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await (supabase as any).from("audit_log").insert({
      actor: getActor(),
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? "",
      entity_label: entry.entityLabel ?? "",
      summary: entry.summary ?? "",
      account_id: getActiveAccountId(),
    });
  } catch (e) {
    // Non-fatal — never break the user action because audit failed
    console.warn("[audit] failed to log entry", e);
  }
}