"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getBilling, createCheckout, cancelSubscription, type Billing, type Gateway } from "@/lib/billing";
import { GatewayPicker } from "@/components/GatewayPicker";
import { IconCheck } from "@/components/icons";

const PLAN_NAMES: Record<string, string> = {
  free: "مجاني",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:    { label: "نشط",        cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
  inactive:  { label: "غير مفعّل", cls: "bg-gray-100 text-gray-500" },
  past_due:  { label: "متأخر",      cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-100" },
  cancelled: { label: "ملغي",       cls: "bg-red-50 text-red-600 ring-1 ring-red-100" },
};

const GATEWAY_LABELS: Record<string, { label: string; cls: string }> = {
  stripe: { label: "Stripe",       cls: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" },
  tap:    { label: "Tap Payments", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
  paymob: { label: "Paymob 🇪🇬",   cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-100" },
};

const UPGRADE_PLANS = [
  { slug: "starter", label: "Starter", monthly: 9, yearly: 90, popular: false,
    features: ["٢٠٠ شهادة شهرياً", "كل القوالب الجاهزة", "تحقّق عام بـ QR"] },
  { slug: "pro", label: "Pro", monthly: 29, yearly: 290, popular: true,
    features: ["٢٠٠٠ شهادة شهرياً", "الإصدار الجماعي", "توقيع رقمي مخصص", "تكامل لينكدإن"] },
  { slug: "business", label: "Business", monthly: 79, yearly: 790, popular: false,
    features: ["١٠٬٠٠٠ شهادة شهرياً", "إزالة العلامة (White-label)", "تتبّع مشاهدات وتحميلات الشهادات", "دعم أولوية"] },
];

type PendingUpgrade = { slug: string; interval: "monthly" | "annual" };

function BillingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pending, setPending] = useState<PendingUpgrade | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    getBilling().then(setBilling).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (params.get("success")) {
      showToast("تم تفعيل الباقة بنجاح!", "ok");
      router.replace("/dashboard/billing");
    } else if (params.get("error")) {
      const msg: Record<string, string> = {
        payment_failed: "فشلت عملية الدفع. يرجى المحاولة مرة أخرى.",
        verify_failed:  "تعذّر التحقق من الدفع. تواصل مع الدعم.",
        missing_id:     "رابط الدفع غير صالح.",
        not_found:      "لم يتم العثور على بيانات الاشتراك.",
      };
      showToast(msg[params.get("error") ?? ""] ?? "حدث خطأ.", "err");
      router.replace("/dashboard/billing");
    }
  }, [params, router]);

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleUpgradeClick(slug: string, interval: "monthly" | "annual") {
    if (slug === "free") {
      doCheckout("free", interval, "stripe");
      return;
    }
    setPending({ slug, interval });
  }

  async function doCheckout(slug: string, interval: "monthly" | "annual", gateway: Gateway) {
    setPending(null);
    setCheckoutLoading(true);
    try {
      const res = await createCheckout(slug, interval, gateway);
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
      } else {
        showToast(res.message ?? "تم التحديث.", "ok");
        const fresh = await getBilling();
        setBilling(fresh);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "حدث خطأ.", "err");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("هل تريد إلغاء اشتراكك؟ ستبقى على الباقة الحالية حتى نهاية الدورة.")) return;
    setCancelling(true);
    try {
      const res = await cancelSubscription();
      showToast(res.message, "ok");
      const fresh = await getBilling();
      setBilling(fresh);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "حدث خطأ.", "err");
    } finally {
      setCancelling(false);
    }
  }

  const plan = billing?.plan;
  const sub = billing?.subscription;
  const usage = billing?.usage;
  const gateways = billing?.gateways ?? { stripe: false, tap: false, paymob: false };
  const usedPct = usage?.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const isPaid = plan && plan.price_monthly > 0;
  const isActive = sub?.status === "active";
  const cancelAtEnd = sub?.cancel_at_period_end;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("ar-SA")
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl shadow-lg text-sm border ${
          toast.type === "ok"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink">الاشتراك والباقة</h1>
        <p className="text-ink-muted text-sm mt-1">إدارة باقتك وبيانات الدفع</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {sub?.status === "past_due" && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
              ⚠️ دفعتك متأخرة — لم يكتمل تجديد اشتراكك. جدّد خلال أيام قليلة لتفادي التخفيض التلقائي للباقة المجانية.
            </div>
          )}

          {/* Current Plan Card */}
          <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-muted mb-1">الباقة الحالية</p>
                <p className="text-2xl font-bold text-ink">
                  {PLAN_NAMES[plan?.slug ?? "free"] ?? plan?.name ?? "مجاني"}
                </p>
                {isPaid && sub?.amount != null && (
                  <p className="text-sm text-ink-soft mt-0.5">
                    ${sub.amount} {sub.interval === "annual" ? "/سنة" : "/شهر"}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {sub && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_LABELS[sub.status]?.cls ?? ""}`}>
                    {STATUS_LABELS[sub.status]?.label ?? sub.status}
                  </span>
                )}
                {sub?.gateway && GATEWAY_LABELS[sub.gateway] && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${GATEWAY_LABELS[sub.gateway].cls}`}>
                    {GATEWAY_LABELS[sub.gateway].label}
                  </span>
                )}
              </div>
            </div>

            {/* Usage bar */}
            {usage && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">الشهادات هذا الشهر</span>
                  <span className="font-medium text-ink">
                    {usage.used}
                    {usage.limit != null && (
                      <span className="text-ink-muted"> / {usage.limit}</span>
                    )}
                  </span>
                </div>
                {usage.limit != null && (
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usedPct >= 90 ? "bg-red-400" : usedPct >= 70 ? "bg-amber-400" : "bg-brand-500"
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Period end / cancel notice */}
            {periodEnd && (
              <p className="text-sm text-ink-soft">
                {cancelAtEnd
                  ? "ينتهي الاشتراك في:"
                  : sub?.status === "cancelled"
                  ? "ينتهي في:"
                  : "تاريخ التجديد:"}{" "}
                <span className="font-medium text-ink">{periodEnd}</span>
                {cancelAtEnd && (
                  <span className="mr-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">
                    لن يتجدد تلقائياً
                  </span>
                )}
              </p>
            )}

            {/* Cancel */}
            {isPaid && isActive && !cancelAtEnd && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelling ? "جارٍ الإلغاء…" : "إلغاء الاشتراك"}
              </button>
            )}
          </div>

          {/* Upgrade (free users) */}
          {!isPaid && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">رقِّ باقتك</h2>
                  <p className="text-sm text-ink-muted mt-0.5">أصدر المزيد من الشهادات وافتح مزايا متقدمة.</p>
                </div>
                {/* Billing cycle toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
                  <button
                    onClick={() => setCycle("monthly")}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
                      cycle === "monthly" ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:bg-surface-2"
                    }`}
                  >
                    شهري
                  </button>
                  <button
                    onClick={() => setCycle("annual")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
                      cycle === "annual" ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:bg-surface-2"
                    }`}
                  >
                    سنوي
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                      cycle === "annual" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      وفّر ١٧٪
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {UPGRADE_PLANS.map((p) => {
                  const price = cycle === "monthly" ? p.monthly : p.yearly;
                  const perMonth = Math.round(p.yearly / 12);
                  return (
                    <div
                      key={p.slug}
                      className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
                        p.popular ? "border-brand-500 ring-2 ring-brand-500/30" : "border-line hover:border-brand-200"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2.5 right-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow">
                          الأكثر شيوعاً
                        </span>
                      )}
                      <p className="font-display text-lg font-black text-ink">{p.label}</p>
                      <div className="mt-2 flex items-end gap-1">
                        <span className="font-display text-3xl font-black text-ink">${price}</span>
                        <span className="mb-1 text-sm text-ink-muted">{cycle === "monthly" ? "/شهر" : "/سنة"}</span>
                      </div>
                      <p className="mt-0.5 h-4 text-xs text-emerald-600">
                        {cycle === "annual" ? `≈ $${perMonth}/شهر` : ""}
                      </p>

                      <ul className="mt-4 flex-1 space-y-2">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-ink-soft">
                            <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleUpgradeClick(p.slug, cycle)}
                        disabled={checkoutLoading}
                        className={`mt-5 w-full rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                          p.popular
                            ? "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_20px_rgba(79,70,229,0.25)]"
                            : "border border-line bg-surface-2 text-ink hover:bg-white hover:border-brand-300"
                        }`}
                      >
                        {checkoutLoading ? "…" : `الترقية إلى ${p.label}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              <Link href="/pricing" className="inline-block text-sm font-bold text-brand-600 hover:underline">
                مقارنة الباقات الكاملة ←
              </Link>
            </div>
          )}

          {/* Manage (paid users) */}
          {isPaid && (
            <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-3">
              <h2 className="text-lg font-bold text-ink">تغيير الباقة</h2>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/pricing"
                  className="text-sm px-4 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
                >
                  استعرض الباقات
                </Link>
                <button
                  onClick={() => doCheckout("free", "monthly", "stripe")}
                  disabled={checkoutLoading}
                  className="text-sm px-4 py-2 bg-surface-2 text-ink border border-line rounded-xl font-medium hover:bg-surface-2/80 disabled:opacity-50 transition-colors"
                >
                  التخفيض للمجاني
                </button>
              </div>
            </div>
          )}

          {/* Payment methods */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-ink-muted">وسائل الدفع:</span>
            {["مدى", "فيزا", "ماستركارد", "Apple Pay", "STC Pay", "Benefit"].map((m) => (
              <span
                key={m}
                className="text-xs bg-white border border-line rounded-md px-2 py-0.5 text-ink-muted"
              >
                {m}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Gateway Picker Modal */}
      {pending && (
        <GatewayPicker
          stripeAvailable={gateways.stripe}
          tapAvailable={gateways.tap}
          paymobAvailable={gateways.paymob}
          loading={checkoutLoading}
          onSelect={(gw) => doCheckout(pending.slug, pending.interval, gw)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <BillingContent />
    </Suspense>
  );
}
