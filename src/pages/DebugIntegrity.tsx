import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { toNum } from "@/lib/num";

type CheckStatus = "pass" | "fail" | "warn";

interface CheckResult {
  name: string;
  status: CheckStatus;
  expected: string;
  actual: string;
  detail?: string;
}

/**
 * Admin-only data integrity self-check. Mounted at /debug/integrity behind
 * AdminRouteGuard in App.tsx. Runs read-only queries against uploads /
 * upload_rows and reports pass/fail per check.
 */
export default function DebugIntegrity() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);

  const run = async () => {
    setRunning(true);
    const out: CheckResult[] = [];

    // Check 1: every upload_rows.upload_id resolves to an existing uploads.id
    try {
      const { data: rows } = await supabase
        .from("upload_rows")
        .select("upload_id");
      const { data: ups } = await supabase.from("uploads").select("id");
      const ids = new Set((ups || []).map((u: any) => u.id));
      const orphans = (rows || []).filter((r: any) => !ids.has(r.upload_id))
        .length;
      out.push({
        name: "upload_rows reference an existing uploads row",
        status: orphans === 0 ? "pass" : "fail",
        expected: "0 orphan rows",
        actual: `${orphans} orphan row(s)`,
      });
    } catch (e: any) {
      out.push({
        name: "upload_rows reference an existing uploads row",
        status: "fail",
        expected: "query succeeds",
        actual: e.message ?? "query failed",
      });
    }

    // Check 2: no uploads.week_label is null/empty
    try {
      const { data } = await supabase
        .from("uploads")
        .select("id, week_label");
      const bad = (data || []).filter(
        (u: any) => !u.week_label || String(u.week_label).trim() === ""
      ).length;
      out.push({
        name: "uploads.week_label is never null/empty",
        status: bad === 0 ? "pass" : "fail",
        expected: "0 missing week_label",
        actual: `${bad} upload(s) missing week_label`,
      });
    } catch (e: any) {
      out.push({
        name: "uploads.week_label is never null/empty",
        status: "fail",
        expected: "query succeeds",
        actual: e.message ?? "query failed",
      });
    }

    // Check 3: payroll Σ Received Tax Prep Fee(s) ≈ backend Σ for the same week
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
      let mismatches = 0;
      let checked = 0;
      for (const [, { payroll, backend }] of byKey) {
        if (payroll.length === 0 || backend.length === 0) continue;
        const sumFor = async (ids: string[]) => {
          let total = 0;
          for (let i = 0; i < ids.length; i += 10) {
            const batch = ids.slice(i, i + 10);
            const { data } = await supabase
              .from("upload_rows")
              .select("row_data")
              .in("upload_id", batch);
            for (const r of data || [])
              total += toNum(
                (r as any).row_data?.["Received Tax Prep Fee(s)"]
              );
          }
          return total;
        };
        const p = await sumFor(payroll);
        const b = await sumFor(backend);
        checked++;
        if (Math.abs(p - b) > 0.01) mismatches++;
      }
      out.push({
        name:
          "Payroll Σ Received Tax Prep Fee(s) matches Backend Σ per (account, week)",
        status: mismatches === 0 ? "pass" : "warn",
        expected: "0 mismatches",
        actual: `${mismatches}/${checked} mismatched (warn — known divergence possible)`,
      });
    } catch (e: any) {
      out.push({
        name:
          "Payroll Σ Received Tax Prep Fee(s) matches Backend Σ per (account, week)",
        status: "fail",
        expected: "query succeeds",
        actual: e.message ?? "query failed",
      });
    }

    // Check 4: row_data numeric-looking fields are actually numeric in jsonb
    try {
      const numericKeys = [
        "Received Tax Prep Fee(s)",
        "Expected Tax Prep Fee(s)",
        "Service Bureau Fee",
        "ERO3Fee",
        "E-File Fee(s)",
      ];
      const { data } = await supabase
        .from("upload_rows")
        .select("row_data")
        .limit(500);
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
        name: "Numeric jsonb fields contain numbers or numeric strings",
        status: bad === 0 ? "pass" : "warn",
        expected: "0 non-numeric values in sampled rows",
        actual: `${bad} non-numeric value(s) in last 500 rows`,
      });
    } catch (e: any) {
      out.push({
        name: "Numeric jsonb fields contain numbers or numeric strings",
        status: "fail",
        expected: "query succeeds",
        actual: e.message ?? "query failed",
      });
    }

    // Check 5: no duplicate (account_id, type, week_label, source_file_hash)
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
        name:
          "No duplicate (account, type, week, file-hash) uploads",
        status: dups === 0 ? "pass" : "fail",
        expected: "0 duplicate hash groups",
        actual: `${dups} duplicate group(s)`,
      });
    } catch (e: any) {
      out.push({
        name: "No duplicate (account, type, week, file-hash) uploads",
        status: "warn",
        expected: "query succeeds",
        actual:
          "Column source_file_hash may be missing — run pending migration",
      });
    }

    setResults(out);
    setRunning(false);
  };

  useEffect(() => {
    run();
  }, []);

  const summary = useMemo(() => {
    const pass = results.filter((r) => r.status === "pass").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const warn = results.filter((r) => r.status === "warn").length;
    return { pass, fail, warn };
  }, [results]);

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Data Integrity Self-Check</CardTitle>
          <Button onClick={run} disabled={running} size="sm" variant="outline">
            <RefreshCw
              className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`}
            />
            {running ? "Running…" : "Re-run"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {summary.pass} passed · {summary.warn} warning · {summary.fail} failed
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.name}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                {r.status === "pass" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                ) : r.status === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Expected: {r.expected} · Actual: {r.actual}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}