import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LegalDoc } from "@/components/LegalDoc";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

async function dict() {
  return getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).legal;
}

export async function generateMetadata(): Promise<Metadata> {
  const d = (await dict()).terms;
  return { title: d.metaTitle, description: d.metaDesc };
}

export default async function TermsPage() {
  const d = await dict();
  return (
    <>
      <SiteHeader />
      <LegalDoc title={d.terms.title} chip={d.chip} sections={d.terms.sections} disclaimer={d.disclaimer} />
      <SiteFooter />
    </>
  );
}
