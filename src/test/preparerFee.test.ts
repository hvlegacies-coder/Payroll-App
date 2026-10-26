import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { fundingMonthKey, preparerFee } from "@/services/payrollRowProcessor";

describe("preparerFee", () => {
  it("charges nothing when the preparer earned no share", () => {
    expect(preparerFee("Savvy Tax Pros", 0, 3)).toBe(0);
  });

  it("charges $10 once per week, not per return", () => {
    expect(preparerFee("PowerPlay", 500, 1)).toBe(10);
    expect(preparerFee("PowerPlay", 500, 4)).toBe(10);
  });

  it("charges Higher View $10 per distinct funding month", () => {
    expect(preparerFee("Higher View", 500, 2)).toBe(20);
    expect(preparerFee("Higher View", 500, 0)).toBe(10);
  });
});

describe("fundingMonthKey", () => {
  it("reads MM/DD/YYYY, two-digit years, ISO, and Excel serials", () => {
    expect(fundingMonthKey("03/04/2026")).toBe("2026-03");
    expect(fundingMonthKey("3-4-26")).toBe("2026-03");
    expect(fundingMonthKey("2026-03-04")).toBe("2026-03");
    expect(fundingMonthKey(46085)).toBe("2026-03");
    expect(fundingMonthKey("46085")).toBe("2026-03");
    expect(fundingMonthKey("Federal")).toBe("");
    expect(fundingMonthKey("")).toBe("");
  });
});
