/**
 * Jadwa 360 — feasibility engine.
 *
 * The single source of truth for every financial number on the platform.
 * Called both server-side (on save, result cached in project_results) and
 * client-side (live sliders). Never duplicate this logic elsewhere.
 *
 * Pure and deterministic: no I/O, no Date, no randomness.
 *
 * Methodology assumptions are listed in docs/engine-assumptions.md (A1..An)
 * and referenced inline. They must be reconciled with the reference Excel
 * model before results are treated as verified.
 *
 * Units: all rates and percentages are in percent (e.g. 10 = 10%).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeasibilityInput {
  projectLife: number;
  workingCapitalMonths: number;
  revenueLines: { name: string; qtyAt100: number; unitPrice: number }[];
  capacityRampByYear: number[]; // %
  fixedAssets: { name: string; cost: number; depRate: number; insRate: number; maintRate: number }[];
  establishmentCost: number;
  establishmentYears: number;
  indirectWages: { title: string; count: number; monthlySalary: number }[];
  directWages: { title: string; count: number; monthlySalary: number }[];
  allowancePct: number;
  marketingMonthly: number;
  generalAdminMonthly: number;
  otherFixedAnnual: { name: string; annual: number }[];
  rawMaterials: { name: string; annualCost: number }[];
  sparePartsAnnual: number;
  miscVariableAnnual: number;
  loan: { amount: number; ratePct: number; graceYears: number; repayYears: number };
  contingencyPct: number;
  discountRates: [number, number];
}

export interface YearResult {
  year: number;
  capacityPct: number;
  revenue: number;
  variableCost: number;
  grossMargin: number;
  fixedCost: number;
  /** Loan interest charged to the income statement (A7). */
  loanBurden: number;
  profit: number;
  /** Net cash flow for the year, including terminal values in the final year (A9). */
  cashFlow: number;
}

export type TableCell = string | number;

export interface FeasibilityTable {
  id: string;
  title: string;
  columns: string[];
  rows: TableCell[][];
}

export interface FeasibilityOutput {
  totalInvestment: number;
  equity: number;
  yearly: YearResult[];
  npv: [number, number];
  /** Percent, or null when cash flows have no sign change / no root found. */
  irr: number | null;
  payback: { label: string; years: number | null };
  /** Accounting rate of return, percent (A10). */
  arr: number;
  undiscountedPI: number;
  tables: FeasibilityTable[];
  /** Full cash-flow vector, index 0 = initial outflow. */
  cashFlows: number[];
  warnings: string[];
}

export class FeasibilityInputError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid feasibility input: ${issues.join("; ")}`);
    this.name = "FeasibilityInputError";
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isNonNeg = (n: number) => Number.isFinite(n) && n >= 0;

export function validateInput(input: FeasibilityInput): string[] {
  const issues: string[] = [];
  const chk = (cond: boolean, msg: string) => {
    if (!cond) issues.push(msg);
  };

  chk(Number.isInteger(input.projectLife) && input.projectLife >= 1 && input.projectLife <= 50, "projectLife must be an integer in 1..50");
  chk(isNonNeg(input.workingCapitalMonths) && input.workingCapitalMonths <= 24, "workingCapitalMonths must be in 0..24");
  chk(input.revenueLines.length > 0, "at least one revenue line is required");
  input.revenueLines.forEach((r, i) => chk(isNonNeg(r.qtyAt100) && isNonNeg(r.unitPrice), `revenueLines[${i}] qty/price must be >= 0`));
  chk(input.capacityRampByYear.length > 0, "capacityRampByYear must not be empty");
  input.capacityRampByYear.forEach((c, i) => chk(isNonNeg(c) && c <= 100, `capacityRampByYear[${i}] must be in 0..100`));
  input.fixedAssets.forEach((a, i) =>
    chk(isNonNeg(a.cost) && isNonNeg(a.depRate) && a.depRate <= 100 && isNonNeg(a.insRate) && isNonNeg(a.maintRate), `fixedAssets[${i}] has invalid cost/rates`),
  );
  chk(isNonNeg(input.establishmentCost), "establishmentCost must be >= 0");
  chk(input.establishmentCost === 0 || (Number.isInteger(input.establishmentYears) && input.establishmentYears >= 1), "establishmentYears must be a positive integer when establishmentCost > 0");
  [...input.indirectWages, ...input.directWages].forEach((w, i) => chk(isNonNeg(w.count) && isNonNeg(w.monthlySalary), `wage line ${i} has invalid count/salary`));
  chk(isNonNeg(input.allowancePct), "allowancePct must be >= 0");
  chk(isNonNeg(input.marketingMonthly) && isNonNeg(input.generalAdminMonthly), "marketing/G&A must be >= 0");
  input.otherFixedAnnual.forEach((o, i) => chk(isNonNeg(o.annual), `otherFixedAnnual[${i}] must be >= 0`));
  input.rawMaterials.forEach((m, i) => chk(isNonNeg(m.annualCost), `rawMaterials[${i}] must be >= 0`));
  chk(isNonNeg(input.sparePartsAnnual) && isNonNeg(input.miscVariableAnnual), "spare parts / misc variable must be >= 0");
  const { loan } = input;
  chk(isNonNeg(loan.amount) && isNonNeg(loan.ratePct), "loan amount/rate must be >= 0");
  chk(loan.amount === 0 || (Number.isInteger(loan.graceYears) && loan.graceYears >= 0 && Number.isInteger(loan.repayYears) && loan.repayYears >= 1), "loan grace must be an integer >= 0 and repayYears an integer >= 1");
  chk(isNonNeg(input.contingencyPct), "contingencyPct must be >= 0");
  chk(input.discountRates.length === 2 && input.discountRates.every((r) => Number.isFinite(r) && r > -100), "discountRates must be two rates > -100");
  return issues;
}

// ---------------------------------------------------------------------------
// Financial primitives (exported for reuse by scenarios/sensitivity layers)
// ---------------------------------------------------------------------------

/** NPV of a cash-flow vector where index 0 is undiscounted. `ratePct` in percent. */
export function npv(ratePct: number, flows: number[]): number {
  const r = ratePct / 100;
  return flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
}

/**
 * IRR in percent. Scans for a sign change of NPV over a rate grid, then
 * bisects. Returns null when no root exists in (-99%, 1000%].
 * If several roots exist (non-conventional flows), the lowest is returned.
 */
export function irr(flows: number[]): number | null {
  const hasPos = flows.some((f) => f > 0);
  const hasNeg = flows.some((f) => f < 0);
  if (!hasPos || !hasNeg) return null;

  const grid: number[] = [];
  for (let r = -99; r < 100; r += 0.5) grid.push(r);
  for (let r = 100; r <= 1000; r += 5) grid.push(r);

  let lo = grid[0];
  let fLo = npv(lo, flows);
  for (let i = 1; i < grid.length; i++) {
    const hi = grid[i];
    const fHi = npv(hi, flows);
    if (fLo === 0) return lo;
    if (Math.sign(fLo) !== Math.sign(fHi)) {
      let a = lo, b = hi, fa = fLo;
      for (let k = 0; k < 200; k++) {
        const m = (a + b) / 2;
        const fm = npv(m, flows);
        if (Math.abs(fm) < 1e-9 || b - a < 1e-10) return m;
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m;
          fa = fm;
        } else {
          b = m;
        }
      }
      return (a + b) / 2;
    }
    lo = hi;
    fLo = fHi;
  }
  return null;
}

/** Simple (undiscounted) payback in years, linearly interpolated within the year. */
export function paybackYears(flows: number[]): number | null {
  let cum = flows[0];
  if (cum >= 0) return 0;
  for (let t = 1; t < flows.length; t++) {
    const next = cum + flows[t];
    if (next >= 0) return t - 1 + -cum / flows[t];
    cum = next;
  }
  return null;
}

function arabicCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function paybackLabel(years: number | null): string {
  if (years === null) return "لا يتم الاسترداد خلال عمر المشروع";
  let y = Math.floor(years);
  let m = Math.round((years - y) * 12);
  if (m === 12) {
    y += 1;
    m = 0;
  }
  const parts: string[] = [];
  if (y > 0) parts.push(arabicCount(y, "سنة واحدة", "سنتان", "سنوات", "سنة"));
  if (m > 0) parts.push(arabicCount(m, "شهر واحد", "شهران", "أشهر", "شهرًا"));
  return parts.length ? parts.join(" و") : "فوري";
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFeasibility(input: FeasibilityInput): FeasibilityOutput {
  const issues = validateInput(input);
  if (issues.length) throw new FeasibilityInputError(issues);

  const N = input.projectLife;
  const years = Array.from({ length: N }, (_, i) => i + 1);
  const warnings: string[] = [];

  // A1: ramp shorter than project life → last value carried forward.
  const ramp = years.map((y) => input.capacityRampByYear[Math.min(y - 1, input.capacityRampByYear.length - 1)]);
  if (input.capacityRampByYear.length < N) warnings.push("capacityRampByYear shorter than projectLife; last value carried forward");
  if (input.capacityRampByYear.length > N) warnings.push("capacityRampByYear longer than projectLife; extra years ignored");

  // 1) Fixed assets → depreciation (A2: straight-line on cost, capped at cost).
  const depByAsset = input.fixedAssets.map((a) => {
    let book = a.cost;
    return years.map(() => {
      const d = Math.min((a.cost * a.depRate) / 100, book);
      book -= d;
      return d;
    });
  });
  const depreciation = years.map((_, i) => sum(depByAsset.map((row) => row[i])));
  const residualBookValue = sum(input.fixedAssets.map((a, k) => a.cost - sum(depByAsset[k])));
  const totalFixedAssets = sum(input.fixedAssets.map((a) => a.cost));

  // 2) Insurance & maintenance (A3: % of original cost, every year).
  const insurance = sum(input.fixedAssets.map((a) => (a.cost * a.insRate) / 100));
  const maintenance = sum(input.fixedAssets.map((a) => (a.cost * a.maintRate) / 100));

  // 3) Establishment cost amortization (straight-line over establishmentYears).
  const amortization = years.map((y) =>
    input.establishmentCost > 0 && y <= input.establishmentYears ? input.establishmentCost / input.establishmentYears : 0,
  );
  if (input.establishmentCost > 0 && input.establishmentYears > N) warnings.push("establishmentYears exceeds projectLife; part of establishment cost is never amortized");

  // 4) Operating fixed costs (A4: wages + allowance %).
  const allowanceFactor = 1 + input.allowancePct / 100;
  const indirectWagesAnnual = sum(input.indirectWages.map((w) => w.count * w.monthlySalary * 12)) * allowanceFactor;
  const marketingAnnual = input.marketingMonthly * 12;
  const gaAnnual = input.generalAdminMonthly * 12;
  const otherFixed = sum(input.otherFixedAnnual.map((o) => o.annual));
  const cashFixedCost = insurance + maintenance + indirectWagesAnnual + marketingAnnual + gaAnnual + otherFixed;
  const fixedCost = years.map((_, i) => cashFixedCost + depreciation[i] + amortization[i]);

  // 5) Variable costs at 100% capacity, scaled by yearly capacity (A5).
  const rawMaterialsAt100 = sum(input.rawMaterials.map((m) => m.annualCost));
  const directWagesAt100 = sum(input.directWages.map((w) => w.count * w.monthlySalary * 12)) * allowanceFactor;
  const variableAt100 = rawMaterialsAt100 + directWagesAt100 + input.sparePartsAnnual + input.miscVariableAnnual;
  const variableCost = ramp.map((c) => (variableAt100 * c) / 100);

  // 6) Working capital (A6: months of cash operating costs at 100% capacity).
  const workingCapital = (input.workingCapitalMonths / 12) * (variableAt100 + cashFixedCost);

  // 7) Total investment + contingency (A8: contingency on the whole base).
  const investmentBase = totalFixedAssets + input.establishmentCost + workingCapital;
  const contingency = (investmentBase * input.contingencyPct) / 100;
  const totalInvestment = investmentBase + contingency;

  // 8) Financing structure.
  if (input.loan.amount > totalInvestment) throw new FeasibilityInputError(["loan amount exceeds total investment"]);
  const equity = totalInvestment - input.loan.amount;

  // 9) Loan schedule (A7: grace = interest-only, then equal principal instalments).
  const { amount: L, ratePct, graceYears, repayYears } = input.loan;
  const loanRows: { year: number; opening: number; interest: number; principal: number; closing: number }[] = [];
  let balance = L;
  const principalPerYear = L > 0 ? L / repayYears : 0;
  for (const y of years) {
    const opening = balance;
    const interest = (opening * ratePct) / 100;
    const principal = y > graceYears && balance > 1e-9 ? Math.min(principalPerYear, balance) : 0;
    balance = opening - principal;
    loanRows.push({ year: y, opening, interest, principal, closing: balance });
  }
  if (L > 0 && balance > 1e-6) warnings.push("loan is not fully repaid within projectLife (graceYears + repayYears > projectLife)");
  const interest = loanRows.map((r) => r.interest);

  // 10) Revenue by capacity.
  const revenueAt100 = sum(input.revenueLines.map((r) => r.qtyAt100 * r.unitPrice));
  const revenue = ramp.map((c) => (revenueAt100 * c) / 100);

  // 11) Income statement (A11: no income tax) and 12) cash flows (A9).
  const terminalValue = workingCapital + residualBookValue;
  const yearly: YearResult[] = years.map((y, i) => {
    const grossMargin = revenue[i] - variableCost[i];
    const profit = grossMargin - fixedCost[i] - interest[i];
    const cashFlow = profit + depreciation[i] + amortization[i] + (y === N ? terminalValue : 0);
    return {
      year: y,
      capacityPct: ramp[i],
      revenue: revenue[i],
      variableCost: variableCost[i],
      grossMargin,
      fixedCost: fixedCost[i],
      loanBurden: interest[i],
      profit,
      cashFlow,
    };
  });
  const cashFlows = [-totalInvestment, ...yearly.map((r) => r.cashFlow)];

  // 13) Indicators.
  const npvPair: [number, number] = [npv(input.discountRates[0], cashFlows), npv(input.discountRates[1], cashFlows)];
  const irrPct = irr(cashFlows);
  const pb = paybackYears(cashFlows);
  const avgProfit = sum(yearly.map((r) => r.profit)) / N;
  const arr = totalInvestment > 0 ? (avgProfit / totalInvestment) * 100 : 0; // A10
  const undiscountedPI = totalInvestment > 0 ? sum(cashFlows.slice(1)) / totalInvestment : 0;

  // 14) Detail tables for display/export.
  const yearCols = years.map((y) => `السنة ${y}`);
  const tables: FeasibilityTable[] = [
    {
      id: "fixedAssets",
      title: "الأصول الثابتة والإهلاك",
      columns: ["الأصل", "الكلفة", "نسبة الإهلاك %", ...yearCols, "القيمة الدفترية المتبقية"],
      rows: input.fixedAssets.map((a, k) => [a.name, a.cost, a.depRate, ...depByAsset[k].map(round2), round2(a.cost - sum(depByAsset[k]))]),
    },
    {
      id: "insuranceMaintenance",
      title: "التأمين والصيانة السنوية",
      columns: ["الأصل", "الكلفة", "نسبة التأمين %", "التأمين", "نسبة الصيانة %", "الصيانة"],
      rows: input.fixedAssets.map((a) => [a.name, a.cost, a.insRate, round2((a.cost * a.insRate) / 100), a.maintRate, round2((a.cost * a.maintRate) / 100)]),
    },
    {
      id: "establishment",
      title: "مصاريف التأسيس وإطفاؤها",
      columns: ["البند", ...yearCols],
      rows: [["إطفاء مصاريف التأسيس", ...amortization.map(round2)]],
    },
    {
      id: "wages",
      title: "الأجور السنوية (شاملة المخصصات)",
      columns: ["الوظيفة", "النوع", "العدد", "الراتب الشهري", "الكلفة السنوية"],
      rows: [
        ...input.indirectWages.map((w) => [w.title, "غير مباشر", w.count, w.monthlySalary, round2(w.count * w.monthlySalary * 12 * allowanceFactor)]),
        ...input.directWages.map((w) => [w.title, "مباشر", w.count, w.monthlySalary, round2(w.count * w.monthlySalary * 12 * allowanceFactor)]),
      ],
    },
    {
      id: "fixedCosts",
      title: "التكاليف الثابتة",
      columns: ["البند", ...yearCols],
      rows: [
        ["الإهلاك", ...depreciation.map(round2)],
        ["إطفاء التأسيس", ...amortization.map(round2)],
        ["التأمين", ...years.map(() => round2(insurance))],
        ["الصيانة", ...years.map(() => round2(maintenance))],
        ["الأجور غير المباشرة", ...years.map(() => round2(indirectWagesAnnual))],
        ["التسويق", ...years.map(() => round2(marketingAnnual))],
        ["المصاريف الإدارية والعمومية", ...years.map(() => round2(gaAnnual))],
        ...input.otherFixedAnnual.map((o) => [o.name, ...years.map(() => round2(o.annual))]),
        ["الإجمالي", ...fixedCost.map(round2)],
      ],
    },
    {
      id: "variableCosts",
      title: "التكاليف المتغيرة",
      columns: ["البند", "عند طاقة 100%", ...yearCols],
      rows: [
        ...input.rawMaterials.map((m) => [m.name, m.annualCost, ...ramp.map((c) => round2((m.annualCost * c) / 100))]),
        ["الأجور المباشرة", round2(directWagesAt100), ...ramp.map((c) => round2((directWagesAt100 * c) / 100))],
        ["قطع الغيار", input.sparePartsAnnual, ...ramp.map((c) => round2((input.sparePartsAnnual * c) / 100))],
        ["مصاريف متغيرة أخرى", input.miscVariableAnnual, ...ramp.map((c) => round2((input.miscVariableAnnual * c) / 100))],
        ["الإجمالي", round2(variableAt100), ...variableCost.map(round2)],
      ],
    },
    {
      id: "workingCapital",
      title: "رأس المال العامل",
      columns: ["البند", "القيمة"],
      rows: [
        ["التكاليف المتغيرة السنوية (100%)", round2(variableAt100)],
        ["التكاليف الثابتة النقدية السنوية", round2(cashFixedCost)],
        ["عدد الأشهر", input.workingCapitalMonths],
        ["رأس المال العامل", round2(workingCapital)],
      ],
    },
    {
      id: "investment",
      title: "إجمالي الكلفة الاستثمارية",
      columns: ["البند", "القيمة"],
      rows: [
        ["الأصول الثابتة", round2(totalFixedAssets)],
        ["مصاريف التأسيس", round2(input.establishmentCost)],
        ["رأس المال العامل", round2(workingCapital)],
        [`احتياطي الطوارئ (${input.contingencyPct}%)`, round2(contingency)],
        ["الإجمالي", round2(totalInvestment)],
      ],
    },
    {
      id: "financing",
      title: "هيكل التمويل",
      columns: ["المصدر", "القيمة", "النسبة %"],
      rows: [
        ["رأس المال الممتلك", round2(equity), round2(totalInvestment > 0 ? (equity / totalInvestment) * 100 : 0)],
        ["القرض", round2(L), round2(totalInvestment > 0 ? (L / totalInvestment) * 100 : 0)],
      ],
    },
    {
      id: "loanSchedule",
      title: "جدول تسديد القرض",
      columns: ["السنة", "الرصيد أول المدة", "الفائدة", "القسط", "الرصيد آخر المدة"],
      rows: loanRows.map((r) => [r.year, round2(r.opening), round2(r.interest), round2(r.principal), round2(r.closing)]),
    },
    {
      id: "revenue",
      title: "الإيرادات",
      columns: ["المنتج", "الكمية عند 100%", "سعر الوحدة", ...yearCols],
      rows: [
        ...input.revenueLines.map((r) => [r.name, r.qtyAt100, r.unitPrice, ...ramp.map((c) => round2((r.qtyAt100 * r.unitPrice * c) / 100))]),
        ["نسبة الطاقة %", "", "", ...ramp],
        ["الإجمالي", "", "", ...revenue.map(round2)],
      ],
    },
    {
      id: "incomeStatement",
      title: "قائمة الدخل",
      columns: ["البند", ...yearCols],
      rows: [
        ["الإيرادات", ...yearly.map((r) => round2(r.revenue))],
        ["التكاليف المتغيرة", ...yearly.map((r) => round2(r.variableCost))],
        ["هامش المساهمة", ...yearly.map((r) => round2(r.grossMargin))],
        ["التكاليف الثابتة", ...yearly.map((r) => round2(r.fixedCost))],
        ["فوائد القرض", ...yearly.map((r) => round2(r.loanBurden))],
        ["صافي الربح", ...yearly.map((r) => round2(r.profit))],
      ],
    },
    {
      id: "cashFlow",
      title: "التدفقات النقدية",
      columns: ["البند", "السنة 0", ...yearCols],
      rows: [
        ["الاستثمار المبدئي", round2(-totalInvestment), ...years.map(() => 0)],
        ["صافي الربح", 0, ...yearly.map((r) => round2(r.profit))],
        ["الإهلاك والإطفاء", 0, ...years.map((_, i) => round2(depreciation[i] + amortization[i]))],
        ["القيمة المتبقية (رأس المال العامل + القيمة الدفترية)", 0, ...years.map((y) => (y === N ? round2(terminalValue) : 0))],
        ["صافي التدفق النقدي", ...cashFlows.map(round2)],
      ],
    },
    {
      id: "indicators",
      title: "مؤشرات التقييم",
      columns: ["المؤشر", "القيمة"],
      rows: [
        [`صافي القيمة الحالية عند ${input.discountRates[0]}%`, round2(npvPair[0])],
        [`صافي القيمة الحالية عند ${input.discountRates[1]}%`, round2(npvPair[1])],
        ["معدل العائد الداخلي %", irrPct === null ? "غير متاح" : round2(irrPct)],
        ["فترة الاسترداد", paybackLabel(pb)],
        ["معدل العائد المحاسبي %", round2(arr)],
        ["دليل الربحية غير المخصوم", round2(undiscountedPI)],
      ],
    },
  ];

  return {
    totalInvestment,
    equity,
    yearly,
    npv: npvPair,
    irr: irrPct,
    payback: { label: paybackLabel(pb), years: pb },
    arr,
    undiscountedPI,
    tables,
    cashFlows,
    warnings,
  };
}
