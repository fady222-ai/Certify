"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { listTemplates, deleteTemplate, createTemplate, type Template } from "@/lib/templates";
import { IconPalette, IconArrow, IconBadge } from "@/components/icons";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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

  // Public (ready-made) templates aren't owned by the org, so they can't be
  // edited in place — duplicate into an editable copy and open it.
  async function useAsTemplate(t: Template) {
    if (!t.design_data) return;
    setBusy(t.id);
    try {
      const created = await createTemplate({ name: `${t.name} (نسخة)`, designData: t.design_data });
      router.push(`/dashboard/templates/${created.id}`);
    } catch {
      alert("تعذّر إنشاء نسخة من القالب.");
      setBusy(null);
    }
  }

  return (
      <main className="mx-auto max-w-7xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-black text-ink">قوالب الشهادات</h1>
            <p className="mt-1 text-sm text-ink-soft">استخدم قالباً جاهزاً أو صمّم قالبك الخاص بألوان منظمتك.</p>
          </div>
          <Link href="/dashboard/templates/new" className="btn-primary">
            <IconPalette className="h-4 w-4" /> قالب جديد
          </Link>
        </div>

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
                  className="relative flex h-40 items-center justify-center border-b"
                  style={{ background: t.design_data?.background ?? "#f8fafc" }}
                >
                  <IconBadge className="h-10 w-10" style={{ color: firstColor(t) }} />
                  {t.is_public && (
                    <span className="absolute right-3 top-3 rounded-full bg-brand-600/90 px-2.5 py-1 text-[11px] font-bold text-white">
                      جاهز
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-extrabold text-ink">{t.name}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t.design_data?.elements?.length ?? 0} عنصر
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {t.is_public ? (
                      <button
                        onClick={() => useAsTemplate(t)}
                        disabled={busy === t.id}
                        className="btn-primary flex-1 justify-center py-2 text-xs disabled:opacity-60"
                      >
                        {busy === t.id ? "جارٍ النسخ…" : "استخدام كقالب"}
                        {busy !== t.id && <IconArrow className="h-3.5 w-3.5" />}
                      </button>
                    ) : (
                      <>
                        <Link href={`/dashboard/templates/${t.id}`} className="btn-ghost flex-1 justify-center py-2 text-xs">
                          تعديل <IconArrow className="h-3.5 w-3.5" />
                        </Link>
                        <button onClick={() => remove(t.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
  );
}

function firstColor(t: Template) {
  const el = t.design_data?.elements?.find((e) => e.fill && e.type !== "rect");
  return el?.fill ?? "#4f46e5";
}
