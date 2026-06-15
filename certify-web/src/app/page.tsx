import Link from "next/link";
import { PLAN_PRICING } from "@/lib/pricing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  IconBolt, IconShield, IconLinkedin, IconQr, IconUpload, IconPalette,
  IconChart, IconCheck, IconClock, IconBadge, IconSparkle, IconArrow,
} from "@/components/icons";

const features = [
  { icon: IconUpload, title: "إصدار جماعي من Excel", desc: "ارفع ملفاً واحداً وأصدر مئات الشهادات في دقائق — بدل ساعات من العمل اليدوي." },
  { icon: IconPalette, title: "محرر قوالب عربي RTL", desc: "صمّم شهاداتك بسحب وإفلات، بخطوط عربية أنيقة وألوان علامتك التجارية." },
  { icon: IconShield, title: "تحقّق مضاد للتزوير", desc: "كل شهادة تحمل رمز تحقق فريد وبصمة رقمية مشفّرة تكشف أي تلاعب فوراً." },
  { icon: IconLinkedin, title: "إضافة إلى لينكدإن", desc: "زر واحد يضيف الشهادة لملف المتدرب على لينكدإن — تسويق مجاني لك." },
  { icon: IconQr, title: "صفحة تحقّق عامة", desc: "رابط أنيق ورمز QR لكل شهادة، يفتحه أي صاحب عمل للتأكد من صحتها." },
  { icon: IconChart, title: "تحليلات مباشرة", desc: "تابع من فتح الشهادة، ومن حمّلها، ومن شاركها على لينكدإن — لحظة بلحظة." },
];

const steps = [
  { n: "١", title: "صمّم قالبك", desc: "اختر من القوالب الجاهزة أو صمّم قالبك بألوان وشعار منظمتك." },
  { n: "٢", title: "ارفع المتدربين", desc: "أدخل اسماً واحداً أو ارفع ملف Excel بمئات الأسماء دفعة واحدة." },
  { n: "٣", title: "أصدر وأرسل", desc: "بنقرة واحدة تُولّد الشهادات وتُرسل تلقائياً لكل متدرب عبر الإيميل." },
];

const stats = [
  { value: "٥ دقائق", label: "لإصدار أول شهادة" },
  { value: "٩٩.٩٪", label: "جاهزية المنصة" },
  { value: "RTL", label: "دعم عربي أصيل" },
  { value: "∞", label: "قوالب لا محدودة" },
];

// Prices/names come from the canonical pricing module (single source of truth,
// kept in sync with the backend seed); only marketing copy lives here.
const plans = [
  { ...PLAN_PRICING.free, tag: "للتجربة", features: ["محرر القوالب", "صفحة تحقق عامة", "تكامل لينكدإن"], cta: "ابدأ مجاناً", highlight: false },
  { ...PLAN_PRICING.pro, tag: "الأكثر اختياراً", features: ["كل ميزات المجاني", "إصدار جماعي من Excel", "توقيع رقمي مخصص", "تحليلات متقدمة", "٣ أعضاء فريق"], cta: "ابدأ الآن", highlight: true },
  { ...PLAN_PRICING.business, tag: "للأكاديميات", features: ["كل ميزات Pro", "White-label", "نطاق فرعي مخصص", "API كامل", "١٠ أعضاء فريق"], cta: "تواصل معنا", highlight: false },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ===================== HERO ===================== */}
        <section className="mesh-bg relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-60" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
            <div className="text-center lg:text-right">
              <span className="chip animate-rise">
                <IconSparkle className="h-4 w-4" />
                أول منصة شهادات عربية مصمّمة من الصفر
              </span>

              <h1 className="animate-rise delay-1 mt-6 font-display text-4xl font-black leading-[1.15] text-ink sm:text-5xl lg:text-6xl">
                أصدر شهاداتك الرقمية
                <br />
                <span className="gradient-text">بنقرة واحدة</span>
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0">
                شهادات احترافية بالعربية، قابلة للتحقق، وقابلة للنشر على لينكدإن.
                وفّر ساعات من العمل اليدوي وامنح متدربيك شهادة تليق بإنجازهم.
              </p>

              <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/register" className="btn-primary text-base">
                  ابدأ مجاناً الآن
                  <IconArrow className="h-4 w-4 rotate-180" />
                </Link>
                <Link href="/verify" className="btn-ghost text-base">
                  <IconShield className="h-4 w-4" />
                  تحقّق من شهادة
                </Link>
              </div>

              <div className="animate-rise delay-4 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted lg:justify-start">
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> بدون بطاقة ائتمان</span>
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> إعداد في دقائق</span>
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> دعم عربي</span>
              </div>
            </div>

            {/* بطاقة شهادة معاينة */}
            <div className="animate-rise delay-2 relative mx-auto w-full max-w-md">
              <div className="animate-float card-lift card relative overflow-hidden p-1.5">
                <div className="rounded-[1rem] border-2 border-brand-100 bg-white p-7">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest text-brand-600">CERTIFICATE</span>
                    <IconBadge className="h-7 w-7 text-gold-500" />
                  </div>
                  <div className="my-5 h-1 w-16 rounded bg-gradient-to-l from-brand-600 to-brand-300" />
                  <p className="text-xs text-ink-muted">شهادة إتمام دورة</p>
                  <h3 className="mt-2 font-display text-2xl font-extrabold text-ink">عبدالرحمن الأحمدي</h3>
                  <p className="mt-3 text-sm text-ink-soft">أتمّ بنجاح دورة</p>
                  <p className="font-bold text-brand-700">أساسيات إدارة المشاريع</p>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <div className="h-px w-24 bg-ink-muted/40" />
                      <p className="mt-1 text-[10px] text-ink-muted">توقيع المُصدر</p>
                    </div>
                    <div className="grid h-14 w-14 place-items-center rounded-lg border border-brand-100 bg-brand-50">
                      <IconQr className="h-8 w-8 text-brand-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* شارة تحقق عائمة */}
              <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgba(16,185,129,0.25)]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-verify-50">
                  <IconCheck className="h-5 w-5 text-verify-600" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-extrabold text-verify-700">شهادة موثّقة</p>
                  <p className="text-[10px] text-ink-muted">تم التحقق بنجاح</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== STATS ===================== */}
        <section className="border-y bg-white">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="px-6 py-8 text-center">
                <div className="font-display text-3xl font-black gradient-text">{s.value}</div>
                <div className="mt-1 text-sm text-ink-soft">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== FEATURES ===================== */}
        <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip"><IconBolt className="h-4 w-4" /> كل ما تحتاجه</span>
            <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">
              منصة متكاملة لإصدار الشهادات
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              من التصميم إلى الإصدار إلى التحقق — كل شيء بالعربية وبتجربة عصرية.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card card-lift group p-7">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition group-hover:from-brand-600 group-hover:to-brand-700 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section id="how" className="bg-surface-2/70 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <span className="chip"><IconClock className="h-4 w-4" /> ثلاث خطوات</span>
              <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">
                من فكرة إلى شهادة في دقائق
              </h2>
            </div>

            <div className="relative mt-16 grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.n} className="relative">
                  <div className="card card-lift p-8 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 font-display text-2xl font-black text-white shadow-lg">
                      {s.n}
                    </span>
                    <h3 className="mt-5 text-lg font-extrabold text-ink">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="absolute -left-4 top-1/2 hidden -translate-y-1/2 text-brand-300 md:block">
                      <IconArrow className="h-7 w-7" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== PRICING ===================== */}
        <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip"><IconBadge className="h-4 w-4" /> أسعار بسيطة</span>
            <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">
              باقة تناسب كل مدرّب وأكاديمية
            </h2>
            <p className="mt-4 text-lg text-ink-soft">ابدأ مجاناً، وارقِّ متى احتجت. بدون التزامات.</p>
          </div>

          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col p-8 ${
                  p.highlight
                    ? "card border-2 border-brand-500 shadow-[0_24px_60px_rgba(79,70,229,0.18)]"
                    : "card card-lift"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3.5 right-8 rounded-full bg-gradient-to-l from-gold-400 to-gold-600 px-4 py-1 text-xs font-extrabold text-white shadow">
                    {p.tag}
                  </span>
                )}
                <h3 className="text-lg font-extrabold text-ink">{p.name}</h3>
                {!p.highlight && <span className="mt-1 text-xs font-bold text-ink-muted">{p.tag}</span>}
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-display text-5xl font-black text-ink">{p.monthly}</span>
                  <span className="mb-2 text-lg font-bold text-ink-muted">$/شهر</span>
                </div>
                <p className="mt-2 text-sm font-bold text-brand-700">{p.certsLabel}</p>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-soft">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-verify-50">
                        <IconCheck className="h-3.5 w-3.5 text-verify-600" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`mt-8 w-full text-center ${p.highlight ? "btn-primary" : "btn-ghost"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== CTA ===================== */}
        <section className="mx-auto max-w-7xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-8 py-16 text-center shadow-[0_30px_80px_rgba(79,70,229,0.35)]">
            <div className="absolute inset-0 dot-grid opacity-20" />
            <div className="relative">
              <h2 className="font-display text-3xl font-black text-white sm:text-4xl">
                جاهز لإصدار شهادتك الأولى؟
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">
                انضم لمئات المدربين والأكاديميات الذين يصدرون شهاداتهم باحترافية.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/register" className="btn bg-white px-6 text-base font-extrabold text-brand-700 hover:bg-brand-50">
                  ابدأ مجاناً
                  <IconArrow className="h-4 w-4 rotate-180" />
                </Link>
                <Link href="/login" className="btn border border-white/30 px-6 text-base font-bold text-white hover:bg-white/10">
                  لديّ حساب
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
