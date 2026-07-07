import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, FileText, TrendingUp, Calendar as CalendarIcon, LogOut, User, Loader2, ChevronDown, BarChart3, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, formatMoney as fmt } from '@/lib/utils';
import hvLogo from '@/assets/hv-logo.png';
import { generatePreparerWeeklyReports } from '@/services/preparerReportGenerator';

interface EarningRow {
  efin: string;
  ptin: string;
  taxpayer_last_name: string;
  taxpayer_first_name: string;
  funding_date: string;
  taxpayer_ssn_last4: string;
  expected_tax_prep_fees: number;
  received_tax_prep_fees: number;
  high_prep_fee: number;
  after_advance: number;
  pay: number;
  preparer: string;
  tax_office: string;
  preparer_share: number;
  advance_requested: boolean;
  client_belongs_to: string;
}

interface WeekData {
  id: string;
  week_label: string;
  ptin: string;
  preparer_name: string;
  tax_office: string;
  row_data: EarningRow[];
  total_received: number;
  total_high_prep_fee: number;
  total_after_advance: number;
  total_pay: number;
  total_preparer_share: number;
  preparer_fee: number;
  total_share: number;
  created_at: string;
}

export default function MyEarnings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [preparerName, setPreparerName] = useState('');
  const [weeks, setWeeks] = useState<string[]>([]);
  const [weekMeta, setWeekMeta] = useState<{ label: string; start_date: string }[]>([]);
  const [ptin, setPtin] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [allWeekRows, setAllWeekRows] = useState<WeekData[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [mode, setMode] = useState<'week' | 'range'>('week');
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [rangeLoading, setRangeLoading] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/preparer-login'); return; }
    setUserEmail(user.email || '');

    // Get linked PTIN
    const { data: link, error: linkErr } = await supabase
      .from('preparer_users')
      .select('ptin, contractor_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (linkErr) {
      console.error('preparer_users lookup error:', linkErr);
      toast.error(`Failed to load preparer record: ${linkErr.message}`);
      await supabase.auth.signOut();
      navigate('/preparer-login');
      return;
    }
    if (!link) {
      toast.error('No preparer record linked to this account. Please register again.');
      await supabase.auth.signOut();
      navigate('/preparer-login');
      return;
    }
    setPreparerName(link.contractor_name || link.ptin);

    // Show ALL payroll weeks from the owner view in the dropdown.
    const { data: allWeeks } = await supabase
      .from('payroll_weeks')
      .select('label, start_date')
      .order('start_date', { ascending: false });
    const ownerLabels = (allWeeks || []).map(w => w.label);
    setWeekMeta((allWeeks || []) as any);
    setPtin(link.ptin);

    // Get this preparer's already-generated weekly earnings.
    let { data: weekRows } = await supabase
      .from('preparer_payroll_weeks')
      .select('*')
      .eq('ptin', link.ptin)
      .order('created_at', { ascending: false });

    if (ownerLabels.length > 0) {
      setWeeks(ownerLabels);
      const initial = ownerLabels[0];
      setSelectedWeek(initial);

      let initialRow = (weekRows || []).find(w => w.week_label === initial);
      if (!initialRow) {
        try {
          await generatePreparerWeeklyReports(initial);
          const { data: re } = await supabase
            .from('preparer_payroll_weeks')
            .select('*')
            .eq('ptin', link.ptin)
            .eq('week_label', initial)
            .maybeSingle();
          if (re) initialRow = re as any;
        } catch (err) {
          console.error(`Auto-generate earnings failed for ${initial}`, err);
        }
        const refetch = await supabase
          .from('preparer_payroll_weeks')
          .select('*')
          .eq('ptin', link.ptin)
          .order('created_at', { ascending: false });
        weekRows = refetch.data;
      }
      if (initialRow) setWeekData(initialRow as unknown as WeekData);
      setAllWeekRows((weekRows || []) as unknown as WeekData[]);
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWeekChange = async (week: string) => {
    setSelectedWeek(week);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: link } = await supabase.from('preparer_users').select('ptin').eq('user_id', user.id).single();
    if (!link) return;
    let { data } = await supabase
      .from('preparer_payroll_weeks')
      .select('*')
      .eq('ptin', link.ptin)
      .eq('week_label', week)
      .maybeSingle();
    if (!data) {
      // Auto-generate earnings on demand for the selected week.
      try {
        toast.loading(`Calculating earnings for ${week}…`, { id: 'calc-week' });
        await generatePreparerWeeklyReports(week);
        const re = await supabase
          .from('preparer_payroll_weeks')
          .select('*')
          .eq('ptin', link.ptin)
          .eq('week_label', week)
          .maybeSingle();
        data = re.data;
        toast.success(`Earnings ready for ${week}`, { id: 'calc-week' });
      } catch (err: any) {
        toast.error(`Failed to calculate ${week}: ${err.message || err}`, { id: 'calc-week' });
      }
      // Refresh full list so charts/totals include the new week.
      const { data: refetch } = await supabase
        .from('preparer_payroll_weeks')
        .select('*')
        .eq('ptin', link.ptin)
        .order('created_at', { ascending: false });
      if (refetch) setAllWeekRows(refetch as unknown as WeekData[]);
    }
    if (data) setWeekData(data as unknown as WeekData);
    else setWeekData(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/preparer-login');
  };

  const handleEmailReport = async () => {
    setSendingEmail(true);
    try {
      const weeks = (allWeekRows || []).map((w: any) => ({
        week_label: w.week_label,
        total_received: Number(w.total_received) || 0,
        total_share: Number(w.total_share) || 0,
        preparer_fee: Number(w.preparer_fee) || 0,
        returns_count: (w.row_data || []).length,
      }));
      const sw = weekData as any;
      const detailRows = (sw?.row_data || []).map((r: any) => ({
        taxpayer: r.taxpayer || `${r.taxpayer_last_name || ''}, ${r.taxpayer_first_name || ''}`.replace(/^, |, $/, '') || '—',
        efin: r.efin || '—',
        received: Number(r.received_tax_prep_fees ?? r.receivedFee ?? r.totalReceived ?? 0),
        highPrep: Number(r.high_prep_fee ?? r.highPrepFee ?? 0),
        afterAdvance: Number(r.after_advance ?? r.afterAdvance ?? 0),
        share: Number(r.preparer_share ?? r.preparerShare ?? r.totalShare ?? 0),
      }));
      const grandReceived = (allWeekRows || []).reduce((s: number, w: any) => s + (Number(w.total_received) || 0), 0);
      const grandShare = (allWeekRows || []).reduce((s: number, w: any) => s + (Number(w.total_share) || 0), 0);
      const grandFee = (allWeekRows || []).reduce((s: number, w: any) => s + (Number(w.preparer_fee) || 0), 0);
      const grandReturns = (allWeekRows || []).reduce((s: number, w: any) => s + ((w.row_data || []).length), 0);

      const { data, error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'earnings-report',
          recipientEmail: 'jayrico321@gmail.com',
          idempotencyKey: `earnings-${preparerName}-${Date.now()}`,
          templateData: {
            preparerName,
            grandReceived,
            grandShare,
            grandFee,
            grandReturns,
            weeks,
            detailRows,
            selectedWeekLabel: sw?.week_label,
          },
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Earnings report sent to jayrico321@gmail.com');
      } else {
        toast.error('Failed to send: ' + (data?.error || 'Unknown error'));
      }
    } catch (err: any) {
      toast.error('Failed to send report: ' + (err.message || 'Unknown error'));
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(40,6%,8%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  const rows = (weekData?.row_data || []) as EarningRow[];

  const applyRange = async () => {
    if (!range.from || !range.to) { toast.error('Pick a start and end date'); return; }
    const fromTs = new Date(range.from); fromTs.setHours(0,0,0,0);
    const toTs = new Date(range.to); toTs.setHours(23,59,59,999);
    const inRange = weekMeta.filter(w => {
      const d = new Date(w.start_date);
      return d >= fromTs && d <= toTs;
    });
    if (inRange.length === 0) { toast.error('No payroll weeks fall within that range'); return; }
    setRangeLoading(true);
    try {
      const collected: WeekData[] = [];
      for (const wk of inRange) {
        let { data } = await supabase
          .from('preparer_payroll_weeks').select('*')
          .eq('ptin', ptin).eq('week_label', wk.label).maybeSingle();
        if (!data) {
          try {
            await generatePreparerWeeklyReports(wk.label);
            const re = await supabase.from('preparer_payroll_weeks').select('*')
              .eq('ptin', ptin).eq('week_label', wk.label).maybeSingle();
            data = re.data;
          } catch (err) { console.error('generate failed', wk.label, err); }
        }
        if (data) collected.push(data as unknown as WeekData);
      }
      if (collected.length === 0) { toast.error('No earnings found in range'); return; }
      const sum = (k: keyof WeekData) => collected.reduce((s, w) => s + (Number(w[k] as any) || 0), 0);
      const aggregated: WeekData = {
        id: 'range-' + Date.now(),
        week_label: `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`,
        ptin, preparer_name: collected[0].preparer_name, tax_office: collected[0].tax_office,
        row_data: collected.flatMap(c => c.row_data || []),
        total_received: sum('total_received'),
        total_high_prep_fee: sum('total_high_prep_fee'),
        total_after_advance: sum('total_after_advance'),
        total_pay: sum('total_pay'),
        total_preparer_share: sum('total_preparer_share'),
        preparer_fee: sum('preparer_fee'),
        total_share: sum('total_share'),
        created_at: new Date().toISOString(),
      };
      setWeekData(aggregated);
      setSelectedWeek(aggregated.week_label);
      toast.success(`Aggregated ${collected.length} week${collected.length !== 1 ? 's' : ''}`);
    } finally { setRangeLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[hsl(40,6%,8%)]">
      {/* Header */}
      <header className="border-b border-[hsl(43,15%,20%)] bg-[hsl(40,6%,10%)] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={hvLogo} alt="HV" className="h-9 w-9 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-[hsl(43,85%,55%)]">My Earnings</h1>
              <p className="text-xs text-[hsl(40,10%,50%)]">Preparer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-[hsl(40,10%,60%)]">
              <User className="w-4 h-4" />
              <span>{preparerName}</span>
              <span className="text-[hsl(40,10%,30%)]">•</span>
              <span className="text-xs">{userEmail}</span>
            </div>
            {weekData && (
              <Button variant="outline" size="sm" onClick={handleEmailReport} disabled={sendingEmail} className="gap-1.5 border-[hsl(43,15%,25%)] text-[hsl(40,10%,60%)] hover:text-[hsl(43,85%,55%)] hover:border-[hsl(43,85%,55%,0.3)]">
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Email Report
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5 border-[hsl(43,15%,25%)] text-[hsl(40,10%,60%)] hover:text-[hsl(43,85%,55%)] hover:border-[hsl(43,85%,55%,0.3)]">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Week Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-[hsl(43,85%,55%)]" />
            <h2 className="text-xl font-semibold text-[hsl(43,20%,90%)]">{mode === 'range' ? 'Monthly Earnings' : 'Weekly Earnings'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[hsl(43,15%,25%)] overflow-hidden">
              <button onClick={() => setMode('week')} className={cn('px-3 py-1.5 text-xs', mode === 'week' ? 'bg-[hsl(43,85%,55%,0.15)] text-[hsl(43,85%,55%)]' : 'text-[hsl(40,10%,60%)]')}>Weekly</button>
              <button onClick={() => setMode('range')} className={cn('px-3 py-1.5 text-xs border-l border-[hsl(43,15%,25%)]', mode === 'range' ? 'bg-[hsl(43,85%,55%,0.15)] text-[hsl(43,85%,55%)]' : 'text-[hsl(40,10%,60%)]')}>Monthly Range</button>
            </div>
            {mode === 'week' && weeks.length > 0 && (
              <Select value={selectedWeek} onValueChange={handleWeekChange}>
                <SelectTrigger className="w-[220px] bg-[hsl(40,6%,12%)] border-[hsl(43,15%,25%)] text-[hsl(43,20%,90%)]">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(40,6%,12%)] border-[hsl(43,15%,25%)]">
                  {weeks.map(w => (
                    <SelectItem key={w} value={w} className="text-[hsl(43,20%,90%)] focus:bg-[hsl(43,85%,55%,0.1)] focus:text-[hsl(43,85%,55%)]">{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {mode === 'range' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-[hsl(43,15%,25%)] bg-[hsl(40,6%,12%)] text-[hsl(43,20%,90%)] hover:text-[hsl(43,85%,55%)]">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {range.from && range.to
                        ? `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`
                        : 'Pick date range'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={range as any}
                      onSelect={(r: any) => setRange(r || {})}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <Button size="sm" onClick={applyRange} disabled={rangeLoading || !range.from || !range.to} className="bg-[hsl(43,85%,55%)] text-[hsl(40,6%,8%)] hover:bg-[hsl(43,85%,50%)]">
                  {rangeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                </Button>
              </>
            )}
          </div>
        </div>

        {!weekData ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 mx-auto text-[hsl(40,10%,30%)] mb-4" />
            <h3 className="text-lg font-medium text-[hsl(43,20%,70%)]">No earnings data yet</h3>
            <p className="text-sm text-[hsl(40,10%,40%)] mt-1">Your weekly earnings will appear here after payroll is processed.</p>
          </div>
        ) : (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="Total Received" value={fmt(weekData.total_received)} icon={DollarSign} color="text-[hsl(43,85%,55%)]" />
              <SummaryCard label="Preparer Fee" value={fmt(weekData.preparer_fee)} icon={FileText} color="text-[hsl(0,72%,60%)]" />
              <SummaryCard label="Total Share" value={fmt(weekData.total_share)} icon={TrendingUp} color="text-[hsl(142,72%,50%)]" />
              <SummaryCard label="Returns Filed" value={String(rows.length)} icon={FileText} color="text-[hsl(210,80%,60%)]" />
            </div>

            {/* Dashboard Charts */}
            <DashboardCharts rows={rows} weeks={weeks} allWeekData={allWeekRows} weekData={weekData} />

            {/* Detailed Breakdown */}
            <div className="bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] overflow-hidden">
              <div className="p-4 border-b border-[hsl(43,15%,20%)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[hsl(43,20%,90%)]">Detailed Breakdown — {selectedWeek}</h3>
                <span className="text-xs text-[hsl(40,10%,50%)]">{rows.length} return{rows.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(43,15%,18%)]">
                      {['EFIN','PTIN','Taxpayer','Funding Date','Expected Fee','Received Fee','High Prep Fee','After Advance','Pay','Preparer Share','Client Belongs To'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-[hsl(40,10%,50%)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any, i) => (
                      <tr key={i} className="border-b border-[hsl(43,15%,14%)] hover:bg-[hsl(43,85%,55%,0.03)] transition-colors">
                        <td className="px-3 py-2 font-mono text-xs text-[hsl(43,20%,75%)]">{r.efin || '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[hsl(43,20%,75%)]">{r.ptin || '—'}</td>
                        <td className="px-3 py-2 text-[hsl(43,20%,90%)] whitespace-nowrap">{r.taxpayer || `${r.taxpayer_last_name || ''}, ${r.taxpayer_first_name || ''}`.replace(/^, |, $/,'') || '—'}</td>
                        <td className="px-3 py-2 text-[hsl(43,20%,75%)]">{r.fundingDate || r.funding_date || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(43,20%,75%)]">{fmt(r.expected_tax_prep_fees ?? r.expectedFee)}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(43,85%,55%)]">{fmt(r.received_tax_prep_fees ?? r.totalReceived ?? r.receivedFee)}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(43,20%,75%)]">{fmt(r.high_prep_fee ?? r.highPrepFee)}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(43,20%,75%)]">{fmt(r.after_advance ?? r.afterAdvance)}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(43,20%,75%)]">{fmt(r.pay ?? r.totalPay)}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-[hsl(142,72%,50%)]">{fmt(r.preparer_share ?? r.preparerShare)}</td>
                        <td className="px-3 py-2 text-[hsl(43,20%,75%)]">{r.client_belongs_to || r.clientBelongsTo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr className="bg-[hsl(43,85%,55%,0.05)] border-t-2 border-[hsl(43,85%,55%,0.2)]">
                      <td colSpan={4} className="px-3 py-2.5 text-xs font-bold text-[hsl(43,85%,55%)]">TOTAL</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(43,20%,90%)]">{fmt(rows.reduce((s, r) => s + (r.expected_tax_prep_fees || 0), 0))}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(43,85%,55%)]">{fmt(weekData.total_received)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(43,20%,90%)]">{fmt(weekData.total_high_prep_fee)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(43,20%,90%)]">{fmt(weekData.total_after_advance)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(43,20%,90%)]">{fmt(weekData.total_pay)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[hsl(142,72%,50%)]">{fmt(weekData.total_preparer_share)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Preparer Share Summary */}
            <div className="bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] p-5">
              <h3 className="text-sm font-semibold text-[hsl(43,20%,90%)] mb-4">Preparer's Share Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-[hsl(40,6%,8%)]">
                  <span className="text-xs text-[hsl(40,10%,50%)]">Preparer</span>
                  <span className="font-medium text-[hsl(43,20%,90%)]">{weekData.preparer_name}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-[hsl(40,6%,8%)]">
                  <span className="text-xs text-[hsl(40,10%,50%)]">Fee</span>
                  <span className="font-mono font-medium text-[hsl(0,72%,60%)]">{fmt(weekData.preparer_fee)}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-[hsl(40,6%,8%)]">
                  <span className="text-xs text-[hsl(40,10%,50%)]">Total Share</span>
                  <span className="font-mono font-semibold text-[hsl(142,72%,50%)] text-lg">{fmt(weekData.total_share)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const CHART_COLORS = [
  'hsl(43,85%,55%)', 'hsl(142,72%,50%)', 'hsl(210,80%,60%)', 'hsl(0,72%,60%)',
  'hsl(280,60%,55%)', 'hsl(30,80%,55%)', 'hsl(170,60%,45%)', 'hsl(340,70%,55%)',
];

function DashboardCharts({ rows, weeks, allWeekData, weekData }: { rows: EarningRow[]; weeks: string[]; allWeekData: WeekData[] | null; weekData: WeekData }) {
  // Weekly totals bar chart (all weeks)
  const weeklyTotalsData = (allWeekData || []).slice().reverse().map((w) => ({
    name: w.week_label.replace(/Week \d+ - /, ''),
    received: Number(w.total_received) || 0,
    share: Number(w.total_share) || 0,
    fee: Number(w.preparer_fee) || 0,
  }));

  // Fee breakdown pie chart
  const totalReceived = Number(weekData.total_received) || 0;
  const totalShare = Number(weekData.total_share) || 0;
  const fee = Number(weekData.preparer_fee) || 0;
  const highPrep = Number(weekData.total_high_prep_fee) || 0;
  const pieData = [
    { name: 'Your Share', value: totalShare },
    { name: 'Preparer Fee', value: fee },
    { name: 'High Prep Fee', value: highPrep },
    { name: 'Other', value: Math.max(0, totalReceived - totalShare - fee - highPrep) },
  ].filter(d => d.value > 0);

  // Cumulative earnings area
  let cumReceived = 0, cumShare = 0;
  const cumulativeData = (allWeekData || []).slice().reverse().map((w) => {
    cumReceived += Number(w.total_received) || 0;
    cumShare += Number(w.total_share) || 0;
    return { name: w.week_label.replace(/Week \d+ - /, ''), received: cumReceived, share: cumShare };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Weekly Earnings Totals */}
      <div className="lg:col-span-2 bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] p-5">
        <h3 className="text-sm font-semibold text-[hsl(43,20%,90%)] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Weekly Earnings Totals
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyTotalsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(43,15%,18%)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(40,10%,50%)' }} angle={-25} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(40,10%,50%)' }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: 'hsl(40,6%,12%)', border: '1px solid hsl(43,15%,25%)', borderRadius: 8, color: 'hsl(43,20%,90%)' }} formatter={(v: number) => [fmt(v), '']} />
            <Bar dataKey="received" fill="hsl(43,85%,55%)" radius={[4, 4, 0, 0]} name="Received" />
            <Bar dataKey="share" fill="hsl(142,72%,50%)" radius={[4, 4, 0, 0]} name="Your Share" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fee Breakdown Pie */}
      <div className="bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] p-5">
        <h3 className="text-sm font-semibold text-[hsl(43,20%,90%)] mb-3">Fee Breakdown</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} stroke="none">
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: 'hsl(40,6%,12%)', border: '1px solid hsl(43,15%,25%)', borderRadius: 8, color: 'hsl(43,20%,90%)' }} formatter={(v: number) => [fmt(v), '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {pieData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-[hsl(40,10%,60%)]">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              {d.name}
            </div>
          ))}
        </div>
      </div>

      {/* Cumulative Earnings Area */}
      <div className="lg:col-span-3 bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] p-5">
        <h3 className="text-sm font-semibold text-[hsl(43,20%,90%)] mb-3">Cumulative Earnings Over Weeks</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(43,15%,18%)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(40,10%,50%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(40,10%,50%)' }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: 'hsl(40,6%,12%)', border: '1px solid hsl(43,15%,25%)', borderRadius: 8, color: 'hsl(43,20%,90%)' }} formatter={(v: number) => [fmt(v), '']} />
            <Area type="monotone" dataKey="received" stroke="hsl(43,85%,55%)" fill="hsl(43,85%,55%,0.15)" strokeWidth={2} name="Total Received" />
            <Area type="monotone" dataKey="share" stroke="hsl(142,72%,50%)" fill="hsl(142,72%,50%,0.15)" strokeWidth={2} name="Total Share" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-[hsl(40,6%,10%)] rounded-xl border border-[hsl(43,15%,20%)] p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-[hsl(40,6%,14%)] ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-[hsl(40,10%,50%)]">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  );
}
