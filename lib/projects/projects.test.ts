import { describe, expect, it } from "vitest";
import { fixture } from "../fixtures";
import { runSensitivity } from "../sensitivity";
import { dashboardStats, indicatorRows, monthlySeries, sectorDistribution } from "./stats";
import { hashInput, LocalProjectStore, MemoryStorage, StoreError } from "./store";
import { blankInput, demoExportJson, demoProjects } from "./templates";

const NOW = new Date("2026-10-15T12:00:00Z");
const mkStore = () => new LocalProjectStore(new MemoryStorage(), () => NOW);

describe("LocalProjectStore", () => {
  it("creates drafts and validates metadata", async () => {
    const s = mkStore();
    const p = await s.create({ name: "  مصنع  ", sector: "industrial" });
    expect(p).toMatchObject({ name: "مصنع", status: "draft", input: null, result: null, isDemo: false });
    await expect(s.create({ name: "x", sector: "industrial" })).rejects.toThrow(StoreError);
    await expect(s.create({ name: "مشروع", sector: "nope" as never })).rejects.toThrow(/القطاع/);
    expect(await s.list()).toHaveLength(1);
  });

  it("saveInput computes the result in the same write and moves to in_progress", async () => {
    const s = mkStore();
    const p = await s.create({ name: "مشروع", sector: "industrial" });
    const saved = await s.saveInput(p.id, fixture);
    expect(saved.status).toBe("in_progress");
    expect(saved.result?.inputHash).toBe(hashInput(fixture));
    expect(saved.result?.output.totalInvestment).toBeCloseTo(404_880, 6);
    expect(saved.inputIssues).toEqual([]);
  });

  it("invalid input clears the cached result (no stale numbers)", async () => {
    const s = mkStore();
    const p = await s.create({ name: "مشروع", sector: "industrial" });
    await s.saveInput(p.id, fixture);
    const bad = await s.saveInput(p.id, { ...fixture, projectLife: 0 });
    expect(bad.result).toBeNull();
    expect(bad.inputIssues.length).toBeGreaterThan(0);
    expect(bad.input?.projectLife).toBe(0);
  });

  it("markCompleted requires a valid, non-trivial result; editing reopens the study", async () => {
    const s = mkStore();
    const p = await s.create({ name: "مشروع", sector: "industrial" });
    await expect(s.markCompleted(p.id)).rejects.toThrow(StoreError);
    await s.saveInput(p.id, blankInput());
    await expect(s.markCompleted(p.id)).rejects.toThrow(/صفرية/);
    await s.saveInput(p.id, fixture);
    expect((await s.markCompleted(p.id)).status).toBe("completed");
    expect((await s.saveInput(p.id, fixture)).status).toBe("in_progress");
  });

  it("export → import round-trips and recomputes results instead of trusting the file", async () => {
    const a = mkStore();
    const p = await a.create({ name: "مشروع", sector: "health" });
    await a.saveInput(p.id, fixture);
    const json = await a.exportAll();
    const tampered = json.replace(/"totalInvestment": [0-9.]+/, '"totalInvestment": 1');
    const b = mkStore();
    expect(await b.importAll(tampered)).toBe(1);
    expect((await b.get(p.id))?.result?.output.totalInvestment).toBeCloseTo(404_880, 6);
    await expect(b.importAll("{}")).rejects.toThrow(StoreError);
    await expect(b.importAll("not json")).rejects.toThrow(StoreError);
  });

  it("demo data is flagged, computed, and removable without touching real projects", async () => {
    const s = mkStore();
    await s.create({ name: "حقيقي", sector: "services" });
    await s.importAll(demoExportJson(NOW));
    const all = await s.list();
    expect(all.filter((p) => p.isDemo)).toHaveLength(4);
    expect(all.filter((p) => p.isDemo && p.input).every((p) => p.result !== null)).toBe(true);
    expect(await s.removeDemo()).toBe(4);
    expect((await s.list()).map((p) => p.name)).toEqual(["حقيقي"]);
  });

  it("surfaces corrupted storage as a StoreError", async () => {
    const mem = new MemoryStorage();
    mem.setItem("jadwa.projects.v1", "{oops");
    await expect(new LocalProjectStore(mem).list()).rejects.toThrow(StoreError);
  });

  it("notifies subscribers on writes", async () => {
    const s = mkStore();
    let n = 0;
    const off = s.subscribe(() => n++);
    await s.create({ name: "مشروع", sector: "industrial" });
    off();
    await s.create({ name: "مشروع 2", sector: "industrial" });
    expect(n).toBe(1);
  });
});

describe("dashboard stats", () => {
  it("counts, months, sectors, indicators", async () => {
    const s = mkStore();
    await s.importAll(demoExportJson(NOW));
    const ps = await s.list();
    const st = dashboardStats(ps);
    expect(st.total).toBe(4);
    expect(Object.fromEntries(st.byStatus.map((b) => [b.status, b.count]))).toEqual({ completed: 2, in_progress: 1, draft: 1 });
    expect(st.reportsReady).toBe(3);
    expect(st.demoCount).toBe(4);

    const m6 = monthlySeries(ps, NOW, 6);
    expect(m6).toHaveLength(6);
    expect(m6.at(-1)!.key).toBe("2026-10");
    expect(m6.reduce((a, b) => a + b.created, 0)).toBe(4);
    expect(monthlySeries(ps, NOW, 3).reduce((a, b) => a + b.created, 0)).toBe(2); // Aug–Oct: cafe (Sep) + farm (Oct)
    expect(monthlySeries(ps, NOW, "all")).toHaveLength(6);
    expect(monthlySeries([], NOW, "all")).toEqual([]);

    expect(sectorDistribution(ps).map((r) => r.sector).sort()).toEqual(["agricultural", "commercial", "health", "industrial"]);

    const rows = indicatorRows(ps);
    expect(rows).toHaveLength(3);
    for (let i = 1; i < rows.length; i++) expect((rows[i - 1].irr ?? -Infinity) >= (rows[i].irr ?? -Infinity)).toBe(true);
  });

  it("demo dates fall inside the window", () => {
    for (const p of demoProjects(NOW)) expect(Date.parse(p.createdAt)).toBeLessThanOrEqual(NOW.getTime());
  });
});

describe("sensitivity", () => {
  it("re-runs the engine per shocked variable and sorts by swing", () => {
    const r = runSensitivity(fixture, 10);
    expect(r.rows).toHaveLength(6);
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i - 1].swing).toBeGreaterThanOrEqual(r.rows[i].swing);
    const price = r.rows.find((x) => x.key === "price")!;
    expect(price.npvHigh!).toBeGreaterThan(r.baseNpv);
    expect(price.npvLow!).toBeLessThan(r.baseNpv);
    const inv = r.rows.find((x) => x.key === "investment")!;
    expect(inv.npvHigh!).toBeLessThan(r.baseNpv);
    expect(r.rows[0].key).toBe("price");
  });
});
