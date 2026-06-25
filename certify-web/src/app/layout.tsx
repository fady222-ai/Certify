import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/LocaleProvider";
import { normalizeLocale, dirFor, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://certify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "منصة الشهادات الرقمية | Certify",
  description:
    "أصدر مئات الشهادات الرقمية الاحترافية بنقرة واحدة — قابلة للتحقق، وقابلة للنشر على لينكدإن.",
  keywords: ["شهادات رقمية", "إصدار شهادات", "التحقق من الشهادات", "Certify", "شهادات إتمام الدورات"],
  applicationName: "Certify",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: "Certify",
    title: "منصة الشهادات الرقمية | Certify",
    description:
      "أصدر مئات الشهادات الرقمية الاحترافية بنقرة واحدة — قابلة للتحقق، وقابلة للنشر على لينكدإن.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "منصة الشهادات الرقمية | Certify",
    description: "أصدر شهادات رقمية احترافية قابلة للتحقق بنقرة واحدة.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale comes from a cookie (set by the language switcher); default Arabic.
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${cairo.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
