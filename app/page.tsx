"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, FileText, FlaskConical, FolderKanban, FolderOpen, FolderPlus, Loader, PlayCircle, RotateCcw } from "lucide-react";
import { useProjects } from "@/components/ProjectsProvider";
import { ProjectsTable } from "@/components/ProjectsTable";
import { ColumnChart, RankedBars, StatusDonut } from "@/components/charts/Charts";
import { ChartCard, EmptyState, ErrorState, KpiCard, LoadingBlock, Segmented, SmallEmpty } from "@/components/ui/primitives";
import { fmtCompact, fmtDate, fmtNumber, fmtPct } from "@/lib/format";
import { dashboardStats, indicatorRows, monthlySeries, sectorDistribution } from "@/lib/projects/stats";

type Range = "6" | "12" | "all";

export default function DashboardPage() {
  const { projects, loading, error, reload } = useProjects();
  const [range, setRange] = useState<Range>("6");

  const stats = useMemo(() => dashboardStats(projects), [projects]);
  const months = useMemo(() => monthlySeries(projects, new Date(), range === "all" ? "all" : Number(range)), [projects, range]);
  const sectors = useMemo(() => sectorDistribution(projects), [projects]);
  const indicators = useMemo(() => indicatorRows(projects), [projects]);

  if (loading) return <LoadingBlock height={110} count={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const count = (s: string) => stats.byStatus.find((b) => b.status === s)?.count ?? 0;
  const resume = projects.find((p) => p.status === "in_progress") ?? projects.find((p) => p.status === "draft");
  const lastUpdated = projects[0];

  if (stats.total === 0) {
    return (
      <>
        <QuickActions resumeId={undefined} hasReports={false} />
        <div className="card">
          <EmptyState icon={FolderKanban} title="لا توجد مشاريع بعد" text="ابدأ بإنشاء مشروعك الأول وإدخال بيانات دراسة الجدوى، وستظهر المؤشرات والرسوم البيانية هنا تلقائيًا من بياناتك الفعلية.">
            <Link href="/projects/new?next=study" className="btn btn-primary">
              <FolderPlus size={16} aria-hidden />
              إنشاء مشروع وبدء الدراسة
            </Link>
            <Link href="/settings" className="btn">
              <FlaskConical size={16} aria-hidden />
              استعراض المنصة ببيانات تجريبية
            </Link>
          </EmptyState>
        </div>
      </>
    );
  }

  const rangeLabel = range === "all" ? "منذ أول مشروع" : `آخر ${range} أشهر`;
  const investedMonths = months.filter((m) => m.investmentCount > 0).length;

  return (
    <>
      {stats.demoCount > 0 && (
        <div className="alert alert-warn" role="status">
          <FlaskConical size={18} aria-hidden />
          <div style={{ flex: 1 }}>
            تتضمن اللوحة <strong className="num">{stats.demoCount}</strong> مشروعًا تجريبيًا (موسومة بـ«تجريبي»). أرقامها توضيحية وليست بيانات فعلية.
          </div>
          <Link href="/settings" className="btn btn-sm">
            إدارة البيانات التجريبية
          </Link>
        </div>
      )}

      <QuickActions resumeId={resume?.id} hasReports={stats.reportsReady > 0} />

      <section className="grid grid-kpi" aria-label="مؤشرات الأداء">
        <KpiCard label="إجمالي المشاريع" value={fmtNumber(stats.total)} icon={FolderKanban} accent="brand" href="/projects" hint={lastUpdated ? `آخر تحديث: ${fmtDate(lastUpdated.updatedAt)}` : undefined} />
        <KpiCard label="الدراسات المكتملة" value={fmtNumber(count("completed"))} icon={CheckCircle2} accent="gold" href="/projects?status=completed" hint={`${stats.total ? Math.round((count("completed") / stats.total) * 100) : 0}% من المشاريع`} />
        <KpiCard label="قيد التنفيذ" value={fmtNumber(count("in_progress"))} icon={Loader} href="/projects?status=in_progress" hint="بيانات محفوظة لم تُعتمد بعد" />
        <KpiCard label="المسودات" value={fmtNumber(count("draft"))} icon={CircleDashed} href="/projects?status=draft" hint="مشاريع بلا بيانات دراسة" />
        <KpiCard label="التقارير الجاهزة" value={fmtNumber(stats.reportsReady)} icon={FileText} href="/reports" hint="دراسات بنتائج محسوبة صالحة" />
      </section>

      <div className="row-between">
        <h2 style={{ fontSize: 17 }}>تحليل المحفظة</h2>
        <Segmented<Range>
          label="الفترة الزمنية للرسوم الشهرية"
          value={range}
          onChange={setRange}
          options={[
            { value: "6", label: "6 أشهر" },
            { value: "12", label: "12 شهرًا" },
            { value: "all", label: "الكل" },
          ]}
        />
      </div>

      <div className="grid grid-2">
        <ChartCard
          title="المشاريع حسب الحالة"
          subtitle="كل المشاريع الحالية"
          chart={<StatusDonut data={stats.byStatus.map((b) => ({ label: b.label, count: b.count }))} />}
          table={
            <table className="data compact">
              <thead><tr><th>الحالة</th><th className="n">العدد</th></tr></thead>
              <tbody>{stats.byStatus.map((b) => <tr key={b.status}><td>{b.label}</td><td className="n">{b.count}</td></tr>)}</tbody>
            </table>
          }
        />
        <ChartCard
          title="المشاريع المنشأة شهريًا"
          subtitle={rangeLabel}
          chart={<ColumnChart data={months as unknown as Record<string, unknown>[]} xKey="label" yKey="created" name="مشاريع جديدة" />}
          table={
            <table className="data compact">
              <thead><tr><th>الشهر</th><th className="n">مشاريع جديدة</th></tr></thead>
              <tbody>{months.map((m) => <tr key={m.key}><td>{m.label}</td><td className="n">{m.created}</td></tr>)}</tbody>
            </table>
          }
        />
        <ChartCard
          title="توزيع المشاريع حسب القطاع"
          subtitle="عدد المشاريع في كل قطاع"
          chart={<RankedBars data={sectors.map((s) => ({ label: s.label, value: s.count }))} name="عدد المشاريع" />}
          table={
            <table className="data compact">
              <thead><tr><th>القطاع</th><th className="n">العدد</th></tr></thead>
              <tbody>{sectors.map((s) => <tr key={s.sector}><td>{s.label}</td><td className="n">{s.count}</td></tr>)}</tbody>
            </table>
          }
        />
        <ChartCard
          title="الإنفاق الاستثماري المخطط شهريًا"
          subtitle={`للمشاريع ذات النتائج المحسوبة حسب شهر الإنشاء · ${rangeLabel}`}
          empty={investedMonths === 0 ? <SmallEmpty text="لا توجد مشاريع بنتائج محسوبة في هذه الفترة" /> : undefined}
          chart={<ColumnChart data={months as unknown as Record<string, unknown>[]} xKey="label" yKey="investment" name="الكلفة الاستثمارية" color="#1d4ed8" format={fmtNumber} />}
          table={
            <table className="data compact">
              <thead><tr><th>الشهر</th><th className="n">الكلفة الاستثمارية</th><th className="n">عدد المشاريع</th></tr></thead>
              <tbody>{months.map((m) => <tr key={m.key}><td>{m.label}</td><td className="n">{fmtNumber(m.investment)}</td><td className="n">{m.investmentCount}</td></tr>)}</tbody>
            </table>
          }
        />
      </div>

      <ChartCard
        title="مقارنة معدل العائد الداخلي (IRR)"
        subtitle="للمشاريع ذات النتائج المحسوبة. معدلات الخصم تختلف بين المشاريع، لذا لا تُقارَن قيم NPV مباشرة هنا."
        empty={indicators.filter((r) => r.irr !== null).length === 0 ? <SmallEmpty text="لا توجد مشاريع بمعدل عائد داخلي محسوب بعد" /> : undefined}
        actions={<Link href="/financial" className="btn btn-sm">التحليل المالي</Link>}
        chart={<RankedBars data={indicators.filter((r) => r.irr !== null).map((r) => ({ label: r.name, value: Math.round(r.irr! * 100) / 100 }))} name="IRR %" color="#b7860b" format={(n) => fmtPct(n)} allowDecimals />}
        table={
          <table className="data compact">
            <thead><tr><th>المشروع</th><th className="n">IRR</th><th className="n">NPV</th><th className="n">معدل الخصم</th><th className="n">الكلفة الاستثمارية</th></tr></thead>
            <tbody>
              {indicators.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td className="n">{fmtPct(r.irr)}</td><td className="n">{fmtCompact(r.npv)}</td><td className="n">{fmtPct(r.discountRate)}</td><td className="n">{fmtCompact(r.totalInvestment)}</td></tr>
              ))}
            </tbody>
          </table>
        }
      />

      <section className="card" aria-label="أحدث المشاريع">
        <div className="card-head">
          <div>
            <h3>أحدث المشاريع</h3>
            <div className="card-sub">مرتبة حسب آخر تحديث</div>
          </div>
          <Link href="/projects" className="btn btn-sm">
            كل المشاريع
          </Link>
        </div>
        <ProjectsTable projects={projects} pageSize={5} toolbar={false} caption="أحدث المشاريع" />
      </section>
    </>
  );
}

function QuickActions({ resumeId, hasReports }: { resumeId?: string; hasReports: boolean }) {
  return (
    <section className="quick" aria-label="إجراءات سريعة">
      <Link href="/projects/new">
        <span className="qa-icon" aria-hidden><FolderPlus size={19} /></span>
        <span><span className="qa-title">إنشاء مشروع</span><br /><span className="qa-sub">تسجيل مشروع جديد كمسودة</span></span>
      </Link>
      <Link href="/projects/new?next=study">
        <span className="qa-icon gold" aria-hidden><PlayCircle size={19} /></span>
        <span><span className="qa-title">بدء دراسة جدوى</span><br /><span className="qa-sub">مشروع جديد ثم إدخال البيانات</span></span>
      </Link>
      <Link href={resumeId ? `/projects/${resumeId}/study` : "#"} aria-disabled={!resumeId} tabIndex={resumeId ? undefined : -1}>
        <span className="qa-icon" aria-hidden><RotateCcw size={19} /></span>
        <span><span className="qa-title">استكمال دراسة محفوظة</span><br /><span className="qa-sub">{resumeId ? "آخر دراسة غير مكتملة" : "لا توجد دراسات غير مكتملة"}</span></span>
      </Link>
      <Link href="/reports" aria-disabled={!hasReports} tabIndex={hasReports ? undefined : -1}>
        <span className="qa-icon" aria-hidden><FolderOpen size={19} /></span>
        <span><span className="qa-title">فتح التقارير السابقة</span><br /><span className="qa-sub">{hasReports ? "تقارير الدراسات المحسوبة" : "لا توجد تقارير بعد"}</span></span>
      </Link>
    </section>
  );
}
