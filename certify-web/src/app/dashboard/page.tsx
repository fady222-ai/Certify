"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IssueCertificateModal } from "@/components/IssueCertificateModal";
import { getToken, getStoredUser, logout, authedFetch, type AuthUser } from "@/lib/auth";
import {
  IconBadge, IconUpload, IconPalette, IconChart, IconUsers,
  IconArrow, IconCheck, IconQr, IconBolt,
} from "@/components/icons";

type Stats = {
  issued_total: number;
  issued_this_month: number;
  opened_total: number;
  limit: number | null;
};
type Certificate = {
  id: string;
  recipient_name: string;
  course_name: string | null;
  verification_code: string;
  opened_count: number;
  status: string;
  pdf_url: string | null;
};

const nav = [
  { label: "نظرة عامة", icon: IconChart, href: "/dashboard", active: true },
  { label: "الشهادات", icon: IconBadge, href: "/dashboard" },
  { label: "القوالب", icon: IconPalette, href: "/dashboard/templates" },
  { label: "الإصدار الجماعي", icon: IconUpload, href: "/dashboard" },
  { label: "الفريق", icon: IconUsers, href: "/dashboard" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, certsRes] = await Promise.all([
        authedFetch("me/stats"),
        authedFetch("certificates"),
      ]);
      setStats(await statsRes.json());
      const certsData = await certsRes.json();
      setCerts(certsData.data ?? []);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setProfile(getStoredUser());
    load();
  }, [router, load]);

  function onLogout() {
    logout();
    router.push("/");
  }

  const org = profile?.organization;
  const remaining =
    stats?.limit != null ? Math.max(0, stats.limit - stats.issued_this_month) : null;

  const statCards = [
    { label: "شهادات مُصدرة", value: stats?.issued_total ?? 0, sub: "الإجمالي", icon: IconBadge, tone: "brand" },
    { label: "مرات الفتح", value: stats?.opened_total ?? 0, sub: "إجمالي", icon: IconQr, tone: "gold" },
    { label: "متبقٍّ في الباقة", value: remaining ?? "∞", sub: stats?.limit ? `من ${stats.limit} شهرياً` : "غير محدود", icon: IconBolt, tone: "verify" },
  ];
  const toneMap: Record<string, string> = {
    brand: "from-brand-50 to-brand-100 text-brand-600",
    gold: "from-gold-50 to-gold-100 text-gold-600",
    verify: "from-verify-50 to-verify-100 text-verify-600",
  };

  return (
    <div className="flex min-h-screen bg-surface-2/40">
      <IssueCertificateModal open={modalOpen} onClose={() => setModalOpen(false)} onIssued={load} />

      {/* الشريط الجانبي */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-white lg:flex">
        <div className="border-b px-5 py-4"><Logo /></div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link key={n.label} href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                n.active ? "bg-brand-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]"
                  : "text-ink-soft hover:bg-surface-2 hover:text-brand-700"}`}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
          <p className="text-sm font-extrabold">{org?.plan?.name ?? "باقة مجانية"}</p>
          <p className="mt-1 text-xs text-brand-100">
            {remaining != null ? `${remaining} شهادة متبقية هذا الشهر` : "إصدار غير محدود"}
          </p>
          <Link href="/#pricing" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">
            ترقية الباقة
          </Link>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex-1">
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
          <div>
            <h1 className="font-display text-lg font-black text-ink">نظرة عامة</h1>
            <p className="text-xs text-ink-muted">{org?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
              <IconBadge className="h-4 w-4" />
              إصدار شهادة جديدة
            </button>
            <button className="btn-ghost" type="button" onClick={onLogout}>خروج</button>
          </div>
        </header>

        <main className="space-y-6 p-6">
          {/* بطاقات الإحصاء */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((s) => (
              <div key={s.label} className="card card-lift p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink-soft">{s.label}</p>
                    <p className="mt-2 font-display text-4xl font-black text-ink">
                      {loading ? "…" : s.value}
                    </p>
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
            <QuickAction icon={IconBadge} title="إصدار فردي" desc="أصدر شهادة واحدة لمتدرب." onClick={() => setModalOpen(true)} />
            <QuickAction icon={IconUpload} title="إصدار جماعي" desc="ارفع ملف Excel بمئات الأسماء." onClick={() => router.push("/dashboard/bulk")} />
            <QuickAction icon={IconPalette} title="تصميم قالب" desc="صمّم قالباً بألوان منظمتك." onClick={() => router.push("/dashboard/templates")} />
          </div>

          {/* أحدث الشهادات */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-display text-lg font-extrabold text-ink">أحدث الشهادات</h2>
              <span className="text-xs text-ink-muted">{certs.length} شهادة</span>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-ink-muted">جارٍ التحميل…</div>
            ) : certs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-ink-soft">لم تُصدر أي شهادة بعد.</p>
                <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
                  <IconBadge className="h-4 w-4" /> أصدر أول شهادة
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {certs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-6 py-4 transition hover:bg-surface-2/60">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-display font-black text-brand-600">
                        {r.recipient_name.charAt(0)}
                      </span>
                      <div>
                        <p className="font-bold text-ink">{r.recipient_name}</p>
                        <p className="text-xs text-ink-muted">{r.course_name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden font-mono text-xs text-ink-muted sm:inline">{r.verification_code}</span>
                      <span className="flex items-center gap-1.5 rounded-full bg-verify-50 px-3 py-1 text-xs font-bold text-verify-700">
                        <IconCheck className="h-3.5 w-3.5" /> نشطة
                      </span>
                      <Link href={`/verify/${r.verification_code}`} target="_blank" className="text-sm font-bold text-brand-700 hover:underline">
                        تحقق <IconArrow className="inline h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, title, desc, onClick,
}: {
  icon: typeof IconBadge; title: string; desc: string; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="card card-lift group p-6 text-right">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 transition group-hover:from-brand-600 group-hover:to-brand-700 group-hover:text-white">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{desc}</p>
    </button>
  );
}
