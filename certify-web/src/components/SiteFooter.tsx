import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface-2/60">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
              منصة عربية لإصدار الشهادات الرقمية الاحترافية القابلة للتحقق — أصدر مئات
              الشهادات بنقرة واحدة، وامنح متدربيك شهادة تليق بهم وقابلة للنشر على لينكدإن.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">المنتج</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><a href="/#features" className="hover:text-brand-700">المميزات</a></li>
              <li><a href="/#pricing" className="hover:text-brand-700">الأسعار</a></li>
              <li><Link href="/help" className="hover:text-brand-700">مركز المساعدة</Link></li>
              <li><Link href="/support" className="hover:text-brand-700">تواصل معنا / الدعم</Link></li>
              <li><Link href="/verify" className="hover:text-brand-700">التحقق من شهادة</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">الحساب</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><Link href="/login" className="hover:text-brand-700">تسجيل الدخول</Link></li>
              <li><Link href="/register" className="hover:text-brand-700">إنشاء حساب</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">قانوني</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><Link href="/terms" className="hover:text-brand-700">شروط الاستخدام</Link></li>
              <li><Link href="/privacy" className="hover:text-brand-700">سياسة الخصوصية</Link></li>
              <li><Link href="/refund" className="hover:text-brand-700">سياسة الاسترداد</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-ink-muted sm:flex-row">
          <span>© {new Date().getFullYear()} سرتفاي · جميع الحقوق محفوظة</span>
          <span className="flex items-center gap-1.5">
            صنع بحب للسوق العربي
            <span className="text-gold-500">★</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
