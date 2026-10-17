/** Dashboard aggregations. Pure: the caller passes `now` so results are testable. */
import { Project, ProjectStatus, SECTORS, sectorLabel, STATUS_LABELS } from "./types";

export interface StatusCount {
  status: ProjectStatus;
  label: string;
  count: number;
}

export interface DashboardStats {
  total: number;
  byStatus: StatusCount[];
  /** Projects with a valid computed result (report can be opened). */
  reportsReady: number;
  demoCount: number;
}

export function dashboardStats(projects: Project[]): DashboardStats {
  const order: ProjectStatus[] = ["completed", "in_progress", "draft"];
  return {
    total: projects.length,
    byStatus: order.map((status) => ({ status, label: STATUS_LABELS[status], count: projects.filter((p) => p.status === status).length })),
    reportsReady: projects.filter((p) => p.result).length,
    demoCount: projects.filter((p) => p.isDemo).length,
  };
}

export interface MonthBucket {
  key: string; // YYYY-MM
  label: string;
  created: number;
  /** Sum of total investment of projects created that month that have a computed result. */
  investment: number;
  /** How many projects contributed to `investment`. */
  investmentCount: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthFmt = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "short", year: "numeric" });

/**
 * Last `months` calendar months ending at `now` (inclusive), oldest first.
 * `months = "all"` spans from the earliest project's month.
 */
export function monthlySeries(projects: Project[], now: Date, months: number | "all"): MonthBucket[] {
  let count: number;
  if (months === "all") {
    if (!projects.length) return [];
    const earliest = projects.reduce((m, p) => (p.createdAt < m ? p.createdAt : m), projects[0].createdAt);
    const e = new Date(earliest);
    count = (now.getFullYear() - e.getFullYear()) * 12 + (now.getMonth() - e.getMonth()) + 1;
    count = Math.max(1, count);
  } else {
    count = months;
  }
  const buckets: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(d), label: monthFmt.format(d), created: 0, investment: 0, investmentCount: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const p of projects) {
    const i = idx.get(monthKey(new Date(p.createdAt)));
    if (i === undefined) continue;
    buckets[i].created += 1;
    if (p.result) {
      buckets[i].investment += p.result.output.totalInvestment;
      buckets[i].investmentCount += 1;
    }
  }
  return buckets;
}

export function sectorDistribution(projects: Project[]): { sector: string; label: string; count: number }[] {
  return SECTORS.map((s) => ({ sector: s.id, label: sectorLabel(s.id), count: projects.filter((p) => p.sector === s.id).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

export interface ProjectIndicatorRow {
  id: string;
  name: string;
  isDemo: boolean;
  totalInvestment: number;
  irr: number | null;
  npv: number;
  discountRate: number;
  paybackYears: number | null;
}

/** Indicator rows for projects with computed results, highest IRR first (null IRR last). */
export function indicatorRows(projects: Project[]): ProjectIndicatorRow[] {
  return projects
    .filter((p) => p.result && p.input)
    .map((p) => ({
      id: p.id,
      name: p.name,
      isDemo: p.isDemo,
      totalInvestment: p.result!.output.totalInvestment,
      irr: p.result!.output.irr,
      npv: p.result!.output.npv[0],
      discountRate: p.input!.discountRates[0],
      paybackYears: p.result!.output.payback.years,
    }))
    .sort((a, b) => (b.irr ?? -Infinity) - (a.irr ?? -Infinity));
}
