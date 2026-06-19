import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
