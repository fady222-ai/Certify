"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getBilling, createCheckout, cancelSubscription, type Billing } from "@/lib/billing";

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

function BillingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

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

  async function handleUpgrade(slug: string, interval: "monthly" | "annual") {
    setUpgrading(true);
    try {
      const res = await createCheckout(slug, interval);
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
      setUpgrading(false);
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
  const usedPct = usage?.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const isPaid = plan && plan.price_monthly > 0;
  const isActive = sub?.status === "active";
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
          {/* Current Plan Card */}
          <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-ink-muted mb-1">الباقة الحالية</p>
                <p className="text-2xl font-bold text-ink">
                  {PLAN_NAMES[plan?.slug ?? "free"] ?? plan?.name ?? "مجاني"}
                </p>
                {isPaid && (
                  <p className="text-sm text-ink-soft mt-0.5">
                    {plan?.price_monthly.toLocaleString("ar-SA")} ر.س / شهر
                  </p>
                )}
              </div>
              {sub && (
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_LABELS[sub.status]?.cls ?? ""}`}>
                  {STATUS_LABELS[sub.status]?.label ?? sub.status}
                </span>
              )}
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

            {/* Period end */}
            {periodEnd && (
              <p className="text-sm text-ink-soft">
                {sub?.status === "cancelled" ? "ينتهي في:" : "تاريخ التجديد:"}{" "}
                <span className="font-medium text-ink">{periodEnd}</span>
              </p>
            )}

            {/* Cancel */}
            {isPaid && isActive && sub?.status !== "cancelled" && (
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
            <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-ink">ترقية الباقة</h2>
                <p className="text-sm text-ink-muted mt-0.5">
                  أصدر المزيد من الشهادات وافتح مزايا متقدمة
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { slug: "starter", label: "Starter", price: "49 ر.س/شهر",  annual: "490 ر.س/سنة" },
                  { slug: "pro",     label: "Pro",     price: "149 ر.س/شهر", annual: "1490 ر.س/سنة", hot: true },
                  { slug: "business",label: "Business",price: "299 ر.س/شهر", annual: "2990 ر.س/سنة" },
                ].map((p) => (
                  <div
                    key={p.slug}
                    className={`rounded-xl border p-4 space-y-3 ${
                      p.hot ? "border-brand-300 bg-brand-50/30" : "border-line"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-ink">{p.label}</p>
                      <p className="text-sm text-ink font-medium">{p.price}</p>
                      <p className="text-xs text-ink-muted">أو {p.annual}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpgrade(p.slug, "monthly")}
                        disabled={upgrading}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors ${
                          p.hot
                            ? "bg-brand-600 text-white hover:bg-brand-700"
                            : "bg-surface-2 text-ink hover:bg-surface-2/80 border border-line"
                        }`}
                      >
                        شهري
                      </button>
                      <button
                        onClick={() => handleUpgrade(p.slug, "annual")}
                        disabled={upgrading}
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 transition-colors"
                      >
                        سنوي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/pricing" className="text-sm text-brand-600 hover:underline">
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
                  onClick={() => handleUpgrade("free", "monthly")}
                  disabled={upgrading}
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
            {["مدى", "فيزا", "ماستركارد", "Apple Pay", "STC Pay"].map((m) => (
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
