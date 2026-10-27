import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FEE_TYPES, type FeeType, type FeeConfigEntry,
  EFIN_TILE_BY_OFFICE, EFIN_TILE_FALLBACK_BY_OFFICE, TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW,
  SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES, SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES,
  SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE, SERVICE_BUREAU_FEE_D_AND_D_WHITELIST,
  SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST, EFILE_FEE_D_AND_D_WHITELIST, EFILE_DOWNLINES_D_AND_D_WHITELIST,
  PTIN_OFFICE_OVERRIDES, buildBackendLookups, resolveTaxOffice, buildRollupOffices,
  computeEffectiveEfin, getBackendRowContribution, getFieldValue, normalizeOfficeName,
} from '../src/components/office-summary/backendContributors';
import { PREPARER_FEE, fundingDay, makeFundingRangeFilter } from '../src/lib/payrollRules';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const list = (s: Iterable<string>) => [...s].join(', ');
const efinTiles = Object.entries(EFIN_TILE_BY_OFFICE)
  .map(([o, e]) => `${o}=${e}${EFIN_TILE_FALLBACK_BY_OFFICE[o] ? ` (+${EFIN_TILE_FALLBACK_BY_OFFICE[o]})` : ''}`)
  .join(', ');

// Rule lists are rendered from the same constants the Office Summary uses, so
// the assistant's knowledge can't drift from the app.
const KNOWLEDGE_BASE = `
You are the assistant inside Higher View Taxes, a payroll operations app for a network of tax offices (live at www.wagevora.com). Office managers and admins ask you how the app works and why a number is what it is. Answer in plain English, concisely, with exact formulas and dollar amounts when they matter. Say which page and section to look at. If you don't know something, say so — never guess a number.

WEEKLY FLOW
Each payroll week (payroll_weeks.label, e.g. "10/23/2026") admins upload reports on Upload Center: Payroll Report (every funded return: preparer PTIN, EFIN, Received Tax Prep Fee(s), fees, Funding Date), Backend Money Report (same columns; source of the backend fee tiles), Advance Report (clients who took a refund advance), Client Data Report (who each client "belongs to"), Client Email Report, Fee Intercept Report. A week may have a funding-date range (funding_date_from/to); then only returns whose Funding Date falls in that range count. Ranges compare calendar days, so every timezone sees the same rows. Week labels must match exactly — "data test" and "data    test" are different weeks.

PAGES
Dashboard; Upload Center; Payroll Processing (row-level pay for the week); Preparers (Master PTIN list, per-preparer office, share settings; "update reports" recalculates saved earnings); Offices (share %, EFINs, parent office, flags); Office Summary (/higher-view: per-office summary tables, backend fee tiles, Preparer Share table, Source Rows panel); Advances; Fee Intercept; Clients; Backend table; My Earnings (preparer's saved weekly earnings, emailed to preparers); Exports & Emails; App Health (automatic integrity checks with an "explain" button); Data Dictionary; System Logic.

PER-RETURN CALCULATION (Office Summary, My Earnings, earnings emails)
1. Preparer and office: the row's PTIN finds the preparer in Preparers; the preparer's Tax Office must exactly match an office name. If a PTIN is under several offices, the one whose EFIN matches the row wins. A preparer whose Tax Office isn't a real office (e.g. "Instant Tax" instead of "Instant") is a data error: the return is left out of office fee tiles and paid at 100%. App Health lists these.
2. Advance: if the client is on the week's Advance Report (SSN last 4 + first/last name at least 85% similar) and the office has process_advance on, After Advance = max(0, Received − $100); otherwise After Advance = Received.
3. Pay = After Advance × office share_percent (offices table). If the preparer's office isn't configured, Pay = After Advance (100%).
4. Preparer Share (only offices with process_preparers_share on; today only Higher View):
   - Client belongs to "Preparer": min(Pay × preparer_client_percent, Pay)
   - Client belongs to blank: the office's default_preparers_share (Higher View: office_flat_rate)
   - Otherwise: office_flat_rate
   Client ownership comes from the week's Client Data Report; Clients-page overrides (client_overrides) win.
   Known open question: the Payroll Processing page instead uses min(Received × preparer_client_percent, After Advance). The two differ only for the preparer's own clients who took an advance. The owner has not yet confirmed which is correct — say so if asked.
5. Preparer fee: $${PREPARER_FEE} per preparer per payroll run, charged only when the preparer earned a share; at Higher View $${PREPARER_FEE} per distinct funding-date month. Net = Preparer Share − fee. Admins can override a preparer's fee or gross share on the Preparer Share table; overrides, notes and colors are stored in the database and shared by all admins.

OFFICE SUMMARY TABLES
Each office has saved summary tables (office_summary_configs). Built-in fields: Received Tax Prep Fees, Pay, After Advance, Preparer Share totals; AGI = Pay − Fees Due (the "Fees Due" table total); Higher View Cut = −Received + Pay; Processing Fee at King J = $10 × payroll rows (a manual value overrides). D & D's per-row totals also include Tax Champions rows. Values that match a Source Rows total show a "src" badge and always equal that total.

BACKEND FEE TILES (Office Summary → backend money, from the Backend Money Report)
Every row is assigned a source office (preparer office by PTIN; else by EFIN). Overrides: ${Object.entries(PTIN_OFFICE_OVERRIDES).map(([p, o]) => `${p.toUpperCase()} → ${o}`).join(', ')}.
- Transmitter Fee counts only the amount above $10 per return (max(0, fee − 10)).
- Higher View, Transmitter Fee: from ${list(TRANSMITTER_FEE_WHITELIST_HIGHER_VIEW)}.
- Higher View, Service Bureau Fee: full amount from ${list(SERVICE_BUREAU_FEE_HIGHER_VIEW_FULL_OFFICES)}; amount minus $${SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_RATE} from ${list(SERVICE_BUREAU_FEE_HIGHER_VIEW_SPLIT_OFFICES)}.
- D & D, Transmitter Fee: D & D and offices whose parent office is D & D (one level only).
- D & D, Service Bureau Fee: from ${list(SERVICE_BUREAU_FEE_D_AND_D_WHITELIST)}.
- D & D, E-File Fee(s): from ${list(EFILE_FEE_D_AND_D_WHITELIST)}. E-File Downlines: from ${list(EFILE_DOWNLINES_D_AND_D_WHITELIST)}.
- PowerPlay, Service Bureau Fee: from ${list(SERVICE_BUREAU_FEE_POWERPLAY_WHITELIST)}.
- EFIN tiles (E-File-EFIN / ERO3-EFIN, raw sum of rows with that EFIN): ${efinTiles}. These are a filtered view of the same E-File/ERO3 money, not extra money — never add them to the E-File Fee(s) or ERO3Fee tiles. E-File Downlines exists only for D & D.
- Which tiles feed a summary total (e.g. "Total Backend Money") is set in that office's saved summary table, not fixed.
- Every other fee/office pair is split by the source office's Fee Settings (office_fee_configs: percentage, flat_rate, or remaining).

USING YOUR TOOLS
You can read live data (read-only) when the user is a signed-in admin. Use the tools instead of guessing whenever a question is about real numbers, a specific week, office, preparer or client. backend_fee_breakdown reproduces the backend fee tiles exactly. Start from payroll_weeks to find the exact week label (is_active marks the current week). Never reveal SSNs, bank or card numbers. If the tools are unavailable, explain the rule and tell the user where in the app to check.
`;

const TABLES: Record<string, string> = {
  offices: 'office_name, active, share_percent, primary_efin, secondary_efin, extra_efins, parent_office, process_advance, process_preparers_share, default_preparers_share, process_frontend, process_backend, notes',
  preparers: 'contractor, ptin, tax_office, active, efin, efin2, share_percent, shared_efin_percent, preparer_client_percent, office_flat_rate, landing_tab, main_office, notes',
  payroll_weeks: 'label, is_active, start_date, funding_date_from, funding_date_to, created_at',
  uploads: 'id, type, week_label, filename, rows_detected, status, uploaded_by, uploaded_date, created_at',
  office_fee_configs: 'office_name, fee_type, target_office, mode, value',
  preparer_payroll_weeks: 'week_label, ptin, preparer_name, tax_office, total_received, total_after_advance, total_pay, total_preparer_share, preparer_fee, total_share, total_high_prep_fee',
  preparer_share_state: 'key, value, updated_at',
  referral_office_mapping: 'referrer_name, referrer_email, office_name',
  audit_log: 'created_at, actor, action, entity_type, entity_label, summary',
};

const REPORT_TYPES = ['Payroll Report', 'Backend Money Report', 'Advance Report', 'Client Data Report', 'Fee Intercept Report'];
// Only these row fields ever reach the model — never SSNs, bank or card numbers.
const SAFE_ROW_FIELDS = [
  'Taxpayer Last Name', 'Taxpayer First Name', 'EFIN', 'PTIN', 'Funding Date', 'Received Tax Prep Fee(s)',
  'High Prep Fee', 'Service Bureau Fee', 'Transmitter Fee', 'E-File Fee(s)', 'ERO3Fee', 'Check Status',
  'LAST_NAME', 'FIRST_NAME', 'Client Name', 'Client Belongs To',
];

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'query_table',
    description: `Read rows from one app table (read-only, max 200 rows). Tables and their columns: ${Object.entries(TABLES).map(([t, c]) => `${t} (${c})`).join('; ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: Object.keys(TABLES) },
        columns: { type: 'array', items: { type: 'string' }, description: 'Columns to return; omit for the default set.' },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'is'] },
              value: { type: ['string', 'number', 'boolean', 'null'] },
            },
            required: ['column', 'op', 'value'],
          },
        },
        order_by: { type: 'string' },
        descending: { type: 'boolean' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      required: ['table'],
    },
  },
  {
    name: 'find_upload_rows',
    description: "Find returns in one week's uploaded report, optionally matching a taxpayer name, PTIN or EFIN. Returns fee columns, the funding date, and the source office the app assigns. SSNs and account numbers are never included.",
    input_schema: {
      type: 'object',
      properties: {
        week_label: { type: 'string', description: 'Exact payroll_weeks.label.' },
        report_type: { type: 'string', enum: REPORT_TYPES },
        search: { type: 'string', description: 'Case-insensitive text matched against taxpayer name, PTIN and EFIN.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['week_label'],
    },
  },
  {
    name: 'backend_fee_breakdown',
    description: "Compute an office's backend fee tiles for a week exactly as Office Summary does: total per fee type and the amount from each source office. Respects the week's funding-date range.",
    input_schema: {
      type: 'object',
      properties: {
        week_label: { type: 'string', description: 'Exact payroll_weeks.label.' },
        office: { type: 'string', description: 'Exact office name, e.g. "Higher View", "D & D", "King J".' },
      },
      required: ['week_label', 'office'],
    },
  },
];

const MAX_RESULT_CHARS = 40000;
const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'is']);

function clip(value: unknown): string {
  const s = JSON.stringify(value);
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}… (truncated)` : s;
}

async function weekRows(db: SupabaseClient, weekLabel: string, type: string, filterRange: boolean) {
  const { data: uploads, error } = await db.from('uploads').select('id').eq('type', type).eq('week_label', weekLabel);
  if (error) throw new Error(error.message);
  const ids = (uploads || []).map((u: { id: string }) => u.id);
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await db.from('upload_rows').select('row_data')
        .in('upload_id', ids.slice(i, i + 10)).order('id').range(from, from + 999);
      if (e) throw new Error(e.message);
      rows.push(...(data || []).map((d: { row_data: Record<string, any> }) => d.row_data));
      if (!data || data.length < 1000) break;
    }
  }
  if (!filterRange) return { rows, range: null };
  const { data: week } = await db.from('payroll_weeks').select('funding_date_from, funding_date_to').eq('label', weekLabel).maybeSingle();
  const inRange = makeFundingRangeFilter(week?.funding_date_from, week?.funding_date_to);
  return {
    rows: inRange ? rows.filter(r => inRange(r['Funding Date'])) : rows,
    range: inRange ? `${week?.funding_date_from ?? '…'} to ${week?.funding_date_to ?? '…'}` : null,
  };
}

async function backendLookups(db: SupabaseClient) {
  const [offices, preparers] = await Promise.all([
    db.from('offices').select('office_name, primary_efin, secondary_efin, parent_office').order('office_name'),
    db.from('preparers').select('ptin, tax_office'),
  ]);
  if (offices.error) throw new Error(offices.error.message);
  if (preparers.error) throw new Error(preparers.error.message);
  return buildBackendLookups(offices.data || [], preparers.data || []);
}

const isoDay = (v: unknown) => {
  const d = fundingDay(v);
  return d === null ? v : `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100).padStart(2, '0')}-${String(d % 100).padStart(2, '0')}`;
};

async function runTool(db: SupabaseClient, name: string, input: any): Promise<string> {
  if (name === 'query_table') {
    const columns = TABLES[input.table];
    if (!columns) throw new Error(`Unknown table ${input.table}`);
    const allowed = new Set(columns.split(', '));
    const cols: string[] = Array.isArray(input.columns) && input.columns.length ? input.columns : [...allowed];
    for (const c of cols) if (!allowed.has(c)) throw new Error(`Column ${c} is not readable on ${input.table}`);
    let q: any = db.from(input.table).select(cols.join(','), { count: 'exact' });
    for (const f of input.filters || []) {
      if (!allowed.has(f.column)) throw new Error(`Cannot filter on ${f.column}`);
      if (!FILTER_OPS.has(f.op)) throw new Error(`Unsupported filter ${f.op}`);
      q = q[f.op](f.column, f.value);
    }
    if (input.order_by) {
      if (!allowed.has(input.order_by)) throw new Error(`Cannot order by ${input.order_by}`);
      q = q.order(input.order_by, { ascending: !input.descending });
    }
    const { data, error, count } = await q.limit(Math.min(Number(input.limit) || 50, 200));
    if (error) throw new Error(error.message);
    return clip({ total_matching: count, rows: data });
  }

  if (name === 'find_upload_rows') {
    const type = REPORT_TYPES.includes(input.report_type) ? input.report_type : 'Payroll Report';
    const [{ rows }, lk] = await Promise.all([weekRows(db, input.week_label, type, false), backendLookups(db)]);
    const needle = String(input.search || '').trim().toLowerCase();
    const matches = rows.filter(r => !needle || SAFE_ROW_FIELDS.some(k => String(r[k] ?? '').toLowerCase().includes(needle)));
    const limit = Math.min(Number(input.limit) || 25, 100);
    return clip({
      week_label: input.week_label,
      report_type: type,
      rows_in_week: rows.length,
      matching: matches.length,
      rows: matches.slice(0, limit).map(r => {
        const out: Record<string, unknown> = {};
        for (const k of SAFE_ROW_FIELDS) if (r[k] !== undefined && r[k] !== '') out[k] = k === 'Funding Date' ? isoDay(r[k]) : r[k];
        out['Source office'] = resolveTaxOffice(String(r['EFIN'] ?? '').trim(), String(r['PTIN'] ?? '').trim(), lk) || '(unassigned)';
        return out;
      }),
    });
  }

  if (name === 'backend_fee_breakdown') {
    const office = String(input.office);
    const [{ rows, range }, lk, configs] = await Promise.all([
      weekRows(db, input.week_label, 'Backend Money Report', true),
      backendLookups(db),
      db.from('office_fee_configs').select('office_name, fee_type, target_office, mode, value'),
    ]);
    if (configs.error) throw new Error(configs.error.message);
    const configsBySource: Record<string, Record<FeeType, FeeConfigEntry[]>> = {};
    for (const c of configs.data || []) {
      if (!FEE_TYPES.includes(c.fee_type as FeeType)) continue;
      configsBySource[c.office_name] ??= Object.fromEntries(FEE_TYPES.map(f => [f, []])) as unknown as Record<FeeType, FeeConfigEntry[]>;
      configsBySource[c.office_name][c.fee_type as FeeType].push({ target_office: c.target_office, mode: c.mode, value: Number(c.value) });
    }
    const rowsBySource: Record<string, Record<string, any>[]> = {};
    let unassigned = 0;
    for (const r of rows) {
      const src = resolveTaxOffice(String(r['EFIN'] ?? '').trim(), String(r['PTIN'] ?? '').trim(), lk);
      if (!src) { unassigned++; continue; }
      (rowsBySource[src] ??= []).push(r);
    }
    const ctx = {
      officeScope: office,
      rollupOffices: buildRollupOffices(office, lk.officeParent),
      configsBySource,
      effectiveEfin: computeEffectiveEfin(office, rowsBySource),
    };
    // Same tiles Office Summary shows (BackendFeeTable visibleFeeTypes).
    const isDD = normalizeOfficeName(office) === normalizeOfficeName('D & D');
    const visible = FEE_TYPES.filter(f =>
      !((f === 'E-File-EFIN' || f === 'ERO3-EFIN') && !EFIN_TILE_BY_OFFICE[office])
      && !(f === 'E-File Downlines' && !isDD));
    const fees: Record<string, { total: number; by_source_office: Record<string, number> }> = {};
    for (const f of visible) fees[f] = { total: 0, by_source_office: {} };
    for (const [src, srcRows] of Object.entries(rowsBySource)) {
      for (const r of srcRows) {
        const { perFee } = getBackendRowContribution(r, src, ctx);
        for (const f of visible) {
          if (!perFee[f]) continue;
          fees[f].total += perFee[f];
          fees[f].by_source_office[src] = (fees[f].by_source_office[src] || 0) + perFee[f];
        }
      }
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    for (const f of visible) {
      fees[f].total = round(fees[f].total);
      for (const k of Object.keys(fees[f].by_source_office)) fees[f].by_source_office[k] = round(fees[f].by_source_office[k]);
    }
    return clip({
      week_label: input.week_label,
      office,
      funding_range: range,
      backend_rows_counted: rows.length,
      rows_without_source_office: unassigned,
      raw_transmitter_fee_sum: round(rows.reduce((s, r) => s + getFieldValue(r, 'Transmitter Fee'), 0)),
      fees,
    });
  }

  throw new Error(`Unknown tool ${name}`);
}

// Data tools run as the signed-in user (RLS applies), and only for admins.
async function adminClient(req: Request): Promise<SupabaseClient | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !anonKey) return null;
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user } = await db.auth.getUser(token);
  if (!user?.user) return null;
  const { data: isAdmin } = await db.rpc('has_role', { _user_id: user.user.id, _role: 'admin' });
  return isAdmin ? db : null;
}

const MAX_TOOL_ROUNDS = 8;

async function answer(client: Anthropic, db: SupabaseClient | null, messages: Anthropic.Beta.BetaMessageParam[]): Promise<string> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: KNOWLEDGE_BASE, cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: db
        ? `Today is ${new Date().toISOString().slice(0, 10)}. Live data tools are available.`
        : 'Live data tools are unavailable for this user (not a signed-in admin). Answer from the rules only.',
    },
  ];
  for (let round = 0; ; round++) {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      ...(db ? { tools: TOOLS } : {}),
      messages,
    });

    if (response.stop_reason === 'refusal') return "Sorry, I can't help with that one.";
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !db || toolUses.length === 0 || round >= MAX_TOOL_ROUNDS) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');
      return text || "Sorry, I couldn't finish that answer — try asking a narrower question.";
    }

    messages.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(toolUses.map(async (t): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
      try {
        return { type: 'tool_result', tool_use_id: t.id, content: await runTool(db, t.name, t.input) };
      } catch (err) {
        return { type: 'tool_result', tool_use_id: t.id, content: String((err as Error)?.message || err), is_error: true };
      }
    }));
    messages.push({ role: 'user', content: results });
  }
}

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalid');
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const client = new Anthropic({ apiKey });
  const db = await adminClient(req).catch(() => null);

  // Tool lookups can outlast the edge runtime's 25s first-byte limit, so the
  // response starts immediately and the JSON body (leading whitespace is
  // valid JSON) is written when the answer is ready.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(' ')), 10000);
      let body: unknown;
      try {
        body = { reply: await answer(client, db, messages) };
      } catch (err) {
        body = {
          error: 'AI service error',
          detail: err instanceof Anthropic.APIError ? err.message : String((err as Error)?.message || err),
        };
      }
      clearInterval(keepAlive);
      controller.enqueue(encoder.encode(JSON.stringify(body)));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
