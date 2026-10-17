"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, FolderPlus } from "lucide-react";
import { useProjects } from "@/components/ProjectsProvider";
import { ProjectsTable } from "@/components/ProjectsTable";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { ProjectStatus, STATUS_LABELS } from "@/lib/projects/types";

function ProjectsInner() {
  const { projects, loading, error, reload } = useProjects();
  const sp = useSearchParams();
  const raw = sp.get("status");
  const initialStatus: ProjectStatus | "all" = raw && raw in STATUS_LABELS ? (raw as ProjectStatus) : "all";

  if (loading) return <LoadingBlock height={60} count={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>المشاريع ودراسات الجدوى</h2>
          <div className="meta">كل مشروع يحمل دراسة جدوى واحدة: مسودة ← قيد التنفيذ ← مكتملة</div>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          <FolderPlus size={16} aria-hidden />
          مشروع جديد
        </Link>
      </div>
      <section className="card">
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="لا توجد مشاريع" text="أنشئ مشروعًا لبدء دراسة الجدوى الخاصة به.">
            <Link href="/projects/new?next=study" className="btn btn-primary">
              إنشاء مشروع وبدء الدراسة
            </Link>
          </EmptyState>
        ) : (
          <ProjectsTable projects={projects} initialStatus={initialStatus} caption="جدول المشاريع" />
        )}
      </section>
    </>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingBlock height={60} count={5} />}>
      <ProjectsInner />
    </Suspense>
  );
}
