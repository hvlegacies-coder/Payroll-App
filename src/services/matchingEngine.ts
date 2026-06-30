import { BucketRow, BackendRow, PreparerLookup, ClientRef, ClientData, AdvanceMaster } from './types';

export function mapBucketRow(row: BucketRow, lookups: PreparerLookup[]): BucketRow {
  if (!row.ptin) return { ...row, notes: 'PTIN not in lookup', status: 'ptin_not_found' };
  const ptinMatches = lookups.filter(l => l.ptin === row.ptin);
  if (ptinMatches.length === 0) return { ...row, notes: 'PTIN not in lookup', status: 'ptin_not_found' };
  if (ptinMatches.length === 1) {
    const match = ptinMatches[0];
    return { ...row, preparer: match.contractor, tax_office: match.tax_office, main_office: match.main_office, notes: '', status: 'mapped' };
  }
  const efinMatch = ptinMatches.find(l => l.efin === row.efin || l.efin2 === row.efin);
  if (efinMatch) return { ...row, preparer: efinMatch.contractor, tax_office: efinMatch.tax_office, main_office: efinMatch.main_office, notes: '', status: 'mapped' };
  return { ...row, notes: 'No Match — duplicate PTIN, EFIN mismatch', status: 'no_match' };
}

export function mapBackendRow(row: BackendRow, lookups: PreparerLookup[]): BackendRow {
  if (!row.ptin) return { ...row, notes: 'PTIN not in lookup', status: 'ptin_not_found' };
  const ptinMatches = lookups.filter(l => l.ptin === row.ptin);
  if (ptinMatches.length === 0) return { ...row, notes: 'PTIN not in lookup', status: 'ptin_not_found' };
  if (ptinMatches.length === 1) {
    const match = ptinMatches[0];
    return { ...row, preparer: match.contractor, tax_office: match.tax_office, main_office: match.main_office, notes: '', status: 'mapped' };
  }
  const efinMatch = ptinMatches.find(l => l.efin === row.efin || l.efin2 === row.efin);
  if (efinMatch) return { ...row, preparer: efinMatch.contractor, tax_office: efinMatch.tax_office, main_office: efinMatch.main_office, notes: '', status: 'mapped' };
  return { ...row, notes: 'No Match', status: 'no_match' };
}

export function mapAllBucketRows(rows: BucketRow[], lookups: PreparerLookup[]): { mapped: BucketRow[]; unmapped: BucketRow[] } {
  const mapped: BucketRow[] = [];
  const unmapped: BucketRow[] = [];
  rows.forEach(row => {
    const result = mapBucketRow(row, lookups);
    if (result.status === 'mapped') mapped.push(result);
    else unmapped.push(result);
  });
  return { mapped, unmapped };
}

export function matchClientBelongsTo(row: BucketRow, clientRefs: ClientRef[]): string {
  const match = clientRefs.find(ref => {
    if (ref.ssn_last4 !== row.taxpayer_ssn_last4) return false;
    const refNameParts = ref.name.toLowerCase().split(/[,\s]+/);
    const rowName = `${row.taxpayer_first_name} ${row.taxpayer_last_name}`.toLowerCase();
    return refNameParts.some(part => part.length > 2 && rowName.includes(part));
  });
  return match?.answer || '';
}

export function enrichClientEmail(client: ClientData, emailRecords: { ssn_last4: string; name: string; email: string }[]): string {
  if (client.email) return client.email;
  const match = emailRecords.find(r => {
    if (r.ssn_last4 !== client.ssn_last4) return false;
    const nameParts = r.name.toLowerCase().split(/[,\s]+/);
    return nameParts.some(part => part.length > 2 && client.client_name.toLowerCase().includes(part));
  });
  return match?.email || '';
}

export function deduplicateAdvances(advances: AdvanceMaster[]): { unique: AdvanceMaster[]; duplicates: AdvanceMaster[] } {
  const seen = new Map<string, AdvanceMaster>();
  const duplicates: AdvanceMaster[] = [];
  advances.forEach(adv => {
    // Treat rows as duplicates only when SSN + name + amount + date all match.
    // Same person with different dates/amounts should be kept as separate rows.
    const amt = (adv as any).advance_amount ?? (adv as any).amount ?? 0;
    const dt = ((adv as any).loan_paid_date || (adv as any).irs_ack_date || (adv as any).date || '').toString().trim();
    const key = `${adv.ssn_last4}-${adv.first_name.toLowerCase()}-${adv.last_name.toLowerCase()}-${amt}-${dt}`;
    const existing = seen.get(key);
    if (existing) {
      const merged: AdvanceMaster = { ...adv, deducted: existing.deducted || adv.deducted, notes: existing.notes || adv.notes };
      seen.set(key, merged);
      duplicates.push({ ...adv, status: 'duplicate' });
    } else {
      seen.set(key, adv);
    }
  });
  return { unique: Array.from(seen.values()), duplicates };
}

export function matchFeeInterceptToOffice(efin: string, lookups: PreparerLookup[]): string | null {
  const match = lookups.find(l => l.efin === efin || l.efin2 === efin);
  return match?.tax_office || null;
}

export function findDuplicatePtins(lookups: PreparerLookup[]): Map<string, PreparerLookup[]> {
  const ptinMap = new Map<string, PreparerLookup[]>();
  lookups.forEach(l => {
    if (!l.ptin) return;
    const existing = ptinMap.get(l.ptin) || [];
    existing.push(l);
    ptinMap.set(l.ptin, existing);
  });
  const duplicates = new Map<string, PreparerLookup[]>();
  ptinMap.forEach((entries, ptin) => {
    if (entries.length > 1) duplicates.set(ptin, entries);
  });
  return duplicates;
}

export function findDuplicateClients(clients: ClientData[]): Map<string, ClientData[]> {
  const map = new Map<string, ClientData[]>();
  clients.forEach(c => {
    const key = `${c.ssn_last4}-${c.client_name.toLowerCase().trim()}`;
    const existing = map.get(key) || [];
    existing.push(c);
    map.set(key, existing);
  });
  const dups = new Map<string, ClientData[]>();
  map.forEach((entries, key) => {
    if (entries.length > 1) dups.set(key, entries);
  });
  return dups;
}
