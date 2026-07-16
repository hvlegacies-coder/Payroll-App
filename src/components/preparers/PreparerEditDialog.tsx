import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAudit, diffSummary } from '@/services/auditLog';
import { getActiveAccountId } from '@/contexts/AccountContext';

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

// Fields shown in the Add/Edit dialog, also used to build the audit log's
// field-level change summary (which field changed, old → new value).
export const FIELD_LABELS: { key: keyof Preparer; label: string; type?: 'number' }[] = [
  { key: 'ptin', label: 'PTIN' },
  { key: 'contractor', label: 'Contractor Name' },
  { key: 'tax_office', label: 'Office' },
  { key: 'roles', label: 'Roles' },
  { key: 'preparer_client_percent', label: 'Preparer Client %', type: 'number' },
  { key: 'office_flat_rate', label: 'Office Flat Rate', type: 'number' },
];

const PREPARER_AUDIT_FIELDS: { key: keyof Preparer; label: string }[] = [
  ...FIELD_LABELS,
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
}

export function PreparerEditDialog({ open, editItem, onOpenChange, onSaved }: Props) {
  const [formData, setFormData] = useState<Omit<Preparer, 'id'>>(emptyPreparer);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFormData(editItem ? { ...editItem } : emptyPreparer);
  }, [open, editItem]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Preparer' : 'Add New Preparer'}</DialogTitle>
          <DialogDescription>{editItem ? `Editing ${editItem.contractor}` : 'Fill in all fields to add a new preparer'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {FIELD_LABELS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}{(f.key === 'ptin' || f.key === 'contractor') && ' *'}</label>
              <Input
                type={f.type || 'text'}
                value={String(formData[f.key as keyof typeof formData] ?? '')}
                onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                className="mt-1 font-mono text-sm"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2 pt-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editItem ? 'Save Changes' : 'Add Preparer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
