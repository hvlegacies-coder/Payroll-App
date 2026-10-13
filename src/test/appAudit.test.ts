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

import { evaluateSubAccount } from "@/services/appAudit";

describe("evaluateSubAccount", () => {
  const offices = [
    { office_name: "King J", parent_office: null },
    { office_name: "King J North", parent_office: "King J" },
    { office_name: "Main Event", parent_office: null },
  ];
  const account = { name: "King J", slug: "king-j" };

  it("passes when preparers match", () => {
    const preparers = [{ contractor: "A", ptin: "P1", tax_office: "King J", main_office: "" }];
    expect(evaluateSubAccount({ account, offices, preparers })).toEqual([]);
  });

  it("flags downline preparer missing from sub view", () => {
    const preparers = [{ contractor: "B", ptin: "P2", tax_office: "King J North", main_office: "" }];
    const problems = evaluateSubAccount({ account, offices, preparers });
    expect(problems.some((p) => p.includes("missing from the sub-account preparer list"))).toBe(true);
  });

  it("flags unmapped slug", () => {
    expect(evaluateSubAccount({ account: { name: "X", slug: "nope" }, offices, preparers: [] })[0]).toContain("No office mapping");
  });

  it("flags mapped office not in offices table", () => {
    const problems = evaluateSubAccount({ account: { name: "S&C", slug: "s-and-c" }, offices, preparers: [] });
    expect(problems[0]).toContain("not an active office");
  });
});
