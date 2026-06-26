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
  const d = (await dict()).refund;
  return { title: d.metaTitle, description: d.metaDesc };
}

export default async function RefundPage() {
  const d = await dict();
  return (
    <>
      <SiteHeader />
      <LegalDoc title={d.refund.title} chip={d.chip} sections={d.refund.sections} disclaimer={d.disclaimer} />
      <SiteFooter />
    </>
  );
}
