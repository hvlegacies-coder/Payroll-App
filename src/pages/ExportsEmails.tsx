import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/payroll/PageHeader';
import { KpiCard } from '@/components/payroll/KpiCard';
import { FilterBar } from '@/components/payroll/FilterBar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Inbox, Send, AlertTriangle, Paperclip, X, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveWeek } from '@/hooks/useActiveWeek';

type AppMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  status: string;
  error: string | null;
  thread_id: string | null;
  is_read: boolean;
  created_at: string;
};

const SENDER_FROM = 'payroll@wagevora.com';

// Ready-made messages tied to a payroll week. Picking one fills Subject and
// Message, which can still be edited before sending.
const TEMPLATES: Record<string, { label: string; build: (week: string, note?: string | null) => { subject: string; body: string } }> = {
  'no-payroll': {
    label: 'No payroll this week',
    build: (week, note) => ({
      subject: `No Payroll This Week — ${week}`,
      body: [
        'Hi,',
        '',
        `There is no payroll for the payroll week ${week}. No payments will be issued for this week.`,
        ...(note ? ['', `Note: ${note}`] : []),
        '',
        'Payroll will resume with the next scheduled payroll week. If you have any questions, please contact the payroll team.',
        '',
        'Thank you,',
        'Higher View Taxes Payroll',
      ].join('\n'),
    }),
  },
};

// "a@x.com, b@y.com; c@z.com" (or one per line) -> unique addresses.
const parseRecipients = (s: string) => [...new Set(s.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean))];

export default function ExportsEmails() {
  const location = useLocation();
  const initialTab: 'Inbox' | 'Sent' = location.pathname.startsWith('/inbox') ? 'Inbox' : 'Sent';
  const [tab, setTab] = useState<'Inbox' | 'Sent'>(initialTab);
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { weeks, selectedWeek } = useActiveWeek();
  const [templateKey, setTemplateKey] = useState('');
  const [templateWeek, setTemplateWeek] = useState('');

  const applyTemplate = (key: string, weekLabel: string) => {
    setTemplateKey(key);
    setTemplateWeek(weekLabel);
    const t = TEMPLATES[key];
    if (!t || !weekLabel) return;
    const w = weeks.find(x => x.label === weekLabel);
    const filled = t.build(weekLabel, w?.no_payroll_note);
    setSubject(filled.subject);
    setBody(filled.body);
  };

  const load = async () => {
    const { data, error } = await supabase
      .from('app_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error('Failed to load messages');
    } else {
      setMessages((data ?? []) as AppMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('app_messages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const list = messages.filter(m => tab === 'Inbox' ? m.direction === 'inbound' : m.direction === 'outbound');
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(m =>
      m.subject.toLowerCase().includes(q) ||
      m.from_email.toLowerCase().includes(q) ||
      m.to_email.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q),
    );
  }, [messages, tab, search]);

  const kpis = useMemo(() => {
    const inbox = messages.filter(m => m.direction === 'inbound');
    const sent = messages.filter(m => m.direction === 'outbound');
    const failed = sent.filter(m => m.status === 'failed');
    const unread = inbox.filter(m => !m.is_read).length;
    return [
      { title: 'Inbox', value: inbox.length, icon: Inbox },
      { title: 'Unread', value: unread, icon: Mail },
      { title: 'Sent', value: sent.length, icon: Send },
      { title: 'Failed', value: failed.length, icon: AlertTriangle },
    ];
  }, [messages]);

  const resetCompose = () => {
    setTo(''); setSubject(''); setBody(''); setFile(null); setTemplateKey(''); setTemplateWeek('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async () => {
    const recipients = parseRecipients(to);
    const invalid = recipients.filter(r => !/^\S+@\S+\.\S+$/.test(r));
    if (recipients.length === 0 || invalid.length > 0) {
      toast.error(invalid.length ? `Invalid email: ${invalid.join(', ')}` : 'Enter a valid recipient email');
      return;
    }
    if (!subject.trim() && !body.trim()) {
      toast.error('Add a subject or message');
      return;
    }
    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (file) {
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage
          .from('email-attachments')
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('email-attachments').getPublicUrl(path);
        attachmentUrl = pub.publicUrl;
        attachmentName = file.name;
      }

      // One message per recipient so each shows (and can fail) on its own in Sent.
      const failed: string[] = [];
      for (const recipient of recipients) {
        const id = crypto.randomUUID();

        const { error: insertErr } = await supabase.from('app_messages').insert({
          id,
          direction: 'outbound',
          from_email: SENDER_FROM,
          to_email: recipient,
          subject: subject.trim(),
          body: body,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          status: 'pending',
        });
        if (insertErr) throw insertErr;

        const { error: fnErr } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'app-message',
            recipientEmail: recipient,
            idempotencyKey: `app-message-${id}`,
            templateData: {
              subject: subject.trim(),
              body,
              attachmentUrl,
              attachmentName,
            },
          },
        });

        if (fnErr) {
          await supabase.from('app_messages').update({ status: 'failed', error: fnErr.message }).eq('id', id);
          failed.push(recipient);
        } else {
          await supabase.from('app_messages').update({ status: 'sent' }).eq('id', id);
        }
      }

      if (failed.length > 0) {
        toast.error(`Send failed for ${failed.length} of ${recipients.length}: ${failed.join(', ')}`);
      } else {
        toast.success(recipients.length > 1 ? `Email sent to ${recipients.length} recipients` : 'Email sent');
        setComposeOpen(false);
        resetCompose();
      }
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const openMessage = async (m: AppMessage) => {
    setSelected(m);
    if (m.direction === 'inbound' && !m.is_read) {
      await supabase.from('app_messages').update({ is_read: true }).eq('id', m.id);
    }
  };

  return (
    <div>
      <PageHeader title="Email" description="Send and receive payroll communications" actions={
        <Button className="gap-2" onClick={() => setComposeOpen(true)}>
          <Mail className="h-4 w-4" /> New Email
        </Button>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => <KpiCard key={k.title} {...k} />)}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4 bg-surface-ash">
          <TabsTrigger value="Inbox" className="text-xs gap-1">
            <Inbox className="h-3 w-3" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="Sent" className="text-xs gap-1">
            <Send className="h-3 w-3" /> Sent
          </TabsTrigger>
        </TabsList>
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search emails..." />

        <div className="border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {tab === 'Inbox' ? 'No messages yet. Configure your inbound email webhook to receive replies.' : 'No emails sent yet.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(m => (
                <li
                  key={m.id}
                  onClick={() => openMessage(m)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 ${m.direction === 'inbound' && !m.is_read ? 'bg-muted/30' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${m.direction === 'inbound' && !m.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {m.direction === 'inbound' ? m.from_email : m.to_email}
                      </span>
                      {m.attachment_url && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {m.direction === 'outbound' && (
                        <Badge variant={m.status === 'sent' ? 'default' : m.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                          {m.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm truncate">{m.subject || '(no subject)'}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.body.slice(0, 120)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tabs>

      {/* Compose */}
      <Dialog open={composeOpen} onOpenChange={(o) => { setComposeOpen(o); if (!o) resetCompose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Email</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Select value={templateKey} onValueChange={(k) => applyTemplate(k, templateWeek || selectedWeek)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATES).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payroll week</label>
                <Select value={templateWeek} onValueChange={(w) => applyTemplate(templateKey, w)} disabled={!templateKey}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select week" /></SelectTrigger>
                  <SelectContent>
                    {weeks.map(w => (
                      <SelectItem key={w.id} value={w.label}>{w.label}{w.no_payroll ? ' — no payroll' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Textarea value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com — separate several with commas or new lines" className="mt-1" rows={2} />
              {parseRecipients(to).length > 1 && <p className="text-[11px] text-muted-foreground mt-1">{parseRecipients(to).length} recipients — each gets their own email.</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Weekly Payroll Report" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." className="mt-1" rows={6} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Attachment</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                {file && (
                  <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {file && <p className="text-[11px] text-muted-foreground mt-1">{file.name} • {(file.size / 1024).toFixed(1)} KB — will be included as a download link.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selected.subject || '(no subject)'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-b border-border pb-3">
                  <span><strong className="text-foreground">From:</strong> {selected.from_email}</span>
                  <span><strong className="text-foreground">To:</strong> {selected.to_email}</span>
                  <span>{new Date(selected.created_at).toLocaleString()}</span>
                  {selected.direction === 'outbound' && (
                    <Badge variant={selected.status === 'sent' ? 'default' : selected.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {selected.status}
                    </Badge>
                  )}
                </div>
                {selected.error && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {selected.error}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{selected.body || '(empty)'}</div>
                {selected.attachment_url && (
                  <a
                    href={selected.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    {selected.attachment_name || 'Download attachment'}
                  </a>
                )}
                {selected.direction === 'inbound' && (
                  <div className="pt-2">
                    <Button size="sm" onClick={() => {
                      setTo(selected.from_email);
                      setSubject(selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`);
                      setBody(`\n\n— On ${new Date(selected.created_at).toLocaleString()}, ${selected.from_email} wrote:\n${selected.body.split('\n').map(l => `> ${l}`).join('\n')}`);
                      setSelected(null);
                      setComposeOpen(true);
                    }}>Reply</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
