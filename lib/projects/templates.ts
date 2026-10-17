import type { FeasibilityInput } from "../feasibility-engine";
import type { Project } from "./types";

/** Starting point for a new study: structure only, all money fields zero. */
export function blankInput(): FeasibilityInput {
  return {
    projectLife: 10,
    workingCapitalMonths: 3,
    revenueLines: [{ name: "", qtyAt100: 0, unitPrice: 0 }],
    capacityRampByYear: [60, 80, 100],
    fixedAssets: [{ name: "", cost: 0, depRate: 10, insRate: 0.5, maintRate: 1 }],
    establishmentCost: 0,
    establishmentYears: 5,
    indirectWages: [],
    directWages: [],
    allowancePct: 10,
    marketingMonthly: 0,
    generalAdminMonthly: 0,
    otherFixedAnnual: [],
    rawMaterials: [],
    sparePartsAnnual: 0,
    miscVariableAnnual: 0,
    loan: { amount: 0, ratePct: 0, graceYears: 0, repayYears: 1 },
    contingencyPct: 5,
    discountRates: [10, 15],
  };
}

/**
 * Clearly-labelled demo projects (isDemo = true). Loaded only on explicit user
 * action from Settings and removable in one click. Numbers are illustrative.
 */
export function demoProjects(now: Date): Project[] {
  const monthsAgo = (m: number, day = 10) => new Date(now.getFullYear(), now.getMonth() - m, day, 10).toISOString();
  const base = {
    description: "مشروع تجريبي لاستعراض المنصة — الأرقام توضيحية وليست بيانات فعلية.",
    result: null,
    inputIssues: [],
    isDemo: true,
  };
  const bakery: FeasibilityInput = {
    projectLife: 10,
    workingCapitalMonths: 3,
    revenueLines: [
      { name: "خبز ومعجنات", qtyAt100: 200_000, unitPrice: 5 },
      { name: "حلويات", qtyAt100: 30_000, unitPrice: 15 },
    ],
    capacityRampByYear: [65, 80, 90, 100],
    fixedAssets: [
      { name: "أفران ومعدات", cost: 420_000, depRate: 10, insRate: 1, maintRate: 2 },
      { name: "تجهيزات المحل", cost: 150_000, depRate: 10, insRate: 0.5, maintRate: 1 },
      { name: "سيارة توزيع", cost: 95_000, depRate: 20, insRate: 3, maintRate: 4 },
    ],
    establishmentCost: 45_000,
    establishmentYears: 5,
    indirectWages: [
      { title: "مدير", count: 1, monthlySalary: 9_000 },
      { title: "محاسب", count: 1, monthlySalary: 6_000 },
    ],
    directWages: [
      { title: "خباز", count: 4, monthlySalary: 4_500 },
      { title: "بائع", count: 3, monthlySalary: 3_800 },
    ],
    allowancePct: 12,
    marketingMonthly: 3_000,
    generalAdminMonthly: 2_500,
    otherFixedAnnual: [{ name: "إيجار", annual: 96_000 }],
    rawMaterials: [
      { name: "دقيق", annualCost: 210_000 },
      { name: "سكر وزيوت ومكونات", annualCost: 120_000 },
    ],
    sparePartsAnnual: 12_000,
    miscVariableAnnual: 30_000,
    loan: { amount: 350_000, ratePct: 7, graceYears: 1, repayYears: 5 },
    contingencyPct: 5,
    discountRates: [10, 14],
  };
  const clinic: FeasibilityInput = {
    ...bakery,
    projectLife: 12,
    revenueLines: [
      { name: "كشفيات", qtyAt100: 14_000, unitPrice: 170 },
      { name: "إجراءات", qtyAt100: 2_500, unitPrice: 550 },
    ],
    capacityRampByYear: [50, 70, 85, 100],
    fixedAssets: [
      { name: "أجهزة طبية", cost: 1_250_000, depRate: 12.5, insRate: 1, maintRate: 3 },
      { name: "تجهيزات وديكور", cost: 380_000, depRate: 10, insRate: 0.5, maintRate: 1 },
    ],
    establishmentCost: 120_000,
    indirectWages: [
      { title: "مدير طبي", count: 1, monthlySalary: 22_000 },
      { title: "استقبال", count: 3, monthlySalary: 5_000 },
    ],
    directWages: [
      { title: "طبيب", count: 3, monthlySalary: 28_000 },
      { title: "تمريض", count: 4, monthlySalary: 8_000 },
    ],
    otherFixedAnnual: [{ name: "إيجار", annual: 240_000 }],
    rawMaterials: [{ name: "مستهلكات طبية", annualCost: 380_000 }],
    loan: { amount: 900_000, ratePct: 6.5, graceYears: 1, repayYears: 6 },
  };
  const cafe: FeasibilityInput = {
    ...bakery,
    projectLife: 8,
    revenueLines: [{ name: "مشروبات", qtyAt100: 95_000, unitPrice: 16 }],
    capacityRampByYear: [55, 75, 90, 100],
    fixedAssets: [{ name: "معدات قهوة وتجهيزات", cost: 260_000, depRate: 15, insRate: 1, maintRate: 2 }],
    establishmentCost: 30_000,
    indirectWages: [{ title: "مشرف", count: 1, monthlySalary: 7_000 }],
    directWages: [{ title: "باريستا", count: 4, monthlySalary: 4_200 }],
    otherFixedAnnual: [{ name: "إيجار", annual: 240_000 }],
    rawMaterials: [{ name: "بن وحليب ومستلزمات", annualCost: 600_000 }],
    loan: { amount: 0, ratePct: 0, graceYears: 0, repayYears: 1 },
  };
  return [
    { ...base, id: "demo-bakery", name: "مخبز حديث (تجريبي)", sector: "industrial", status: "completed", createdAt: monthsAgo(5), updatedAt: monthsAgo(4, 2), input: bakery },
    { ...base, id: "demo-clinic", name: "مجمع عيادات (تجريبي)", sector: "health", status: "completed", createdAt: monthsAgo(3), updatedAt: monthsAgo(2, 20), input: clinic },
    { ...base, id: "demo-cafe", name: "مقهى مختص (تجريبي)", sector: "commercial", status: "in_progress", createdAt: monthsAgo(1), updatedAt: monthsAgo(0, 1), input: cafe },
    { ...base, id: "demo-farm", name: "مزرعة بيوت محمية (تجريبي)", sector: "agricultural", status: "draft", createdAt: monthsAgo(0, 1), updatedAt: monthsAgo(0, 1), input: null },
  ];
}

export const demoExportJson = (now: Date) => JSON.stringify({ format: "jadwa-projects", version: 1, projects: demoProjects(now) });
