import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import {
  IconBadge, IconUpload, IconPalette, IconChart, IconUsers,
  IconArrow, IconCheck, IconQr, IconBolt,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "لوحة التحكم | Certify",
};

const nav = [
  { label: "نظرة عامة", icon: IconChart, active: true },
  { label: "الشهادات", icon: IconBadge },
  { label: "القوالب", icon: IconPalette },
  { label: "الإصدار الجماعي", icon: IconUpload },
  { label: "الفريق", icon: IconUsers },
];

const stats = [
  { label: "شهادات مُصدرة", value: "١", sub: "هذا الشهر", icon: IconBadge, tone: "brand" },
  { label: "مرات الفتح", value: "٠", sub: "إجمالي", icon: IconQr, tone: "gold" },
  { label: "متبقٍّ في الباقة", value: "٩", sub: "من ١٠ شهادات", icon: IconBolt, tone: "verify" },
];

const recent = [
  { name: "عبدالرحمن محمد الأحمدي", course: "أساسيات إدارة المشاريع", code: "CERT-SMOK-0001", date: "٢٠٢٦/٠٦/١٠" },
];

const toneMap: Record<string, string> = {
  brand: "from-brand-50 to-brand-100 text-brand-600",
  gold: "from-gold-50 to-gold-100 text-gold-600",
  verify: "from-verify-50 to-verify-100 text-verify-600",
};

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-surface-2/40">
      {/* الشريط الجانبي */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-white lg:flex">
        <div className="border-b px-5 py-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <a
              key={n.label}
              href="#"
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                n.active
                  ? "bg-brand-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]"
                  : "text-ink-soft hover:bg-surface-2 hover:text-brand-700"
              }`}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </a>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
          <p className="text-sm font-extrabold">باقة مجانية</p>
          <p className="mt-1 text-xs text-brand-100">٩ شهادات متبقية هذا الشهر</p>
          <Link href="/#pricing" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">
            ترقية الباقة
          </Link>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex-1">
        {/* رأس */}
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
          <div>
            <h1 className="font-display text-lg font-black text-ink">نظرة عامة</h1>
            <p className="text-xs text-ink-muted">أكاديمية المسار للتدريب</p>
          </div>
          <button className="btn-primary" type="button">
            <IconBadge className="h-4 w-4" />
            إصدار شهادة جديدة
          </button>
        </header>

        <main className="space-y-6 p-6">
          {/* بطاقات الإحصاء */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="card card-lift p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink-soft">{s.label}</p>
                    <p className="mt-2 font-display text-4xl font-black text-ink">{s.value}</p>
                    <p className="mt-1 text-xs text-ink-muted">{s.sub}</p>
                  </div>
                  <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${toneMap[s.tone]}`}>
                    <s.icon className="h-6 w-6" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* إجراءات سريعة */}
          <div className="grid gap-5 lg:grid-cols-3">
            <QuickAction icon={IconBadge} title="إصدار فردي" desc="أصدر شهادة واحدة لمتدرب." />
            <QuickAction icon={IconUpload} title="إصدار جماعي" desc="ارفع ملف Excel بمئات الأسماء." />
            <QuickAction icon={IconPalette} title="تصميم قالب" desc="صمّم قالباً بألوان منظمتك." />
          </div>

          {/* أحدث الشهادات */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-display text-lg font-extrabold text-ink">أحدث الشهادات</h2>
              <a href="#" className="flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
                عرض الكل <IconArrow className="h-4 w-4" />
              </a>
            </div>
            <div className="divide-y">
              {recent.map((r) => (
                <div key={r.code} className="flex items-center justify-between px-6 py-4 transition hover:bg-surface-2/60">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-display font-black text-brand-600">
                      {r.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-ink">{r.name}</p>
                      <p className="text-xs text-ink-muted">{r.course}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="hidden font-mono text-xs text-ink-muted sm:inline">{r.code}</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-verify-50 px-3 py-1 text-xs font-bold text-verify-700">
                      <IconCheck className="h-3.5 w-3.5" /> نشطة
                    </span>
                    <Link href={`/verify/${r.code}`} className="text-sm font-bold text-brand-700 hover:underline">
                      تحقق
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof IconBadge;
  title: string;
  desc: string;
}) {
  return (
    <button type="button" className="card card-lift group p-6 text-right">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition group-hover:from-brand-600 group-hover:to-brand-700 group-hover:text-white">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{desc}</p>
    </button>
  );
}
