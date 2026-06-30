import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELD_REGISTRY, DATASET_LABELS, EFIN_VIRTUAL_FIELDS, AUTO_FIELDS } from './fieldRegistry';
import { Plus, Trash2 } from 'lucide-react';
import type { TableField, CalcOperand, Operator } from './types';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


interface SiblingTable { id: string; title: string; total: number }

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, formula: string, operands?: CalcOperand[]) => void;
  existingFields: TableField[];
  siblingTables?: SiblingTable[];
  efinOptions?: string[];
  officeOptions?: string[];
  inheritEfin?: string;
  inheritTaxOffice?: string;
  title?: string;
  initialLabel?: string;
  initialOperands?: CalcOperand[];
  hideLabel?: boolean;
  submitText?: string;
  officeScope?: string;
}

const OPS: Operator[] = ['+', '-', '×', '÷'];

const emptyOperand = (): CalcOperand => ({
  id: `op_${Date.now()}_${Math.random()}`,
  type: 'field',
  fieldId: '',
  constant: '',
  operator: '+',
});

export function CalculatedFieldDialog({
  open, onClose, onAdd, siblingTables = [], existingFields = [],
  efinOptions = [], officeOptions = [], inheritEfin, inheritTaxOffice,
  title = 'Calculated Field', initialLabel, initialOperands, hideLabel = false, submitText = 'Add',
  officeScope,
}: Props) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [operands, setOperands] = useState<CalcOperand[]>(initialOperands && initialOperands.length > 0 ? initialOperands : [emptyOperand()]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const isEditMode = initialOperands !== undefined;

  // Reset state when dialog opens with new initial values
  if (open === false) {
    // no-op; reset handled on submit/close
  }

  const addOperand = () => setOperands(prev => [...prev, emptyOperand()]);
  const removeOperand = (id: string) => setOperands(prev => prev.filter(o => o.id !== id));
  const updateOperand = (id: string, updates: Partial<CalcOperand>) => {
    setOperands(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const handleSubmit = async () => {
    const parts: string[] = [];
    operands.forEach((op, idx) => {
      if (idx > 0) parts.push(op.operator);
      parts.push(op.type === 'field' ? op.fieldId : op.constant || '0');
    });
    const formula = parts.join(' ');
    if (saveAsTemplate && !isEditMode) {
      const name = (templateName || label || 'Untitled Template').trim();
      setSavingTemplate(true);
      const { error } = await supabase
        .from('office_summary_calc_templates')
        .insert({ name, operands: operands as any });
      setSavingTemplate(false);
      if (error) {
        toast.error(`Failed to save template: ${error.message}`);
        return;
      }
      toast.success(`Template "${name}" saved`);
    }
    onAdd(label || (initialLabel ?? 'Calculated Field'), formula, operands);
    if (initialOperands === undefined) {
      setLabel('');
      setOperands([emptyOperand()]);
      setSaveAsTemplate(false);
      setTemplateName('');
    }
    onClose();
  };

  const groupedFields = ['payroll', 'backend', 'fee_intercept'].map(ds => ({
    dataset: ds,
    label: DATASET_LABELS[ds],
    fields: FIELD_REGISTRY.filter(f => f.dataset === ds),
  }));

  const virtualFields = (officeScope && EFIN_VIRTUAL_FIELDS[officeScope]) || [];

  const isValid = operands.length > 0 && operands.every(o =>
    o.type === 'constant' ? o.constant !== '' : o.fieldId !== ''
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1">
          {!hideLabel && (
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Net Fees" />
            </div>
          )}

          {operands.map((op, idx) => {
            return (
              <div key={op.id} className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
                {idx > 0 && (
                  <div>
                    <Label className="text-xs">Operator</Label>
                    <Select value={op.operator} onValueChange={v => updateOperand(op.id, { operator: v as Operator })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Field</Label>
                    <Select
                      value={op.type === 'field' ? op.fieldId : '__constant__'}
                      onValueChange={v => {
                        if (v === '__constant__') {
                          updateOperand(op.id, { type: 'constant', fieldId: '', filters: undefined });
                        } else {
                          updateOperand(op.id, { type: 'field', fieldId: v, constant: '' });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__constant__">Custom Number</SelectItem>
                        <div>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Auto</div>
                          {AUTO_FIELDS.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                          ))}
                        </div>
                        {virtualFields.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Virtual</div>
                            {virtualFields.map(vf => (
                              <SelectItem key={vf.id} value={vf.id}>{vf.label}</SelectItem>
                            ))}
                          </div>
                        )}
                        {existingFields.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">In This Table</div>
                            {existingFields.map(ef => (
                              <SelectItem key={ef.id} value={ef.id}>{ef.label}</SelectItem>
                            ))}
                          </div>
                        )}
                        {siblingTables.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Other Tables</div>
                            {siblingTables.map(s => (
                              <>
                                <SelectItem key={`${s.id}-pos`} value={`__table__${s.id}`}>{s.title} (+)</SelectItem>
                                <SelectItem key={`${s.id}-neg`} value={`__table__${s.id}__neg`}>{s.title} (−)</SelectItem>
                              </>
                            ))}
                          </div>
                        )}
                        {groupedFields.map(g => (
                          <div key={g.dataset}>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{g.label}</div>
                            {g.fields.filter(f => f.type === 'number').map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {op.type === 'constant' && (
                    <Input
                      className="h-8 w-24 text-xs"
                      type="number"
                      placeholder="Value"
                      value={op.constant}
                      onChange={e => updateOperand(op.id, { constant: e.target.value })}
                    />
                  )}
                  {operands.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOperand(op.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addOperand}>
            <Plus className="h-3 w-3" /> Add Operand
          </Button>
        </div>
        <DialogFooter>
          {!isEditMode && (
            <div className="flex items-center gap-2 mr-auto">
              <Checkbox
                id="save-as-template"
                checked={saveAsTemplate}
                onCheckedChange={v => setSaveAsTemplate(!!v)}
              />
              <Label htmlFor="save-as-template" className="text-xs cursor-pointer">Save as template</Label>
              {saveAsTemplate && (
                <Input
                  className="h-7 text-xs w-40"
                  placeholder={label || 'Template name'}
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
              )}
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || savingTemplate}>{submitText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
