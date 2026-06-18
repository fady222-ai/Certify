"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser, getToken } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    const profile = getStoredUser();
    if (!token || !profile?.user?.is_admin) {
      router.replace("/dashboard");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2/40">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nav = [
    { href: "/admin", label: "نظرة عامة", icon: "📊" },
    { href: "/admin/organizations", label: "المنظمات", icon: "🏢" },
    { href: "/admin/payment-gateways", label: "بوابات الدفع", icon: "💳" },
  ];

  return (
    <div className="min-h-screen flex bg-surface-2/40 text-ink" dir="rtl">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-l border-line flex flex-col shadow-sm">
        <div className="px-5 py-6 border-b border-line">
          <span className="text-lg font-bold text-brand-600">Certify</span>
          <span className="text-xs text-ink-muted block mt-0.5">لوحة المدير</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)]"
                    : "text-ink-soft hover:bg-surface-2 hover:text-brand-700"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-line">
          <Link
            href="/dashboard"
            className="text-xs text-ink-muted hover:text-brand-600 transition-colors"
          >
            ← العودة للداشبورد
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
