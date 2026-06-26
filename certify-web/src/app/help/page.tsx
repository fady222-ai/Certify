import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { IconShield, IconArrow } from "@/components/icons";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

async function dict() {
  return getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).help;
}

export async function generateMetadata(): Promise<Metadata> {
  const d = await dict();
  return { title: d.metaTitle, description: d.metaDesc };
}

export default async function HelpPage() {
  const d = await dict();
  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 lg:py-24">
          <div className="text-center">
            <span className="chip"><IconShield className="h-4 w-4" /> {d.chip}</span>
            <h1 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">{d.title}</h1>
            <p className="mt-4 text-lg text-ink-soft">{d.subtitle}</p>
          </div>

          <div className="mt-12 space-y-3">
            {d.faqs.map((f) => (
              <details key={f.q} className="card group p-5 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-4 font-extrabold text-ink list-none">
                  {f.q}
                  <IconArrow className="h-4 w-4 shrink-0 -rotate-90 text-ink-muted transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 card flex flex-col items-center gap-3 p-8 text-center">
            <h2 className="font-display text-xl font-black text-ink">{d.ctaTitle}</h2>
            <p className="text-sm text-ink-soft">{d.ctaSubtitle}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary">{d.ctaStart} <IconArrow className="h-4 w-4 rotate-180" /></Link>
              <Link href="/" className="btn-ghost">{d.ctaHome}</Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
