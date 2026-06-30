import {
  BucketRow, PreparerLookup, PreparerShareResult,
  HIGHER_VIEW_FEE_EXCLUDED_PREPARERS, HIGHER_VIEW_PREPARER_FEE,
  OfficeReport, BackendRow,
  officeMatches,
} from './types';

export function calculateAfterAdvance(row: BucketRow): number {
  if (row.advance_requested) {
    return Math.max(0, row.received_tax_prep_fees - 100);
  }
  return row.received_tax_prep_fees;
}

export function calculatePay(row: BucketRow, lookup: PreparerLookup | undefined): number {
  if (!lookup) return 0;
  const afterAdvance = row.after_advance;
  if (afterAdvance <= 0) return 0;
  const efinMatch = row.efin === lookup.efin || row.efin === lookup.efin2;
  if (row.ptin && !efinMatch && lookup.shared_efin_percent > 0) {
    return afterAdvance * (lookup.shared_efin_percent / 100);
  }
  return afterAdvance * (lookup.share_percent / 100);
}

export function calculateHigherViewPreparerShare(row: BucketRow, lookup: PreparerLookup | undefined): number {
  if (!lookup) return 0;
  const afterAdvance = row.after_advance;
  if (afterAdvance <= 0) return 0;
  const pay = calculatePay(row, lookup);
  if (row.client_belongs_to && row.client_belongs_to.toLowerCase() === row.preparer.toLowerCase()) {
    if (pay <= 0) return 0;
    return Math.min(pay * (lookup.preparer_client_percent / 100), pay);
  }
  return Math.min(lookup.office_flat_rate, afterAdvance);
}

export function calculateKingJPreparerShare(row: BucketRow, lookup: PreparerLookup | undefined): number {
  if (!lookup) return 0;
  const afterAdvance = row.after_advance;
  if (afterAdvance <= 0) return 0;
  return afterAdvance * (lookup.kingj_preparer_share / 100);
}

export function calculatePreparerShare(row: BucketRow, lookup: PreparerLookup | undefined, officeName: string): number {
  if (officeName === 'Higher View') return calculateHigherViewPreparerShare(row, lookup);
  if (officeName === 'King J') return calculateKingJPreparerShare(row, lookup);
  return calculatePay(row, lookup);
}

export function calculateBucketRow(row: BucketRow, lookup: PreparerLookup | undefined): BucketRow {
  const afterAdvance = calculateAfterAdvance(row);
  const updatedRow = { ...row, after_advance: afterAdvance };
  const pay = calculatePay(updatedRow, lookup);
  const preparerShare = calculatePreparerShare(updatedRow, lookup, row.tax_office);
  return {
    ...updatedRow,
    pay,
    preparer_share: preparerShare,
    status: row.status === 'imported' || row.status === 'mapped' ? 'calculated' : row.status,
  };
}

export function getPreparerFee(preparerName: string): number {
  if (!preparerName) return 0;
  const normalized = preparerName.toUpperCase().trim();
  if (HIGHER_VIEW_FEE_EXCLUDED_PREPARERS.some(ex => normalized.includes(ex))) return 0;
  return HIGHER_VIEW_PREPARER_FEE;
}

export function buildPreparerShareBlock(rows: BucketRow[], lookups: PreparerLookup[]): PreparerShareResult[] {
  const preparerMap = new Map<string, BucketRow[]>();
  rows.forEach(r => {
    if (!r.preparer) return;
    const existing = preparerMap.get(r.preparer) || [];
    existing.push(r);
    preparerMap.set(r.preparer, existing);
  });
  const results: PreparerShareResult[] = [];
  preparerMap.forEach((prepRows, preparer) => {
    const lookup = lookups.find(l => l.contractor === preparer);
    const totalReceived = prepRows.reduce((sum, r) => sum + r.received_tax_prep_fees, 0);
    const fee = getPreparerFee(preparer);
    const totalShare = totalReceived - fee;
    results.push({
      preparer,
      ptin: lookup?.ptin || '',
      tax_office: prepRows[0]?.tax_office || '',
      row_count: prepRows.length,
      total_received: totalReceived,
      preparer_fee: fee,
      total_share: Math.max(0, totalShare),
      share_percent: lookup?.share_percent || 0,
    });
  });
  return results.sort((a, b) => a.preparer.localeCompare(b.preparer));
}

export function buildOfficeReport(officeName: string, bucketRows: BucketRow[], backendRows: BackendRow[], feeIntercept: number, lookups: PreparerLookup[]): OfficeReport {
  // Consolidation-aware: e.g. "D & D" pulls in Tax Champions rows for every per-row metric.
  const officeRows = bucketRows.filter(r => officeMatches(r.tax_office, officeName));
  const officeBackend = backendRows.filter(r => officeMatches(r.tax_office, officeName));
  const totalReceivedPrepFee = officeRows.reduce((s, r) => s + r.received_tax_prep_fees, 0);
  const highPrepFeeTotal = officeRows.filter(r => r.high_prep_fee).reduce((s, r) => s + r.received_tax_prep_fees, 0);
  const preparerShareBlock = buildPreparerShareBlock(officeRows, lookups);
  const preparerFeeTotal = preparerShareBlock.reduce((s, p) => s + p.preparer_fee, 0);
  const totalTransmitterFee = officeRows.reduce((s, r) => s + Math.max(0, r.transmitter_fee - 10), 0);
  const totalFeesDue = highPrepFeeTotal + preparerFeeTotal + feeIntercept + totalTransmitterFee;
  const agi = totalReceivedPrepFee - totalFeesDue;
  const totalBackendMoney = officeBackend.reduce((s, r) => s + r.received_amount, 0);
  const netPay = agi + totalBackendMoney;
  return {
    id: `report-${officeName}-${Date.now()}`,
    office_name: officeName,
    run_date: new Date().toISOString(),
    total_received_prep_fee: totalReceivedPrepFee,
    total_fees_due: totalFeesDue,
    high_prep_fee_total: highPrepFeeTotal,
    preparer_fee_total: preparerFeeTotal,
    fee_intercept: feeIntercept,
    agi,
    total_backend_money: totalBackendMoney,
    net_pay: netPay,
    total_transmitter_fee: totalTransmitterFee,
    created_at: new Date().toISOString(),
  };
}

export function calculateTransmitterFeeSummary(bucketRows: BucketRow[]): Record<string, number> {
  const summary: Record<string, number> = {};
  bucketRows.forEach(r => {
    if (!r.tax_office) return;
    summary[r.tax_office] = (summary[r.tax_office] || 0) + Math.max(0, r.transmitter_fee - 10);
  });
  return summary;
}
