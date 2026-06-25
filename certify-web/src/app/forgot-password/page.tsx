import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "استعادة كلمة المرور | Certify",
};

export default async function ForgotPasswordPage() {
  const dict = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value));
  const d = dict.auth.forgot;
  return (
    <AuthShell
      title={d.title}
      subtitle={d.subtitle}
      footer={
        <>
          {d.remembered}{" "}
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            {dict.auth.login.signIn}
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
