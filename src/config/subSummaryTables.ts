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

/**
 * Auto-inject built-in template fields into the saved "Totals" table when
 * missing, so new auto formulas (e.g. Total SB+ERO3+EFile) appear without
 * requiring every office to edit the table by hand.
 */
export function ensureTotalsTemplateFields(
  tables: SummaryTableConfig[],
): SummaryTableConfig[] {
  const REQUIRED = [
    { fieldId: "__auto_sb_ero3_efile__", label: "Total SB+ERO3+EFile" },
  ];
  return tables.map((t) => {
    if ((t.title || "").trim().toLowerCase() !== "totals") return t;
    const fields = [...(t.fields || [])];
    let changed = false;
    for (const req of REQUIRED) {
      const has = fields.some(
        (f) =>
          f.fieldId === req.fieldId ||
          (f.label || "").trim().toLowerCase() === req.label.toLowerCase(),
      );
      if (has) continue;
      if (fields.length > 0) {
        fields[fields.length - 1] = { ...fields[fields.length - 1], operator: "+" };
      }
      fields.push({
        id: `tpl_${req.fieldId}_${Date.now()}`,
        fieldId: req.fieldId,
        label: req.label,
        type: "field",
      });
      changed = true;
    }
    return changed ? { ...t, fields } : t;
  });
}