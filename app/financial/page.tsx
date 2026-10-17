"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BarChart3, Calculator } from "lucide-react";
import { useProjects } from "@/components/ProjectsProvider";
import { DemoBadge } from "@/components/ui/Badges";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { fmtNumber, fmtPct } from "@/lib/format";
import { indicatorRows } from "@/lib/projects/stats";
import { paybackLabel } from "@/lib/feasibility-engine";

export default function FinancialHubPage() {
  const { projects, loading, error, reload } = useProjects();
  const rows = useMemo(() => indicatorRows(projects), [projects]);

  if (loading) return <LoadingBlock height={60} count={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>التحليل المالي</h2>
          <div className="meta">مؤشرات الجدوى لكل مشروع بنتائج محسوبة. افتح المشروع لعرض CAPEX وOPEX والتدفقات النقدية ونقطة التعادل وتحليل الحساسية.</div>
        </div>
      </div>
      <section className="card">
        {rows.length === 0 ? (
          <EmptyState icon={Calculator} title="لا توجد نتائج مالية بعد" text="تظهر هنا المشاريع بعد إدخال بيانات دراستها وحفظها بنجاح.">
            <Link href="/projects" className="btn btn-primary">الذهاب إلى المشاريع</Link>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <caption className="sr-only">مقارنة مؤشرات الجدوى</caption>
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th className="n">إجمالي الاستثمار</th>
                  <th className="n">NPV</th>
                  <th className="n">معدل الخصم</th>
                  <th className="n">IRR</th>
                  <th>فترة الاسترداد</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <Link href={`/projects/${r.id}`} style={{ fontWeight: 600, color: "var(--text)" }}>{r.name}</Link>
                        {r.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="n">{fmtNumber(r.totalInvestment)}</td>
                    <td className="n" style={{ color: r.npv < 0 ? "var(--danger)" : undefined }}>{fmtNumber(r.npv)}</td>
                    <td className="n">{fmtPct(r.discountRate)}</td>
                    <td className="n">{fmtPct(r.irr)}</td>
                    <td>{paybackLabel(r.paybackYears)}</td>
                    <td>
                      <Link className="btn btn-sm" href={`/projects/${r.id}/financial`}>
                        <BarChart3 size={14} aria-hidden />
                        التحليل الكامل
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
