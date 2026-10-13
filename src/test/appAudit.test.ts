import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { evaluatePayrollMath, type PayrollWeekRow } from "@/services/appAudit";

const good: PayrollWeekRow = {
  preparer_name: "Jane",
  ptin: "P1",
  total_received: 500,
  total_after_advance: 400,
  total_preparer_share: 240,
  total_share: 475,
  total_pay: 240,
  preparer_fee: 25,
};

describe("evaluatePayrollMath", () => {
  it("passes a consistent row", () => {
    expect(evaluatePayrollMath([good])).toEqual([]);
  });

  it.each([
    ["after-advance above received", { total_after_advance: 600 }, "exceeds received"],
    ["preparer share above after-advance", { total_preparer_share: 450 }, "exceeds after-advance"],
    ["negative pay", { total_pay: -5 }, "negative pay"],
    ["share not received minus fee", { total_share: 500 }, "≠ received − preparer fee"],
  ])("flags %s", (_label, patch, expected) => {
    const problems = evaluatePayrollMath([{ ...good, ...patch }]);
    expect(problems.some((p) => p.includes(expected))).toBe(true);
  });
});
