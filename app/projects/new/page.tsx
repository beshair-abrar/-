"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjects } from "@/components/ProjectsProvider";
import { ProjectMetaForm } from "@/components/ProjectMetaForm";
import { ErrorState, LoadingBlock } from "@/components/ui/primitives";

function NewProjectInner() {
  const { store, loading, error } = useProjects();
  const router = useRouter();
  const startStudy = useSearchParams().get("next") === "study";

  if (loading) return <LoadingBlock />;
  if (error || !store) return <ErrorState message={error ?? "التخزين غير متاح"} />;

  return (
    <section className="card" style={{ maxWidth: 820 }}>
      <div className="card-head">
        <div>
          <h2>{startStudy ? "بدء دراسة جدوى جديدة" : "إنشاء مشروع جديد"}</h2>
          <div className="card-sub">{startStudy ? "الخطوة 1 من 2: بيانات المشروع الأساسية، ثم تنتقل إلى إدخال بيانات الدراسة." : "يُحفظ المشروع كمسودة ويمكنك بدء الدراسة لاحقًا."}</div>
        </div>
      </div>
      <div className="card-body">
        <ProjectMetaForm
          submitLabel={startStudy ? "متابعة إلى بيانات الدراسة" : "إنشاء المشروع"}
          onSubmit={async (data) => {
            const p = await store.create(data);
            router.push(startStudy ? `/projects/${p.id}/study` : `/projects/${p.id}`);
          }}
          onCancel={() => router.back()}
        />
      </div>
    </section>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewProjectInner />
    </Suspense>
  );
}
