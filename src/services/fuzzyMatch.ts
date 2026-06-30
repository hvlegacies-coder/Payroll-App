/**
 * Simple Levenshtein-based fuzzy matching utility.
 * Returns a similarity ratio between 0 and 1.
 */

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/** Returns similarity ratio 0–1 (1 = identical) */
export function fuzzySimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

/** Check if two advance rows are duplicates: exact SSN + fuzzy name ≥ threshold + same amount + same date.
 *  If amount or date differ, rows are treated as distinct (not duplicates). */
export function isAdvanceDuplicate(
  a: { ssn: string; lastName: string; firstName: string; advanceAmount?: number; loanPaidDate?: string; irsAckDate?: string },
  b: { ssn: string; lastName: string; firstName: string; advanceAmount?: number; loanPaidDate?: string; irsAckDate?: string },
  threshold = 0.85
): boolean {
  if (a.ssn !== b.ssn) return false;
  const lastSim = fuzzySimilarity(a.lastName, b.lastName);
  const firstSim = fuzzySimilarity(a.firstName, b.firstName);
  if (lastSim < threshold || firstSim < threshold) return false;
  // Different amount → not a duplicate
  if ((a.advanceAmount ?? 0) !== (b.advanceAmount ?? 0)) return false;
  // Different date (prefer loanPaidDate, fall back to irsAckDate) → not a duplicate
  const dateA = (a.loanPaidDate || a.irsAckDate || '').trim();
  const dateB = (b.loanPaidDate || b.irsAckDate || '').trim();
  if (dateA !== dateB) return false;
  return true;
}
