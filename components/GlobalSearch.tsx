"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useProjects } from "./ProjectsProvider";
import { sectorLabel } from "@/lib/projects/types";
import { StatusBadge } from "./ui/Badges";

/** Searches the user's projects by name, sector or description. */
export function GlobalSearch() {
  const { projects } = useProjects();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return projects
      .filter((p) => p.name.toLowerCase().includes(t) || sectorLabel(p.sector).includes(t) || p.description.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, projects]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    setQ("");
    router.push(`/projects/${id}`);
  };

  return (
    <div className="search" ref={box} role="search">
      <Search size={16} className="search-icon" aria-hidden />
      <input
        type="search"
        placeholder="ابحث في مشاريعك…"
        aria-label="البحث في المشاريع"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            go(results[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && q.trim() && (
        <div className="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="muted small" style={{ padding: "8px 10px" }}>لا توجد مشاريع مطابقة</div>
          ) : (
            results.map((p, i) => (
              <Link key={p.id} href={`/projects/${p.id}`} data-active={i === active} role="option" aria-selected={i === active} onClick={() => { setOpen(false); setQ(""); }}>
                <span>
                  {p.name}
                  <span className="muted small"> · {sectorLabel(p.sector)}</span>
                </span>
                <StatusBadge status={p.status} />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
