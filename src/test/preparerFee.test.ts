import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { fundingMonthKey, makeFundingRangeFilter, preparerFee } from "@/services/payrollRowProcessor";

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

describe("makeFundingRangeFilter", () => {
  // Excel serials: 46083 = 03/02/2026 ... 46086 = 03/05/2026.
  for (const tz of ["Asia/Manila", "America/Chicago"]) {
    it(`selects the same days in ${tz}`, () => {
      const saved = process.env.TZ;
      process.env.TZ = tz;
      try {
        const inRange = makeFundingRangeFilter("2026-03-02", "03/04/2026")!;
        expect([46082, 46083, 46084, 46085, 46086].filter(inRange)).toEqual([46083, 46084, 46085]);
        expect(inRange("03/02/2026")).toBe(true);
        expect(inRange("Federal")).toBe(false);
      } finally {
        if (saved === undefined) delete process.env.TZ;
        else process.env.TZ = saved;
      }
    });
  }

  it("is off when the week has no range", () => {
    expect(makeFundingRangeFilter(null, null)).toBeNull();
  });
});
