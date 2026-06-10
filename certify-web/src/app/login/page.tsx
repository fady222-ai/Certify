import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { IconMail, IconLock, IconGoogle, IconArrow } from "@/components/icons";

export const metadata: Metadata = {
  title: "تسجيل الدخول | Certify",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="مرحباً بعودتك 👋"
      subtitle="سجّل الدخول لإدارة شهاداتك ومتابعة تحليلاتك."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-extrabold text-brand-700 hover:underline">
            أنشئ حساباً مجاناً
          </Link>
        </>
      }
    >
      <form className="space-y-4">
        <button type="button" className="btn-ghost w-full">
          <IconGoogle className="h-5 w-5" />
          المتابعة عبر Google
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          أو بالبريد الإلكتروني
          <span className="h-px flex-1 bg-line" />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">البريد الإلكتروني</span>
          <span className="relative block">
            <IconMail className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="email" placeholder="you@example.com" className="input pr-11" dir="ltr" />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-ink">
            كلمة المرور
            <a href="#" className="text-xs font-bold text-brand-600 hover:underline">نسيت كلمة المرور؟</a>
          </span>
          <span className="relative block">
            <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="password" placeholder="••••••••" className="input pr-11" dir="ltr" />
          </span>
        </label>

        <Link href="/dashboard" className="btn-primary w-full">
          تسجيل الدخول
          <IconArrow className="h-4 w-4 rotate-180" />
        </Link>
      </form>
    </AuthShell>
  );
}
