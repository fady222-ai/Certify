import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SupportContactForm } from "@/components/SupportContactForm";

export const metadata: Metadata = {
  title: "تواصل معنا | Certify",
  description: "هل لديك سؤال أو مشكلة؟ راسل فريق دعم Certify وسنردّ في أقرب وقت.",
};

export default function SupportContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-ink">تواصل مع الدعم</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
            أرسل لنا رسالتك وسيتواصل معك فريق الدعم عبر بريدك الإلكتروني. لديك حساب؟
            يمكنك فتح تذكرة من لوحة التحكم لمتابعة أسرع.
          </p>
        </div>
        <SupportContactForm />
      </main>
      <SiteFooter />
    </>
  );
}
