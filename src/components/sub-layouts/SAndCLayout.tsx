import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SourceRowsPanel } from "@/components/office-summary/SourceRowsPanel";
import { SubPreparersList } from "./SubPreparersList";
import { BUILTIN_KEYS, type SubLayoutProps } from "./types";
import { HideableBlock, HiddenTablesBar } from "./visibility";
import { SubSummaryTablesGrid } from "./SummaryTablesGrid";

export default function SAndCLayout(p: SubLayoutProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="border-b border-foreground/20 pb-6">
        <p className="text-[10px] uppercase tracking-[0.5em] text-muted-foreground">Issue · Vol. {p.preparers.length}</p>
        <h1 className="font-serif text-6xl font-bold leading-none mt-3">{p.subName}</h1>
        <p className="mt-3 text-sm text-muted-foreground italic">
          {p.officeScope} — a quiet ledger of clean numbers.
        </p>
      </header>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Office Summary</TabsTrigger>
          <TabsTrigger value="preparers">Preparers ({p.preparers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-8">
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
            gridClassName="grid grid-cols-1 md:grid-cols-2 gap-4 items-start"
          />
          {!p.hiddenKeys.includes(BUILTIN_KEYS.sourceRows) && (
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Source Verification</h2>
              <HideableBlock isAdmin={p.isAdmin} itemKey={BUILTIN_KEYS.sourceRows} onHide={p.onToggleHidden} onHideScoped={p.onToggleHiddenScoped}>
                <SourceRowsPanel officeScope={p.officeScope} />
              </HideableBlock>
            </section>
          )}
        </TabsContent>

        <TabsContent value="preparers" className="mt-6">
          <SubPreparersList preparers={p.preparers} loading={p.loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}