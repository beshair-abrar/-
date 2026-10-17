/**
 * Sensitivity (tornado) analysis built on top of the engine: each variable is
 * shocked by ±delta and the engine is re-run. No financial formula lives here.
 */
import { computeFeasibility, FeasibilityInput } from "./feasibility-engine";

export type SensitivityKey = "price" | "materials" | "wages" | "investment" | "fixedOps" | "loanRate";

export interface SensitivityRow {
  key: SensitivityKey;
  label: string;
  /** NPV at the first discount rate when the variable moves by −delta / +delta. null if the shocked input is invalid. */
  npvLow: number | null;
  npvHigh: number | null;
  /** NPV change vs base for each side (null if that side is invalid). */
  deltaLow: number | null;
  deltaHigh: number | null;
  /** max |ΔNPV| vs base across both sides. */
  swing: number;
}

export interface SensitivityResult {
  deltaPct: number;
  discountRate: number;
  baseNpv: number;
  rows: SensitivityRow[];
}

const scale = (n: number, f: number) => n * f;

const SHOCKS: { key: SensitivityKey; label: string; apply: (i: FeasibilityInput, f: number) => FeasibilityInput }[] = [
  { key: "price", label: "سعر البيع", apply: (i, f) => ({ ...i, revenueLines: i.revenueLines.map((r) => ({ ...r, unitPrice: scale(r.unitPrice, f) })) }) },
  {
    key: "materials",
    label: "تكلفة المواد والتكاليف المتغيرة",
    apply: (i, f) => ({
      ...i,
      rawMaterials: i.rawMaterials.map((m) => ({ ...m, annualCost: scale(m.annualCost, f) })),
      sparePartsAnnual: scale(i.sparePartsAnnual, f),
      miscVariableAnnual: scale(i.miscVariableAnnual, f),
    }),
  },
  {
    key: "wages",
    label: "الرواتب والأجور",
    apply: (i, f) => ({
      ...i,
      indirectWages: i.indirectWages.map((w) => ({ ...w, monthlySalary: scale(w.monthlySalary, f) })),
      directWages: i.directWages.map((w) => ({ ...w, monthlySalary: scale(w.monthlySalary, f) })),
    }),
  },
  {
    key: "investment",
    label: "الكلفة الاستثمارية",
    apply: (i, f) => ({ ...i, fixedAssets: i.fixedAssets.map((a) => ({ ...a, cost: scale(a.cost, f) })), establishmentCost: scale(i.establishmentCost, f) }),
  },
  {
    key: "fixedOps",
    label: "المصاريف الثابتة التشغيلية",
    apply: (i, f) => ({
      ...i,
      marketingMonthly: scale(i.marketingMonthly, f),
      generalAdminMonthly: scale(i.generalAdminMonthly, f),
      otherFixedAnnual: i.otherFixedAnnual.map((o) => ({ ...o, annual: scale(o.annual, f) })),
    }),
  },
  { key: "loanRate", label: "سعر فائدة القرض", apply: (i, f) => ({ ...i, loan: { ...i.loan, ratePct: scale(i.loan.ratePct, f) } }) },
];

function safeNpv(input: FeasibilityInput): number | null {
  try {
    return computeFeasibility(input).npv[0];
  } catch {
    return null;
  }
}

export function runSensitivity(input: FeasibilityInput, deltaPct = 10): SensitivityResult {
  const baseNpv = computeFeasibility(input).npv[0];
  const rows = SHOCKS.map(({ key, label, apply }) => {
    const npvLow = safeNpv(apply(input, 1 - deltaPct / 100));
    const npvHigh = safeNpv(apply(input, 1 + deltaPct / 100));
    const swing = Math.max(npvLow === null ? 0 : Math.abs(npvLow - baseNpv), npvHigh === null ? 0 : Math.abs(npvHigh - baseNpv));
    const deltaLow = npvLow === null ? null : npvLow - baseNpv;
    const deltaHigh = npvHigh === null ? null : npvHigh - baseNpv;
    return { key, label, npvLow, npvHigh, deltaLow, deltaHigh, swing };
  }).sort((a, b) => b.swing - a.swing);
  return { deltaPct, discountRate: input.discountRates[0], baseNpv, rows };
}
