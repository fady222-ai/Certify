import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "استعادة كلمة المرور | Certify",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة."
      footer={
        <>
          تذكّرت كلمة المرور؟{" "}
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
