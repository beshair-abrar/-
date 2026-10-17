"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Pencil, Search } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { Project, ProjectStatus, SECTORS, sectorLabel, STATUS_LABELS } from "@/lib/projects/types";
import { DemoBadge, StatusBadge } from "./ui/Badges";

type SortKey = "name" | "sector" | "createdAt" | "status" | "updatedAt";
const STATUS_ORDER: Record<ProjectStatus, number> = { draft: 0, in_progress: 1, completed: 2 };

export function ProjectsTable({
  projects,
  pageSize = 10,
  toolbar = true,
  initialStatus = "all",
  caption,
}: {
  projects: Project[];
  pageSize?: number;
  toolbar?: boolean;
  initialStatus?: ProjectStatus | "all";
  caption?: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">(initialStatus);
  const [sector, setSector] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updatedAt", dir: -1 });
  const [page, setPage] = useState(0);

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = projects.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (sector === "all" || p.sector === sector) &&
        (!t || p.name.toLowerCase().includes(t) || p.description.toLowerCase().includes(t)),
    );
    const cmp = (a: Project, b: Project): number => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name, "ar");
        case "sector":
          return sectorLabel(a.sector).localeCompare(sectorLabel(b.sector), "ar");
        case "status":
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return a[sort.key].localeCompare(b[sort.key]);
      }
    };
    return [...rows].sort((a, b) => cmp(a, b) * sort.dir);
  }, [projects, q, status, sector, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => setPage(0), [q, status, sector, pageSize]);
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const head = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button className="sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "name" || key === "sector" ? 1 : -1 }))}>
          {label}
          <Icon size={13} aria-hidden style={{ opacity: active ? 1 : 0.4 }} />
        </button>
      </th>
    );
  };

  return (
    <div>
      {toolbar && (
        <div className="toolbar">
          <div className="search-input">
            <Search size={15} className="search-icon" aria-hidden />
            <input type="search" placeholder="ابحث باسم المشروع أو الوصف" aria-label="بحث في الجدول" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select aria-label="تصفية حسب الحالة" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "all")}>
            <option value="all">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select aria-label="تصفية حسب القطاع" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="all">كل القطاعات</option>
            {SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="table-wrap">
        <table className="data">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {head("name", "اسم المشروع")}
              {head("sector", "القطاع")}
              {head("createdAt", "تاريخ الإنشاء")}
              {head("status", "حالة الدراسة")}
              {head("updatedAt", "آخر تحديث")}
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 28 }}>
                  لا توجد مشاريع مطابقة لمعايير البحث والتصفية
                </td>
              </tr>
            ) : (
              slice.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Link href={`/projects/${p.id}`} style={{ fontWeight: 600, color: "var(--text)" }}>
                        {p.name}
                      </Link>
                      {p.isDemo && <DemoBadge />}
                    </div>
                  </td>
                  <td>{sectorLabel(p.sector)}</td>
                  <td className="num">{fmtDate(p.createdAt)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="num">{fmtDate(p.updatedAt)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <Link className="btn btn-sm" href={`/projects/${p.id}/study`} title={p.input ? "استكمال/تعديل الدراسة" : "بدء الدراسة"}>
                        <Pencil size={14} aria-hidden />
                        {p.input ? (p.status === "completed" ? "تعديل" : "استكمال") : "بدء الدراسة"}
                      </Link>
                      {p.result ? (
                        <Link className="btn btn-sm" href={`/projects/${p.id}/report`}>
                          <FileText size={14} aria-hidden />
                          التقرير
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > pageSize && (
        <div className="pagination">
          <span>
            عرض <span className="num">{page * pageSize + 1}</span>–<span className="num">{Math.min(filtered.length, (page + 1) * pageSize)}</span> من <span className="num">{filtered.length}</span>
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="الصفحة السابقة">
              <ChevronRight size={15} aria-hidden />
              السابق
            </button>
            <span className="num">
              {page + 1} / {pages}
            </span>
            <button className="btn btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1} aria-label="الصفحة التالية">
              التالي
              <ChevronLeft size={15} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
