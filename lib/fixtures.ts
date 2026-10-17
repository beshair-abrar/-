import type { FeasibilityInput } from "./feasibility-engine";

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
