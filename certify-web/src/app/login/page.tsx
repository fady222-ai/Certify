import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";
import { getDict, normalizeLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "تسجيل الدخول | Certify",
};

export default async function LoginPage() {
  const d = getDict(normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)).auth.login;
  return (
    <AuthShell
      title={d.title}
      subtitle={d.subtitle}
      footer={
        <>
          {d.noAccount}{" "}
          <Link href="/register" className="font-extrabold text-brand-700 hover:underline">
            {d.createFree}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
