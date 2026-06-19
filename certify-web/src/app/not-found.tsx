import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { IconShield, IconArrow } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center lg:py-32">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-brand-50 text-brand-600">
            <IconShield className="h-10 w-10" />
          </span>
          <p className="mt-8 font-display text-6xl font-black text-ink">٤٠٤</p>
          <h1 className="mt-3 font-display text-2xl font-black text-ink">الصفحة غير موجودة</h1>
          <p className="mt-3 text-ink-soft">
            ربما حذف الرابط أو تغير. تحقق من العنوان أو عد إلى الصفحة الرئيسية.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              <IconArrow className="h-4 w-4" /> العودة للرئيسية
            </Link>
            <Link href="/help" className="btn-ghost">مركز المساعدة</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
