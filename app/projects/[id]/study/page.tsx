"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Save } from "lucide-react";
import { ProjectFrame } from "@/components/ProjectHeader";
import { useProjects } from "@/components/ProjectsProvider";
import { NumField, NumInput, RowsEditor, Section } from "@/components/study/fields";
import type { FeasibilityInput } from "@/lib/feasibility-engine";
import { blankInput } from "@/lib/projects/templates";
import type { Project } from "@/lib/projects/types";

export default function StudyPage() {
  return <ProjectFrame>{(p) => <StudyForm key={p.id} project={p} />}</ProjectFrame>;
}

/** Resize the ramp to projectLife, carrying the last value forward. */
function fitRamp(ramp: number[], life: number): number[] {
  const n = Math.max(1, Math.min(50, Math.floor(life) || 1));
  const last = ramp.length ? ramp[ramp.length - 1] : 100;
  return Array.from({ length: n }, (_, i) => (i < ramp.length ? ramp[i] : last));
}

function StudyForm({ project }: { project: Project }) {
  const { store } = useProjects();
  const [initial] = useState<FeasibilityInput>(() => {
    const i = project.input ?? blankInput();
    return { ...i, capacityRampByYear: fitRamp(i.capacityRampByYear, i.projectLife) };
  });
  const [input, setInput] = useState<FeasibilityInput>(initial);
  // Unsaved study → always "dirty"; saved study → compare against the (ramp-normalized) saved input.
  const [savedJson, setSavedJson] = useState(() => (project.input ? JSON.stringify(initial) : ""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "warn"; text: string; issues?: string[] } | null>(null);

  const dirty = useMemo(() => JSON.stringify(input) !== savedJson, [input, savedJson]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const up = <K extends keyof FeasibilityInput>(k: K, v: FeasibilityInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!store) return;
    setBusy(true);
    try {
      // Fit the ramp only for a valid life; an invalid life (e.g. 0) must not truncate the saved schedule.
      const lifeValid = Number.isInteger(input.projectLife) && input.projectLife >= 1 && input.projectLife <= 50;
      const toSave = lifeValid ? { ...input, capacityRampByYear: fitRamp(input.capacityRampByYear, input.projectLife) } : input;
      const p = await store.saveInput(project.id, toSave);
      setSavedJson(JSON.stringify(toSave));
      setInput(toSave);
      if (p.result) {
        setMsg({ kind: "success", text: "تم حفظ الدراسة وحساب النتائج.", issues: p.result.output.warnings });
      } else {
        setMsg({ kind: "warn", text: "حُفظت البيانات، لكن لم تُحسب النتائج لوجود الأخطاء التالية:", issues: p.inputIssues });
      }
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "تعذّر الحفظ" });
    } finally {
      setBusy(false);
    }
  };

  // Display the ramp fitted to the current life; the stored array keeps any extra years until save.
  const ramp = fitRamp(input.capacityRampByYear, input.projectLife);
  const wageCols = [
    { key: "title" as const, label: "الوظيفة", type: "text" as const, fr: 2 },
    { key: "count" as const, label: "العدد", type: "number" as const },
    { key: "monthlySalary" as const, label: "الراتب الشهري", type: "number" as const },
  ];

  return (
    <form
      className="stack"
      style={{ gap: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {project.isDemo && <div className="alert alert-warn">هذا مشروع تجريبي؛ أرقامه توضيحية.</div>}
      {project.status === "completed" && <div className="alert alert-info">هذه الدراسة معتمدة. أي حفظ لتعديلات سيعيدها إلى حالة «قيد التنفيذ» حتى تعتمدها مجددًا.</div>}

      <Section id="general" title="الإعدادات العامة" sub="عمر المشروع ومعدلات الخصم والاحتياطيات">
        <div className="grid grid-form">
          <NumField label="عمر المشروع (سنوات)" value={input.projectLife} onChange={(n) => setInput((s) => ({ ...s, projectLife: n, capacityRampByYear: s.capacityRampByYear.length >= n ? s.capacityRampByYear : fitRamp(s.capacityRampByYear, n) }))} step="1" />
          <NumField label="رأس المال العامل (أشهر)" hint="أشهر من التكاليف التشغيلية النقدية" value={input.workingCapitalMonths} onChange={(n) => up("workingCapitalMonths", n)} />
          <NumField label="احتياطي الطوارئ %" value={input.contingencyPct} onChange={(n) => up("contingencyPct", n)} />
          <NumField label="معدل الخصم الأول %" value={input.discountRates[0]} onChange={(n) => up("discountRates", [n, input.discountRates[1]])} />
          <NumField label="معدل الخصم الثاني %" value={input.discountRates[1]} onChange={(n) => up("discountRates", [input.discountRates[0], n])} />
        </div>
      </Section>

      <Section id="revenue" title="الإيرادات" sub="الكمية والسعر عند تشغيل الطاقة الكاملة (100%)">
        <RowsEditor
          rows={input.revenueLines}
          onChange={(r) => up("revenueLines", r)}
          newRow={() => ({ name: "", qtyAt100: 0, unitPrice: 0 })}
          addLabel="إضافة منتج/خدمة"
          cols={[
            { key: "name", label: "المنتج أو الخدمة", type: "text", fr: 2 },
            { key: "qtyAt100", label: "الكمية السنوية عند 100%", type: "number" },
            { key: "unitPrice", label: "سعر الوحدة", type: "number" },
          ]}
        />
      </Section>

      <Section id="capacity" title="الطاقة التشغيلية" sub="نسبة التشغيل المتوقعة لكل سنة من عمر المشروع (%)">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
          {ramp.map((v, i) => (
            <label className="field" key={i}>
              السنة {i + 1}
              <NumInput value={v} onChange={(n) => setInput((s) => ({ ...s, capacityRampByYear: s.capacityRampByYear.map((x, j) => (j === i ? n : x)) }))} ariaLabel={`نسبة الطاقة في السنة ${i + 1}`} />
            </label>
          ))}
        </div>
      </Section>

      <Section id="assets" title="الأصول الثابتة" sub="الكلفة ونسب الإهلاك والتأمين والصيانة السنوية (%)">
        <RowsEditor
          rows={input.fixedAssets}
          onChange={(r) => up("fixedAssets", r)}
          newRow={() => ({ name: "", cost: 0, depRate: 10, insRate: 0.5, maintRate: 1 })}
          addLabel="إضافة أصل"
          emptyText="لا توجد أصول ثابتة"
          cols={[
            { key: "name", label: "الأصل", type: "text", fr: 2 },
            { key: "cost", label: "الكلفة", type: "number", fr: 1.4 },
            { key: "depRate", label: "الإهلاك %", type: "number" },
            { key: "insRate", label: "التأمين %", type: "number" },
            { key: "maintRate", label: "الصيانة %", type: "number" },
          ]}
        />
        <div className="grid grid-form">
          <NumField label="مصاريف التأسيس" value={input.establishmentCost} onChange={(n) => up("establishmentCost", n)} />
          <NumField label="سنوات إطفاء التأسيس" value={input.establishmentYears} onChange={(n) => up("establishmentYears", n)} step="1" />
        </div>
      </Section>

      <Section id="wages" title="الرواتب والأجور" sub="الأجور غير المباشرة تكلفة ثابتة، والمباشرة تكلفة متغيرة مع الطاقة">
        <h4 style={{ fontSize: 14 }}>الأجور غير المباشرة (إدارية)</h4>
        <RowsEditor rows={input.indirectWages} onChange={(r) => up("indirectWages", r)} newRow={() => ({ title: "", count: 1, monthlySalary: 0 })} addLabel="إضافة وظيفة" emptyText="لا توجد وظائف غير مباشرة" cols={wageCols} />
        <h4 style={{ fontSize: 14, marginTop: 8 }}>الأجور المباشرة (إنتاجية)</h4>
        <RowsEditor rows={input.directWages} onChange={(r) => up("directWages", r)} newRow={() => ({ title: "", count: 1, monthlySalary: 0 })} addLabel="إضافة وظيفة" emptyText="لا توجد وظائف مباشرة" cols={wageCols} />
        <div className="grid grid-form">
          <NumField label="نسبة المخصصات والبدلات %" hint="تُضاف على إجمالي الرواتب" value={input.allowancePct} onChange={(n) => up("allowancePct", n)} />
        </div>
      </Section>

      <Section id="fixed" title="المصاريف الثابتة التشغيلية">
        <div className="grid grid-form">
          <NumField label="التسويق (شهريًا)" value={input.marketingMonthly} onChange={(n) => up("marketingMonthly", n)} />
          <NumField label="المصاريف الإدارية والعمومية (شهريًا)" value={input.generalAdminMonthly} onChange={(n) => up("generalAdminMonthly", n)} />
        </div>
        <RowsEditor
          rows={input.otherFixedAnnual}
          onChange={(r) => up("otherFixedAnnual", r)}
          newRow={() => ({ name: "", annual: 0 })}
          addLabel="إضافة مصروف ثابت سنوي"
          emptyText="لا توجد مصاريف ثابتة أخرى (مثل الإيجار)"
          cols={[
            { key: "name", label: "البند", type: "text", fr: 2 },
            { key: "annual", label: "المبلغ السنوي", type: "number" },
          ]}
        />
      </Section>

      <Section id="variable" title="التكاليف المتغيرة" sub="المبالغ السنوية عند الطاقة الكاملة، وتتناسب مع نسبة التشغيل">
        <RowsEditor
          rows={input.rawMaterials}
          onChange={(r) => up("rawMaterials", r)}
          newRow={() => ({ name: "", annualCost: 0 })}
          addLabel="إضافة مادة خام"
          emptyText="لا توجد مواد خام"
          cols={[
            { key: "name", label: "المادة الخام", type: "text", fr: 2 },
            { key: "annualCost", label: "الكلفة السنوية عند 100%", type: "number" },
          ]}
        />
        <div className="grid grid-form">
          <NumField label="قطع الغيار (سنويًا)" value={input.sparePartsAnnual} onChange={(n) => up("sparePartsAnnual", n)} />
          <NumField label="مصاريف متغيرة أخرى (سنويًا)" value={input.miscVariableAnnual} onChange={(n) => up("miscVariableAnnual", n)} />
        </div>
      </Section>

      <Section id="loan" title="التمويل" sub="القرض: فترة سماح بالفوائد فقط ثم أقساط أصل متساوية. الباقي رأس مال ممتلك.">
        <div className="grid grid-form">
          <NumField label="مبلغ القرض" value={input.loan.amount} onChange={(n) => up("loan", { ...input.loan, amount: n })} />
          <NumField label="سعر الفائدة السنوي %" value={input.loan.ratePct} onChange={(n) => up("loan", { ...input.loan, ratePct: n })} />
          <NumField label="فترة السماح (سنوات)" value={input.loan.graceYears} onChange={(n) => up("loan", { ...input.loan, graceYears: n })} step="1" />
          <NumField label="سنوات السداد" value={input.loan.repayYears} onChange={(n) => up("loan", { ...input.loan, repayYears: n })} step="1" />
        </div>
      </Section>

      {msg && (
        <div className={`alert alert-${msg.kind}`} role={msg.kind === "error" ? "alert" : "status"}>
          {msg.kind === "success" ? <CheckCircle2 size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
          <div style={{ flex: 1 }}>
            {msg.text}
            {msg.issues && msg.issues.length > 0 && (
              <ul>
                {msg.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
          {msg.kind === "success" && (
            <Link href={`/projects/${project.id}/financial`} className="btn btn-sm">
              <BarChart3 size={14} aria-hidden />
              عرض النتائج
            </Link>
          )}
        </div>
      )}

      <div className="sticky-actions">
        <span className="small muted" aria-live="polite">
          {dirty ? "لديك تعديلات غير محفوظة" : project.input ? "كل التعديلات محفوظة" : "لم تُحفظ بيانات بعد"}
        </span>
        <button type="submit" className="btn btn-primary" disabled={busy || (!dirty && !!project.input)}>
          <Save size={16} aria-hidden />
          {busy ? "جارٍ الحفظ والحساب…" : "حفظ وحساب النتائج"}
        </button>
      </div>
    </form>
  );
}
