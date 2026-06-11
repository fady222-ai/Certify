"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getToken } from "@/lib/auth";
import { listPlans, getBilling, changePlan, type Plan, type Billing } from "@/lib/billing";
import { IconCheck, IconBolt } from "@/components/icons";

export default function BillingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([listPlans(), getBilling()]);
      setPlans(p);
      setBilling(b);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  async function select(slug: string) {
    setChanging(slug);
    setNotice(null);
    try {
      const r = await changePlan(slug);
      setNotice(r.message);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "حدث خطأ.");
    } finally {
      setChanging(null);
    }
  }

  const currentSlug = billing?.plan?.slug;
  const usage = billing?.usage;
  const pct =
    usage && usage.limit != null && usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-surface-2/40">
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-sm font-bold text-ink-muted sm:inline">/ الباقة والفوترة</span>
        </div>
        <Link href="/dashboard" className="btn-ghost">لوحة التحكم</Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">الباقة والفوترة</h1>
          <p className="mt-1 text-sm text-ink-soft">تابع استهلاكك الشهري وبدّل باقتك حسب حاجتك.</p>
        </div>

        {notice && (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
            {notice}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-ink-muted">جارٍ التحميل…</p>
        ) : (
          <>
            {/* Usage card */}
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-ink-soft">باقتك الحالية</p>
                  <p className="mt-1 font-display text-2xl font-black text-ink">
                    {billing?.plan?.name ?? "—"}
                  </p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
                  <IconBolt className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-bold text-ink">
                    {usage?.used ?? 0}
                    {usage?.limit != null ? ` / ${usage.limit}` : ""} شهادة هذا الشهر
                  </span>
                  <span className="text-ink-muted">
                    {usage?.limit == null ? "غير محدود" : `${pct}%`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 90 ? "bg-red-500" : "bg-gradient-to-l from-brand-600 to-brand-400"
                    }`}
                    style={{ width: usage?.limit == null ? "100%" : `${pct}%` }}
                  />
                </div>
                {usage?.remaining != null && (
                  <p className="mt-2 text-xs text-ink-muted">متبقٍّ {usage.remaining} شهادة هذا الشهر</p>
                )}
              </div>
            </div>

            {/* Plans grid */}
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              {plans.map((p) => {
                const isCurrent = p.slug === currentSlug;
                return (
                  <div key={p.slug}
                    className={`flex flex-col rounded-2xl p-6 ${
                      isCurrent ? "card border-2 border-brand-500" : "card card-lift"
                    }`}>
                    {isCurrent && (
                      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                        <IconCheck className="h-3.5 w-3.5" /> باقتك الحالية
                      </span>
                    )}
                    <h3 className="font-extrabold text-ink">{p.name}</h3>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="font-display text-3xl font-black text-ink">
                        {p.price_monthly === 0 ? "مجاني" : `$${p.price_monthly}`}
                      </span>
                      {p.price_monthly > 0 && <span className="mb-1 text-sm text-ink-muted">/شهر</span>}
                    </div>
                    <p className="mt-2 text-sm font-bold text-brand-700">
                      {p.certificates_per_month.toLocaleString("ar")} شهادة/شهر
                    </p>
                    <ul className="mt-4 flex-1 space-y-2 text-xs text-ink-soft">
                      <li className="flex items-center gap-2">
                        <IconCheck className="h-3.5 w-3.5 text-verify-500" />
                        {p.team_members_limit} عضو فريق
                      </li>
                      {p.has_api && (
                        <li className="flex items-center gap-2">
                          <IconCheck className="h-3.5 w-3.5 text-verify-500" /> وصول API
                        </li>
                      )}
                      {p.has_white_label && (
                        <li className="flex items-center gap-2">
                          <IconCheck className="h-3.5 w-3.5 text-verify-500" /> علامة بيضاء
                        </li>
                      )}
                    </ul>
                    <button
                      onClick={() => select(p.slug)}
                      disabled={isCurrent || changing === p.slug}
                      className={`mt-5 w-full ${isCurrent ? "btn-ghost" : "btn-primary"} disabled:opacity-60`}
                    >
                      {isCurrent ? "مفعّلة" : changing === p.slug ? "جارٍ…" : "اختيار"}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-ink-muted">
              الدفع الفعلي عبر Stripe يُفعَّل في الإنتاج. في هذه النسخة التجريبية يتم التبديل مباشرة لاختبار حدود الباقات.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
