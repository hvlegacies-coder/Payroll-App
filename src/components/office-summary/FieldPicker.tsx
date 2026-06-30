import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FIELD_REGISTRY, DATASET_LABELS, EFIN_VIRTUAL_FIELDS, DOWNLINE_VIRTUAL_FIELDS, OFFICE_GROUP_VIRTUAL_FIELDS, AUTO_FIELDS, type FieldDef } from './fieldRegistry';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CalcOperand } from './types';

export interface CalcTemplate {
  id: string;
  name: string;
  operands: CalcOperand[];
}

interface SiblingTable { id: string; title: string; total: number }

interface FieldPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (field: { id: string; label: string; key?: string }) => void;
  existingFieldIds: string[];
  siblingTables?: SiblingTable[];
  officeScope?: string;
  onSelectTemplate?: (template: CalcTemplate) => void;
}

export function FieldPicker({ open, onClose, onSelect, existingFieldIds, siblingTables = [], officeScope, onSelectTemplate }: FieldPickerProps) {
  const [tab, setTab] = useState<string>('auto');
  const datasets = ['auto', 'payroll', 'backend', 'fee_intercept', 'tables', 'templates'] as const;
  const tabLabels: Record<string, string> = { ...DATASET_LABELS, tables: 'Other Tables', auto: 'Auto', templates: 'Templates' };
  const [templates, setTemplates] = useState<CalcTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTemplates(true);
    (async () => {
      const { data, error } = await supabase
        .from('office_summary_calc_templates')
        .select('id, name, operands')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setLoadingTemplates(false);
      if (error) { console.error(error); return; }
      setTemplates((data || []) as any);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    const { error } = await supabase.from('office_summary_calc_templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  const virtuals = (officeScope && EFIN_VIRTUAL_FIELDS[officeScope]) || [];
  const downlines = (officeScope && DOWNLINE_VIRTUAL_FIELDS[officeScope]) || [];
  const groups = (officeScope && OFFICE_GROUP_VIRTUAL_FIELDS[officeScope]) || [];
  const filtered: any[] = tab === 'auto'
    ? AUTO_FIELDS.map(a => ({ id: a.id, label: a.label, key: a.description }))
    : tab === 'tables'
    ? siblingTables.flatMap(s => [
        { id: `__table__${s.id}`, label: `${s.title} (+)`, key: 'Table Total' },
        { id: `__table__${s.id}__neg`, label: `${s.title} (−)`, key: 'Table Total (negated)' },
      ])
    : tab === 'templates'
    ? []
    : [
        ...(tab === 'backend'
          ? virtuals.map(v => ({ id: v.id, label: v.label, key: `${v.sourceKey} where EFIN = ${v.efin}` }))
          : []),
        ...downlines
          .filter(d => d.dataset === tab)
          .map(d => ({ id: d.id, label: d.label, key: `${d.sourceKey} (${d.rootOffice} + downlines)` })),
        ...groups
          .filter(g => g.dataset === tab)
          .map(g => ({ id: g.id, label: g.label, key: `${g.sourceKey} across ${g.offices.length} offices` })),
        ...FIELD_REGISTRY.filter(f => f.dataset === tab),
      ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 mb-3 flex-wrap">
          {datasets.map(d => (
            <Button key={d} size="sm" variant={tab === d ? 'default' : 'outline'} onClick={() => setTab(d)} className="text-xs flex-1">
              {tabLabels[d]}
            </Button>
          ))}
        </div>
        <div className="overflow-y-auto space-y-1 flex-1">
          {tab === 'tables' && siblingTables.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              No other tables available. Create another table to use its total as a field.
            </div>
          )}
          {tab === 'templates' && (
            <>
              {loadingTemplates && (
                <div className="text-center text-xs text-muted-foreground py-6">Loading templates...</div>
              )}
              {!loadingTemplates && templates.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">
                  No saved templates. Create a calculated field and tick "Save as template".
                </div>
              )}
              {!loadingTemplates && templates.map(t => (
                <div key={t.id} className="flex items-center gap-1">
                  <button
                    onClick={() => { onSelectTemplate?.(t); onClose(); }}
                    disabled={!onSelectTemplate}
                    className="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent cursor-pointer disabled:opacity-40"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">({t.operands?.length || 0} operand{(t.operands?.length || 0) === 1 ? '' : 's'})</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTemplate(t.id, t.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </>
          )}
          {filtered.map(f => {
            const exists = existingFieldIds.includes(f.id);
            return (
              <button
                key={f.id}
                disabled={exists}
                onClick={() => { onSelect(f as any); onClose(); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  exists ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent cursor-pointer'
                )}
              >
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground ml-2 text-xs">({(f as any).key})</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
