# جدوى تك | Jadwa Tech

منصة دراسات الجدوى الاقتصادية والمالية — واجهة عربية RTL مبنية على Next.js، مع محرك حساب مالي موحّد.

## التشغيل

```bash
npm install
npm run dev          # http://localhost:3000
```

## الفحوص

```bash
npm run typecheck && npm test        # الأنواع + اختبارات المحرك والبيانات (Vitest)
npm run build                        # بناء الإنتاج
npx next start -p 3100 &             # ثم:
BASE_URL=http://localhost:3100 npm run e2e   # اختبار متصفح شامل (Playwright)
```
في بيئة بلا متصفح Playwright مُنزّل، مرّر مسار Chromium عبر `CHROMIUM_PATH`.

## البنية

| المسار | الدور |
|---|---|
| `lib/feasibility-engine.ts` | المحرك المالي — المصدر الوحيد لكل الأرقام (انظر `CLAUDE.md`) |
| `lib/sensitivity.ts` | تحليل الحساسية فوق المحرك |
| `lib/projects/` | نموذج المشروع، طبقة التخزين `ProjectStore`، تجميعات اللوحة، البيانات التجريبية |
| `app/` | الصفحات: اللوحة، المشاريع، الدراسة، التحليل المالي، التقارير، الإعدادات |
| `components/` | الهيكل (Sidebar/Topbar)، الجداول، الرسوم (Recharts)، عناصر الواجهة |
| `supabase/migrations/` | مخطط قاعدة البيانات مع RLS — مُعدّ للمرحلة القادمة، غير مطبّق بعد |
| `docs/engine-assumptions.md` | الافتراضات المنهجية A1–A16 |

**التخزين حاليًا محلي في المتصفح** (لا حسابات ولا مزامنة). الانتقال إلى Supabase يتم بتنفيذ `ProjectStore` جديد دون تغيير الواجهة.
