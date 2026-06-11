"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getToken } from "@/lib/auth";
import { listTemplates, deleteTemplate, type Template } from "@/lib/templates";
import { IconPalette, IconArrow, IconBadge } from "@/components/icons";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setTemplates(await listTemplates());
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    if (!confirm("حذف هذا القالب؟")) return;
    await deleteTemplate(id);
    load();
  }

  return (
    <div className="min-h-screen bg-surface-2/40">
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-sm font-bold text-ink-muted sm:inline">/ القوالب</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn-ghost">لوحة التحكم</Link>
          <Link href="/dashboard/templates/new" className="btn-primary">
            <IconPalette className="h-4 w-4" /> قالب جديد
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <h1 className="font-display text-2xl font-black text-ink">قوالب الشهادات</h1>
        <p className="mt-1 text-sm text-ink-soft">صمّم قوالبك الخاصة واستخدمها عند إصدار الشهادات.</p>

        {loading ? (
          <p className="mt-10 text-center text-sm text-ink-muted">جارٍ التحميل…</p>
        ) : templates.length === 0 ? (
          <div className="card mt-8 p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconPalette className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">لا توجد قوالب بعد</h2>
            <p className="mt-2 text-sm text-ink-soft">ابدأ بتصميم أول قالب لشهاداتك.</p>
            <Link href="/dashboard/templates/new" className="btn-primary mt-6 inline-flex">
              <IconPalette className="h-4 w-4" /> صمّم قالباً
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="card card-lift overflow-hidden">
                <div
                  className="flex h-40 items-center justify-center border-b"
                  style={{ background: t.design_data?.background ?? "#f8fafc" }}
                >
                  <IconBadge className="h-10 w-10" style={{ color: firstColor(t) }} />
                </div>
                <div className="p-4">
                  <h3 className="font-extrabold text-ink">{t.name}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t.design_data?.elements?.length ?? 0} عنصر
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/dashboard/templates/${t.id}`} className="btn-ghost flex-1 justify-center py-2 text-xs">
                      تعديل <IconArrow className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => remove(t.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function firstColor(t: Template) {
  const el = t.design_data?.elements?.find((e) => e.fill && e.type !== "rect");
  return el?.fill ?? "#4f46e5";
}
