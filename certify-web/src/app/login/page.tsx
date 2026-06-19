import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "تسجيل الدخول | Certify",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="مرحبا بعودتك 👋"
      subtitle="سجل الدخول لإدارة شهاداتك ومتابعة تحليلاتك."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-extrabold text-brand-700 hover:underline">
            أنشئ حسابا مجانا
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
