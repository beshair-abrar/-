// End-to-end smoke test against a running production build.
// Usage: npm run build && (npx next start -p 3100 &) && BASE_URL=http://localhost:3100 npm run e2e
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = new URL("./screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ locale: "ar", viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/fonts\.(googleapis|gstatic)\.com|ERR_TUNNEL|ERR_PROXY|ERR_NAME_NOT_RESOLVED/.test(t + (m.location()?.url ?? ""))) return; // offline font fetch in CI
  errors.push(`console: ${t}`);
});

page.on("response", (r) => {
  if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`);
});
// The deliberate visit to an unknown project route is client-rendered (200); no 404 is expected anywhere.

let step = 0;
const check = (cond, msg) => {
  step++;
  if (!cond) throw new Error(`✗ step ${step}: ${msg}`);
  console.log(`✓ ${msg}`);
};
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
const text = (sel) => page.locator(sel).first().innerText();

try {
  // 1. Empty dashboard
  await page.goto(BASE + "/");
  await page.getByText("لا توجد مشاريع بعد").waitFor();
  check(true, "empty dashboard shows empty state");
  check((await page.locator('.quick a[aria-disabled="true"]').count()) === 2, "resume/report quick actions disabled without data");
  await shot("01-empty");

  // 2. Create project + start study
  await page.getByRole("link", { name: "إنشاء مشروع وبدء الدراسة" }).click();
  await page.waitForURL(/\/projects\/new\?next=study/);
  await page.getByRole("button", { name: "متابعة إلى بيانات الدراسة" }).click();
  check(await page.getByText("أدخل اسمًا للمشروع").isVisible(), "client validation blocks empty name");
  await page.getByLabel("اسم المشروع *").fill("مصنع تعبئة مياه");
  await page.getByLabel("القطاع *").selectOption("industrial");
  await page.getByRole("button", { name: "متابعة إلى بيانات الدراسة" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/study$/);
  const projectUrl = page.url().replace(/\/study$/, "");
  check(true, "project created, redirected to study form");

  // 3. Save an invalid study → issues listed, no result
  await page.getByLabel("عمر المشروع (سنوات)").fill("0");
  await page.getByRole("button", { name: "حفظ وحساب النتائج" }).click();
  await page.getByText("لم تُحسب النتائج").waitFor();
  check(true, "invalid input saved with validation issues and no result");

  // 4. Fill a valid study
  await page.getByLabel("عمر المشروع (سنوات)").fill("8");
  await page.getByLabel("المنتج أو الخدمة 1").fill("عبوات 600 مل");
  await page.getByLabel("الكمية السنوية عند 100% 1").fill("2000000");
  await page.getByLabel("سعر الوحدة 1").fill("0.6");
  await page.getByLabel("الأصل 1").fill("خط تعبئة");
  await page.getByLabel("الكلفة 1").fill("900000");
  await page.getByRole("button", { name: "إضافة مادة خام" }).click();
  await page.getByLabel("المادة الخام 1").fill("بريفورم وأغطية");
  await page.getByLabel("الكلفة السنوية عند 100% 1").fill("450000");
  await page.getByRole("button", { name: "حفظ وحساب النتائج" }).click();
  await page.getByText("تم حفظ الدراسة وحساب النتائج").waitFor();
  check(await page.getByText("كل التعديلات محفوظة").isVisible(), "valid study saved and computed");
  check((await page.getByLabel("نسبة الطاقة في السنة 3").inputValue()) === "100" && (await page.getByLabel("نسبة الطاقة في السنة 8").inputValue()) === "100", "capacity ramp survives a transient project life of 0");
  await shot("02-study");

  // 5. Financial page for the new project
  await page.getByRole("link", { name: "عرض النتائج" }).click();
  await page.waitForURL(/\/financial$/);
  await page.getByText("CAPEX — التكاليف الاستثمارية").waitFor();
  check((await page.locator(".recharts-surface").count()) >= 3, "financial charts render (cash flow, revenue/cost, tornado)");
  for (const k of ["OPEX", "NPV @10%", "IRR", "ROI", "فترة الاسترداد", "نقطة التعادل", "تحليل الحساسية (Tornado)"]) {
    check(await page.getByText(k, { exact: false }).first().isVisible(), `financial page shows ${k}`);
  }
  await page.getByRole("button", { name: "جدول" }).first().click();
  check(await page.locator("table.data").first().isVisible(), "chart → table toggle works");
  await shot("03-financial");

  // 6. Mark completed from overview
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "اعتماد الدراسة كمكتملة" }).click();
  await page.getByText("تم اعتماد الدراسة كمكتملة").waitFor();
  check((await text(".page-head .badge")).includes("مكتملة"), "study marked completed");

  // 7. Report + CSV download
  await page.getByRole("link", { name: "فتح التقرير" }).click();
  await page.waitForURL(/\/report$/);
  check((await page.locator(".report table").count()) >= 10, "report renders engine tables");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /تنزيل الجداول/ }).click()]);
  check(dl.suggestedFilename().endsWith(".csv"), "CSV export downloads");

  // 8. Load demo data
  await page.getByRole("link", { name: "الإعدادات والبيانات" }).click();
  await page.getByRole("button", { name: "تحميل البيانات التجريبية" }).click();
  await page.getByText("تم تحميل 4 مشاريع تجريبية").waitFor();
  check(true, "demo data loaded");

  // 9. Dashboard with data
  await page.getByRole("link", { name: "الرئيسية" }).click();
  await page.getByText("إجمالي المشاريع").waitFor();
  const kpis = await page.locator(".kpi .kpi-value").allInnerTexts();
  check(kpis[0] === "5", `total projects KPI = 5 (got ${kpis[0]})`);
  check(kpis[1] === "3" && kpis[2] === "1" && kpis[3] === "1" && kpis[4] === "4", `status KPIs completed/in-progress/draft/reports = 3/1/1/4 (got ${kpis.slice(1).join("/")})`);
  check(await page.getByText("مشروعًا تجريبيًا").isVisible(), "demo banner visible");
  check((await page.locator(".recharts-surface").count()) >= 5, "dashboard charts render");
  await page.getByRole("button", { name: "12 شهرًا" }).click();
  check((await page.getByRole("button", { name: "12 شهرًا" }).getAttribute("aria-pressed")) === "true", "time filter toggles");
  check((await page.locator(".quick a[aria-disabled='true']").count()) === 0, "all quick actions enabled with data");
  await shot("04-dashboard");

  // 10. KPI link → filtered projects table
  await page.locator(".kpi", { hasText: "الدراسات المكتملة" }).click();
  await page.waitForURL(/\/projects\?status=completed/);
  await page.locator("table.data tbody tr").first().waitFor();
  check((await page.locator("table.data tbody tr").count()) === 3, "status filter from KPI shows 3 completed");
  await page.getByLabel("تصفية حسب الحالة").selectOption("all");
  check((await page.locator("table.data tbody tr").count()) === 5, "clearing filter shows 5");
  await page.getByLabel("بحث في الجدول").fill("مخبز");
  check((await page.locator("table.data tbody tr").count()) === 1, "table search narrows to 1");
  await page.getByLabel("بحث في الجدول").fill("");
  await page.getByLabel("تصفية حسب القطاع").selectOption("health");
  check((await page.locator("table.data tbody tr").count()) === 1, "sector filter works");
  await page.getByLabel("تصفية حسب القطاع").selectOption("all");
  await page.getByRole("button", { name: /اسم المشروع/ }).click();
  const names = await page.locator("table.data tbody tr td:first-child a").allInnerTexts();
  check(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, "ar"))), "sort by name ascending");

  // 11. Global search
  await page.getByLabel("البحث في المشاريع").fill("عيادات");
  await page.locator(".search-results a").first().click();
  await page.waitForURL(/\/projects\/demo-clinic$/);
  check(true, "global search navigates to project");

  // 12. Reports + financial hub + nav links
  for (const [label, url, expectText] of [
    ["التقارير والملفات", "/reports", "فتح التقرير"],
    ["التحليل المالي", "/financial", "التحليل الكامل"],
    ["المشاريع ودراسات الجدوى", "/projects", "مشروع جديد"],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await page.waitForURL(new RegExp(url.replace("/", "\\/") + "$"));
    await page.getByText(expectText).first().waitFor();
    check(true, `nav: ${label}`);
  }
  check((await page.locator("tbody tr").count()) >= 1, "projects page lists rows");

  // 13. Unknown project → not-found state
  await page.goto(BASE + "/projects/does-not-exist");
  await page.getByText("المشروع غير موجود").waitFor();
  check(true, "unknown project shows not-found state");

  // 14. Delete demo data keeps real project
  await page.goto(BASE + "/settings");
  await page.getByRole("button", { name: /حذف البيانات التجريبية/ }).click();
  await page.getByText("تم حذف 4 مشاريع تجريبية").waitFor();
  await page.goto(BASE + "/projects");
  await page.locator("table.data tbody tr").first().waitFor();
  check((await page.locator("table.data tbody tr").count()) === 1, "demo removal keeps the real project");

  // 15. Mobile layout
  await page.goto(BASE + "/settings");
  await page.getByRole("button", { name: "تحميل البيانات التجريبية" }).click();
  await page.getByText("تم تحميل 4").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/projects", "/projects/demo-bakery/financial", "/projects/demo-bakery/study"]) {
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `no horizontal page scroll on mobile at ${path} (overflow ${overflow}px)`);
  }
  await page.goto(BASE + "/");
  await page.getByText("إجمالي المشاريع").waitFor();
  await shot("05-mobile-dashboard");
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("link", { name: "التقارير والملفات" }).click();
  await page.waitForURL(/\/reports$/);
  check(true, "mobile sidebar opens and navigates");

  check(errors.length === 0, `no JavaScript errors (${errors.length})\n${errors.join("\n")}`);
  console.log(`\nAll ${step} checks passed.`);
} catch (e) {
  await shot("failure").catch(() => {});
  console.error(e.message);
  if (errors.length) console.error("JS errors:\n" + errors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
