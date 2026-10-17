"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LocalProjectStore, ProjectStore, StoreError } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

interface ProjectsState {
  store: ProjectStore | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<ProjectsState | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ProjectStore | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: ProjectStore) => {
    try {
      setProjects(await s.list());
      setError(null);
    } catch (e) {
      setError(e instanceof StoreError ? e.message : "حدث خطأ غير متوقع أثناء تحميل المشاريع");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let s: ProjectStore;
    try {
      s = new LocalProjectStore(window.localStorage);
    } catch {
      setError("التخزين المحلي في المتصفح غير متاح (قد يكون وضع التصفح الخاص مفعّلًا)");
      setLoading(false);
      return;
    }
    setStore(s);
    load(s);
    const off = s.subscribe(() => load(s));
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("jadwa.")) load(s);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  const value = useMemo(
    () => ({ store, projects, loading, error, reload: () => store && load(store) }),
    [store, projects, loading, error, load],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProjects must be used inside ProjectsProvider");
  return v;
}

export function useProject(id: string | undefined) {
  const { projects, loading, error, store } = useProjects();
  const project = id ? (projects.find((p) => p.id === id) ?? null) : null;
  return { project, loading, error, store };
}
