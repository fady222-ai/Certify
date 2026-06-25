import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/RegisterForm";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "إنشاء حساب | Certify",
};

export default async function RegisterPage() {
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).auth.register;
  return (
    <AuthShell
      title={d.title}
      subtitle={d.subtitle}
      footer={
        <>
          {d.haveAccount}{" "}
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            {d.signIn}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
