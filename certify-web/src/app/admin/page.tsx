"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminStats, type AdminStats } from "@/lib/admin";

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`bg-gray-900 border ${color} rounded-xl p-5`}>
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value.toLocaleString("ar-SA")}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-gray-400">تعذّر تحميل البيانات.</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">نظرة عامة على المنصة</h1>
        <p className="text-gray-500 text-sm mt-1">إحصائيات حقيقية من قاعدة البيانات</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="المنظمات المسجّلة" value={stats.total_organizations} color="border-indigo-800" />
        <StatCard label="المستخدمون" value={stats.total_users} color="border-blue-800" />
        <StatCard label="إجمالي الشهادات" value={stats.total_certificates} sub="منذ الإطلاق" color="border-emerald-800" />
        <StatCard label="شهادات هذا الشهر" value={stats.certificates_this_month} color="border-amber-800" />
      </div>

      {/* Recent Organizations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">آخر المنظمات المنضمّة</h2>
          <Link href="/admin/organizations" className="text-sm text-indigo-400 hover:text-indigo-300">
            عرض الكل ←
          </Link>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-right px-5 py-3 font-medium">المنظمة</th>
                <th className="text-right px-5 py-3 font-medium">المالك</th>
                <th className="text-right px-5 py-3 font-medium">الباقة</th>
                <th className="text-right px-5 py-3 font-medium">الشهادات</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_organizations.map((org) => (
                <tr key={org.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{org.name}</td>
                  <td className="px-5 py-3 text-gray-400">{org.owner_email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <PlanBadge slug={org.plan?.slug} name={org.plan?.name} />
                  </td>
                  <td className="px-5 py-3 text-gray-300">{org.certs_total}</td>
                </tr>
              ))}
              {stats.recent_organizations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    لا توجد منظمات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanBadge({ slug, name }: { slug?: string; name?: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-700 text-gray-300",
    starter: "bg-blue-900 text-blue-300",
    pro: "bg-indigo-900 text-indigo-300",
    enterprise: "bg-amber-900 text-amber-300",
  };
  const cls = colors[slug ?? ""] ?? "bg-gray-700 text-gray-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {name ?? "—"}
    </span>
  );
}
