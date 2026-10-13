import type { SummaryTableConfig } from "@/components/office-summary/types";

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const ALLOWED_SUMMARY_TABLES: Record<string, string[]> = {
  "powerplay": ["Fees Due", "Totals", "Service Bureau Fee", "ERO3 by EFIN", "E-File by EFIN"],
  "d-and-d": ["Fees Due", "Totals", "Service Bureau Fee", "E-File by EFIN", "ERO3 by EFIN"],
  "main-event": ["Fees Due", "Totals", "E-File Fee(s)"],
  "s-and-c": ["Fees Due", "Totals", "ERO3 by EFIN", "E-File by EFIN"],
  "king-j": ["Fees Due", "Totals", "Service Bureau Split", "ERO3 by EFIN", "E-File by EFIN", "Downline Paychex Payroll"],
};

export function filterSummaryTablesForSub(
  slug: string,
  tables: SummaryTableConfig[],
): SummaryTableConfig[] {
  const allowed = ALLOWED_SUMMARY_TABLES[slug];
  if (!allowed) return tables;
  const byTitle = new Map<string, SummaryTableConfig>();
  for (const t of tables) {
    const k = norm(t.title);
    if (!byTitle.has(k)) byTitle.set(k, t);
  }
  const out: SummaryTableConfig[] = [];
  for (const name of allowed) {
    const found = byTitle.get(norm(name));
    if (found) out.push(found);
  }
  return out;
}
