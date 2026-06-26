import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportContactForm } from "@/components/SupportContactForm";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).supportPub;
  return { title: d.metaTitle, description: d.metaDesc };
}

export default async function SupportContactPage() {
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).supportPub;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-ink">{d.pageTitle}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
            {d.pageSubtitle}
          </p>
        </div>
        <SupportContactForm />
      </main>
      <SiteFooter />
    </>
  );
}
