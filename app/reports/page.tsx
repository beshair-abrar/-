"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useProjects } from "@/components/ProjectsProvider";
import { DemoBadge, StatusBadge } from "@/components/ui/Badges";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/format";
import { sectorLabel } from "@/lib/projects/types";

export default function ReportsPage() {
  const { projects, loading, error, reload } = useProjects();
  if (loading) return <LoadingBlock height={60} count={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const withReports = projects.filter((p) => p.result);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>التقارير والملفات</h2>
          <div className="meta">تقرير لكل دراسة بنتائج محسوبة صالحة — قابل للطباعة كملف PDF وتنزيل جداوله بصيغة CSV لبرنامج Excel.</div>
        </div>
      </div>
      <section className="card">
        {withReports.length === 0 ? (
          <EmptyState icon={FileText} title="لا توجد تقارير بعد" text="يصبح تقرير المشروع متاحًا فور حفظ بيانات دراسة صحيحة.">
            <Link href="/projects" className="btn btn-primary">الذهاب إلى المشاريع</Link>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <caption className="sr-only">قائمة التقارير</caption>
              <thead>
                <tr><th>المشروع</th><th>القطاع</th><th>حالة الدراسة</th><th>تاريخ احتساب النتائج</th><th>الإجراءات</th></tr>
              </thead>
              <tbody>
                {withReports.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        {p.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td>{sectorLabel(p.sector)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num">{fmtDateTime(p.result!.computedAt)}</td>
                    <td>
                      <Link className="btn btn-sm btn-primary" href={`/projects/${p.id}/report`}>
                        <FileText size={14} aria-hidden />
                        فتح التقرير
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
