import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildUploadWorkbook, getExpectedHeaderSets, normalizeHeader, parseFile, validateHeaders } from '@/services/fileParser';

const TYPES = ['Payroll Report', 'Backend Money Report', 'Advance Report', 'Client Data Report', 'Client Email Report', 'Fee Intercept Report'];

// A downloaded upload must re-upload cleanly: same headers valid, same rows back.
describe('buildUploadWorkbook round-trip', () => {
  for (const type of TYPES) {
    it(type, async () => {
      const headers = [...getExpectedHeaderSets(type)[0], 'Extra Column'];
      // Shuffled key order, like jsonb returns them.
      const rows = [1, 2, 3].map(n => Object.fromEntries([...headers].reverse().map((h, i) => [h, i % 2 ? `v${n}-${i}` : n * 10 + i])));
      const wb = buildUploadWorkbook(type, `${type} - test.xls`, rows);
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      // jsdom's File lacks arrayBuffer(); parseFile only needs name + arrayBuffer.
      const parsed = await parseFile({ name: 'test.xlsx', arrayBuffer: async () => buf } as unknown as File, type);
      expect(parsed.errors.join()).toBe("");
      expect(validateHeaders(parsed, type).valid).toBe(true);
      expect(parsed.headers.slice(0, headers.length - 1)).toEqual(headers.slice(0, -1));
      expect(parsed.rows).toEqual(rows.map(r => Object.fromEntries(parsed.headers.map(h => [h, r[h]]))));
    });
  }
});

describe('header spelling', () => {
  const base = getExpectedHeaderSets('Payroll Report')[0].filter(h => !/^(ERO3_FEE|ERO4_FEE|ROYALTY_FEE)$/.test(h));
  const check = (extra: string[]) =>
    validateHeaders({ fileName: 'x', headers: [...base, ...extra], rows: [], rowCount: 0, errors: [] }, 'Payroll Report');

  it('accepts ERO3Fee / ERO4Fee / RoyaltyFee and the spaced form', () => {
    expect(check(['ERO3Fee', 'ERO4Fee', 'RoyaltyFee']).valid).toBe(true);
    expect(check(['ERO3 Fee', 'ERO4 Fee', 'Royalty Fee']).valid).toBe(true);
  });

  it('still rejects a different spelling', () => {
    expect(check(['ERO3 Fees', 'ERO4Fee', 'RoyaltyFee']).missing).toEqual(['ERO3_FEE']);
  });

  it('no two required headers collapse to the same name', () => {
    for (const type of TYPES) for (const set of getExpectedHeaderSets(type)) {
      const norm = set.map(normalizeHeader);
      expect(new Set(norm).size).toBe(norm.length);
    }
  });
});
