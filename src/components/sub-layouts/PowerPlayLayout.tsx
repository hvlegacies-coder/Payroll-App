import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Cpu, Users, Activity, DollarSign } from "lucide-react";
import { SourceRowsPanel } from "@/components/office-summary/SourceRowsPanel";
import { SubPreparersList } from "./SubPreparersList";
import { BUILTIN_KEYS, type SubLayoutProps } from "./types";
import { HideableBlock, HiddenTablesBar } from "./visibility";
import { SubSummaryTablesGrid } from "./SummaryTablesGrid";
import { formatMoney } from "@/lib/utils";

const EMERALD = "160 70% 38%";

export default function PowerPlayLayout(p: SubLayoutProps) {
  const totalAvailed = p.preparers.reduce((s, x) => s + Number(x.availed_payroll || 0), 0);
  const active = p.preparers.filter((x) => x.active).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div
          className="rounded-2xl border border-border p-5 shadow-card space-y-4"
          style={{ background: `linear-gradient(180deg, hsl(${EMERALD} / 0.12), transparent)` }}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4" style={{ color: `hsl(${EMERALD})` }} />
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Performance Cell</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{p.subName}</h1>
          <p className="text-xs text-muted-foreground">{p.officeScope}</p>
          <div className="border-t border-border pt-4 space-y-3">
            <Metric icon={Users} label="Preparers" value={p.preparers.length} />
            <Metric icon={Activity} label="Active" value={active} />
            <Metric icon={DollarSign} label="Availed" value={formatMoney(totalAvailed, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">System status</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Box title="Office Scope" value={p.officeScope || "—"} />
            <Box title="Tables Configured" value={String(p.summaryTables.length)} />
            <Box title="Aliases" value={p.offices.join(", ") || "—"} />
            <Box title="Mode" value={p.isSubUser ? "Sub-account" : "Admin"} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Office Summary</TabsTrigger>
          <TabsTrigger value="preparers">Preparers ({p.preparers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-6">
          <HiddenTablesBar
            isAdmin={p.isAdmin}
            hiddenKeys={p.hiddenKeys}
            summaryTables={p.summaryTables}
            onUnhide={p.onToggleHidden}
            label="Hidden (Admin)"
          />
          {p.officesHiddenKeys && p.onToggleHiddenScoped && (
            <HiddenTablesBar
              isAdmin={p.isAdmin}
              hiddenKeys={p.officesHiddenKeys}
              summaryTables={p.summaryTables}
              onUnhide={(k) => p.onToggleHiddenScoped!(k, 'offices')}
              label="Hidden (Offices)"
            />
          )}
          <SubSummaryTablesGrid
            summaryTables={p.summaryTables}
            setSummaryTables={p.setSummaryTables}
            officeScope={p.officeScope}
            isSubUser={p.isSubUser}
            isAdmin={p.isAdmin}
            hiddenKeys={p.hiddenKeys}
            onToggleHidden={p.onToggleHidden}
            onToggleHiddenScoped={p.onToggleHiddenScoped}
            gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start"
          />
          {!p.hiddenKeys.includes(BUILTIN_KEYS.sourceRows) && (
            <HideableBlock isAdmin={p.isAdmin} itemKey={BUILTIN_KEYS.sourceRows} onHide={p.onToggleHidden} onHideScoped={p.onToggleHiddenScoped}>
              <SourceRowsPanel officeScope={p.officeScope} />
            </HideableBlock>
          )}
        </TabsContent>

        <TabsContent value="preparers" className="mt-4">
          <SubPreparersList preparers={p.preparers} loading={p.loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Box({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}