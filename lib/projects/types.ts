import type { FeasibilityInput, FeasibilityOutput } from "../feasibility-engine";

export type ProjectStatus = "draft" | "in_progress" | "completed";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "مسودة",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};

export const SECTORS = [
  { id: "industrial", label: "صناعي" },
  { id: "commercial", label: "تجاري" },
  { id: "services", label: "خدمي" },
  { id: "agricultural", label: "زراعي" },
  { id: "tourism", label: "سياحي وضيافة" },
  { id: "technology", label: "تقني" },
  { id: "health", label: "صحي" },
  { id: "education", label: "تعليمي" },
  { id: "real_estate", label: "عقاري" },
  { id: "other", label: "أخرى" },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];

export const sectorLabel = (id: string) => SECTORS.find((s) => s.id === id)?.label ?? "غير محدد";

/** Cached engine result. `inputHash` ties it to the exact input it was computed from. */
export interface CachedResult {
  output: FeasibilityOutput;
  inputHash: string;
  computedAt: string;
}

export interface Project {
  id: string;
  name: string;
  sector: SectorId;
  description: string;
  status: ProjectStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Study inputs as last saved (may be invalid while the study is in progress). */
  input: FeasibilityInput | null;
  /** null when no input or input is invalid. Always recomputed in the same write as `input`. */
  result: CachedResult | null;
  /** Validation issues for the saved input, empty when valid. */
  inputIssues: string[];
  /** Demo records are always labelled as such in the UI. */
  isDemo: boolean;
}

export interface NewProject {
  name: string;
  sector: SectorId;
  description?: string;
}
