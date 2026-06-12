"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IssueCertificateModal } from "@/components/IssueCertificateModal";
import { getToken, getStoredUser, logout, type AuthUser } from "@/lib/auth";
import {
  IconBadge, IconUpload, IconPalette, IconChart, IconBolt as IconBoltNav, IconSettings,
} from "@/components/icons";

const nav = [
  { label: "نظرة عامة", icon: IconChart, href: "/dashboard" },
  { label: "الشهادات", icon: IconBadge, href: "/dashboard/certificates" },
  { label: "القوالب", icon: IconPalette, href: "/dashboard/templates" },
  { label: "الإصدار الجماعي", icon: IconUpload, href: "/dashboard/bulk" },
  { label: "الباقة والفوترة", icon: IconBoltNav, href: "/dashboard/billing" },
  { label: "إعدادات المنظمة", icon: IconSettings, href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setProfile(getStoredUser());
    setChecked(true);
  }, [router]);

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

      {/* الشريط الجانبي */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-white lg:flex">
        <div className="border-b px-5 py-4"><Logo /></div>
        <nav className="flex-1 space-y-1 p-3">
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
        </nav>
        <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
          <p className="text-sm font-extrabold">{org?.plan?.name ?? "باقة مجانية"}</p>
          <p className="mt-1 text-xs text-brand-100">
            {org?.plan?.certificates_per_month != null
              ? `${org.plan.certificates_per_month} شهادة شهرياً`
              : "إصدار غير محدود"}
          </p>
          <Link href="/dashboard/billing" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">
            ترقية الباقة
          </Link>
        </div>
        {profile?.user?.is_admin && (
          <div className="m-3 mt-0">
            <Link
              href="/admin"
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2.5 text-xs font-bold text-amber-400 hover:bg-gray-800 transition-colors"
            >
              <span>⚙️</span> لوحة الإدارة
            </Link>
          </div>
        )}
      </aside>

      {/* المحتوى */}
      <div className="flex flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="lg:hidden"><Logo /></span>
            <p className="text-sm font-bold text-ink-soft">{org?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
              <IconBadge className="h-4 w-4" />
              إصدار شهادة جديدة
            </button>
            <button className="btn-ghost" type="button" onClick={onLogout}>خروج</button>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
