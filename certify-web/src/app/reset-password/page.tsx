import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "إعادة تعيين كلمة المرور | Certify",
};

export default async function ResetPasswordPage() {
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).auth.reset;
  return (
    <AuthShell
      title={d.title}
      subtitle={d.subtitle}
      footer={
        <>
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            {d.backToLogin}
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
