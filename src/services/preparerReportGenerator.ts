// Aggregates the Payroll Report rows for a given week and writes/updates one
// row per preparer in `preparer_payroll_weeks` so each preparer's earnings
// report (MyEarnings page) is in sync with the latest payroll data.

import { supabase } from '@/integrations/supabase/client';
import { fetchPayrollLookups, processPayrollRow } from '@/services/payrollRowProcessor';

const PREPARER_FEE = 10; // flat preparer fee (matches existing Office Summary logic)

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
  const parseDateStr = (v: any): Date | null => {
    if (!v) return null;
    const s = String(v);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) { let y = parseInt(m[3], 10); if (y < 100) y += 2000; return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10)); }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  let lo = weekRow?.funding_date_from ? parseDateStr(weekRow.funding_date_from) || undefined : undefined;
  let hi = weekRow?.funding_date_to ? parseDateStr(weekRow.funding_date_to) || undefined : undefined;
  if (lo && hi && lo.getTime() > hi.getTime()) { const t = lo; lo = hi; hi = t; }
  if (lo) lo.setHours(0, 0, 0, 0);
  if (hi) hi.setHours(23, 59, 59, 999);
  const rangeActive = !!(lo || hi);
  const inRange = (raw: Record<string, any>): boolean => {
    if (!rangeActive) return true;
    const fd = parseDateStr(getField(raw, 'Funding Date'));
    if (!fd) return false;
    if (lo && fd.getTime() < lo.getTime()) return false;
    if (hi && fd.getTime() > hi.getTime()) return false;
    return true;
  };

  // 1. Fetch payroll uploads for this week
  const { data: uploads, error: upErr } = await supabase
    .from('uploads')
    .select('id')
    .eq('type', 'Payroll Report')
    .eq('week_label', weekLabel);
  if (upErr) throw new Error(`Failed to load uploads: ${upErr.message}`);
  if (!uploads || uploads.length === 0) {
    return { weekLabel, preparersUpdated: 0, rowsProcessed: 0 };
  }
  const uploadIds = uploads.map(u => u.id);

  // 2. Fetch all rows for these uploads
  const allRows: Record<string, any>[] = [];
  for (let i = 0; i < uploadIds.length; i += 10) {
    const batch = uploadIds.slice(i, i + 10);
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('upload_rows')
        .select('row_data')
        .in('upload_id', batch)
        .range(from, from + pageSize - 1);
      if (error) break;
      if (data) allRows.push(...data.map(d => d.row_data as Record<string, any>));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }

  if (allRows.length === 0) {
    return { weekLabel, preparersUpdated: 0, rowsProcessed: 0 };
  }

  // Filter by the week's funding date range
  const filteredRows = allRows.filter(inRange);
  if (filteredRows.length === 0) {
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
  }

  // 5. Upsert one row per preparer
  const records = Array.from(byPtin.values()).map(b => {
    const preparer_fee = b.rows.length * PREPARER_FEE;
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

  return { weekLabel, preparersUpdated: records.length, rowsProcessed };
}
