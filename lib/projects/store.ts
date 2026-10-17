/**
 * Project persistence.
 *
 * `ProjectStore` is the only data-access boundary the UI uses. Today it is
 * backed by browser storage (single local workspace, no accounts). A Supabase
 * implementation with RLS (see supabase/migrations) can replace it without UI
 * changes.
 *
 * Cache rule (CLAUDE.md §3): `saveInput` recomputes or clears `result` in the
 * same write. A result can never outlive the input it was computed from.
 */
import { computeFeasibility, FeasibilityInput, FeasibilityInputError, validateInput } from "../feasibility-engine";
import { CachedResult, NewProject, Project, ProjectStatus, SECTORS } from "./types";

export interface ProjectStore {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(data: NewProject, opts?: { isDemo?: boolean }): Promise<Project>;
  updateMeta(id: string, data: Partial<NewProject>): Promise<Project>;
  saveInput(id: string, input: FeasibilityInput): Promise<Project>;
  markCompleted(id: string): Promise<Project>;
  remove(id: string): Promise<void>;
  removeDemo(): Promise<number>;
  exportAll(): Promise<string>;
  importAll(json: string): Promise<number>;
  clear(): Promise<void>;
  subscribe(fn: () => void): () => void;
}

export class StoreError extends Error {}

/** Minimal Storage subset so tests can inject an in-memory backend. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "jadwa.projects.v1";

/** Deterministic hash of an input (FNV-1a over its JSON) used to detect stale cached results. */
export function hashInput(input: FeasibilityInput): string {
  const json = JSON.stringify(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function computeResult(input: FeasibilityInput, now: string): { result: CachedResult | null; issues: string[] } {
  const issues = validateInput(input);
  if (issues.length) return { result: null, issues };
  try {
    return { result: { output: computeFeasibility(input), inputHash: hashInput(input), computedAt: now }, issues: [] };
  } catch (e) {
    if (e instanceof FeasibilityInputError) return { result: null, issues: e.issues };
    throw e;
  }
}

function isProjectShape(p: unknown): p is Project {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.sector === "string" &&
    (o.status === "draft" || o.status === "in_progress" || o.status === "completed") &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    !Number.isNaN(Date.parse(o.createdAt as string))
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class LocalProjectStore implements ProjectStore {
  private listeners = new Set<() => void>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private read(): Project[] {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new StoreError("تعذّر قراءة البيانات المحفوظة: الملف تالف");
    }
    if (!Array.isArray(parsed)) throw new StoreError("تعذّر قراءة البيانات المحفوظة: صيغة غير متوقعة");
    const defaults = { description: "", input: null, result: null, inputIssues: [] as string[], isDemo: false };
    return parsed.filter(isProjectShape).map((p) => ({ ...defaults, ...p }));
  }

  private write(projects: Project[]) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      throw new StoreError("تعذّر حفظ البيانات: مساحة التخزين في المتصفح ممتلئة أو غير متاحة");
    }
    this.listeners.forEach((fn) => fn());
  }

  private mutate(id: string, fn: (p: Project) => Project): Project {
    const all = this.read();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) throw new StoreError("المشروع غير موجود");
    const next = fn(all[idx]);
    all[idx] = next;
    this.write(all);
    return next;
  }

  private validateMeta(data: Partial<NewProject>) {
    if (data.name !== undefined) {
      const n = data.name.trim();
      if (n.length < 2) throw new StoreError("اسم المشروع يجب أن يكون حرفين على الأقل");
      if (n.length > 120) throw new StoreError("اسم المشروع طويل جدًا (الحد 120 حرفًا)");
    }
    if (data.sector !== undefined && !SECTORS.some((s) => s.id === data.sector)) throw new StoreError("القطاع غير صالح");
    if (data.description !== undefined && data.description.length > 2000) throw new StoreError("الوصف طويل جدًا (الحد 2000 حرف)");
  }

  async list() {
    return this.read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    return this.read().find((p) => p.id === id) ?? null;
  }

  async create(data: NewProject, opts: { isDemo?: boolean } = {}) {
    this.validateMeta(data);
    const now = this.clock().toISOString();
    const project: Project = {
      id: newId(),
      name: data.name.trim(),
      sector: data.sector,
      description: (data.description ?? "").trim(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      input: null,
      result: null,
      inputIssues: [],
      isDemo: !!opts.isDemo,
    };
    this.write([...this.read(), project]);
    return project;
  }

  async updateMeta(id: string, data: Partial<NewProject>) {
    this.validateMeta(data);
    return this.mutate(id, (p) => ({
      ...p,
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.sector !== undefined && { sector: data.sector }),
      ...(data.description !== undefined && { description: data.description.trim() }),
      updatedAt: this.clock().toISOString(),
    }));
  }

  async saveInput(id: string, input: FeasibilityInput) {
    const now = this.clock().toISOString();
    const { result, issues } = computeResult(input, now);
    // Editing a completed study re-opens it: the completed result no longer reflects the saved input.
    return this.mutate(id, (p) => ({ ...p, input, result, inputIssues: issues, status: "in_progress" as ProjectStatus, updatedAt: now }));
  }

  async markCompleted(id: string) {
    return this.mutate(id, (p) => {
      if (!p.input || !p.result) throw new StoreError("لا يمكن اعتماد الدراسة قبل إدخال بيانات صحيحة وحساب النتائج");
      if (p.result.inputHash !== hashInput(p.input)) throw new StoreError("النتائج المخزنة لا تطابق المدخلات الحالية؛ احفظ الدراسة مجددًا");
      if (p.result.output.totalInvestment <= 0 || p.result.output.revenueAt100 <= 0)
        throw new StoreError("لا يمكن اعتماد دراسة بإيرادات أو كلفة استثمارية صفرية");
      return { ...p, status: "completed", updatedAt: this.clock().toISOString() };
    });
  }

  async remove(id: string) {
    const all = this.read();
    if (!all.some((p) => p.id === id)) throw new StoreError("المشروع غير موجود");
    this.write(all.filter((p) => p.id !== id));
  }

  async removeDemo() {
    const all = this.read();
    const kept = all.filter((p) => !p.isDemo);
    this.write(kept);
    return all.length - kept.length;
  }

  async exportAll() {
    return JSON.stringify({ format: "jadwa-projects", version: 1, exportedAt: this.clock().toISOString(), projects: this.read() }, null, 2);
  }

  /** Merges projects from an export file. Results are recomputed, never trusted from the file. */
  async importAll(json: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new StoreError("الملف ليس JSON صالحًا");
    }
    const obj = parsed as { format?: string; projects?: unknown };
    if (obj?.format !== "jadwa-projects" || !Array.isArray(obj.projects)) throw new StoreError("الملف ليس نسخة احتياطية من جدوى تك");
    const incoming = obj.projects.filter(isProjectShape);
    const now = this.clock().toISOString();
    const byId = new Map(this.read().map((p) => [p.id, p]));
    for (const p of incoming) {
      const base: Project = { ...p, description: p.description ?? "", isDemo: !!p.isDemo, input: p.input ?? null, result: null, inputIssues: [] };
      if (base.input) {
        const { result, issues } = computeResult(base.input, now);
        base.result = result;
        base.inputIssues = issues;
        if (!result && base.status === "completed") base.status = "in_progress";
      } else {
        base.status = "draft";
      }
      byId.set(base.id, base);
    }
    this.write([...byId.values()]);
    return incoming.length;
  }

  async clear() {
    this.storage.removeItem(STORAGE_KEY);
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export class MemoryStorage implements KeyValueStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
