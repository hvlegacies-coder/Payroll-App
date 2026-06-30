import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crown, Users } from "lucide-react";
import { SourceRowsPanel } from "@/components/office-summary/SourceRowsPanel";
import { SubPreparersList } from "./SubPreparersList";
import { BUILTIN_KEYS, type SubLayoutProps } from "./types";
import { HideableBlock, HiddenTablesBar } from "./visibility";
import { SubSummaryTablesGrid } from "./SummaryTablesGrid";

const NAVY = "220 60% 18%";
const GOLD = "43 80% 52%";

export default function KingJLayout(p: SubLayoutProps) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-8 shadow-card text-white relative overflow-hidden"
        style={{ background: `linear-gradient(120deg, hsl(${NAVY}), hsl(${NAVY} / 0.85))`, borderColor: `hsl(${GOLD} / 0.4)` }}
      >
        <div className="absolute -right-10 -top-10 opacity-10">
          <Crown className="h-48 w-48" style={{ color: `hsl(${GOLD})` }} />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Crown className="h-5 w-5" style={{ color: `hsl(${GOLD})` }} />
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: `hsl(${GOLD})` }}>Royal Estate</p>
        </div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">{p.subName}</h1>
        <p className="text-sm text-white/70 mt-1">{p.officeScope} · {p.preparers.length} preparers under crown</p>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Office Summary</TabsTrigger>
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
            gridClassName="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
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