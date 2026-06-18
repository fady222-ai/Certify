"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCheckout, type Gateway } from "@/lib/billing";
import { GatewayPicker } from "@/components/GatewayPicker";
import { getToken } from "@/lib/auth";
import { PLAN_PRICING, ANNUAL_SAVING_PCT } from "@/lib/pricing";

// Prices/names come from the canonical pricing module; only marketing copy
// (feature bullets, CTA, highlight) is defined here.
const PLANS = [
  { ...PLAN_PRICING.free, features: ["قالب واحد", "صفحة تحقق عامة", "تحميل PDF", "رمز QR"], cta: "ابدأ مجاناً", highlight: false },
  { ...PLAN_PRICING.starter, features: ["كل ميزات Free", "قوالب غير محدودة", "إرسال بريد إلكتروني", "إصدار جماعي CSV"], cta: "ابدأ الآن", highlight: false },
  { ...PLAN_PRICING.pro, features: ["كل ميزات Starter", "تكامل لينكدإن", "وصول API", "تقارير متقدمة"], cta: "ابدأ الآن", highlight: true },
  { ...PLAN_PRICING.business, features: ["كل ميزات Pro", "تتبّع مشاهدات الشهادات", "علامة بيضاء (White-label)", "دعم مخصص"], cta: "ابدأ الآن", highlight: false },
];

export default function PricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [pending, setPending] = useState<{ slug: string; interval: "monthly" | "annual" } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(slug: string) {
    if (!getToken()) return router.push(`/register?plan=${slug}&interval=${interval}`);
    if (slug === "free") return doCheckout(slug, interval, "stripe");
    setPending({ slug, interval });
  }

  async function doCheckout(slug: string, iv: "monthly" | "annual", gateway: Gateway) {
    setPending(null);
    setLoading(slug);
    setError(null);
    try {
      const res = await createCheckout(slug, iv, gateway);
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
      } else {
        router.push("/dashboard/billing?success=1");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ.");
      setLoading(null);
    }
  }

  const annualSaving = ANNUAL_SAVING_PCT;

  return (
    <div className="min-h-screen bg-surface-2/40" dir="rtl">
      {/* Navbar */}
      <header className="glass sticky top-0 z-30 border-b border-line px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">Certify</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-ink-soft hover:text-brand-600 transition-colors">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="btn-primary text-sm px-4 py-2">ابدأ مجاناً</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-ink">الأسعار</h1>
          <p className="text-lg text-ink-soft">اختر الباقة المناسبة لنشاطك — جميع الأسعار بالدولار الأمريكي</p>
        </div>

        {/* Interval Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center bg-white border border-line rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                interval === "monthly" ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              شهري
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                interval === "annual" ? "bg-brand-600 text-white shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              سنوي
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
                interval === "annual" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
              }`}>
                وفّر {annualSaving}%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const price = interval === "annual" ? plan.yearly : plan.monthly;
            const monthlyEquiv = interval === "annual" && plan.yearly > 0 ? Math.round(plan.yearly / 12) : null;

            return (
              <div
                key={plan.slug}
                className={`bg-white rounded-2xl p-6 flex flex-col border transition-shadow hover:shadow-md ${
                  plan.highlight
                    ? "border-brand-400 shadow-[0_0_0_3px_rgba(79,70,229,0.12)] ring-1 ring-brand-300"
                    : "border-line shadow-sm"
                }`}
              >
                {plan.highlight && (
                  <div className="text-center mb-4">
                    <span className="inline-block bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      الأكثر شيوعاً
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                <p className="text-sm text-ink-muted mt-1 mb-4">{plan.certsLabel}</p>

                <div className="mb-6">
                  {price === 0 ? (
                    <p className="text-3xl font-bold text-ink">مجاني</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-ink">
                        <span className="text-base font-normal text-ink-muted">$</span>
                        {price}
                        <span className="text-sm font-normal text-ink-muted">
                          {interval === "annual" ? "/سنة" : "/شهر"}
                        </span>
                      </p>
                      {monthlyEquiv && (
                        <p className="text-xs text-emerald-600 mt-1">
                          ${monthlyEquiv} / شهر فقط
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.slug)}
                  disabled={loading === plan.slug}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                      : "bg-surface-2 hover:bg-surface-2/80 text-ink border border-line"
                  }`}
                >
                  {loading === plan.slug ? "جارٍ التحميل…" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="text-center space-y-3">
          <p className="text-sm text-ink-muted font-medium">وسائل الدفع المقبولة</p>
          <div className="flex justify-center flex-wrap gap-3">
            {["مدى", "فيزا", "ماستركارد", "Apple Pay", "STC Pay", "Benefit", "American Express"].map((m) => (
              <span key={m} className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
                {m}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-muted">جميع المدفوعات آمنة ومشفّرة — Stripe أو Tap Payments</p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-xl font-bold text-ink text-center">أسئلة شائعة</h2>
          {[
            { q: "هل يتجدد الاشتراك تلقائياً؟", a: "نعم، يتجدد الاشتراك تلقائياً كل شهر أو سنة. يمكنك الإلغاء في أي وقت وستبقى على باقتك حتى نهاية الدورة الحالية." },
            { q: "ما الفرق بين Stripe وTap؟", a: "Stripe: دفع عالمي بالبطاقات الائتمانية. Tap: مخصص للسوق الخليجي ويدعم مدى، STC Pay، وApple Pay. كلاهما يقبل الدفع بالدولار." },
            { q: "هل يمكنني الترقية أو التخفيض؟", a: "نعم في أي وقت. التخفيض يُطبَّق فوراً والترقية تُفعَّل فور إتمام الدفع." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <p className="font-bold text-ink mb-2">{q}</p>
              <p className="text-sm text-ink-soft">{a}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Gateway Picker Modal */}
      {pending && (
        <GatewayPicker
          stripeAvailable={true}
          tapAvailable={true}
          paymobAvailable={true}
          loading={!!loading}
          onSelect={(gw) => doCheckout(pending.slug, pending.interval, gw)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
