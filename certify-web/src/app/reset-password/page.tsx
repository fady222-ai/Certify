import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "إعادة تعيين كلمة المرور | Certify",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="إعادة تعيين كلمة المرور"
      subtitle="أنشئ كلمة مرور جديدة قوية لحسابك."
      footer={
        <>
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
