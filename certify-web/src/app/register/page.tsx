import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { IconMail, IconLock, IconGoogle, IconArrow, IconUsers, IconBadge } from "@/components/icons";

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
      <form className="space-y-4">
        <button type="button" className="btn-ghost w-full">
          <IconGoogle className="h-5 w-5" />
          التسجيل عبر Google
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          أو بالبريد الإلكتروني
          <span className="h-px flex-1 bg-line" />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">الاسم الكامل</span>
          <span className="relative block">
            <IconUsers className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="text" placeholder="اسمك" className="input pr-11" />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">اسم المنظمة / الأكاديمية</span>
          <span className="relative block">
            <IconBadge className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="text" placeholder="أكاديمية..." className="input pr-11" />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">البريد الإلكتروني</span>
          <span className="relative block">
            <IconMail className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="email" placeholder="you@example.com" className="input pr-11" dir="ltr" />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">كلمة المرور</span>
          <span className="relative block">
            <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="password" placeholder="٨ أحرف على الأقل" className="input pr-11" dir="ltr" />
          </span>
        </label>

        <Link href="/dashboard" className="btn-primary w-full">
          إنشاء الحساب
          <IconArrow className="h-4 w-4 rotate-180" />
        </Link>

        <p className="text-center text-xs leading-relaxed text-ink-muted">
          بإنشائك حساباً فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
      </form>
    </AuthShell>
  );
}
