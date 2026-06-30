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