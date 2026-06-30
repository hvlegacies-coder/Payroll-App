import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Users, DollarSign, Flame } from "lucide-react";
import { SourceRowsPanel } from "@/components/office-summary/SourceRowsPanel";
import { SubPreparersList } from "./SubPreparersList";
import { BUILTIN_KEYS, type SubLayoutProps } from "./types";
import { HideableBlock, HiddenTablesBar } from "./visibility";
import { SubSummaryTablesGrid } from "./SummaryTablesGrid";
import { formatMoney } from "@/lib/utils";

const ACCENT = "30 95% 50%"; // amber

export default function DAndDLayout(p: SubLayoutProps) {
  const totalAvailed = p.preparers.reduce((s, x) => s + Number(x.availed_payroll || 0), 0);
  const active = p.preparers.filter((x) => x.active).length;
  return (
    <div className="space-y-6" style={{ ['--sub-accent' as any]: ACCENT }}>
      <div
        className="relative overflow-hidden rounded-2xl border border-border p-6 shadow-card"
        style={{ background: `linear-gradient(135deg, hsl(${ACCENT} / 0.18), hsl(${ACCENT} / 0.04))` }}
      >
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-white"
            style={{ background: `hsl(${ACCENT})` }}
          >
            <Trophy className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Champion Office</p>
            <h1 className="text-2xl font-bold">{p.subName}</h1>
            <p className="text-sm text-muted-foreground">Tax Champions · {p.officeScope}</p>
          </div>
          <div className="hidden md:grid grid-cols-3 gap-6 text-right">
            <Stat label="Preparers" value={p.preparers.length} />
            <Stat label="Active" value={active} />
            <Stat label="Availed" value={formatMoney(totalAvailed, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary"><Flame className="h-3.5 w-3.5 mr-1.5" />Office Summary</TabsTrigger>
          <TabsTrigger value="preparers"><Users className="h-3.5 w-3.5 mr-1.5" />Preparers ({p.preparers.length})</TabsTrigger>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}