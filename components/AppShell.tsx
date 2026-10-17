"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, FileText, FolderKanban, HardDrive, LayoutDashboard, Menu, Settings, X } from "lucide-react";
import { ProjectsProvider } from "./ProjectsProvider";
import { GlobalSearch } from "./GlobalSearch";

/** Only sections backed by real functionality are listed. */
const NAV = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/projects", label: "المشاريع ودراسات الجدوى", icon: FolderKanban, match: (p: string) => p.startsWith("/projects") && !/\/(financial|report)$/.test(p) },
  { href: "/financial", label: "التحليل المالي", icon: BarChart3, match: (p: string) => p.startsWith("/financial") || /\/financial$/.test(p) },
  { href: "/reports", label: "التقارير والملفات", icon: FileText, match: (p: string) => p.startsWith("/reports") || /\/report$/.test(p) },
  { href: "/settings", label: "الإعدادات والبيانات", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

function titleFor(path: string): string {
  if (path === "/") return "لوحة التحكم";
  if (path === "/projects") return "المشاريع";
  if (path === "/projects/new") return "مشروع جديد";
  if (/^\/projects\/[^/]+\/study$/.test(path)) return "دراسة الجدوى";
  if (/^\/projects\/[^/]+\/financial$/.test(path)) return "التحليل المالي للمشروع";
  if (/^\/projects\/[^/]+\/report$/.test(path)) return "تقرير الدراسة";
  if (/^\/projects\/[^/]+$/.test(path)) return "تفاصيل المشروع";
  if (path === "/financial") return "التحليل المالي";
  if (path === "/reports") return "التقارير والملفات";
  if (path === "/settings") return "الإعدادات والبيانات";
  return "جدوى تك";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const title = titleFor(pathname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.title = `${title} | جدوى تك`;
  }, [title]);

  return (
    <ProjectsProvider>
      <div className="shell">
        <aside className="sidebar" data-open={open} aria-label="القائمة الرئيسية">
          <div className="sidebar-brand">
            <div className="brand-mark" aria-hidden>ج</div>
            <div>
              <div className="brand-name">جدوى تك</div>
              <div className="brand-sub">Jadwa Tech</div>
            </div>
            <button className="btn btn-ghost btn-icon menu-btn" style={{ marginInlineStart: "auto", color: "#fff" }} onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
              <X size={18} />
            </button>
          </div>
          <nav className="nav">
            {NAV.map(({ href, label, icon: Icon, match }) => (
              <Link key={href} href={href} aria-current={match(pathname) ? "page" : undefined}>
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">منصة دراسات الجدوى الاقتصادية والمالية</div>
        </aside>
        <div className="backdrop" data-open={open} onClick={() => setOpen(false)} aria-hidden />

        <div className="main">
          <header className="topbar">
            <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="فتح القائمة" aria-expanded={open}>
              <Menu size={20} />
            </button>
            <h1>{title}</h1>
            <div className="topbar-spacer" />
            <GlobalSearch />
            <Link href="/settings" className="workspace-chip" title="البيانات محفوظة في هذا المتصفح فقط — لا يوجد نظام حسابات بعد">
              <HardDrive size={15} aria-hidden />
              <span className="chip-text">مساحة عمل محلية</span>
            </Link>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </ProjectsProvider>
  );
}
