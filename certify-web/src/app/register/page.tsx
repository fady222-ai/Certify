import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "إنشاء حساب | Certify",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="أنشئ حسابك المجاني"
      subtitle="ابدأ بإصدار شهاداتك الاحترافية خلال دقائق — بدون بطاقة ائتمان."
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
