import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAudit, diffSummary } from '@/services/auditLog';
import { getActiveAccountId } from '@/contexts/AccountContext';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

export interface Preparer {
  id: string;
  ptin: string;
  contractor: string;
  main_office: string;
  tax_office: string;
  efin: string;
  efin2: string;
  share_percent: number;
  shared_efin_percent: number;
  roles: string;
  preparer_client_percent: number;
  office_flat_rate: number;
  landing_tab: string;
  availed_payroll: number;
  notes: string;
  active: boolean;
}

export type PreparerFieldDef = { key: keyof Preparer; label: string; type?: 'number' | 'boolean' };

// Condensed set shown on the Master PTIN (Preparers) page's dialog.
export const FIELD_LABELS: PreparerFieldDef[] = [
  { key: 'ptin', label: 'PTIN' },
  { key: 'contractor', label: 'Contractor Name' },
  { key: 'tax_office', label: 'Office' },
  { key: 'roles', label: 'Roles' },
  { key: 'preparer_client_percent', label: 'Preparer Client %', type: 'number' },
  { key: 'office_flat_rate', label: 'Office Flat Rate', type: 'number' },
];

// Full set — every column from the source PTIN List spreadsheet plus the
// in-app Active flag — shown on the Master PTIN (Sheet View) page's dialog.
export const FULL_FIELD_LABELS: PreparerFieldDef[] = [
  { key: 'ptin', label: 'PTIN' },
  { key: 'contractor', label: 'Contractor Name' },
  { key: 'main_office', label: 'Main Office' },
  { key: 'tax_office', label: 'Tax Office' },
  { key: 'efin', label: 'EFIN' },
  { key: 'efin2', label: 'EFIN2' },
  { key: 'share_percent', label: 'Share %', type: 'number' },
  { key: 'shared_efin_percent', label: 'Shared EFIN (%)', type: 'number' },
  { key: 'roles', label: 'Roles' },
  { key: 'preparer_client_percent', label: 'Preparer Client %', type: 'number' },
  { key: 'office_flat_rate', label: 'Office Flat Rate', type: 'number' },
  { key: 'landing_tab', label: 'Landing Tab' },
  { key: 'availed_payroll', label: 'Availed Payroll', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
];

// Always diff every field regardless of which dialog variant made the edit,
// so the audit log's change summary stays accurate either way.
const PREPARER_AUDIT_FIELDS: PreparerFieldDef[] = [
  ...FULL_FIELD_LABELS,
  { key: 'notes', label: 'Notes' },
];

export const emptyPreparer: Omit<Preparer, 'id'> = {
  ptin: '', contractor: '', main_office: '', tax_office: '', efin: '', efin2: '',
  share_percent: 0, shared_efin_percent: 0, roles: '', preparer_client_percent: 0,
  office_flat_rate: 0, landing_tab: '', availed_payroll: 0, notes: '', active: true,
};

interface Props {
  open: boolean;
  editItem: Preparer | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
  fields?: PreparerFieldDef[];
}

export function PreparerEditDialog({ open, editItem, onOpenChange, onSaved, fields = FIELD_LABELS }: Props) {
  const [formData, setFormData] = useState<Omit<Preparer, 'id'>>(emptyPreparer);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) setFormData(editItem ? { ...editItem } : emptyPreparer);
  }, [open, editItem]);

  const handleDelete = async () => {
    if (!editItem) return;
    try {
      const { error } = await supabase.from('preparers').delete().eq('id', editItem.id);
      if (error) throw error;
      toast.success(`"${editItem.contractor}" deleted`);
      await logAudit({
        action: 'delete',
        entityType: 'preparer',
        entityId: editItem.id,
        entityLabel: editItem.contractor,
        summary: `Deleted preparer "${editItem.contractor}" (PTIN ${editItem.ptin}).`,
      });
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    if (!formData.ptin || !formData.contractor) { toast.error('PTIN and Contractor are required'); return; }
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase.from('preparers').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editItem.id);
        if (error) throw error;
        toast.success('Preparer updated');
        const changes = diffSummary<Preparer>(editItem, formData, PREPARER_AUDIT_FIELDS);
        await logAudit({
          action: 'update',
          entityType: 'preparer',
          entityId: editItem.id,
          entityLabel: editItem.contractor,
          summary: changes ? `Updated preparer "${editItem.contractor}" — ${changes}` : `Updated preparer "${editItem.contractor}" (no field changes).`,
        });
      } else {
        const acct = getActiveAccountId();
        const { data: ins, error } = await supabase.from('preparers').insert({ ...formData, ...(acct ? { account_id: acct } : {}) } as any).select().single();
        if (error) throw error;
        toast.success('Preparer added');
        await logAudit({ action: 'create', entityType: 'preparer', entityId: (ins as any)?.id, entityLabel: formData.contractor, summary: `Created preparer "${formData.contractor}".` });
      }
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Preparer' : 'Add New Preparer'}</DialogTitle>
          <DialogDescription>{editItem ? `Editing ${editItem.contractor}` : 'Fill in all fields to add a new preparer'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}{(f.key === 'ptin' || f.key === 'contractor') && ' *'}</label>
              {f.type === 'boolean' ? (
                <div className="mt-2">
                  <Switch
                    checked={!!formData[f.key as keyof typeof formData]}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, [f.key]: checked }))}
                  />
                </div>
              ) : (
                <Input
                  type={f.type || 'text'}
                  value={String(formData[f.key as keyof typeof formData] ?? '')}
                  onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  className="mt-1 font-mono text-sm"
                />
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2 pt-2 justify-between">
          {editItem ? (
            <Button variant="destructive" className="gap-2" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? 'Save Changes' : 'Add Preparer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDeleteDialog
      open={deleteConfirmOpen}
      onOpenChange={setDeleteConfirmOpen}
      title="Delete preparer?"
      entityName={editItem ? `${editItem.contractor} (${editItem.ptin})` : undefined}
      onConfirm={handleDelete}
    />
    </>
  );
}
