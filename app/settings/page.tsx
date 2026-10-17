"use client";

import { useRef, useState } from "react";
import { Database, Download, FlaskConical, HardDrive, Trash2, Upload } from "lucide-react";
import { useProjects } from "@/components/ProjectsProvider";
import { ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { demoExportJson } from "@/lib/projects/templates";

export default function SettingsPage() {
  const { store, projects, loading, error, reload } = useProjects();
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <LoadingBlock />;
  if (error || !store) return <ErrorState message={error ?? "التخزين غير متاح"} onRetry={reload} />;

  const demoCount = projects.filter((p) => p.isDemo).length;
  const run = async (fn: () => Promise<string>) => {
    try {
      setMsg({ kind: "success", text: await fn() });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "حدث خطأ" });
    }
  };

  return (
    <>
      {msg && (
        <div className={`alert alert-${msg.kind}`} role={msg.kind === "error" ? "alert" : "status"}>
          {msg.text}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h3>مساحة العمل</h3>
            <div className="card-sub">مكان حفظ بياناتك حاليًا</div>
          </div>
        </div>
        <div className="card-body stack">
          <div className="alert alert-info">
            <HardDrive size={18} aria-hidden />
            <div>
              المشاريع ودراساتها محفوظة <strong>في هذا المتصفح فقط</strong> (تخزين محلي). لا يوجد بعد نظام حسابات أو مزامنة سحابية، لذا لا يمكن لأي مستخدم آخر الوصول إليها، لكنها لن تظهر على جهاز آخر. استخدم النسخ الاحتياطي للنقل أو الحماية من مسح بيانات المتصفح.
            </div>
          </div>
          <div className="row">
            <span className="muted">عدد المشاريع المحفوظة:</span>
            <strong className="num">{projects.length}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>النسخ الاحتياطي</h3>
            <div className="card-sub">تصدير كل المشاريع إلى ملف JSON أو استيرادها. عند الاستيراد تُعاد حسابات النتائج من المدخلات ولا يُعتمد على أرقام الملف.</div>
          </div>
        </div>
        <div className="card-body row">
          <button
            className="btn btn-primary"
            disabled={projects.length === 0}
            onClick={() =>
              run(async () => {
                const json = await store.exportAll();
                const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `jadwa-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                return "تم تصدير النسخة الاحتياطية.";
              })
            }
          >
            <Download size={16} aria-hidden />
            تصدير نسخة احتياطية
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden />
            استيراد نسخة احتياطية
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="ملف النسخة الاحتياطية"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) return setMsg({ kind: "error", text: "الملف أكبر من 10 ميغابايت" });
              run(async () => `تم استيراد ${await store.importAll(await f.text())} مشروع.`);
            }}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>البيانات التجريبية</h3>
            <div className="card-sub">أربعة مشاريع توضيحية لاستعراض اللوحة والرسوم. تُوسم دائمًا بـ«تجريبي» ويمكن حذفها بضغطة واحدة دون المساس بمشاريعك.</div>
          </div>
        </div>
        <div className="card-body row">
          <button className="btn btn-gold" onClick={() => run(async () => `تم تحميل ${await store.importAll(demoExportJson(new Date()))} مشاريع تجريبية.`)}>
            <FlaskConical size={16} aria-hidden />
            {demoCount ? "إعادة تحميل البيانات التجريبية" : "تحميل البيانات التجريبية"}
          </button>
          <button className="btn btn-danger" disabled={!demoCount} onClick={() => run(async () => `تم حذف ${await store.removeDemo()} مشاريع تجريبية.`)}>
            <Trash2 size={16} aria-hidden />
            حذف البيانات التجريبية ({demoCount})
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>حذف كل البيانات</h3>
            <div className="card-sub">يحذف كل المشاريع من هذا المتصفح نهائيًا. صدّر نسخة احتياطية أولًا.</div>
          </div>
        </div>
        <div className="card-body">
          {!confirmClear ? (
            <button className="btn btn-danger" disabled={projects.length === 0} onClick={() => setConfirmClear(true)}>
              <Database size={16} aria-hidden />
              حذف كل البيانات
            </button>
          ) : (
            <div className="alert alert-error" role="alert" style={{ alignItems: "center" }}>
              <span style={{ flex: 1 }}>سيُحذف {projects.length} مشروع نهائيًا. هل أنت متأكد؟</span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() =>
                  run(async () => {
                    await store.clear();
                    setConfirmClear(false);
                    return "تم حذف كل البيانات.";
                  })
                }
              >
                نعم، احذف الكل
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmClear(false)}>إلغاء</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
