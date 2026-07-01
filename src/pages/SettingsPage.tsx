import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveWeek } from '@/hooks/useActiveWeek';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ExternalLink, Headset, Lock, CalendarDays, Sun, Moon, Monitor,
  Plus, CheckCircle2, Loader2, Shield, KeyRound, UserPlus, Mail,
  ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, Building2, UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TABS = ['Payroll Week', 'Account', 'Appearance', 'Support', 'Credentials'];

// Mirrors the ownerMap in Login.tsx — deduplicated by email
const OWNER_ACCOUNTS = [
  { username: 'payroll',    email: 'payroll@hvtaxprep.com',    label: 'Payroll (Admin)' },
  { username: 'michael',    email: 'michael@hvtaxprep.com',    label: 'Michael' },
  { username: 'olbrown',    email: 'olbrown@hvtaxprep.com',    label: 'OL Brown' },
  { username: 'julius',     email: 'julius@hvtaxprep.com',     label: 'Julius' },
  { username: 'higherview', email: 'higherview@hvtaxprep.com', label: 'Higher View Office' },
  { username: 'd&d',        email: 'dd@hvtaxprep.com',         label: 'D&D Office' },
  { username: 'powerplay',  email: 'powerplay@hvtaxprep.com',  label: 'PowerPlay Office' },
  { username: 's&c',        email: 'sc@hvtaxprep.com',         label: 'S&C Office' },
  { username: 'mainevent',  email: 'mainevent@hvtaxprep.com',  label: 'Main Event Office' },
  { username: 'kingj',      email: 'kingj@hvtaxprep.com',      label: 'King J Office' },
];

type PrepRow = { id: string; ptin: string; contractor: string; main_office: string };

export default function SettingsPage() {
  const [tab, setTab] = useState('Payroll Week');
  const { theme, setTheme } = useTheme();
  const { weeks, activeWeek, refresh } = useActiveWeek();
  const { user } = useAuth();

  // ── Payroll week state ──
  const [settingWeek, setSettingWeek] = useState<string | null>(null);
  const [addingWeek, setAddingWeek] = useState(false);
  const [newWeekLabel, setNewWeekLabel] = useState('');
  const [newWeekStart, setNewWeekStart] = useState('');
  const [savingWeek, setSavingWeek] = useState(false);

  // ── Account / password state ──
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // ── Credentials state ──
  const [preparers, setPreparers] = useState<PrepRow[]>([]);
  const [loadingPreparers, setLoadingPreparers] = useState(false);
  const [resetingEmail, setResetingEmail] = useState<string | null>(null);

  // Add new owner account
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [newOwnerPwShow, setNewOwnerPwShow] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);

  // Set password for existing owner/office account
  const [ownerPwId, setOwnerPwId] = useState<string | null>(null);
  const [ownerNewPw, setOwnerNewPw] = useState('');
  const [ownerPwShow, setOwnerPwShow] = useState(false);
  const [savingOwnerPw, setSavingOwnerPw] = useState(false);

  // Create / reset preparer login
  const [prepLoginId, setPrepLoginId] = useState<string | null>(null);
  const [prepEmail, setPrepEmail] = useState('');
  const [prepPassword, setPrepPassword] = useState('');
  const [prepPwShow, setPrepPwShow] = useState(false);
  const [savingPrepLogin, setSavingPrepLogin] = useState(false);

  useEffect(() => {
    if (tab === 'Credentials') loadPreparers();
  }, [tab]);

  // ── Payroll week handlers ──
  const handleSetActiveWeek = async (label: string) => {
    setSettingWeek(label);
    try {
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

  // ── Account / password handler ──
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

  // ── Credentials handlers ──
  const loadPreparers = async () => {
    setLoadingPreparers(true);
    try {
      const { data, error } = await supabase
        .from('preparers')
        .select('id, ptin, contractor, main_office')
        .order('contractor', { ascending: true });
      if (error) throw error;
      setPreparers(data ?? []);
    } catch (err: any) {
      toast.error('Could not load preparers: ' + err.message);
    } finally {
      setLoadingPreparers(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setResetingEmail(email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      toast.success(`Reset email sent to ${email}`);
    } catch (err: any) {
      toast.error('Failed to send reset email: ' + err.message);
    } finally {
      setResetingEmail(null);
    }
  };

  const createOwnerAccount = async () => {
    if (!newOwnerEmail.trim()) { toast.error('Email is required.'); return; }
    if (newOwnerPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setSavingOwner(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: newOwnerEmail.trim(),
        password: newOwnerPassword,
      });
      if (error) throw error;
      toast.success(`Account created for ${newOwnerEmail.trim()}.`);
      setNewOwnerEmail('');
      setNewOwnerPassword('');
      setShowAddOwner(false);
    } catch (err: any) {
      toast.error('Failed to create account: ' + err.message);
    } finally {
      setSavingOwner(false);
    }
  };

  const openOwnerPw = (username: string) => {
    if (ownerPwId === username) { setOwnerPwId(null); return; }
    setOwnerPwId(username);
    setOwnerNewPw('');
    setOwnerPwShow(false);
  };

  const setOwnerPassword = async (acct: typeof OWNER_ACCOUNTS[0]) => {
    if (ownerNewPw.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setSavingOwnerPw(true);
    try {
      // Try signUp first (works if account doesn't exist yet)
      const { error: signUpErr } = await supabase.auth.signUp({
        email: acct.email,
        password: ownerNewPw,
      });
      if (!signUpErr) {
        toast.success(`Account created for ${acct.label}.`);
      } else {
        // Account already exists — send reset email so they can update it
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(acct.email, {
          redirectTo: window.location.origin + '/login',
        });
        if (resetErr) throw resetErr;
        toast.success(`Reset link sent to ${acct.email} — they must click it to set the new password.`);
      }
      setOwnerPwId(null);
      setOwnerNewPw('');
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSavingOwnerPw(false);
    }
  };

  const createPreparerLogin = async (prep: PrepRow) => {
    if (!prepEmail.trim()) { toast.error('Email is required.'); return; }
    if (prepPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setSavingPrepLogin(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: prepEmail.trim(),
        password: prepPassword,
      });
      if (error) throw error;
      // Attempt to link PTIN — non-fatal if RLS blocks it
      if (data.user?.id) {
        await supabase.from('preparer_users').insert({
          user_id: data.user.id,
          ptin: prep.ptin,
          contractor_name: prep.contractor,
        });
      }
      toast.success(`Login created for ${prep.contractor} (${prep.ptin})`);
      setPrepLoginId(null);
      setPrepEmail('');
      setPrepPassword('');
    } catch (err: any) {
      toast.error('Failed to create login: ' + err.message);
    } finally {
      setSavingPrepLogin(false);
    }
  };

  const openPrepLogin = (id: string) => {
    if (prepLoginId === id) { setPrepLoginId(null); return; }
    setPrepLoginId(id);
    setPrepEmail('');
    setPrepPassword('');
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

          {/* ── Credentials ── */}
          {tab === 'Credentials' && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-primary" /> Account Credentials
                </h3>
                <p className="text-xs text-muted-foreground">Manage login accounts for owners, admins, and preparers. Use "Send Reset Email" to let them set their own password.</p>
              </div>

              {/* ── Owner & Admin Accounts ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Owner &amp; Admin Accounts</span>
                    <Badge variant="outline" className="text-[10px]">{OWNER_ACCOUNTS.length}</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setShowAddOwner(!showAddOwner)}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Account
                  </Button>
                </div>

                {showAddOwner && (
                  <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                    <p className="text-xs font-semibold flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> New Owner / Admin Account</p>
                    <div>
                      <label className="text-xs text-muted-foreground">Email *</label>
                      <Input
                        type="email"
                        value={newOwnerEmail}
                        onChange={e => setNewOwnerEmail(e.target.value)}
                        placeholder="user@hvtaxprep.com"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Temporary Password *</label>
                      <div className="relative mt-1">
                        <Input
                          type={newOwnerPwShow ? 'text' : 'password'}
                          value={newOwnerPassword}
                          onChange={e => setNewOwnerPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="text-sm pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setNewOwnerPwShow(!newOwnerPwShow)}
                        >
                          {newOwnerPwShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      After creating, add a username mapping in Login.tsx so they can log in with a username.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createOwnerAccount} disabled={savingOwner} className="gap-1.5">
                        {savingOwner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {savingOwner ? 'Creating…' : 'Create Account'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddOwner(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {OWNER_ACCOUNTS.map(acct => {
                    const isResetting = resetingEmail === acct.email;
                    const isPwOpen = ownerPwId === acct.username;
                    return (
                      <div key={acct.email} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-background hover:bg-muted/20 transition-colors">
                          <div>
                            <p className="text-sm font-medium">{acct.label}</p>
                            <p className="text-[10px] text-muted-foreground">{acct.email} · username: <span className="font-mono">{acct.username}</span></p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => sendPasswordReset(acct.email)}
                              disabled={!!resetingEmail}
                            >
                              {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                              {isResetting ? 'Sending…' : 'Reset Email'}
                            </Button>
                            <Button
                              size="sm"
                              variant={isPwOpen ? 'secondary' : 'outline'}
                              className="gap-1 h-7 text-xs"
                              onClick={() => openOwnerPw(acct.username)}
                            >
                              {isPwOpen ? <ChevronDown className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                              {isPwOpen ? 'Cancel' : 'Set Password'}
                            </Button>
                          </div>
                        </div>

                        {isPwOpen && (
                          <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/20">
                            <p className="text-xs font-semibold flex items-center gap-1.5">
                              <KeyRound className="h-3.5 w-3.5" /> Set password for {acct.label}
                            </p>
                            <div>
                              <label className="text-xs text-muted-foreground">New Password *</label>
                              <div className="relative mt-1">
                                <Input
                                  type={ownerPwShow ? 'text' : 'password'}
                                  value={ownerNewPw}
                                  onChange={e => setOwnerNewPw((e.target as HTMLInputElement).value)}
                                  placeholder="Min. 6 characters"
                                  className="text-sm pr-9"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setOwnerPwShow(!ownerPwShow)}
                                >
                                  {ownerPwShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              If this account already exists, a password reset link will be sent to <span className="font-medium">{acct.email}</span> instead.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => setOwnerPassword(acct)}
                              disabled={savingOwnerPw}
                              className="gap-1.5"
                            >
                              {savingOwnerPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                              {savingOwnerPw ? 'Saving…' : 'Save Password'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Preparer Accounts ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Preparer Login Accounts</span>
                    <Badge variant="outline" className="text-[10px]">{preparers.length}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={loadPreparers} disabled={loadingPreparers}>
                    {loadingPreparers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Each preparer below can have a login account. Click "Create Login" to set up their email + password. They will log in at the Preparer Login screen with their email and PTIN.
                </p>

                {loadingPreparers && (
                  <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading preparers…
                  </div>
                )}

                {!loadingPreparers && preparers.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No preparers found in the database.</p>
                )}

                <div className="space-y-1.5">
                  {preparers.map(prep => {
                    const isOpen = prepLoginId === prep.id;
                    const isResetting = resetingEmail === prep.id;
                    return (
                      <div key={prep.id} className="rounded-lg border border-border overflow-hidden">
                        {/* Row */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-background hover:bg-muted/20 transition-colors">
                          <div>
                            <p className="text-sm font-medium">{prep.contractor}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {prep.ptin}{prep.main_office ? ` · ${prep.main_office}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => sendPasswordReset(prep.ptin)}
                              disabled={!!resetingEmail}
                              title="Send password reset email (requires their email on file)"
                            >
                              {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                              Reset
                            </Button>
                            <Button
                              size="sm"
                              variant={isOpen ? 'secondary' : 'outline'}
                              className="gap-1 h-7 text-xs"
                              onClick={() => openPrepLogin(prep.id)}
                            >
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {isOpen ? 'Cancel' : 'Create Login'}
                            </Button>
                          </div>
                        </div>

                        {/* Inline create-login form */}
                        {isOpen && (
                          <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/20">
                            <p className="text-xs font-semibold flex items-center gap-1.5">
                              <KeyRound className="h-3.5 w-3.5" /> Set up login for {prep.contractor}
                            </p>
                            <div>
                              <label className="text-xs text-muted-foreground">Email *</label>
                              <Input
                                type="email"
                                value={prepEmail}
                                onChange={e => setPrepEmail(e.target.value)}
                                placeholder="preparer@example.com"
                                className="mt-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Temporary Password *</label>
                              <div className="relative mt-1">
                                <Input
                                  type={prepPwShow ? 'text' : 'password'}
                                  value={prepPassword}
                                  onChange={e => setPrepPassword(e.target.value)}
                                  placeholder="Min. 6 characters"
                                  className="text-sm pr-9"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setPrepPwShow(!prepPwShow)}
                                >
                                  {prepPwShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              PTIN <span className="font-mono font-medium">{prep.ptin}</span> will be linked automatically to this account.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => createPreparerLogin(prep)}
                              disabled={savingPrepLogin}
                              className="gap-1.5"
                            >
                              {savingPrepLogin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                              {savingPrepLogin ? 'Creating…' : 'Create Login'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>
          )}

        </div>
      </Tabs>
    </div>
  );
}
