"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { FolderX } from "lucide-react";
import { useProject } from "./ProjectsProvider";
import { DemoBadge, StatusBadge } from "./ui/Badges";
import { EmptyState, ErrorState, LoadingBlock } from "./ui/primitives";
import { fmtDate } from "@/lib/format";
import { sectorLabel } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";

/** Shared header/tabs for /projects/[id]/*. Renders children with the loaded project. */
export function ProjectFrame({ children }: { children: (p: Project) => React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { project, loading, error } = useProject(id);

  if (loading) return <LoadingBlock height={90} count={3} />;
  if (error) return <ErrorState message={error} />;
  if (!project)
    return (
      <div className="card">
        <EmptyState icon={FolderX} title="المشروع غير موجود" text="ربما حُذف المشروع أو أن الرابط غير صحيح.">
          <Link href="/projects" className="btn btn-primary">
            العودة إلى المشاريع
          </Link>
        </EmptyState>
      </div>
    );

  const base = `/projects/${project.id}`;
  const tabs = [
    { href: base, label: "نظرة عامة" },
    { href: `${base}/study`, label: "بيانات الدراسة" },
    { href: `${base}/financial`, label: "التحليل المالي" },
    { href: `${base}/report`, label: "التقرير" },
  ];

  return (
    <>
      <div className="no-print stack" style={{ gap: 14 }}>
        <div className="page-head">
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h2>{project.name}</h2>
              <StatusBadge status={project.status} />
              {project.isDemo && <DemoBadge />}
            </div>
            <div className="meta">
              <span>القطاع: {sectorLabel(project.sector)}</span>
              <span>
                أُنشئ: <span className="num">{fmtDate(project.createdAt)}</span>
              </span>
              <span>
                آخر تحديث: <span className="num">{fmtDate(project.updatedAt)}</span>
              </span>
            </div>
          </div>
        </div>
        <nav className="tabs" aria-label="أقسام المشروع">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={pathname === t.href ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children(project)}
    </>
  );
}
