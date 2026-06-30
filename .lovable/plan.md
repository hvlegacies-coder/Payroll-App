## Goal

Today the Higher-View Office Summary's **Payroll tab** decides "is this row mine?" by matching `row.EFIN` against the head office's `scopeEfinSet` (primary/secondary + admin extra EFINs + descendant offices' EFINs). When a preparer moves to a different office, their historic payroll rows still carry the old EFIN, so they appear under the wrong office and the new office's totals are wrong.

Switch the Payroll-tab membership test to **PTIN-based**: a row belongs to the scope office if its `PTIN` resolves (via the preparers registry) to a preparer whose current `tax_office` rolls up into the consolidated scope. EFIN is ignored for inclusion on the Payroll tab.

This makes the Preparer's Share table, KPI totals, and Source Rows panel all consolidate clients by PTIN → current preparer → current office, which is what we want when preparers change offices.

## Scope of the change

Only the **Payroll dataset** and only on Higher-View Office Summary. Backend and Fee Intercept tabs keep their current logic (those are office/EFIN-driven by design).

### 1. `src/components/office-summary/SummaryTable.tsx`

- Build a new memo `scopePtinSet: Set<string>` derived from `preparerList` + `consolidatedScope`:
  - Lower/trim each preparer's `ptin`.
  - Include the preparer if `norm(preparer.tax_office)` is in `consolidatedScope`.
- In `matchesScopeRow`, for `row.dataset === 'payroll'`:
  - Replace the `payrollScopeEfin` / `efin !== payrollScopeEfin` check with:
    `const ptin = String(row.data?.['PTIN']||'').trim().toLowerCase(); return !!ptin && scopePtinSet.has(ptin);`
  - Keep the existing "Higher View" guard that requires `resolvedTaxOffice` to also be in scope (now redundant in most cases, but keep as a safety net — drop the EFIN piece).
- Remove/retire `payrollScopeEfin` from the payroll branch (still fine to keep for other call sites if any).
- `scopedPreparerList` already filters by `ptinToPreparers` + `consolidatedScope`; keep as-is — it will now align 1:1 with `scopePtinSet`.

### 2. `src/components/office-summary/PreparersShareTable.tsx`

- Add an analogous `scopePtins: Set<string>` built from the preparers lookup (`lookups.ptinToPreparers`) where the preparer's `tax_office` is in `consolidatedOfficeNames`.
- In the row filter (around line 300), replace the `scopeEfins.has(efin)` clause with `scopePtins.has(String(r['PTIN']||'').trim().toLowerCase())`.
- Keep `scopeEfins` state only if still needed for display; otherwise remove it and its loader to clean up.

### 3. `src/components/office-summary/SourceRowsPanel.tsx` — Payroll tab only

- For `tab === 'payroll'`, replace the `efin && scopeEfins.has(efin)` filter (~line 391-394) with a PTIN membership check using the same `scopePtins` set (build it the same way as in PreparersShareTable).
- Update the informational banner near line 549 so the Payroll tab shows "Consolidated by PTIN — includes preparers currently assigned to: …" instead of the EFIN sentence. Backend / Fee Intercept tabs keep the EFIN banner.

### 4. No DB changes

`preparers.tax_office` is already the source of truth for current assignment. No migrations needed. When admins move a preparer to a new office, the next render of Higher-View will automatically reattribute their historic payroll rows.

## Edge cases

- **Unknown PTIN** (row PTIN not in preparers registry): excluded from the office's totals (same behavior as today's "Higher View only counts known preparers" guard).
- **PTIN matches multiple preparers**: use the first match's `tax_office` (already how `processPayrollRow` resolves it).
- **Preparer reassigned mid-week**: all of that preparer's rows for any week now appear under the **current** office. This is the intended behavior per the request; flag in PR description so reviewers know historical weekly snapshots will shift if preparers move.
- **Backend tab / Fee Intercept tab**: untouched — those remain EFIN/office driven.

## Verification

1. Pick a preparer, change their `tax_office` in the Preparers page.
2. Open Higher-View for the old office → their client rows should disappear from the Payroll tab and Preparer's Share table.
3. Open Higher-View for the new office → the same rows should appear there, with totals updated.
4. Backend and Fee Intercept tabs for both offices should be unchanged.
5. KPI totals at the top of Higher-View should match the sum of the new Preparer's Share rows.
