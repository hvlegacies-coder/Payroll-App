import { Search, ChevronDown, Sun, Moon, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { NotificationPanel } from './NotificationPanel';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AccountSwitcher } from './AccountSwitcher';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { logAudit } from '@/services/auditLog';

export function AppHeader() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { weeks, selectedWeek, setSelectedWeek, refresh } = useActiveWeek();
  const [newWeekOpen, setNewWeekOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newFundFrom, setNewFundFrom] = useState('');
  const [newFundTo, setNewFundTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createWeek = async () => {
    if (!newLabel || !newDate) {
      toast.error('Label and start date required');
      return;
    }
    if (!newFundFrom || !newFundTo) {
      toast.error('Funding date range required');
      return;
    }
    if (newFundFrom > newFundTo) {
      toast.error('Funding "From" date must be on or before "To" date');
      return;
    }
    setCreating(true);
    // Deactivate all weeks
    const { error: deactivateErr } = await supabase
      .from('payroll_weeks')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (deactivateErr) {
      toast.error('Failed to archive previous weeks');
      setCreating(false);
      return;
    }
    const { error } = await supabase
      .from('payroll_weeks')
      .insert({ label: newLabel, start_date: newDate, is_active: true, funding_date_from: newFundFrom, funding_date_to: newFundTo });
    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }
    toast.success(`New week "${newLabel}" is now active. Previous payrolls archived.`);
    await logAudit({ action: 'create', entityType: 'payroll_week', entityLabel: newLabel, summary: `Started new payroll week "${newLabel}" (start ${newDate}, funding ${newFundFrom} → ${newFundTo}).` });
    await refresh();
    setSelectedWeek(newLabel);
    setNewWeekOpen(false);
    setNewLabel('');
    setNewDate('');
    setNewFundFrom('');
    setNewFundTo('');
    setCreating(false);
  };

  const deleteWeek = async () => {
    if (!selectedWeek) return;
    setDeleting(true);
    try {
      const { data: ups, error: upErr } = await supabase
        .from('uploads')
        .select('id')
        .eq('week_label', selectedWeek);
      if (upErr) throw upErr;
      const uploadIds = (ups || []).map(u => u.id);
      if (uploadIds.length) {
        await supabase.from('upload_rows').delete().in('upload_id', uploadIds);
        await supabase.from('uploads').delete().in('id', uploadIds);
      }
      await supabase.from('preparer_payroll_weeks').delete().eq('week_label', selectedWeek);
      const { error: delErr } = await supabase.from('payroll_weeks').delete().eq('label', selectedWeek);
      if (delErr) throw delErr;

      const { data: remaining } = await supabase
        .from('payroll_weeks')
        .select('*')
        .order('start_date', { ascending: false });
      const list = remaining || [];
      if (list.length && !list.some(w => w.is_active)) {
        await supabase.from('payroll_weeks').update({ is_active: true }).eq('id', list[0].id);
      }
      toast.success(`Deleted "${selectedWeek}" and its data`);
      await logAudit({ action: 'delete', entityType: 'payroll_week', entityLabel: selectedWeek, summary: `Deleted payroll week ${selectedWeek} and all associated uploads/rows.` });
      await refresh();
      setDeleteOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete week');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <header className="h-14 lg:h-16 bg-card border-b border-border flex items-center justify-between px-3 lg:px-6 gap-2 lg:gap-4 sticky top-0 z-10">
      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search payroll, preparers, offices..." className="pl-9 h-9 bg-surface-ash border-0" />
      </div>
      <div className="flex items-center gap-1.5 lg:gap-3 ml-auto">
        <AccountSwitcher />
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[160px] lg:w-[220px] h-9 text-xs lg:text-sm bg-surface-ash border-0">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map(w => (
              <SelectItem key={w.id} value={w.label}>
                {w.label}{w.is_active ? ' (active)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Start new payroll week" onClick={() => setNewWeekOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" title="Delete selected payroll week" onClick={() => setDeleteOpen(true)} disabled={!selectedWeek}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <NotificationPanel />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">AD</span>
              </div>
              <span className="text-sm font-medium hidden sm:inline">Admin</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/accounts')}>Manage sub-accounts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/login')}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={newWeekOpen} onOpenChange={setNewWeekOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start new payroll week</DialogTitle>
            <DialogDescription>
              The current week's data stays archived and viewable. New uploads will be tagged to this new week.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Week label</Label>
              <Input placeholder="e.g. April 17, 2026" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payroll date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Funding date — From</Label>
                <Input type="date" value={newFundFrom} onChange={(e) => setNewFundFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Funding date — To</Label>
                <Input type="date" value={newFundTo} onChange={(e) => setNewFundTo(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Payroll Processing and Office Summary will only include rows whose Funding Date falls within this range.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWeekOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createWeek} disabled={creating}>{creating ? 'Creating…' : 'Create week'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete payroll week?"
        entityName={selectedWeek}
        description={<>This permanently deletes <strong>{selectedWeek}</strong> along with all uploads, rows, and preparer reports tagged to it.</>}
        confirmLabel="Delete week"
        onConfirm={deleteWeek}
      />
    </header>
  );
}
