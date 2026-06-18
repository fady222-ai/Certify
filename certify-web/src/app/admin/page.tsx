"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminStats, type AdminStats } from "@/lib/admin";
import { IconBuilding, IconUsers, IconBadge, IconChart, IconArrow } from "@/components/icons";

const toneMap: Record<string, string> = {
  brand: "from-brand-50 to-brand-100 text-brand-600",
  gold: "from-gold-50 to-gold-100 text-gold-600",
  verify: "from-verify-50 to-verify-100 text-verify-600",
};

function StatCard({
  label, value, sub, icon: Icon, tone, loading,
}: {
  label: string; value: number; sub?: string; icon: typeof IconBadge; tone: string; loading: boolean;
}) {
  return (
    <div className="card card-lift p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-ink-soft">{label}</p>
          <p className="mt-2 font-display text-4xl font-black text-ink">
            {loading ? "…" : value.toLocaleString("en-US")}
          </p>
          {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
        </div>
        <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${toneMap[tone]}`}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
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

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-black text-ink">نظرة عامة على المنصة</h1>
        <p className="mt-1 text-sm text-ink-soft">إحصائيات حقيقية من قاعدة البيانات.</p>
      </div>

      {/* بطاقات الإحصاء */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="المنظمات المسجّلة" value={stats?.total_organizations ?? 0} icon={IconBuilding} tone="brand" loading={loading} />
        <StatCard label="المستخدمون" value={stats?.total_users ?? 0} icon={IconUsers} tone="gold" loading={loading} />
        <StatCard label="إجمالي الشهادات" value={stats?.total_certificates ?? 0} sub="منذ الإطلاق" icon={IconBadge} tone="verify" loading={loading} />
        <StatCard label="شهادات هذا الشهر" value={stats?.certificates_this_month ?? 0} icon={IconChart} tone="brand" loading={loading} />
      </div>

      {/* آخر المنظمات */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-lg font-extrabold text-ink">آخر المنظمات المنضمّة</h2>
          <Link href="/admin/organizations" className="text-sm font-bold text-brand-700 hover:underline">
            عرض الكل <IconArrow className="inline h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-ink-muted">جارٍ التحميل…</div>
        ) : !stats || stats.recent_organizations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconBuilding className="h-8 w-8" />
            </div>
            <h3 className="mt-5 font-display text-xl font-black text-ink">لا توجد منظمات بعد</h3>
            <p className="mt-2 text-sm text-ink-soft">ستظهر المنظمات هنا فور تسجيلها على المنصة.</p>
          </div>
        ) : (
          <div className="divide-y">
            {stats.recent_organizations.map((org) => (
              <div key={org.id} className="flex items-center justify-between px-6 py-4 transition hover:bg-surface-2/60">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-display font-black text-brand-600">
                    {org.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-bold text-ink">{org.name}</p>
                    <p className="text-xs text-ink-muted">{org.owner_email ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <PlanBadge slug={org.plan?.slug} name={org.plan?.name} />
                  <span className="hidden text-sm text-ink-soft sm:inline">{org.certs_total} شهادة</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PlanBadge({ slug, name }: { slug?: string; name?: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    pro: "bg-brand-50 text-brand-700",
    business: "bg-amber-50 text-amber-700",
  };
  const cls = colors[slug ?? ""] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold ${cls}`}>
      {name ?? "—"}
    </span>
  );
}
