import { EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelForKey } from "./types";
import type { SummaryTableConfig } from "@/components/office-summary/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type HideScope = "admin" | "offices";

export function HideableBlock({
  isAdmin,
  itemKey,
  onHide,
  onHideScoped,
  children,
}: {
  isAdmin: boolean;
  itemKey: string;
  onHide?: (key: string) => void;
  onHideScoped?: (key: string, scope: HideScope) => void;
  children: React.ReactNode;
}) {
  if (!isAdmin) return <>{children}</>;
  if (onHideScoped) {
    return (
      <div className="relative group">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Hide this table…"
              className="absolute top-2 right-2 z-10 h-7 w-7 rounded-md border border-border bg-background/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            <button
              type="button"
              onClick={() => onHideScoped(itemKey, "admin")}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
            >
              Hide for Admin View
            </button>
            <button
              type="button"
              onClick={() => onHideScoped(itemKey, "offices")}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
            >
              Hide for Offices
            </button>
          </PopoverContent>
        </Popover>
        {children}
      </div>
    );
  }
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onHide?.(itemKey)}
        title="Hide this table for this sub-account"
        className="absolute top-2 right-2 z-10 h-7 w-7 rounded-md border border-border bg-background/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <EyeOff className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  );
}

export function HiddenTablesBar({
  isAdmin,
  hiddenKeys,
  summaryTables,
  onUnhide,
  label,
}: {
  isAdmin: boolean;
  hiddenKeys: string[];
  summaryTables: SummaryTableConfig[];
  onUnhide: (key: string) => void;
  label?: string;
}) {
  if (!isAdmin || hiddenKeys.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
        {label ?? "Hidden"} ({hiddenKeys.length})
      </span>
      {hiddenKeys.map((k) => (
        <Button
          key={k}
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => onUnhide(k)}
        >
          <Plus className="h-3 w-3" />
          {labelForKey(k, summaryTables)}
        </Button>
      ))}
    </div>
  );
}