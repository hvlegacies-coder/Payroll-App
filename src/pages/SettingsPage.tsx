import { PageHeader } from '@/components/payroll/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { ExternalLink, Headset, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

const settingsSections = ['Payroll Week', 'Matching', 'Account', 'Appearance', 'Office Routing', 'Email Templates', 'Export Preferences', 'Permissions', 'Support', 'System'];

export default function SettingsPage() {
  const [tab, setTab] = useState('Payroll Week');
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleAccountSave = () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    toast.success('Account settings saved.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div>
      <PageHeader title="Settings" description="Configure system preferences and operational rules" actions={<Button>Save Changes</Button>} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 bg-surface-ash flex-wrap">{settingsSections.map(s => <TabsTrigger key={s} value={s} className="text-xs">{s}</TabsTrigger>)}</TabsList>
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          {tab === 'Payroll Week' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-medium">Payroll Week Settings</h3>
              <div className="space-y-4">
                <div><label className="text-xs font-medium text-muted-foreground">Current Payroll Week</label>
                  <Select defaultValue="w10"><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="w10">Week 10 — Mar 4–10, 2024</SelectItem><SelectItem value="w9">Week 9 — Feb 26–Mar 3, 2024</SelectItem></SelectContent></Select>
                </div>
                <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Auto-advance week</p><p className="text-xs text-muted-foreground">Automatically advance to next week on Monday</p></div><Switch defaultChecked /></div>
              </div>
            </div>
          )}
          {tab === 'Matching' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-medium">Matching Thresholds</h3>
              <div className="space-y-4">
                <div><label className="text-xs font-medium text-muted-foreground">PTIN Match Confidence (%)</label><Input type="number" defaultValue="85" className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Name Match Similarity (%)</label><Input type="number" defaultValue="80" className="mt-1" /></div>
                <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Auto-map high confidence</p><p className="text-xs text-muted-foreground">Automatically map rows above 95% confidence</p></div><Switch /></div>
              </div>
            </div>
          )}
          {tab === 'Account' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-medium flex items-center gap-2"><User className="h-4 w-4" /> Account Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Change Username</label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter new username" className="mt-1" />
                </div>
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3"><Lock className="h-4 w-4" /> Change Password</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                      <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">New Password</label>
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
                      <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="mt-1" />
                    </div>
                  </div>
                </div>
                <Button onClick={handleAccountSave}>Save Account Changes</Button>
              </div>
            </div>
          )}
          {tab === 'Appearance' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-medium">Theme</h3>
              <div className="space-y-3">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button key={t} onClick={() => setTheme(t)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${theme === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <span className="text-sm font-medium capitalize">{t} Mode</span>
                    {theme === t && <span className="text-xs text-primary font-medium">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === 'Support' && (
            <div className="space-y-6 max-w-lg">
              <h3 className="text-sm font-medium flex items-center gap-2"><Headset className="h-4 w-4" /> Customer Service</h3>
              <p className="text-sm text-muted-foreground">Need help? Open a support ticket to reach our customer service team.</p>
              <a href="https://ticket.higherviewtaxesllc.com" target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <Headset className="h-4 w-4" />
                  Open Support Ticket
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">You'll be redirected to our ticketing system at ticket.higherviewtaxesllc.com</p>
              </div>
            </div>
          )}
          {tab === 'System' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-medium">System Preferences</h3>
              <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Enable audit logging</p><p className="text-xs text-muted-foreground">Log all system events and user actions</p></div><Switch defaultChecked /></div>
              <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Send error notifications</p><p className="text-xs text-muted-foreground">Email admins when imports fail</p></div><Switch defaultChecked /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Timezone</label>
                <Select defaultValue="est"><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="est">Eastern (EST/EDT)</SelectItem><SelectItem value="cst">Central (CST/CDT)</SelectItem><SelectItem value="pst">Pacific (PST/PDT)</SelectItem></SelectContent></Select>
              </div>
            </div>
          )}
          {!['Payroll Week', 'Matching', 'Account', 'Appearance', 'Support', 'System'].includes(tab) && (
            <div className="text-center py-12"><p className="text-sm text-muted-foreground">{tab} settings — configure in this section.</p></div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
