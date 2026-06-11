"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminStats, type AdminStats } from "@/lib/admin";

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-line border-t-4 ${accent}`}>
      <p className="text-sm text-ink-muted mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink">{value.toLocaleString("ar-SA")}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
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
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-ink-muted">تعذّر تحميل البيانات.</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">نظرة عامة على المنصة</h1>
        <p className="text-ink-muted text-sm mt-1">إحصائيات حقيقية من قاعدة البيانات</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="المنظمات المسجّلة" value={stats.total_organizations} accent="border-t-brand-600" />
        <StatCard label="المستخدمون" value={stats.total_users} accent="border-t-blue-500" />
        <StatCard label="إجمالي الشهادات" value={stats.total_certificates} sub="منذ الإطلاق" accent="border-t-emerald-500" />
        <StatCard label="شهادات هذا الشهر" value={stats.certificates_this_month} accent="border-t-amber-500" />
      </div>

      {/* Recent Organizations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">آخر المنظمات المنضمّة</h2>
          <Link href="/admin/organizations" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            عرض الكل ←
          </Link>
        </div>
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-ink-muted">
                <th className="text-right px-5 py-3 font-medium">المنظمة</th>
                <th className="text-right px-5 py-3 font-medium">المالك</th>
                <th className="text-right px-5 py-3 font-medium">الباقة</th>
                <th className="text-right px-5 py-3 font-medium">الشهادات</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_organizations.map((org) => (
                <tr key={org.id} className="border-b border-line last:border-0 hover:bg-surface-2/40 transition-colors">
                  <td className="px-5 py-3 text-ink font-medium">{org.name}</td>
                  <td className="px-5 py-3 text-ink-soft">{org.owner_email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <PlanBadge slug={org.plan?.slug} name={org.plan?.name} />
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{org.certs_total}</td>
                </tr>
              ))}
              {stats.recent_organizations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-muted">
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
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-50 text-blue-700",
    pro: "bg-brand-50 text-brand-700",
    enterprise: "bg-amber-50 text-amber-700",
  };
  const cls = colors[slug ?? ""] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {name ?? "—"}
    </span>
  );
}
