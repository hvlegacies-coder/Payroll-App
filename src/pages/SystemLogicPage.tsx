import { PageHeader } from '@/components/payroll/PageHeader';
import { ALL_OFFICES, HIGHER_VIEW_FEE_EXCLUDED_PREPARERS, HIGHER_VIEW_PREPARER_FEE } from '@/services/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Upload, GitMerge, Calculator, DollarSign, Building2, Users,
  ArrowRight, CheckCircle2, AlertCircle, Info, Layers, FileText,
  Banknote, Percent, Hash, Mail, RefreshCw
} from 'lucide-react';

// ─── Reusable mini components ─────────────────────────────────────────────────

function SectionHeader({ icon: Icon, color, title, subtitle }: { icon: any; color: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color} shrink-0`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Formula({ label, formula }: { label?: string; formula: string }) {
  return (
    <div className="mt-3 bg-muted/50 rounded-lg px-4 py-2.5 border border-border">
      {label && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>}
      <code className="text-xs font-mono text-primary">{formula}</code>
    </div>
  );
}

function Rule({ text, type = 'default' }: { text: string; type?: 'default' | 'note' | 'warning' | 'example' }) {
  const styles = {
    default: 'text-foreground',
    note: 'text-muted-foreground italic',
    warning: 'text-amber-600 dark:text-amber-400',
    example: 'text-emerald-600 dark:text-emerald-400',
  };
  const icons = { default: '→', note: 'ℹ', warning: '⚠', example: '✦' };
  return (
    <li className="flex items-start gap-2 text-xs py-1">
      <span className="text-primary font-bold shrink-0 mt-0.5">{icons[type]}</span>
      <span className={styles[type]}>{text}</span>
    </li>
  );
}

function StepFlow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20">
            <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
            {step}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemLogicPage() {
  return (
    <div>
      <PageHeader
        title="How the App Works"
        description="Plain-English guide to every calculation and rule in the payroll system"
      />

      {/* ── Overview Flow ── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 shadow-card">
        <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> The Big Picture</p>
        <p className="text-xs text-muted-foreground mb-3">Every week, five reports are uploaded and the system processes them in this order:</p>
        <StepFlow steps={['Upload Reports', 'Match PTINs & Clients', 'Calculate Pay', 'Apply Fees & Advances', 'Distribute to Offices']} />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
          {[
            { label: 'Payroll Report', desc: 'Primary source — who earned what', color: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' },
            { label: 'Backend Money', desc: 'Add-on fees owed back to offices', color: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' },
            { label: 'Advance Report', desc: 'Loan / advance tracking per client', color: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' },
            { label: 'Client Data', desc: 'Client → preparer ownership', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
            { label: 'Fee Intercept', desc: 'Daily intercept per sub-office', color: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' },
          ].map(r => (
            <div key={r.label} className={`rounded-lg border px-3 py-2 text-[10px] ${r.color}`}>
              <p className="font-semibold">{r.label}</p>
              <p className="opacity-80 mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['ptin', 'pay', 'share', 'fees', 'totals', 'status', 'constants']} className="space-y-3">

        {/* ── 1. PTIN & Data Matching ── */}
        <AccordionItem value="ptin" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={GitMerge} color="bg-blue-500" title="1. PTIN Matching & Data Linking" subtitle="How the system identifies which preparer each client row belongs to" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-muted-foreground mb-3">When a payroll report row comes in, the system looks up the PTIN in the <strong>Master PTIN (Preparers)</strong> table to find the preparer's office, share %, and pay rules.</p>
            <ul className="space-y-0.5">
              <Rule text="PTIN is unique in the lookup table → match immediately, no extra checks needed" />
              <Rule text="PTIN appears more than once → also require the row's EFIN to match the preparer's EFIN or secondary EFIN" />
              <Rule text="Duplicate PTIN but EFIN doesn't match any preparer → row is marked 'No Match'" />
              <Rule text="PTIN not found at all in the lookup → row is marked 'PTIN not in lookup'" />
              <Rule text="'No Match' and 'PTIN not in lookup' rows are excluded from all pay totals until manually corrected" type="warning" />
            </ul>

            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold mb-2">Client Ownership Matching</p>
              <ul className="space-y-0.5">
                <Rule text="The system matches clients from the Client Data report using SSN last 4 digits + fuzzy name matching" />
                <Rule text="A match fills the 'Client Belongs To' field — this determines Higher View's preparer share split" />
                <Rule text="Client Email enrichment works the same way — only fills email if it's currently blank (never overwrites)" />
              </ul>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold mb-2">Advance Deduplication</p>
              <ul className="space-y-0.5">
                <Rule text="Key = SSN last 4 + first name + last name" />
                <Rule text="If a duplicate appears, the newer record replaces the older one — but the 'Deducted' flag and notes are kept from the original" />
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 2. Pay Calculation ── */}
        <AccordionItem value="pay" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Calculator} color="bg-emerald-500" title="2. Pay Calculation" subtitle="How each preparer's weekly pay is computed from their received fees" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold mb-1">Step 1 — Advance Deduction</p>
                <p className="text-xs text-muted-foreground">If the client requested a loan (advance), $100 is deducted before any pay is calculated. This covers the advance processing fee.</p>
                <ul className="space-y-0.5 mt-2">
                  <Rule text="No advance requested → After Advance = Received Tax Prep Fees (no change)" />
                  <Rule text="Advance requested → After Advance = Received Tax Prep Fees − $100 (minimum $0)" />
                  <Rule text="Example: Preparer earned $350, client had advance → After Advance = $350 − $100 = $250" type="example" />
                </ul>
                <Formula label="Formula" formula="after_advance = max(0, received_tax_prep_fees − (advance ? 100 : 0))" />
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold mb-1">Step 2 — Pay Percentage</p>
                <p className="text-xs text-muted-foreground">Once After Advance is known, the system applies a percentage to get the preparer's pay. The percentage comes from the preparer's lookup record.</p>
                <ul className="space-y-0.5 mt-2">
                  <Rule text="After Advance = $0 → Pay = $0 (nothing to pay out)" />
                  <Rule text="Normal case → Pay = After Advance × (Share % / 100)" />
                  <Rule text="Shared EFIN case (preparer is under a different office's EFIN) → Pay = After Advance × (Shared EFIN % / 100) instead" />
                  <Rule text="Example: After Advance = $250, Share % = 60% → Pay = $250 × 0.60 = $150" type="example" />
                </ul>
                <Formula label="Formula" formula="pay = after_advance × (share_percent / 100)" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 3. Preparer Share ── */}
        <AccordionItem value="share" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Percent} color="bg-violet-500" title="3. Preparer Share (by Office)" subtitle="Different offices have different rules for splitting the preparer's portion" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-muted-foreground mb-3">After pay is calculated, the system determines the <strong>Preparer Share</strong> — the amount the preparer actually takes home. This varies by office.</p>

            <div className="grid gap-3">
              {/* Higher View */}
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">Higher View</Badge>
                  <p className="text-xs font-semibold">Two-path logic based on who the client belongs to</p>
                </div>
                <ul className="space-y-0.5">
                  <Rule text="After Advance = $0 → Preparer Share = $0" />
                  <Rule text="Client belongs to this preparer → Share = min(Received Fees × preparer_client_percent%, After Advance)" />
                  <Rule text="Client does NOT belong to this preparer → Share = min(office_flat_rate, After Advance)" />
                  <Rule text="Example: Client belongs to preparer, Received = $400, preparer_client_percent = 50% → Share = min($200, After Advance)" type="example" />
                </ul>
                <Formula label="Path A (client is theirs)" formula="preparer_share = min(received_fees × (preparer_client_percent / 100), after_advance)" />
                <Formula label="Path B (client is not theirs)" formula="preparer_share = min(office_flat_rate, after_advance)" />
              </div>

              {/* King J */}
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">King J</Badge>
                  <p className="text-xs font-semibold">Fixed percentage of After Advance</p>
                </div>
                <ul className="space-y-0.5">
                  <Rule text="After Advance = $0 → Preparer Share = $0" />
                  <Rule text="Otherwise → Share = After Advance × kingj_preparer_share%" />
                  <Rule text="The kingj_preparer_share % comes from the preparer's lookup record" type="note" />
                </ul>
                <Formula label="Formula" formula="preparer_share = after_advance × (kingj_preparer_share / 100)" />
              </div>

              {/* All other offices */}
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]">All Other Offices</Badge>
                  <p className="text-xs font-semibold">Preparer Share = Pay (same as Step 2)</p>
                </div>
                <ul className="space-y-0.5">
                  <Rule text="For D&D, PowerPlay, S&C, Main Event, etc. → Preparer Share equals the Pay calculated in Step 2" />
                  <Rule text="No secondary split — what they earn, they keep (minus the office's share from the fee structure)" />
                </ul>
                <Formula label="Formula" formula="preparer_share = pay  (same value as Step 2)" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 4. Fees & Deductions ── */}
        <AccordionItem value="fees" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={DollarSign} color="bg-rose-500" title="4. Fees & Deductions" subtitle="Preparer fees, transmitter fees, backend money, and fee intercepts" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4">

              <div>
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-primary" /> Preparer Fee (Higher View only)</p>
                <p className="text-xs text-muted-foreground mb-2">A fixed per-preparer fee charged by the office. Applied once per preparer per payroll run, not per client.</p>
                <ul className="space-y-0.5">
                  <Rule text={`Default fee = $${HIGHER_VIEW_PREPARER_FEE} per preparer`} />
                  <Rule text={`Excluded preparers pay $0 fee: ${HIGHER_VIEW_FEE_EXCLUDED_PREPARERS.join(', ')}`} />
                  <Rule text="Matching is by case-insensitive name — partial name matches count" type="note" />
                </ul>
                <Formula label="Per preparer total" formula={`preparer_fee = $${HIGHER_VIEW_PREPARER_FEE}  (or $0 if excluded)`} />
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-primary" /> Transmitter Fee</p>
                <p className="text-xs text-muted-foreground mb-2">The office keeps the portion of the transmitter fee above $10 per row. The first $10 is absorbed.</p>
                <ul className="space-y-0.5">
                  <Rule text="Fee ≤ $10 → office keeps $0  (e.g. $8 fee → $0 credited)" />
                  <Rule text="Fee > $10 → office keeps (fee − $10)  (e.g. $15 fee → $5 credited)" />
                  <Rule text="Example: Row has $12 transmitter fee → office receives $2" type="example" />
                  <Rule text="Rows without a tax office are skipped" type="note" />
                </ul>
                <Formula label="Per row" formula="credited = max(0, transmitter_fee − 10)" />
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-primary" /> Backend Money</p>
                <p className="text-xs text-muted-foreground mb-2">Money owed back to offices from add-on fees (software fees, service bureau fees, etc.). Configured in the office's Backend Fee section.</p>
                <ul className="space-y-0.5">
                  <Rule text="Sourced from the Backend Money Report upload" />
                  <Rule text="Each office's backend total = sum of received_amount rows for that office" />
                  <Rule text="Added to the office's Net Pay at the end (AGI + Backend Money = Net Pay)" />
                  <Rule text="Fee split between offices is configured per fee type: Percentage, Flat Rate, or Remaining (auto-calculated remainder)" />
                </ul>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Fee Intercept</p>
                <p className="text-xs text-muted-foreground mb-2">Daily deposit fees intercepted at the sub-office level. Matched by EFIN → Tax Office and aggregated per office.</p>
                <ul className="space-y-0.5">
                  <Rule text="Match: row EFIN → lookup EFIN or secondary EFIN → find office name" />
                  <Rule text="Aggregate intercept_amount per office" />
                  <Rule text="Included in the office's Total Fees Due calculation" />
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 5. Office Report Totals ── */}
        <AccordionItem value="totals" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Building2} color="bg-amber-500" title="5. Office Report Totals" subtitle="How AGI and Net Pay are built from all the pieces above" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-muted-foreground mb-3">The Office Summary page rolls up all rows for a given office into a single financial picture. Here's how each number is built:</p>

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Total Received Prep Fees', formula: 'Σ received_tax_prep_fees (all rows for this office)', desc: 'Sum of all client fees received by the office this week' },
                  { label: 'High Prep Fee Total', formula: 'Σ received_tax_prep_fees WHERE high_prep_fee = true', desc: 'Sum of fees flagged as high — these are charged to the office' },
                  { label: 'Preparer Fee Total', formula: 'Σ preparer_fee per preparer (from Preparer Share rollup)', desc: 'Total of all per-preparer fixed fees across this office' },
                  { label: 'Transmitter Fee Total', formula: 'Σ max(0, transmitter_fee − 10) per row', desc: 'Office\'s share of transmitter fees (amount above $10 per row)' },
                  { label: 'Total Fees Due', formula: 'High Prep Fee + Preparer Fee + Fee Intercept + Transmitter Fee', desc: 'Everything the office owes before calculating AGI' },
                  { label: 'AGI (Adjusted Gross Income)', formula: 'Total Received Prep Fees − Total Fees Due', desc: 'What\'s left after all fees are deducted' },
                  { label: 'Backend Money', formula: 'Σ received_amount from Backend Money Report (this office)', desc: 'Add-on fee money coming back to the office' },
                  { label: 'Net Pay', formula: 'AGI + Backend Money', desc: 'Final amount the office actually receives' },
                ].map(item => (
                  <div key={item.label} className="border border-border rounded-lg p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{item.label}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                    <code className="text-[10px] font-mono text-primary bg-muted/50 px-2 py-1 rounded mt-1.5 block">{item.formula}</code>
                  </div>
                ))}
              </div>

              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 mt-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">⚠ D&D Special Rule</p>
                <p className="text-xs text-muted-foreground">When the office is <strong>D&D</strong>, all Tax Champions rows are automatically folded into D&D's totals. Every metric (received fees, pay, preparer share, transmitter, backend, etc.) includes both D&D and Tax Champions rows.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 6. Preparer Share Rollup ── */}
        <AccordionItem value="rollup" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Users} color="bg-teal-500" title="6. Preparer Share Rollup" subtitle="How individual preparer earnings are grouped and summarized" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-muted-foreground mb-3">For the Preparer Share table, rows are grouped by preparer name and summarized into one block per preparer.</p>
            <ul className="space-y-0.5">
              <Rule text="Group all bucket rows by preparer name (rows with blank preparer names are skipped)" />
              <Rule text="total_received = sum of received_tax_prep_fees across all that preparer's rows" />
              <Rule text="preparer_fee = the fixed Higher View fee ($HIGHER_VIEW_PREPARER_FEE) unless the preparer is excluded ($0)" />
              <Rule text="total_share = max(0, total_received − preparer_fee)" />
              <Rule text="Share % and PTIN are pulled from the Master PTIN (Preparers) table by matching the preparer's contractor name" />
            </ul>
            <Formula label="Per preparer" formula={`total_share = max(0, total_received − $${HIGHER_VIEW_PREPARER_FEE})`} />
          </AccordionContent>
        </AccordionItem>

        {/* ── 7. Row Status Flow ── */}
        <AccordionItem value="status" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={RefreshCw} color="bg-indigo-500" title="7. Row Status Flow" subtitle="What each status means and how rows move through the system" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <StepFlow steps={['imported', 'mapped', 'calculated', 'advance_applied', 'distributed', 'sent', 'archived']} />
            <div className="mt-4 space-y-2">
              {[
                { status: 'imported', desc: 'Row was just uploaded from the payroll report. No matching has happened yet.', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
                { status: 'mapped', desc: 'PTIN was found in the lookup table. Preparer, office, and pay % are now known.', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300' },
                { status: 'calculated', desc: 'Pay and Preparer Share have been computed using the formulas above.', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
                { status: 'advance_applied', desc: 'Advance deduction ($100) has been applied if the client requested one.', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
                { status: 'distributed', desc: 'Row has been assigned to the correct office\'s report sheet.', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
                { status: 'sent', desc: 'Earnings report email has been sent to the preparer.', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-300' },
                { status: 'archived', desc: 'Row is finalized and stored for record-keeping.', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-300' },
                { status: 'no_match', desc: '⚠ Duplicate PTIN with no EFIN match. Must be corrected manually.', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
                { status: 'ptin_not_found', desc: '⚠ PTIN not in the Preparers table at all. Add the preparer first.', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
                { status: 'missing_office', desc: '⚠ Office could not be determined from the lookup.', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
              ].map(item => (
                <div key={item.status} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${item.color} bg-opacity-50`}>
                  <code className="text-[10px] font-mono font-bold shrink-0 mt-0.5">{item.status}</code>
                  <p className="text-[10px]">{item.desc}</p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 8. Distribution & Routing ── */}
        <AccordionItem value="routing" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Upload} color="bg-cyan-500" title="8. Distribution & Routing" subtitle="How rows get assigned to the right office tab" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-0.5">
              <Rule text="Each preparer has a 'landing_tab' field in the lookup table — this tells the system which office tab to route the row to" />
              <Rule text="Before writing new period data, all previous data for that office is cleared first (clean slate each week)" />
              <Rule text="Rows are sorted by Tax Office first, then by Preparer name within each office" />
              <Rule text="Fee Intercept rows are matched by EFIN → office name and aggregated separately" />
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* ── 9. Email System ── */}
        <AccordionItem value="email" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Mail} color="bg-pink-500" title="9. Email & Notifications" subtitle="How earnings reports are sent to preparers" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-0.5">
              <Rule text="Earnings report emails are sent from the Email / Exports page" />
              <Rule text="Sent in batches of 10 messages per cycle with a 200ms delay between sends" />
              <Rule text="Transactional email links expire after 60 minutes" />
              <Rule text="Auth emails (password reset, verification) expire after 15 minutes" />
              <Rule text="Preparers must have an email on file (from Client Email enrichment or entered manually)" type="note" />
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* ── 10. System Constants ── */}
        <AccordionItem value="constants" className="bg-card border border-border rounded-xl shadow-card px-5 py-1">
          <AccordionTrigger className="hover:no-underline py-4">
            <SectionHeader icon={Info} color="bg-gray-500" title="10. Fixed Values & Constants" subtitle="Hard-coded numbers used throughout all calculations" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Advance fee deduction', value: '$100 per client', desc: 'Deducted before pay calc when client requested an advance' },
                { label: 'Transmitter fee threshold', value: '$10 per row', desc: 'Office keeps the amount above $10 per row; $10 or less = $0' },
                { label: 'Higher View preparer fee', value: `$${HIGHER_VIEW_PREPARER_FEE} per preparer`, desc: 'Charged once per preparer per payroll run' },
                { label: 'Excluded from preparer fee', value: HIGHER_VIEW_FEE_EXCLUDED_PREPARERS.join(', ') || 'None', desc: 'These preparers are charged $0 instead of the default fee' },
                { label: 'Email batch size', value: '10 messages per cycle', desc: 'How many emails are sent at once' },
                { label: 'Email send delay', value: '200 ms between sends', desc: 'Pause between each email to avoid spam filters' },
                { label: 'Transactional email TTL', value: '60 minutes', desc: 'Report links expire after this time' },
                { label: 'Auth email TTL', value: '15 minutes', desc: 'Password reset / verification links expire after this time' },
              ].map(item => (
                <div key={item.label} className="border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{item.value}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> All Offices</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_OFFICES.map(o => (
                  <span key={o} className="text-[10px] px-2.5 py-1 bg-muted rounded-lg font-medium border border-border">{o}</span>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
