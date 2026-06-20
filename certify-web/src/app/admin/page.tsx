"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminStats, type AdminStats } from "@/lib/admin";
import { getStoredUser } from "@/lib/auth";
import {
  IconBuilding, IconUsers, IconBadge, IconChart, IconArrow,
  IconCreditCard, IconBolt, IconMail, IconClock, IconBan, IconLock,
} from "@/components/icons";

const toneMap: Record<string, string> = {
  brand: "from-brand-50 to-brand-100 text-brand-600",
  gold: "from-gold-50 to-gold-100 text-gold-600",
  verify: "from-verify-50 to-verify-100 text-verify-600",
};

function KpiCard({
  label, value, sub, icon: Icon, tone, loading,
}: {
  label: string; value: string; sub?: string; icon: typeof IconBadge; tone: string; loading: boolean;
}) {
  return (
    <div className="card card-lift p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-soft">{label}</p>
          <p className="mt-2 font-display text-4xl font-black text-ink">{loading ? "…" : value}</p>
          {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
        </div>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${toneMap[tone]}`}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </div>
  );
}

/** An actionable item: highlighted (amber) when its count needs attention. */
function AttentionCard({
  label, count, href, icon: Icon, loading,
}: {
  label: string; count: number; href: string; icon: typeof IconBadge; loading: boolean;
}) {
  const active = count > 0;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-4 transition ${
        active
          ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70"
          : "border-line bg-surface-2/50 hover:bg-surface-2"
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
        active ? "bg-amber-100 text-amber-700" : "bg-white text-ink-muted"
      }`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className={`font-display text-2xl font-black ${active ? "text-amber-700" : "text-ink"}`}>
          {loading ? "…" : count.toLocaleString("en-US")}
        </p>
        <p className="truncate text-xs font-bold text-ink-soft">{label}</p>
      </div>
    </Link>
  );
}

const PLAN_BAR: Record<string, string> = {
  free: "bg-gray-300",
  pro: "bg-brand-500",
  business: "bg-amber-400",
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(true); // assume on until checked (no flash)

  useEffect(() => {
    getAdminStats().then(setStats).finally(() => setLoading(false));
    setMfaEnabled(!!getStoredUser()?.user?.mfa_enabled);
  }, []);

  const money = (n?: number) => `$${(n ?? 0).toLocaleString("en-US")}`;
  const planTotal = stats?.plan_distribution.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <main className="space-y-7 p-6">
      <div>
        <h1 className="font-display text-2xl font-black text-ink">نظرة عامة على المنصة</h1>
        <p className="mt-1 text-sm text-ink-soft">مؤشرات الأعمال والتشغيل — مباشرة من قاعدة البيانات.</p>
      </div>

      {!mfaEnabled && (
        <Link
          href="/admin/security"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:bg-amber-100/70"
        >
          <IconLock className="h-5 w-5 shrink-0 text-amber-700" />
          <span className="text-sm font-bold text-amber-800">
            فعل المصادقة الثنائية لحماية حسابك الإداري — اضغط للإعداد.
          </span>
        </Link>
      )}

      {/* مؤشرات الأعمال (الأهم) */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="الإيراد الشهري المتكرر" value={money(stats?.mrr)} sub={`سنويا ≈ ${money(stats?.arr)}`} icon={IconCreditCard} tone="verify" loading={loading} />
        <KpiCard label="اشتراكات نشطة" value={(stats?.active_subscriptions ?? 0).toLocaleString("en-US")} sub={`من ${stats?.total_organizations ?? 0} منظمة`} icon={IconBolt} tone="brand" loading={loading} />
        <KpiCard label="نسبة التحويل للمدفوع" value={`${stats?.paid_conversion_pct ?? 0}%`} sub="منظمات مشتركة / الإجمالي" icon={IconChart} tone="gold" loading={loading} />
        <KpiCard label="منظمات جديدة هذا الشهر" value={(stats?.new_orgs_this_month ?? 0).toLocaleString("en-US")} icon={IconBuilding} tone="brand" loading={loading} />
      </div>

      {/* يحتاج إلى إجراء */}
      <div>
        <h2 className="mb-3 font-display text-lg font-extrabold text-ink">يحتاج إلى إجراء</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AttentionCard label="تذاكر دعم مفتوحة" count={stats?.open_tickets ?? 0} href="/admin/support" icon={IconMail} loading={loading} />
          <AttentionCard label="مدفوعات متأخرة" count={stats?.past_due ?? 0} href="/admin/organizations" icon={IconClock} loading={loading} />
          <AttentionCard label="اشتراكات ستلغى" count={stats?.cancelling ?? 0} href="/admin/organizations" icon={IconBolt} loading={loading} />
          <AttentionCard label="منظمات موقوفة" count={stats?.suspended_orgs ?? 0} href="/admin/organizations" icon={IconBan} loading={loading} />
        </div>
      </div>

      {/* توزيع الباقات + إحصاءات المنصة */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg font-extrabold text-ink">توزيع الباقات</h2>
          <div className="mt-4 space-y-3">
            {loading || !stats ? (
              <p className="text-sm text-ink-muted">جار التحميل…</p>
            ) : stats.plan_distribution.length === 0 ? (
              <p className="text-sm text-ink-muted">لا توجد بيانات بعد.</p>
            ) : (
              stats.plan_distribution.map((p) => {
                const pct = planTotal ? Math.round((p.count / planTotal) * 100) : 0;
                return (
                  <div key={p.slug}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-bold text-ink">{p.name}</span>
                      <span className="text-ink-muted">{p.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${PLAN_BAR[p.slug] ?? "bg-gray-300"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-extrabold text-ink">إحصاءات المنصة</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniStat label="إجمالي المنظمات" value={stats?.total_organizations} icon={IconBuilding} loading={loading} />
            <MiniStat label="المستخدمون" value={stats?.total_users} icon={IconUsers} loading={loading} />
            <MiniStat label="شهادات هذا الشهر" value={stats?.certificates_this_month} icon={IconChart} loading={loading} />
            <MiniStat label="إجمالي الشهادات" value={stats?.total_certificates} icon={IconBadge} loading={loading} />
          </div>
        </div>
      </div>

      {/* آخر المنظمات */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-lg font-extrabold text-ink">آخر المنظمات المنضمة</h2>
          <Link href="/admin/organizations" className="text-sm font-bold text-brand-700 hover:underline">
            عرض الكل <IconArrow className="inline h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-ink-muted">جار التحميل…</div>
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

function MiniStat({ label, value, icon: Icon, loading }: { label: string; value?: number; icon: typeof IconBadge; loading: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-soft">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-black text-ink">{loading ? "…" : (value ?? 0).toLocaleString("en-US")}</p>
        <p className="truncate text-xs text-ink-muted">{label}</p>
      </div>
    </div>
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
