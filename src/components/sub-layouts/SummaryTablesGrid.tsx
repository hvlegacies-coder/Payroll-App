import { useState } from "react";
import { SummaryTable } from "@/components/office-summary/SummaryTable";
import { PreparersShareTable } from "@/components/office-summary/PreparersShareTable";
import { BackendFeeTable } from "@/components/office-summary/BackendFeeTable";
import { AlignmentBanner } from "@/components/office-summary/AlignmentBanner";
import { HideableBlock } from "./visibility";
import { BUILTIN_KEYS, bfKey, isBfKey, bfFeeFromKey, type SubLayoutProps } from "./types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Props = Pick<
  SubLayoutProps,
  | "summaryTables"
  | "setSummaryTables"
  | "officeScope"
  | "isSubUser"
  | "isAdmin"
  | "hiddenKeys"
  | "onToggleHidden"
  | "onToggleHiddenScoped"
> & {
  gridClassName?: string;
};

/**
 * Mirrors the admin Office Summary page: tracks live totals of user-defined
 * summary tables, the Preparers Share table, and the Backend Fee per-EFIN
 * tiles, then feeds them into each SummaryTable as siblingTables so that
 * cross-table references (e.g. "Fees Due (−)") resolve to real numbers
 * instead of 0.
 */
export function SubSummaryTablesGrid({
  summaryTables,
  setSummaryTables,
  officeScope,
  isSubUser,
  isAdmin,
  hiddenKeys,
  onToggleHidden,
  onToggleHiddenScoped,
  gridClassName = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start",
}: Props) {
  const [tableTotals, setTableTotals] = useState<Record<string, number>>({});
  const [preparersShareTotal, setPreparersShareTotal] = useState<number>(0);
  const [feeTotals, setFeeTotals] = useState<Record<string, number>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, number>>({});

  const visibleTables = summaryTables.filter((t) => !hiddenKeys.includes(t.id));

  const autoSiblings = [
    { id: "__pshare__", title: "Preparers Share", total: preparersShareTotal },
    { id: "__bf_efile", title: "E-File Fee(s)", total: feeTotals["E-File Fee(s)"] ?? 0 },
    { id: "__bf_sbf", title: "Service Bureau Fee", total: feeTotals["Service Bureau Fee"] ?? 0 },
    { id: "__bf_ero3", title: "ERO3Fee", total: feeTotals["ERO3Fee"] ?? 0 },
    { id: "__bf_xmit", title: "Transmitter Fee", total: feeTotals["Transmitter Fee"] ?? 0 },
    { id: "__bf_efile_efin", title: "E-File-EFIN", total: feeTotals["E-File-EFIN"] ?? 0 },
    { id: "__bf_ero3_efin", title: "ERO3-EFIN", total: feeTotals["ERO3-EFIN"] ?? 0 },
  ];

  return (
    <>
      <AlignmentBanner office={officeScope} />
      {officeScope === "D & D" && (
        <SbEro3EfileCheck
          summaryTables={summaryTables}
          feeTotals={feeTotals}
          fieldValues={fieldValues}
        />
      )}
      {visibleTables.length > 0 && (
        <div className={gridClassName}>
          {visibleTables.map((t) => {
            const userSiblings = summaryTables
              .filter((o) => o.id !== t.id)
              .map((o) => ({ id: o.id, title: o.title, total: tableTotals[o.id] ?? 0 }));
            return (
              <HideableBlock
                key={t.id}
                isAdmin={isAdmin}
                itemKey={t.id}
                onHide={onToggleHidden}
                onHideScoped={onToggleHiddenScoped}
              >
                <SummaryTable
                  config={t}
                  onChange={(c) => setSummaryTables((prev) => prev.map((x) => (x.id === t.id ? c : x)))}
                  onDelete={() => {}}
                  officeScope={officeScope}
                  readOnly={isSubUser}
                  siblingTables={[...userSiblings, ...autoSiblings]}
                  onTotalChange={(total) =>
                    setTableTotals((prev) => (prev[t.id] === total ? prev : { ...prev, [t.id]: total }))
                  }
                  onFieldValues={(vals) =>
                    setFieldValues((prev) => {
                      const same = Object.keys(vals).every((k) => prev[k] === vals[k]);
                      return same ? prev : { ...prev, ...vals };
                    })
                  }
                />
              </HideableBlock>
            );
          })}
        </div>
      )}
      {!hiddenKeys.includes(BUILTIN_KEYS.preparersShare) && (
        <HideableBlock
          isAdmin={isAdmin}
          itemKey={BUILTIN_KEYS.preparersShare}
          onHide={onToggleHidden}
          onHideScoped={onToggleHiddenScoped}
        >
          <PreparersShareTable
            officeScope={officeScope}
            onTotalChange={(total) => setPreparersShareTotal((prev) => (prev === total ? prev : total))}
          />
        </HideableBlock>
      )}
      <BackendFeeTable
        officeScope={officeScope}
        hiddenFeeTypes={hiddenKeys.filter(isBfKey).map(bfFeeFromKey)}
        onHideFee={
          isAdmin
            ? (f) =>
                onToggleHiddenScoped
                  ? onToggleHiddenScoped(bfKey(f), "admin")
                  : onToggleHidden(bfKey(f))
            : undefined
        }
        onTotalsChange={(totals) =>
          setFeeTotals((prev) => {
            const same = Object.keys(totals).every((k) => prev[k] === (totals as any)[k]);
            return same ? prev : { ...prev, ...totals };
          })
        }
      />
    </>
  );
}

function SbEro3EfileCheck({
  summaryTables,
  feeTotals,
  fieldValues,
}: {
  summaryTables: { id: string; title: string; fields: any[] }[];
  feeTotals: Record<string, number>;
  fieldValues: Record<string, number>;
}) {
  // Find any field referencing the auto SB+ERO3+EFile formula.
  const matches: { tableTitle: string; key: string; actual: number }[] = [];
  for (const t of summaryTables) {
    for (const f of t.fields || []) {
      const isAuto = f.fieldId === "__auto_sb_ero3_efile__";
      const isLabel = (f.label || "").trim().toLowerCase() === "total sb+ero3+efile";
      if (!isAuto && !isLabel) continue;
      const key = `${t.id}:${f.fieldId || f.id}`;
      const actual = fieldValues[key];
      if (typeof actual === "number") {
        matches.push({ tableTitle: t.title, key, actual });
      }
    }
  }
  if (matches.length === 0) return null;

  const sb = feeTotals["Service Bureau Fee"] ?? 0;
  const efile = feeTotals["E-File-EFIN"] ?? 0;
  const ero3 = feeTotals["ERO3-EFIN"] ?? 0;
  const expected = sb + efile + ero3;
  const fmt = (n: number) => formatMoney(n);

  const mismatches = matches.filter((m) => Math.abs(m.actual - expected) > 0.005);
  const ok = mismatches.length === 0;

  return (
    <Alert variant={ok ? "default" : "destructive"}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>
        {ok ? "Total SB+ERO3+EFile check passed" : "Total SB+ERO3+EFile mismatch"}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-1 text-sm tabular-nums">
          Expected: SB {fmt(sb)} + E-File-EFIN {fmt(efile)} + ERO3-EFIN {fmt(ero3)} ={" "}
          <span className="font-semibold">{fmt(expected)}</span>
        </div>
        <ul className="mt-2 space-y-1 text-sm tabular-nums">
          {matches.map((m) => {
            const delta = m.actual - expected;
            const rowOk = Math.abs(delta) <= 0.005;
            return (
              <li key={m.key}>
                <span className="font-medium">{m.tableTitle}</span>: {fmt(m.actual)}{" "}
                {rowOk ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="font-semibold">(Δ {fmt(delta)})</span>
                )}
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}