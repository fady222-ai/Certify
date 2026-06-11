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
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nav = [
    { href: "/admin", label: "نظرة عامة", icon: "📊" },
    { href: "/admin/organizations", label: "المنظمات", icon: "🏢" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-950 text-white" dir="rtl">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-800">
          <span className="text-lg font-bold text-indigo-400">Certify</span>
          <span className="text-xs text-gray-500 block mt-0.5">لوحة المدير</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800">
          <Link
            href="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
