import Link from "next/link";
import { cookies } from "next/headers";
import { PLAN_PRICING } from "@/lib/pricing";
import { getDict, normalizeLocale, fmt, LOCALE_COOKIE } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  IconBolt, IconShield, IconLinkedin, IconQr, IconUpload, IconPalette,
  IconChart, IconCheck, IconClock, IconBadge, IconSparkle, IconArrow,
} from "@/components/icons";

export default async function Home() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const d = getDict(locale).landing;
  const nf = new Intl.NumberFormat("en-US");
  const certs = (n: number) => fmt(d.certsLabel, { n: nf.format(n) });
  const seats = (n: number) => (n <= 1 ? d.seatsFree : fmt(d.seatsUpTo, { n }));

  const features = [
    { icon: IconUpload, title: d.feat.bulkT, desc: d.feat.bulkD },
    { icon: IconPalette, title: d.feat.editorT, desc: d.feat.editorD },
    { icon: IconShield, title: d.feat.antiForgeryT, desc: d.feat.antiForgeryD },
    { icon: IconLinkedin, title: d.feat.linkedinT, desc: d.feat.linkedinD },
    { icon: IconQr, title: d.feat.publicT, desc: d.feat.publicD },
    { icon: IconChart, title: d.feat.analyticsT, desc: d.feat.analyticsD },
  ];

  const steps = [
    { n: locale === "en" ? "1" : "١", title: d.step1T, desc: d.step1D },
    { n: locale === "en" ? "2" : "٢", title: d.step2T, desc: d.step2D },
    { n: locale === "en" ? "3" : "٣", title: d.step3T, desc: d.step3D },
  ];

  const stats = [
    { value: d.statFiveMin, label: d.statForFirst },
    { value: locale === "en" ? "99.9%" : "٩٩.٩٪", label: d.statUptime },
    { value: "RTL", label: d.statRtl },
    { value: "∞", label: d.statTemplates },
  ];

  const plans = [
    {
      ...PLAN_PRICING.free, tag: d.tagTrial, cta: d.ctaFree, highlight: false,
      features: [seats(PLAN_PRICING.free.teamMembers), d.feats.editor, d.feats.publicVerify, d.feats.linkedin],
    },
    {
      ...PLAN_PRICING.pro, tag: d.tagPopular, cta: d.ctaNow, highlight: true,
      features: [seats(PLAN_PRICING.pro.teamMembers), d.feats.allFree, d.feats.bulkExcel, d.feats.api, d.feats.customSign, d.feats.trackViews],
    },
    {
      ...PLAN_PRICING.business, tag: d.tagAcademies, cta: d.ctaContact, highlight: false,
      features: [seats(PLAN_PRICING.business.teamMembers), d.feats.allPro, d.feats.whiteLabel, d.feats.brandedCerts, d.feats.priority],
    },
  ];

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ===================== HERO ===================== */}
        <section className="mesh-bg relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-60" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
            <div className="text-center lg:text-start">
              <span className="chip animate-rise">
                <IconSparkle className="h-4 w-4" />
                {d.heroBadge}
              </span>

              <h1 className="animate-rise delay-1 mt-6 font-display text-4xl font-black leading-[1.15] text-ink sm:text-5xl lg:text-6xl">
                {d.heroTitleA}
                <br />
                <span className="gradient-text">{d.heroTitleB}</span>
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0">
                {d.heroSubtitle}
              </p>

              <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/register" className="btn-primary text-base">
                  {d.heroStart}
                  <IconArrow className="h-4 w-4 rotate-180" />
                </Link>
                <Link href="/verify" className="btn-ghost text-base">
                  <IconShield className="h-4 w-4" />
                  {d.heroVerify}
                </Link>
              </div>

              <div className="animate-rise delay-4 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted lg:justify-start">
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> {d.heroNoCard}</span>
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> {d.heroQuickSetup}</span>
                <span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-verify-500" /> {d.heroArabicSupport}</span>
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
                  <p className="text-xs text-ink-muted">{d.cardCertType}</p>
                  <h3 className="mt-2 font-display text-2xl font-extrabold text-ink">{d.cardName}</h3>
                  <p className="mt-3 text-sm text-ink-soft">{d.cardCompleted}</p>
                  <p className="font-bold text-brand-700">{d.cardCourse}</p>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <div className="h-px w-24 bg-ink-muted/40" />
                      <p className="mt-1 text-[10px] text-ink-muted">{d.cardSign}</p>
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
                  <p className="text-xs font-extrabold text-verify-700">{d.cardVerified}</p>
                  <p className="text-[10px] text-ink-muted">{d.cardVerifiedOk}</p>
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
            <span className="chip"><IconBolt className="h-4 w-4" /> {d.featuresChip}</span>
            <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">{d.featuresTitle}</h2>
            <p className="mt-4 text-lg text-ink-soft">{d.featuresSubtitle}</p>
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
              <span className="chip"><IconClock className="h-4 w-4" /> {d.howChip}</span>
              <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">{d.howTitle}</h2>
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
            <span className="chip"><IconBadge className="h-4 w-4" /> {d.pricingChip}</span>
            <h2 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">{d.pricingTitle}</h2>
            <p className="mt-4 text-lg text-ink-soft">{d.pricingSubtitle}</p>
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
                  <span className="absolute -top-3.5 end-8 rounded-full bg-gradient-to-l from-gold-400 to-gold-600 px-4 py-1 text-xs font-extrabold text-white shadow">
                    {p.tag}
                  </span>
                )}
                <h3 className="text-lg font-extrabold text-ink">{p.name}</h3>
                {!p.highlight && <span className="mt-1 text-xs font-bold text-ink-muted">{p.tag}</span>}
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-display text-5xl font-black text-ink">{p.monthly}</span>
                  <span className="mb-2 text-lg font-bold text-ink-muted">{d.perMonth}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-brand-700">{certs(p.certsPerMonth)}</p>

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
              <h2 className="font-display text-3xl font-black text-white sm:text-4xl">{d.ctaTitle}</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">{d.ctaSubtitle}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/register" className="btn bg-white px-6 text-base font-extrabold text-brand-700 hover:bg-brand-50">
                  {d.ctaStart}
                  <IconArrow className="h-4 w-4 rotate-180" />
                </Link>
                <Link href="/login" className="btn border border-white/30 px-6 text-base font-bold text-white hover:bg-white/10">
                  {d.ctaHaveAccount}
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
