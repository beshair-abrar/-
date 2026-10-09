import { describe, expect, it } from "vitest";
import {
  computeFeasibility,
  FeasibilityInput,
  FeasibilityInputError,
  irr,
  npv,
  paybackLabel,
  paybackYears,
} from "./feasibility-engine";

/**
 * Hand-computed fixture. Every expected value below is derived by hand in
 * comments so the test documents the methodology, not just the code.
 */
export const fixture: FeasibilityInput = {
  projectLife: 5,
  workingCapitalMonths: 3,
  revenueLines: [{ name: "منتج أ", qtyAt100: 10_000, unitPrice: 50 }], // 500,000 @100%
  capacityRampByYear: [60, 80, 100], // → 60,80,100,100,100 (A1)
  fixedAssets: [
    { name: "مبنى", cost: 200_000, depRate: 5, insRate: 0.5, maintRate: 1 }, // dep 10k, ins 1k, maint 2k
    { name: "آلات", cost: 100_000, depRate: 20, insRate: 1, maintRate: 2 }, // dep 20k, ins 1k, maint 2k
  ],
  establishmentCost: 20_000,
  establishmentYears: 5, // 4k/yr
  indirectWages: [{ title: "مدير", count: 1, monthlySalary: 2_000 }], // 24k ×1.1 = 26.4k
  directWages: [{ title: "عامل", count: 3, monthlySalary: 1_000 }], // 36k ×1.1 = 39.6k
  allowancePct: 10,
  marketingMonthly: 1_000, // 12k
  generalAdminMonthly: 500, // 6k
  otherFixedAnnual: [{ name: "إيجار", annual: 12_000 }],
  rawMaterials: [{ name: "مادة خام", annualCost: 150_000 }],
  sparePartsAnnual: 5_000,
  miscVariableAnnual: 5_400, // variable @100% = 150k+39.6k+5k+5.4k = 200k
  loan: { amount: 200_000, ratePct: 8, graceYears: 1, repayYears: 4 },
  contingencyPct: 5,
  discountRates: [10, 15],
};

describe("computeFeasibility — hand-computed fixture", () => {
  const out = computeFeasibility(fixture);

  it("investment and financing", () => {
    // cash fixed = ins 2k + maint 4k + wages 26.4k + mkt 12k + G&A 6k + rent 12k = 62.4k
    // WC = 3/12 × (200k + 62.4k) = 65.6k
    // base = 300k + 20k + 65.6k = 385.6k ; contingency 5% = 19.28k
    expect(out.totalInvestment).toBeCloseTo(404_880, 6);
    expect(out.equity).toBeCloseTo(204_880, 6);
  });

  it("yearly income statement", () => {
    expect(out.yearly.map((y) => y.capacityPct)).toEqual([60, 80, 100, 100, 100]);
    expect(out.yearly.map((y) => y.revenue)).toEqual([300_000, 400_000, 500_000, 500_000, 500_000]);
    expect(out.yearly.map((y) => y.variableCost)).toEqual([120_000, 160_000, 200_000, 200_000, 200_000]);
    // fixed = 62.4k cash + 30k dep + 4k amort
    out.yearly.forEach((y) => expect(y.fixedCost).toBeCloseTo(96_400, 6));
    // interest: grace y1 on 200k, then balances 200k,150k,100k,50k
    expect(out.yearly.map((y) => y.loanBurden)).toEqual([16_000, 16_000, 12_000, 8_000, 4_000]);
    const profits = [67_600, 127_600, 191_600, 195_600, 199_600];
    out.yearly.forEach((y, i) => expect(y.profit).toBeCloseTo(profits[i], 6));
  });

  it("cash flows include terminal value in the final year", () => {
    // CF = profit + 34k (dep+amort); final year + WC 65.6k + residual book 150k
    const expected = [-404_880, 101_600, 161_600, 225_600, 229_600, 449_200];
    out.cashFlows.forEach((cf, i) => expect(cf).toBeCloseTo(expected[i], 6));
  });

  it("indicators", () => {
    // payback: cum −303,280 → −141,680 → +83,920 ⇒ 2 + 141,680/225,600
    expect(out.payback.years).toBeCloseTo(2 + 141_680 / 225_600, 9);
    expect(out.payback.label).toBe("سنتان و8 أشهر");
    // ARR = mean profit 156,400 / 404,880
    expect(out.arr).toBeCloseTo((156_400 / 404_880) * 100, 9);
    // PI = 1,167,600 / 404,880
    expect(out.undiscountedPI).toBeCloseTo(1_167_600 / 404_880, 9);

    const manualNpv = (r: number) => out.cashFlows.reduce((a, cf, t) => a + cf / (1 + r / 100) ** t, 0);
    expect(out.npv[0]).toBeCloseTo(manualNpv(10), 6);
    expect(out.npv[1]).toBeCloseTo(manualNpv(15), 6);
    expect(out.npv[0]).toBeGreaterThan(out.npv[1]);
    expect(out.npv[1]).toBeGreaterThan(0);

    expect(out.irr).not.toBeNull();
    expect(Math.abs(npv(out.irr!, out.cashFlows))).toBeLessThan(1e-3);
    expect(out.irr!).toBeGreaterThan(15);
  });

  it("loan schedule is fully repaid; only the ramp carry-forward warning", () => {
    const loan = out.tables.find((t) => t.id === "loanSchedule")!;
    expect(loan.rows.at(-1)![4]).toBe(0);
    expect(out.warnings).toEqual(["capacityRampByYear shorter than projectLife; last value carried forward"]);
  });

  it("emits all detail tables", () => {
    expect(out.tables.map((t) => t.id)).toEqual([
      "fixedAssets",
      "insuranceMaintenance",
      "establishment",
      "wages",
      "fixedCosts",
      "variableCosts",
      "workingCapital",
      "investment",
      "financing",
      "loanSchedule",
      "revenue",
      "incomeStatement",
      "cashFlow",
      "indicators",
    ]);
  });

  it("is deterministic", () => {
    expect(computeFeasibility(fixture)).toEqual(out);
  });
});

describe("financial primitives", () => {
  it("npv / irr on a trivial flow", () => {
    expect(npv(10, [-100, 110])).toBeCloseTo(0, 9);
    expect(irr([-100, 110])!).toBeCloseTo(10, 6);
    expect(irr([-1000, 300, 400, 500])!).toBeCloseTo(8.896, 2);
  });

  it("irr is null without a sign change", () => {
    expect(irr([100, 100])).toBeNull();
    expect(irr([-100, -10])).toBeNull();
  });

  it("payback", () => {
    expect(paybackYears([-100, 50, 50])).toBe(2);
    expect(paybackYears([-100, 40, 40])).toBeNull();
    expect(paybackYears([-100, 40, 120])).toBeCloseTo(1.5, 9);
  });

  it("payback label Arabic counting", () => {
    expect(paybackLabel(null)).toBe("لا يتم الاسترداد خلال عمر المشروع");
    expect(paybackLabel(1)).toBe("سنة واحدة");
    expect(paybackLabel(3.5)).toBe("3 سنوات و6 أشهر");
    expect(paybackLabel(11.999)).toBe("12 سنة");
    expect(paybackLabel(0)).toBe("فوري");
  });
});

describe("validation and warnings", () => {
  it("rejects invalid input with all issues listed", () => {
    const bad = { ...fixture, projectLife: 0, revenueLines: [] };
    expect(() => computeFeasibility(bad)).toThrow(FeasibilityInputError);
    try {
      computeFeasibility(bad);
    } catch (e) {
      expect((e as FeasibilityInputError).issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("rejects a loan larger than total investment", () => {
    expect(() => computeFeasibility({ ...fixture, loan: { ...fixture.loan, amount: 1e9 } })).toThrow(/exceeds total investment/);
  });

  it("warns when the loan outlives the project", () => {
    const out = computeFeasibility({ ...fixture, loan: { ...fixture.loan, graceYears: 3, repayYears: 5 } });
    expect(out.warnings.some((w) => w.includes("not fully repaid"))).toBe(true);
  });

  it("works with no loan and no establishment cost", () => {
    const out = computeFeasibility({ ...fixture, loan: { amount: 0, ratePct: 0, graceYears: 0, repayYears: 0 }, establishmentCost: 0, establishmentYears: 0 });
    expect(out.equity).toBeCloseTo(out.totalInvestment, 9);
    out.yearly.forEach((y) => expect(y.loanBurden).toBe(0));
  });
});
