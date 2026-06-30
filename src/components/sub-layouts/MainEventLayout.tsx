import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Users } from "lucide-react";
import { SourceRowsPanel } from "@/components/office-summary/SourceRowsPanel";
import { SubPreparersList } from "./SubPreparersList";
import { BUILTIN_KEYS, type SubLayoutProps } from "./types";
import { HideableBlock, HiddenTablesBar } from "./visibility";
import { SubSummaryTablesGrid } from "./SummaryTablesGrid";

const CORAL = "350 85% 60%";

export default function MainEventLayout(p: SubLayoutProps) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 shadow-card text-white"
        style={{ background: `linear-gradient(90deg, hsl(${CORAL}), hsl(20 90% 55%))` }}
      >
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6" />
          <p className="text-xs uppercase tracking-[0.4em] font-bold">Live · Main Event</p>
        </div>
        <h1 className="text-5xl font-black tracking-tight mt-2 uppercase">{p.subName}</h1>
        <div className="flex flex-wrap gap-6 mt-4 text-sm">
          <span><b className="text-xl tabular-nums">{p.preparers.length}</b> preparers</span>
          <span><b className="text-xl tabular-nums">{p.preparers.filter((x) => x.active).length}</b> active</span>
          <span className="opacity-80">{p.officeScope}</span>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Office Summary</TabsTrigger>
          <TabsTrigger value="preparers"><Users className="h-3.5 w-3.5 mr-1.5" />Preparers ({p.preparers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
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
            gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start"
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