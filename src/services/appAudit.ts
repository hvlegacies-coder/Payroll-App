import { supabase } from "@/integrations/supabase/client";
import { toNum } from "@/lib/num";
import { fetchAllRows } from "@/services/payrollRowProcessor";
import { runPayrollVerification } from "@/services/payrollVerification";
import { getSubAccountOffices, rowMatchesSubAccount } from "@/config/subAccountOffices";

export type AuditStatus = "pass" | "fail" | "warn";

export interface AuditResult {
  name: string;
  status: AuditStatus;
  expected: string;
  actual: string;
  detail?: string;
}

const failed = (name: string, e: any, status: AuditStatus = "fail"): AuditResult => ({
  name,
  status,
  expected: "query succeeds",
  actual: e?.message ?? "query failed",
});

// ── Database integrity ───────────────────────────────────────────────────────

export async function runIntegrityChecks(): Promise<AuditResult[]> {
  const out: AuditResult[] = [];

  // Check 1: no uploads.week_label is null/empty
  const weekName = "uploads.week_label is never null/empty";
  try {
    const { data } = await supabase.from("uploads").select("id, week_label");
    const bad = (data || []).filter(
      (u: any) => !u.week_label || String(u.week_label).trim() === ""
    ).length;
    out.push({
      name: weekName,
      status: bad === 0 ? "pass" : "fail",
      expected: "0 missing week_label",
      actual: `${bad} upload(s) missing week_label`,
    });
  } catch (e) {
    out.push(failed(weekName, e));
  }

  // Check 2: payroll Σ Received Tax Prep Fee(s) ≈ backend Σ for the same week
  const sumName = "Payroll Σ Received Tax Prep Fee(s) matches Backend Σ per (account, week)";
  try {
    const { data: ups } = await supabase
      .from("uploads")
      .select("id, type, week_label, account_id");
    const byKey = new Map<string, { payroll: string[]; backend: string[] }>();
    for (const u of ups || []) {
      const key = `${u.account_id ?? ""}::${u.week_label}`;
      const entry = byKey.get(key) || { payroll: [], backend: [] };
      if (u.type === "Payroll Report") entry.payroll.push(u.id);
      if (u.type === "Backend Money Report") entry.backend.push(u.id);
      byKey.set(key, entry);
    }
    const sumFor = async (ids: string[]) =>
      (await fetchAllRows(ids)).reduce((s, r) => s + toNum(r["Received Tax Prep Fee(s)"]), 0);
    let mismatches = 0;
    let checked = 0;
    for (const [, { payroll, backend }] of byKey) {
      if (payroll.length === 0 || backend.length === 0) continue;
      const p = await sumFor(payroll);
      const b = await sumFor(backend);
      checked++;
      if (Math.abs(p - b) > 0.01) mismatches++;
    }
    out.push({
      name: sumName,
      status: mismatches === 0 ? "pass" : "warn",
      expected: "0 mismatches",
      actual: `${mismatches}/${checked} mismatched (warn — known divergence possible)`,
    });
  } catch (e) {
    out.push(failed(sumName, e));
  }

  // Check 3: row_data numeric-looking fields are actually numeric in jsonb
  const numName = "Numeric jsonb fields contain numbers or numeric strings";
  try {
    const numericKeys = [
      "Received Tax Prep Fee(s)",
      "Expected Tax Prep Fee(s)",
      "Service Bureau Fee",
      "ERO3Fee",
      "E-File Fee(s)",
    ];
    const { data } = await supabase.from("upload_rows").select("row_data").limit(500);
    let bad = 0;
    for (const r of data || []) {
      const d = (r as any).row_data || {};
      for (const k of numericKeys) {
        const v = d[k];
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "number") continue;
        // tolerate numeric-looking strings — but flag non-numeric strings
        if (typeof v === "string" && /^-?\$?[0-9,.]+$/.test(v.trim())) continue;
        bad++;
      }
    }
    out.push({
      name: numName,
      status: bad === 0 ? "pass" : "warn",
      expected: "0 non-numeric values in sampled rows",
      actual: `${bad} non-numeric value(s) in last 500 rows`,
    });
  } catch (e) {
    out.push(failed(numName, e));
  }

  // Check 4: no duplicate (account_id, type, week_label, source_file_hash)
  const dupName = "No duplicate (account, type, week, file-hash) uploads";
  try {
    const { data } = await supabase
      .from("uploads")
      .select("account_id, type, week_label, source_file_hash");
    const counts = new Map<string, number>();
    for (const u of (data || []) as any[]) {
      if (!u.source_file_hash) continue;
      const k = `${u.account_id ?? ""}::${u.type}::${u.week_label}::${u.source_file_hash}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const dups = Array.from(counts.values()).filter((c) => c > 1).length;
    out.push({
      name: dupName,
      status: dups === 0 ? "pass" : "fail",
      expected: "0 duplicate hash groups",
      actual: `${dups} duplicate group(s)`,
    });
  } catch {
    out.push({
      name: dupName,
      status: "warn",
      expected: "query succeeds",
      actual: "Column source_file_hash may be missing — run pending migration",
    });
  }

  // Check 5: every active preparer's Tax Office is an existing office. A
  // mismatch (e.g. "Instant Tax" vs "Instant") silently drops the preparer's
  // rows from office fee tiles and pays them at 100% instead of the office's share.
  const officeName = "Every active preparer's Tax Office is an existing office";
  try {
    const [offices, preparers] = await Promise.all([
      supabase.from("offices").select("office_name").eq("active", true),
      supabase.from("preparers").select("contractor, ptin, tax_office").eq("active", true),
    ]);
    if (offices.error) throw offices.error;
    if (preparers.error) throw preparers.error;
    const known = new Set((offices.data || []).map((o: any) => o.office_name));
    const bad = (preparers.data || []).filter((p: any) => !known.has(p.tax_office));
    out.push({
      name: officeName,
      status: bad.length === 0 ? "pass" : "fail",
      expected: "0 preparers with an unknown office",
      actual: `${bad.length} preparer(s) with an unknown office`,
      detail: bad.length
        ? bad.map((p: any) => `${p.contractor} (${p.ptin}): "${p.tax_office || ""}"`).join("\n")
        : undefined,
    });
  } catch (e) {
    out.push(failed(officeName, e));
  }

  return out;
}

// ── Payroll math ─────────────────────────────────────────────────────────────

export interface PayrollWeekRow {
  preparer_name: string;
  ptin: string;
  total_received: number;
  total_after_advance: number;
  total_preparer_share: number;
  total_share: number;
  total_pay: number;
  preparer_fee: number;
}

/**
 * Pure check of per-preparer totals against the app's business rules
 * (see services/calculationEngine.ts). Returns one problem string per
 * violation; empty means every row is consistent.
 */
export function evaluatePayrollMath(rows: PayrollWeekRow[]): string[] {
  const problems: string[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.01;
  for (const r of rows) {
    const who = `${r.preparer_name || "Unknown"} (${r.ptin})`;
    const received = toNum(r.total_received);
    const afterAdvance = toNum(r.total_after_advance);
    const prepShare = toNum(r.total_preparer_share);
    const share = toNum(r.total_share);
    const fee = toNum(r.preparer_fee);
    if (afterAdvance > received + 0.01)
      problems.push(`${who}: after-advance $${afterAdvance.toFixed(2)} exceeds received $${received.toFixed(2)}`);
    if (prepShare > afterAdvance + 0.01)
      problems.push(`${who}: preparer share $${prepShare.toFixed(2)} exceeds after-advance $${afterAdvance.toFixed(2)}`);
    for (const [label, v] of [["received", received], ["after-advance", afterAdvance], ["preparer share", prepShare], ["share", share], ["pay", toNum(r.total_pay)]] as const) {
      if (v < -0.01) problems.push(`${who}: negative ${label} $${v.toFixed(2)}`);
    }
    const expectedShare = Math.max(0, received - fee);
    if (!near(share, expectedShare))
      problems.push(`${who}: total share $${share.toFixed(2)} ≠ received − preparer fee ($${expectedShare.toFixed(2)})`);
  }
  return problems;
}

export async function runPayrollMathChecks(weekLabel: string): Promise<AuditResult[]> {
  const name = "Preparer totals follow pay rules";
  try {
    const { data, error } = await supabase
      .from("preparer_payroll_weeks")
      .select("preparer_name, ptin, total_received, total_after_advance, total_preparer_share, total_share, total_pay, preparer_fee")
      .eq("week_label", weekLabel);
    if (error) throw error;
    const problems = evaluatePayrollMath((data || []) as PayrollWeekRow[]);
    return [{
      name,
      status: problems.length === 0 ? "pass" : "fail",
      expected: "0 rule violations",
      actual: `${problems.length} violation(s) across ${(data || []).length} preparer(s)`,
      detail: problems.slice(0, 20).join("\n") || undefined,
    }];
  } catch (e) {
    return [failed(name, e)];
  }
}

// ── Runtime crashes ──────────────────────────────────────────────────────────

const loggedErrors = new Set<string>();

// ponytail: reuses the notifications table; move to a dedicated app_errors table if volume grows.
export async function logAppError(err: unknown): Promise<void> {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const message = e.message || "Unknown error";
    if (loggedErrors.has(message)) return;
    loggedErrors.add(message);
    await supabase.from("notifications").insert({
      type: "app_error",
      title: `App error: ${message.slice(0, 120)}`,
      description: `On ${window.location.pathname}`,
      metadata: { stack: e.stack?.slice(0, 2000) ?? null, route: window.location.pathname } as any,
    });
  } catch {
    // Logging must never break the app.
  }
}

export async function countRecentCrashes(): Promise<AuditResult[]> {
  const name = "No app errors in the last 7 days";
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("notifications")
      .select("title")
      .eq("type", "app_error")
      .gte("created_at", since)
      .limit(50);
    if (error) throw error;
    const titles = [...new Set((data || []).map((d: any) => d.title))];
    return [{
      name,
      status: titles.length === 0 ? "pass" : "warn",
      expected: "0 errors",
      actual: `${titles.length} distinct error(s)`,
      detail: titles.join("\n") || undefined,
    }];
  } catch (e) {
    return [failed(name, e, "warn")];
  }
}

// ── Sub-accounts vs Office Summary ───────────────────────────────────────────

export interface SubAccountAuditInput {
  account: { name: string; slug: string };
  offices: { office_name: string; parent_office: string | null }[];
  preparers: { contractor: string; ptin: string; tax_office: string | null; main_office: string | null }[];
}

const normOffice = (s: string | null | undefined) => (s || "").replace(/\s+/g, "").toLowerCase();

/**
 * Pure check that a sub-account dashboard shows the same office as the
 * master Office Summary. The summary tables are shared components scoped by
 * the canonical office, but the sub-account preparer list matches names via
 * SUB_ACCOUNT_OFFICES only, while Office Summary also rolls in downline
 * offices (offices.parent_office). Returns one problem string per mismatch.
 */
export function evaluateSubAccount({ account, offices, preparers }: SubAccountAuditInput): string[] {
  const mapped = getSubAccountOffices(account.slug);
  if (mapped.length === 0)
    return [`No office mapping for slug "${account.slug}" in config/subAccountOffices.ts — dashboard shows nothing`];

  const canonical = mapped[0];
  const byNorm = new Map(offices.map((o) => [normOffice(o.office_name), o.office_name]));
  const officeName = byNorm.get(normOffice(canonical));
  if (!officeName)
    return [`Mapped office "${canonical}" is not an active office — sub-account summary will be empty`];

  const problems: string[] = [];
  if (officeName !== canonical)
    problems.push(`Mapped office "${canonical}" differs from office name "${officeName}" — spacing/case mismatch can drop saved table configs`);

  // Downline of the canonical office, same rule Office Summary uses.
  const parentOf = new Map<string, string>();
  for (const o of offices) {
    const parent = byNorm.get(normOffice(o.parent_office));
    if (parent && parent !== o.office_name) parentOf.set(o.office_name, parent);
  }
  const downline = new Set([officeName]);
  for (const o of offices) {
    let cur: string | undefined = o.office_name;
    for (let hops = 0; cur && hops < 20; hops++) {
      if (cur === officeName) { downline.add(o.office_name); break; }
      cur = parentOf.get(cur);
    }
  }
  const downlineNorm = new Set([...downline].map(normOffice));

  for (const p of preparers) {
    const inSummary = downlineNorm.has(normOffice(p.tax_office));
    const inSub = rowMatchesSubAccount(p.tax_office, account.slug) || rowMatchesSubAccount(p.main_office, account.slug);
    if (inSummary && !inSub)
      problems.push(`${p.contractor || p.ptin} (${p.ptin}) — office "${p.tax_office}" is in ${officeName}'s Office Summary but missing from the sub-account preparer list`);
  }
  return problems;
}

export async function runSubAccountChecks(): Promise<AuditResult[]> {
  try {
    const [accRes, offRes, prepRes] = await Promise.all([
      supabase.from("accounts").select("name, slug").not("parent_account_id", "is", null).eq("active", true),
      supabase.from("offices").select("office_name, parent_office").eq("active", true),
      supabase.from("preparers").select("contractor, ptin, tax_office, main_office").eq("active", true),
    ]);
    if (accRes.error) throw accRes.error;
    if (offRes.error) throw offRes.error;
    if (prepRes.error) throw prepRes.error;
    return (accRes.data || []).map((account: any) => {
      const problems = evaluateSubAccount({
        account,
        offices: (offRes.data || []) as any,
        preparers: (prepRes.data || []) as any,
      });
      return {
        name: `Sub-account "${account.name}" matches Office Summary`,
        status: problems.length === 0 ? "pass" : "fail",
        expected: "same office, same preparers",
        actual: problems.length === 0 ? "matches" : `${problems.length} mismatch(es)`,
        detail: problems.slice(0, 20).join("\n") || undefined,
      } as AuditResult;
    });
  } catch (e) {
    return [failed("Sub-accounts match Office Summary", e)];
  }
}

// ── Full audit ───────────────────────────────────────────────────────────────

async function runVerificationAsAudit(weekLabel: string): Promise<AuditResult[]> {
  try {
    const report = await runPayrollVerification(weekLabel);
    return report.checks
      .filter((c) => c.status !== "skip")
      .map((c) => ({
        name: `[${weekLabel}] ${c.title}`,
        status: c.status === "fail" ? (c.severity === "error" ? "fail" : "warn") : c.status === "warn" ? "warn" : "pass",
        expected: "no issues",
        actual: c.description,
        detail: c.details.slice(0, 20).join("\n") || undefined,
      }));
  } catch (e) {
    return [failed("Payroll verification", e)];
  }
}

export async function runAppAudit(weekLabel: string | null | undefined): Promise<AuditResult[]> {
  const parts = await Promise.all([
    weekLabel ? runVerificationAsAudit(weekLabel) : Promise.resolve([]),
    weekLabel ? runPayrollMathChecks(weekLabel) : Promise.resolve([]),
    runIntegrityChecks(),
    runSubAccountChecks(),
    countRecentCrashes(),
  ]);
  return parts.flat();
}

/** Runs the audit and drops one summary notification into the header bell if anything is off. */
export async function runAppAuditAndNotify(weekLabel: string): Promise<void> {
  try {
    const results = await runAppAudit(weekLabel);
    const problems = results.filter((r) => r.status !== "pass");
    if (problems.length === 0) return;
    await supabase.from("notifications").insert({
      type: "audit",
      title: `Audit: ${problems.length} problem(s) in ${weekLabel}`,
      description: problems.map((p) => p.name).slice(0, 5).join(" · "),
      metadata: { weekLabel, results: problems } as any,
    });
  } catch (e) {
    console.warn("[audit] background run failed", e);
  }
}
