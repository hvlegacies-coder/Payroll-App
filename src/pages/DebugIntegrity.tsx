import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { runAppAudit, type AuditResult } from "@/services/appAudit";

/**
 * Admin-only App Health page. Mounted at /debug/integrity behind
 * AdminRouteGuard in App.tsx. Runs the full read-only audit (payroll
 * verification + pay-rule math + DB integrity + recent app errors) for the
 * selected week. The same audit runs in the background after every upload.
 */
export default function DebugIntegrity() {
  const { selectedWeek } = useActiveWeek();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");

  const run = async () => {
    setRunning(true);
    setExplanation("");
    setResults(await runAppAudit(selectedWeek));
    setRunning(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const summary = useMemo(() => {
    const pass = results.filter((r) => r.status === "pass").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const warn = results.filter((r) => r.status === "warn").length;
    return { pass, fail, warn };
  }, [results]);

  const problems = results.filter((r) => r.status !== "pass");

  const explain = async () => {
    setExplaining(true);
    setExplanation("");
    const list = problems
      .map((p) => `- ${p.name}: ${p.actual}${p.detail ? `\n  ${p.detail.split("\n").slice(0, 5).join("\n  ")}` : ""}`)
      .join("\n");
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `The app's automatic audit for week ${selectedWeek ?? "(none)"} found these problems. For each, explain in plain English what it means, how serious it is, and exactly where in the app to fix it.\n\n${list}`,
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      setExplanation(res.ok ? data?.reply || "No response." : `AI error: ${data?.error ?? res.status}`);
    } catch (e: any) {
      setExplanation(`AI error: ${e?.message ?? "request failed"}`);
    }
    setExplaining(false);
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>App Health{selectedWeek ? ` — ${selectedWeek}` : ""}</CardTitle>
          <div className="flex gap-2">
            {problems.length > 0 && (
              <Button onClick={explain} disabled={explaining || running} size="sm" variant="outline">
                <Sparkles className={`mr-2 h-4 w-4 ${explaining ? "animate-pulse" : ""}`} />
                {explaining ? "Asking AI…" : "Explain with AI"}
              </Button>
            )}
            <Button onClick={run} disabled={running} size="sm" variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Running…" : "Re-run"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {summary.pass} passed · {summary.warn} warning · {summary.fail} failed
          </div>
          {explanation && (
            <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
              {explanation}
            </div>
          )}
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.name} className="flex items-start gap-3 rounded-md border p-3">
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
                  {r.detail && r.status !== "pass" && (
                    <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.detail}</pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
