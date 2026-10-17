"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Banknote, Calculator, Clock, Coins, Percent, Scale, TrendingUp, Wallet } from "lucide-react";
import { ProjectFrame } from "@/components/ProjectHeader";
import { ColumnChart, GroupedColumns, SERIES, Tornado } from "@/components/charts/Charts";
import { ChartCard, EmptyState, KpiCard } from "@/components/ui/primitives";
import { fmtCompact, fmtNumber, fmtPct } from "@/lib/format";
import type { Project } from "@/lib/projects/types";
import { runSensitivity } from "@/lib/sensitivity";

export default function FinancialPage() {
  return <ProjectFrame>{(p) => <Financial project={p} />}</ProjectFrame>;
}

function Financial({ project: p }: { project: Project }) {
  const o = p.result?.output;
  const sens = useMemo(() => (p.input && o ? runSensitivity(p.input, 10) : null), [p.input, o]);

  if (!o || !p.input) {
    return (
      <div className="card">
        <EmptyState icon={Calculator} title="لا توجد نتائج مالية بعد" text={p.input ? "بيانات الدراسة المحفوظة تحتوي أخطاء تمنع الحساب. راجعها وأعد الحفظ." : "أدخل بيانات الدراسة واحفظها لحساب المؤشرات المالية."}>
          <Link href={`/projects/${p.id}/study`} className="btn btn-primary">
            {p.input ? "مراجعة بيانات الدراسة" : "بدء الدراسة"}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const [r1, r2] = p.input.discountRates;
  // Reference year for annual figures: first year at peak capacity.
  const peak = Math.max(...o.yearly.map((y) => y.capacityPct));
  const ref = o.yearly.find((y) => y.capacityPct === peak)!;
  const cashData = o.cashFlows.map((cf, t) => ({ label: `س${t}`, value: cf }));
  const rcData = o.yearly.map((y) => ({ label: `س${y.year}`, revenue: y.revenue, cost: y.totalCost }));

  return (
    <>
      {p.isDemo && <div className="alert alert-warn">مشروع تجريبي — الأرقام توضيحية وليست بيانات فعلية.</div>}
      {o.warnings.length > 0 && (
        <div className="alert alert-warn">
          <AlertTriangle size={18} aria-hidden />
          <ul style={{ margin: 0 }}>{o.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <section className="grid grid-kpi" aria-label="المؤشرات المالية">
        <KpiCard label="CAPEX — التكاليف الاستثمارية" value={fmtNumber(o.capex)} icon={Wallet} accent="brand" hint={`إجمالي الاستثمار مع رأس المال العامل والطوارئ: ${fmtCompact(o.totalInvestment)}`} />
        <KpiCard label="OPEX — التكاليف التشغيلية" value={fmtNumber(ref.opex)} icon={Coins} hint={`سنويًا في السنة ${ref.year} (طاقة ${ref.capacityPct}%) دون الإهلاك`} />
        <KpiCard label="الإيرادات المتوقعة" value={fmtNumber(ref.revenue)} icon={Banknote} hint={`السنة ${ref.year} · عند 100%: ${fmtCompact(o.revenueAt100)}`} />
        <KpiCard label={`NPV @${r1}%`} value={fmtNumber(o.npv[0])} icon={TrendingUp} accent="gold" hint={`@${r2}%: ${fmtNumber(o.npv[1])}`} />
        <KpiCard label="IRR — العائد الداخلي" value={fmtPct(o.irr)} icon={Percent} accent="gold" hint={o.irr === null ? "لا يوجد معدل يصفّر التدفقات" : o.irr > r1 ? `أعلى من معدل الخصم ${r1}%` : `أقل من معدل الخصم ${r1}%`} />
        <KpiCard label="ROI — العائد على الاستثمار" value={fmtPct(o.roi)} icon={Percent} hint={`مجموع الأرباح ÷ الاستثمار خلال ${p.input.projectLife} سنوات · المحاسبي السنوي ${fmtPct(o.arr)}`} />
        <KpiCard label="فترة الاسترداد" value={<span style={{ fontSize: 20 }}>{o.payback.label}</span>} icon={Clock} hint="غير مخصومة" />
        <KpiCard label="نقطة التعادل" value={fmtPct(ref.breakEvenCapacityPct)} icon={Scale} hint={ref.breakEvenRevenue === null ? "هامش المساهمة غير موجب" : `من الطاقة · إيراد ${fmtCompact(ref.breakEvenRevenue)} في السنة ${ref.year}`} />
      </section>

      <div className="grid grid-2">
        <ChartCard
          title="التدفقات النقدية الصافية"
          subtitle="السنة 0 = الاستثمار المبدئي؛ السنة الأخيرة تشمل القيمة المتبقية"
          chart={<ColumnChart data={cashData} xKey="label" yKey="value" name="صافي التدفق" />}
          table={
            <table className="data compact">
              <thead><tr><th>السنة</th><th className="n">صافي التدفق</th></tr></thead>
              <tbody>{o.cashFlows.map((cf, t) => <tr key={t}><td>{t}</td><td className="n">{fmtNumber(cf)}</td></tr>)}</tbody>
            </table>
          }
        />
        <ChartCard
          title="الإيرادات مقابل التكاليف"
          subtitle="التكاليف = المتغيرة + الثابتة (شاملة الإهلاك) + فوائد القرض"
          chart={<GroupedColumns data={rcData} xKey="label" series={[{ key: "revenue", name: "الإيرادات" }, { key: "cost", name: "إجمالي التكاليف" }]} />}
          table={
            <table className="data compact">
              <thead><tr><th>السنة</th><th className="n">الإيرادات</th><th className="n">التكاليف</th><th className="n">صافي الربح</th></tr></thead>
              <tbody>{o.yearly.map((y) => <tr key={y.year}><td>{y.year}</td><td className="n">{fmtNumber(y.revenue)}</td><td className="n">{fmtNumber(y.totalCost)}</td><td className="n">{fmtNumber(y.profit)}</td></tr>)}</tbody>
            </table>
          }
        />
      </div>

      {sens && (
        <ChartCard
          title="تحليل الحساسية (Tornado)"
          subtitle={`التغير في NPV @${sens.discountRate}% عند تحريك كل متغير ±${sens.deltaPct}% مع تثبيت الباقي · NPV الأساسي ${fmtNumber(sens.baseNpv)}`}
          chart={<Tornado deltaPct={sens.deltaPct} data={sens.rows.map((r) => ({ label: r.label, low: r.deltaLow, high: r.deltaHigh }))} />}
          table={
            <table className="data compact">
              <thead><tr><th>المتغير</th><th className="n">NPV عند −{sens.deltaPct}%</th><th className="n">NPV عند +{sens.deltaPct}%</th><th className="n">أقصى تغير</th></tr></thead>
              <tbody>
                {sens.rows.map((r) => (
                  <tr key={r.key}><td>{r.label}</td><td className="n">{r.npvLow === null ? "غير صالح" : fmtNumber(r.npvLow)}</td><td className="n">{r.npvHigh === null ? "غير صالح" : fmtNumber(r.npvHigh)}</td><td className="n">{fmtNumber(r.swing)}</td></tr>
                ))}
              </tbody>
            </table>
          }
        />
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h3>قائمة الدخل ونقطة التعادل حسب السنة</h3>
            <div className="card-sub">نقطة التعادل = (التكاليف الثابتة + الفوائد) ÷ نسبة هامش المساهمة</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr>
                <th>السنة</th><th className="n">الطاقة</th><th className="n">الإيرادات</th><th className="n">OPEX</th><th className="n">صافي الربح</th><th className="n">إيراد التعادل</th><th className="n">طاقة التعادل</th>
              </tr>
            </thead>
            <tbody>
              {o.yearly.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td className="n">{fmtPct(y.capacityPct)}</td>
                  <td className="n">{fmtNumber(y.revenue)}</td>
                  <td className="n">{fmtNumber(y.opex)}</td>
                  <td className="n" style={{ color: y.profit < 0 ? "var(--danger)" : undefined }}>{fmtNumber(y.profit)}</td>
                  <td className="n">{y.breakEvenRevenue === null ? "—" : fmtNumber(y.breakEvenRevenue)}</td>
                  <td className="n">{fmtPct(y.breakEvenCapacityPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>هيكل الاستثمار والتمويل</h3>
        <div className="legend" style={{ marginBottom: 10 }}>
          <span><span className="swatch" style={{ background: SERIES[0] }} />رأس المال الممتلك</span>
          <span><span className="swatch" style={{ background: SERIES[1] }} />القرض</span>
        </div>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", gap: 2, background: "var(--surface)" }} role="img" aria-label={`رأس المال الممتلك ${fmtNumber(o.equity)}، القرض ${fmtNumber(p.input.loan.amount)}`}>
          <div style={{ flex: o.equity, background: SERIES[0] }} />
          <div style={{ flex: p.input.loan.amount, background: SERIES[1] }} />
        </div>
        <dl className="facts" style={{ marginTop: 14 }}>
          <div><dt>الأصول والتأسيس (CAPEX)</dt><dd className="num">{fmtNumber(o.capex)}</dd></div>
          <div><dt>رأس المال العامل</dt><dd className="num">{fmtNumber(o.workingCapital)}</dd></div>
          <div><dt>احتياطي الطوارئ</dt><dd className="num">{fmtNumber(o.contingency)}</dd></div>
          <div><dt>رأس المال الممتلك</dt><dd className="num">{fmtNumber(o.equity)}</dd></div>
          <div><dt>القرض</dt><dd className="num">{fmtNumber(p.input.loan.amount)}</dd></div>
        </dl>
      </section>
    </>
  );
}
