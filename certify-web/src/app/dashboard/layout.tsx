"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IssueCertificateModal } from "@/components/IssueCertificateModal";
import { getToken, getStoredUser, logout, type AuthUser } from "@/lib/auth";
import {
  IconBadge, IconUpload, IconPalette, IconChart, IconBolt as IconBoltNav, IconSettings, IconMail, IconUsers, IconKey,
} from "@/components/icons";

const nav = [
  { label: "نظرة عامة", icon: IconChart, href: "/dashboard" },
  { label: "الشهادات", icon: IconBadge, href: "/dashboard/certificates" },
  { label: "القوالب", icon: IconPalette, href: "/dashboard/templates" },
  { label: "الإصدار الجماعي", icon: IconUpload, href: "/dashboard/bulk" },
  { label: "أعضاء الفريق", icon: IconUsers, href: "/dashboard/members" },
  { label: "المطوّرون (API)", icon: IconKey, href: "/dashboard/developers" },
  { label: "الباقة والفوترة", icon: IconBoltNav, href: "/dashboard/billing" },
  { label: "الدعم الفني", icon: IconMail, href: "/dashboard/support" },
  { label: "إعدادات المنظمة", icon: IconSettings, href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setProfile(getStoredUser());
    setChecked(true);
  }, [router]);

  // Close the mobile drawer on route change.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2/40">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const org = profile?.organization;

  function onLogout() {
    logout();
    router.push("/");
  }

  const navItems = (
    <>
      {nav.map((n) => {
        const active =
          n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
              active ? "bg-brand-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]"
                : "text-ink-soft hover:bg-surface-2 hover:text-brand-700"}`}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  const planCard = (
    <>
      <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
        <p className="text-sm font-extrabold">{org?.plan?.name ?? "باقة مجانية"}</p>
        <p className="mt-1 text-xs text-brand-100">
          {org?.plan?.certificates_per_month != null
            ? `${org.plan.certificates_per_month} شهادة شهريا`
            : "إصدار غير محدود"}
        </p>
        <Link href="/dashboard/billing" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">
          ترقية الباقة
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-surface-2/40" dir="rtl">
      <IssueCertificateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onIssued={() => {
          setModalOpen(false);
          router.refresh();
        }}
      />

      {/* الشريط الجانبي (حاسوب) */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-white lg:flex">
        <div className="border-b px-5 py-4"><Logo /></div>
        <nav className="flex-1 space-y-1 p-3">{navItems}</nav>
        {planCard}
      </aside>

      {/* درج التنقل (جوال) */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNavOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-72 max-w-[85%] flex-col border-l bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <Logo />
              <button onClick={() => setNavOpen(false)} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2" aria-label="إغلاق">✕</button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">{navItems}</nav>
            {planCard}
          </aside>
        </div>
      )}

      {/* المحتوى */}
      <div className="flex flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 lg:hidden"
              aria-label="القائمة"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="lg:hidden"><Logo /></span>
            {org && (
              <div className="hidden items-center gap-2.5 ps-1 sm:flex">
                <span className="hidden h-8 w-px bg-border lg:block" aria-hidden />
                {org.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-black"
                    style={{ backgroundColor: `${org.primary_color}1a`, color: org.primary_color }}
                  >
                    {org.name.charAt(0)}
                  </span>
                )}
                <div className="leading-tight">
                  <p className="max-w-[180px] truncate text-sm font-extrabold text-ink" title={org.name}>
                    {org.name}
                  </p>
                  <p className="text-[11px] font-bold text-ink-muted">لوحة التحكم</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
              <IconBadge className="h-4 w-4" />
              <span className="hidden sm:inline">إصدار شهادة جديدة</span>
              <span className="sm:hidden">إصدار</span>
            </button>
            <button className="btn-ghost" type="button" onClick={onLogout}>خروج</button>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
