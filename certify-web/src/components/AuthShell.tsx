import Link from "next/link";
import { Logo } from "./Logo";
import { IconCheck, IconBadge } from "./icons";

const perks = [
  "أصدر ١٠ شهادات مجاناً شهرياً",
  "محرر قوالب عربي بالكامل",
  "صفحة تحقق عامة لكل شهادة",
  "تكامل مباشر مع لينكدإن",
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* اللوحة الجانبية (العلامة) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 lg:block">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo className="[&_span]:text-white [&_.text-ink]:text-white [&_.text-ink-muted]:text-brand-200" />

          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold">
              <IconBadge className="h-4 w-4" />
              منصة الشهادات الرقمية العربية
            </span>
            <h2 className="mt-6 font-display text-4xl font-black leading-tight">
              امنح متدربيك
              <br />
              شهادة تليق بإنجازهم
            </h2>
            <ul className="mt-8 space-y-3">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3 text-brand-100">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
                    <IconCheck className="h-4 w-4" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-brand-200">
            © {new Date().getFullYear()} سرتفاي · صُنع للسوق العربي
          </p>
        </div>
      </div>

      {/* لوحة النموذج */}
      <div className="flex items-center justify-center bg-surface-2/40 px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Logo className="justify-center" />
          </div>
          <div className="card p-8">
            <h1 className="font-display text-2xl font-black text-ink">{title}</h1>
            <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-ink-soft">{footer}</p>
          <p className="mt-3 text-center">
            <Link href="/" className="text-xs font-bold text-ink-muted hover:text-brand-700">
              ← العودة للصفحة الرئيسية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
