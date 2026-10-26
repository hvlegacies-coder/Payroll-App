// Aggregates the Payroll Report rows for a given week and writes/updates one
// row per preparer in `preparer_payroll_weeks` so each preparer's earnings
// report (MyEarnings page) is in sync with the latest payroll data.

import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, fetchPayrollLookups, fundingMonthKey, makeFundingRangeFilter, preparerFee, processPayrollRow } from '@/services/payrollRowProcessor';

const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[$,]/g, '')) || 0;
};

const getField = (raw: Record<string, any>, key: string): any => {
  if (raw[key] !== undefined) return raw[key];
  for (const k of Object.keys(raw)) {
    if (k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) return raw[k];
  }
  return '';
};

export interface GenerateResult {
  weekLabel: string;
  preparersUpdated: number;
  rowsProcessed: number;
}

export async function generatePreparerWeeklyReports(weekLabel: string): Promise<GenerateResult> {
  // 0. Look up the week's funding date range (if any) so we only include rows in range
  const { data: weekRow } = await supabase
    .from('payroll_weeks')
    .select('funding_date_from, funding_date_to')
    .eq('label', weekLabel)
    .maybeSingle();
  const rangeFilter = makeFundingRangeFilter(weekRow?.funding_date_from, weekRow?.funding_date_to);
  const inRange = (raw: Record<string, any>): boolean => !rangeFilter || rangeFilter(getField(raw, 'Funding Date'));

  // 1. Fetch payroll uploads for this week
  const { data: uploads, error: upErr } = await supabase
    .from('uploads')
    .select('id')
    .eq('type', 'Payroll Report')
    .eq('week_label', weekLabel);
  if (upErr) throw new Error(`Failed to load uploads: ${upErr.message}`);
  if (!uploads || uploads.length === 0) {
    await clearReportsExcept(weekLabel, []);
    return { weekLabel, preparersUpdated: 0, rowsProcessed: 0 };
  }
  const uploadIds = uploads.map(u => u.id);

  // 2. Fetch all rows for these uploads
  const allRows = await fetchAllRows(uploadIds);

  if (allRows.length === 0) {
    await clearReportsExcept(weekLabel, []);
    return { weekLabel, preparersUpdated: 0, rowsProcessed: 0 };
  }

  // Filter by the week's funding date range
  const filteredRows = allRows.filter(inRange);
  if (filteredRows.length === 0) {
    await clearReportsExcept(weekLabel, []);
    return { weekLabel, preparersUpdated: 0, rowsProcessed: 0 };
  }

  // 3. Get lookups (preparers, offices, advances, client data) scoped to this week
  const lookups = await fetchPayrollLookups(weekLabel);

  // 4. Process every payroll row and group by PTIN
  type PreparerBucket = {
    ptin: string;
    preparer_name: string;
    tax_office: string;
    rows: any[];
    total_received: number;
    total_high_prep_fee: number;
    total_after_advance: number;
    total_pay: number;
    total_preparer_share: number;
    funding_months: Set<string>;
  };

  const byPtin = new Map<string, PreparerBucket>();
  let rowsProcessed = 0;

  for (const raw of filteredRows) {
    const processed = processPayrollRow(raw, lookups);
    if (!processed.ptin) continue; // skip rows without a PTIN — can't credit a preparer
    rowsProcessed++;

    const highPrep = num(getField(raw, 'High Prep Fee')) || (String(getField(raw, 'High Prep Fee')).toLowerCase() === 'true' ? 1 : 0);
    const ptinKey = processed.ptin.trim().toLowerCase();

    let bucket = byPtin.get(ptinKey);
    if (!bucket) {
      bucket = {
        ptin: processed.ptin,
        preparer_name: processed.preparer || '',
        tax_office: processed.taxOffice || '',
        rows: [],
        total_received: 0,
        total_high_prep_fee: 0,
        total_after_advance: 0,
        total_pay: 0,
        total_preparer_share: 0,
        funding_months: new Set(),
      };
      byPtin.set(ptinKey, bucket);
    }

    bucket.rows.push({
      taxpayer_last_name: String(getField(raw, 'Taxpayer Last Name') || '').trim(),
      taxpayer_first_name: String(getField(raw, 'Taxpayer First Name') || '').trim(),
      taxpayer: `${String(getField(raw, 'Taxpayer Last Name') || '').trim()}, ${String(getField(raw, 'Taxpayer First Name') || '').trim()}`.replace(/^, |, $/, ''),
      efin: processed.efin,
      ptin: processed.ptin,
      funding_date: String(getField(raw, 'Funding Date') || '').trim(),
      received_tax_prep_fees: processed.receivedTaxPrepFee,
      high_prep_fee: highPrep,
      after_advance: processed.afterAdvance,
      pay: processed.pay,
      preparer_share: processed.preparerShare,
      advance_requested: processed.advanceRequested,
      client_belongs_to: processed.clientBelongsTo,
    });

    bucket.total_received += processed.receivedTaxPrepFee;
    bucket.total_high_prep_fee += highPrep;
    bucket.total_after_advance += processed.afterAdvance;
    bucket.total_pay += processed.pay;
    bucket.total_preparer_share += processed.preparerShare;
    const month = fundingMonthKey(getField(raw, 'Funding Date'));
    if (month) bucket.funding_months.add(month);
  }

  // 5. Upsert one row per preparer
  const records = Array.from(byPtin.values()).map(b => {
    const preparer_fee = preparerFee(b.tax_office, b.total_preparer_share, b.funding_months.size);
    const total_share = b.total_preparer_share - preparer_fee;
    return {
      week_label: weekLabel,
      ptin: b.ptin,
      preparer_name: b.preparer_name,
      tax_office: b.tax_office,
      row_data: b.rows as any,
      total_received: b.total_received,
      total_high_prep_fee: b.total_high_prep_fee,
      total_after_advance: b.total_after_advance,
      total_pay: b.total_pay,
      total_preparer_share: b.total_preparer_share,
      preparer_fee,
      total_share,
    };
  });

  // Upsert in batches to avoid huge payloads
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('preparer_payroll_weeks')
      .upsert(batch, { onConflict: 'ptin,week_label' });
    if (error) throw new Error(`Failed to save preparer reports: ${error.message}`);
  }

  await clearReportsExcept(weekLabel, records.map(r => r.ptin));

  return { weekLabel, preparersUpdated: records.length, rowsProcessed };
}

// Drop the week's reports for preparers no longer in its payroll (deleted
// upload, reassigned rows) so stale earnings are never shown or emailed.
async function clearReportsExcept(weekLabel: string, keepPtins: string[]) {
  let query = supabase.from('preparer_payroll_weeks').delete().eq('week_label', weekLabel);
  if (keepPtins.length > 0) {
    query = query.not('ptin', 'in', `(${keepPtins.map(p => `"${p.replace(/"/g, '')}"`).join(',')})`);
  }
  const { error } = await query;
  if (error) throw new Error(`Failed to clear old preparer reports: ${error.message}`);
}
