import { useState } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExternalLink, Headset, Lock, CalendarDays, Sun, Moon, Monitor, Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TABS = ['Payroll Week', 'Account', 'Appearance', 'Support'];

export default function SettingsPage() {
  const [tab, setTab] = useState('Payroll Week');
  const { theme, setTheme } = useTheme();
  const { weeks, activeWeek, refresh } = useActiveWeek();
  const { user } = useAuth();

  // Payroll week state
  const [settingWeek, setSettingWeek] = useState<string | null>(null);
  const [addingWeek, setAddingWeek] = useState(false);
  const [newWeekLabel, setNewWeekLabel] = useState('');
  const [newWeekStart, setNewWeekStart] = useState('');
  const [savingWeek, setSavingWeek] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSetActiveWeek = async (label: string) => {
    setSettingWeek(label);
    try {
      // Set all weeks inactive, then set selected one active
      const { error: clearErr } = await supabase.from('payroll_weeks').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (clearErr) throw clearErr;
      const { error: setErr } = await supabase.from('payroll_weeks').update({ is_active: true }).eq('label', label);
      if (setErr) throw setErr;
      await refresh();
      toast.success(`"${label}" is now the active payroll week.`);
    } catch (err: any) {
      toast.error('Failed to update active week: ' + err.message);
    } finally {
      setSettingWeek(null);
    }
  };

  const handleAddWeek = async () => {
    if (!newWeekLabel.trim()) { toast.error('Week label is required.'); return; }
    setSavingWeek(true);
    try {
      const { error } = await supabase.from('payroll_weeks').insert({
        label: newWeekLabel.trim(),
        start_date: newWeekStart || new Date().toISOString().split('T')[0],
        is_active: false,
      });
      if (error) throw error;
      toast.success(`Week "${newWeekLabel}" added.`);
      setNewWeekLabel('');
      setNewWeekStart('');
      setAddingWeek(false);
      await refresh();
    } catch (err: any) {
      toast.error('Failed to add week: ' + err.message);
    } finally {
      setSavingWeek(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) { toast.error('Enter a new password.'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Failed to update password: ' + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage payroll weeks, account security, and appearance" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 bg-surface-ash">
          {TABS.map(s => <TabsTrigger key={s} value={s} className="text-xs">{s}</TabsTrigger>)}
        </TabsList>

        <div className="bg-card rounded-xl border border-border p-6 shadow-card">

          {/* ── Payroll Week ── */}
          {tab === 'Payroll Week' && (
            <div className="space-y-5 max-w-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Payroll Weeks</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">The active week is where new uploads are assigned. Click "Set Active" to change it.</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddingWeek(!addingWeek)}>
                  <Plus className="h-3.5 w-3.5" /> Add Week
                </Button>
              </div>

              {addingWeek && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                  <p className="text-xs font-semibold">New Payroll Week</p>
                  <div>
                    <label className="text-xs text-muted-foreground">Week Label *</label>
                    <Input value={newWeekLabel} onChange={e => setNewWeekLabel(e.target.value)} placeholder="e.g. Week 22 — May 26–Jun 1, 2026" className="mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <Input type="date" value={newWeekStart} onChange={e => setNewWeekStart(e.target.value)} className="mt-1 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddWeek} disabled={savingWeek} className="gap-1.5">
                      {savingWeek ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {savingWeek ? 'Saving…' : 'Add Week'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingWeek(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {weeks.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No payroll weeks found. Add one above.</p>
                )}
                {weeks.map(week => {
                  const isActive = week.label === activeWeek;
                  const isSetting = settingWeek === week.label;
                  return (
                    <div key={week.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        {isActive && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{week.label}</p>
                          {week.start_date && <p className="text-[10px] text-muted-foreground">Start: {week.start_date}</p>}
                        </div>
                        {isActive && <Badge variant="secondary" className="text-[10px] ml-1">Active</Badge>}
                      </div>
                      {!isActive && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSetActiveWeek(week.label)} disabled={!!settingWeek}>
                          {isSetting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set Active'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {tab === 'Account' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> Account Security</h3>

              {user?.email && (
                <div className="px-4 py-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Logged in as</p>
                  <p className="text-sm font-medium mt-0.5">{user.email}</p>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold">Change Password</p>
                <div>
                  <label className="text-xs text-muted-foreground">New Password</label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Confirm New Password</label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className="mt-1" />
                </div>
                <Button onClick={handleChangePassword} disabled={savingPassword} className="gap-2">
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {savingPassword ? 'Updating…' : 'Update Password'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {tab === 'Appearance' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-semibold">Theme</h3>
              <p className="text-xs text-muted-foreground">Choose how the app looks. System follows your device preference.</p>
              <div className="space-y-2">
                {([
                  { value: 'light', label: 'Light Mode', icon: Sun },
                  { value: 'dark', label: 'Dark Mode', icon: Moon },
                  { value: 'system', label: 'System Default', icon: Monitor },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setTheme(value)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${theme === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${theme === value ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    {theme === value && <Badge variant="secondary" className="text-[10px]">Active</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Support ── */}
          {tab === 'Support' && (
            <div className="space-y-5 max-w-lg">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Headset className="h-4 w-4" /> Customer Support</h3>
              <p className="text-sm text-muted-foreground">Need help with the app? Open a support ticket and our team will get back to you.</p>
              <a href="https://ticket.higherviewtaxesllc.com" target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <Headset className="h-4 w-4" />
                  Open Support Ticket
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">You'll be redirected to <span className="font-mono">ticket.higherviewtaxesllc.com</span></p>
              </div>
            </div>
          )}

        </div>
      </Tabs>
    </div>
  );
}
