"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getStoredUser, getToken, logout, type AuthUser } from "@/lib/auth";
import { IconChart, IconBuilding, IconCreditCard, IconMail, IconLock, IconWhatsapp } from "@/components/icons";
import { useT } from "@/components/LocaleProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const nav = [
    { label: t("admin.nav.overview"), icon: IconChart, href: "/admin" },
    { label: t("admin.nav.organizations"), icon: IconBuilding, href: "/admin/organizations" },
    { label: t("admin.nav.gateways"), icon: IconCreditCard, href: "/admin/payment-gateways" },
    { label: t("admin.nav.integrations"), icon: IconWhatsapp, href: "/admin/integrations" },
    { label: t("admin.nav.tickets"), icon: IconMail, href: "/admin/support" },
    { label: t("admin.nav.security"), icon: IconLock, href: "/admin/security" },
  ];
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored?.user?.is_admin) {
      router.replace("/dashboard");
      return;
    }
    setProfile(stored);
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

  function onLogout() {
    logout();
    router.push("/");
  }

  const adminBadge = (
    <div className="m-3 mt-0 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 text-white">
      <p className="text-sm font-extrabold text-amber-400">{t("admin.nav.adminPanel")}</p>
      <p className="mt-1 text-xs text-gray-300">{profile?.user?.email ?? t("admin.nav.platformAdmin")}</p>
    </div>
  );

  const navItems = (
    <>
      {nav.map((n) => {
        const active =
          n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
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

  return (
    <div className="flex min-h-screen bg-surface-2/40 text-ink">
      {/* الشريط الجانبي (حاسوب) */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-white lg:flex">
        <div className="flex flex-col gap-1 border-b px-5 py-4">
          <Logo />
          <span className="text-[11px] font-bold tracking-wide text-ink-muted">{t("admin.nav.adminConsole")}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">{navItems}</nav>
        {adminBadge}
      </aside>

      {/* درج التنقل (جوال) */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNavOpen(false)} />
          <aside className="absolute end-0 top-0 flex h-full w-72 max-w-[85%] flex-col border-l bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex flex-col gap-1">
                <Logo />
                <span className="text-[11px] font-bold tracking-wide text-ink-muted">{t("admin.nav.adminConsole")}</span>
              </div>
              <button onClick={() => setNavOpen(false)} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2" aria-label={t("admin.nav.close")}>✕</button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">{navItems}</nav>
            {adminBadge}
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
              aria-label={t("admin.nav.menu")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="lg:hidden"><Logo /></span>
            <p className="hidden text-sm font-bold text-ink-soft sm:block">{t("admin.nav.adminPanel")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" type="button" onClick={onLogout}>{t("admin.nav.logout")}</button>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
