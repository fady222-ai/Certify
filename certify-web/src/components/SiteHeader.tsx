import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-bold text-ink-soft md:flex">
          <a href="/#features" className="transition hover:text-brand-700">المميزات</a>
          <a href="/#how" className="transition hover:text-brand-700">كيف تعمل</a>
          <a href="/#pricing" className="transition hover:text-brand-700">الأسعار</a>
          <Link href="/verify" className="transition hover:text-brand-700">تحقق من شهادة</Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">تسجيل الدخول</Link>
          <Link href="/register" className="btn-primary">ابدأ مجانا</Link>
        </div>
      </div>
    </header>
  );
}
