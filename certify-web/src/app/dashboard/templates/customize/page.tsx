"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getTemplate,
  createTemplate,
  updateTemplate,
  type Template,
  type DesignData,
} from "@/lib/templates";
import { getOrganization } from "@/lib/organization";
import { applyTheme, injectLogo, getTheme, type Theme } from "@/lib/customize";
import { DesignPreview } from "@/components/DesignPreview";
import { IconPalette, IconArrow } from "@/components/icons";

function Customizer() {
  const router = useRouter();
  const params = useSearchParams();
  const baseId = params.get("base");
  const ownedId = params.get("id");
  const sourceId = baseId ?? ownedId;

  const [base, setBase] = useState<Template | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [accent2, setAccent2] = useState("#000000");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (!sourceId) { setError("لا يوجد قالب محدّد."); setLoading(false); return; }
    Promise.all([getTemplate(sourceId), getOrganization().catch(() => null)])
      .then(([t, org]) => {
        const th = getTheme(t.design_data);
        if (!t.design_data || !th) { setError("هذا القالب غير قابل للتخصيص."); return; }
        setBase(t);
        setTheme(th);
        setAccent(th.accent);
        setAccent2(th.accent2);
        setName(baseId ? `${t.name} — مخصّص` : t.name);
        setLogoUrl(org?.logo_url ?? null);
      })
      .catch(() => setError("تعذّر تحميل القالب."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  // Saved design = recolor only (logo is resolved from org settings at render time).
  const savedDesign = useMemo<DesignData | null>(() => {
    if (!base?.design_data || !theme) return null;
    return applyTheme(base.design_data, theme, { accent, accent2 });
  }, [base, theme, accent, accent2]);

  // Preview = saved design + the org logo placed at the slot (WYSIWYG).
  const previewDesign = useMemo(() => injectLogo(savedDesign, logoUrl), [savedDesign, logoUrl]);

  async function onSave() {
    if (!savedDesign || !theme) return;
    if (!name.trim()) { setError("يرجى إدخال اسم للقالب."); return; }
    setSaving(true);
    setError(null);
    const designData = { ...savedDesign, theme: { ...theme, accent, accent2 } } as DesignData;
    try {
      if (ownedId) await updateTemplate(ownedId, { name: name.trim(), designData });
      else await createTemplate({ name: name.trim(), designData });
      router.push("/dashboard/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ.");
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-6"><p className="text-center text-sm text-ink-muted">جارٍ التحميل…</p></main>;
  }
  if (error && !base) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-ink-soft">{error}</p>
        <Link href="/dashboard/templates" className="btn-ghost mt-6 inline-flex">العودة للقوالب</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">تخصيص القالب</h1>
          <p className="mt-1 text-sm text-ink-soft">عدّل الألوان فقط — يبقى التصميم كما هو، ثم احفظه باسم جديد.</p>
        </div>
        <Link href="/dashboard/templates" className="btn-ghost">إلغاء</Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-surface-2/50 p-5 ring-1 ring-line">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg shadow ring-1 ring-line">
            {previewDesign && <DesignPreview design={previewDesign} />}
          </div>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">اسم القالب الجديد</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: قالب أكاديميتي" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">اللون الأساسي</span>
              <span className="flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-1.5">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-xs text-ink-muted">{accent}</span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">اللون الثانوي</span>
              <span className="flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-1.5">
                <input type="color" value={accent2} onChange={(e) => setAccent2(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-xs text-ink-muted">{accent2}</span>
              </span>
            </label>
          </div>

          <div className="rounded-xl bg-surface-2/60 px-4 py-3 text-xs text-ink-soft ring-1 ring-line">
            {logoUrl ? (
              <>الشعار يُؤخذ تلقائياً من <Link href="/dashboard/settings" className="font-bold text-brand-700 hover:underline">إعدادات المنظمة</Link> ويظهر في موضعه على الشهادة.</>
            ) : (
              <>لا يوجد شعار لمنظمتك بعد. <Link href="/dashboard/settings" className="font-bold text-brand-700 hover:underline">ارفع شعارك من الإعدادات</Link> ليظهر تلقائياً على القوالب.</>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</p>}

          <button onClick={onSave} disabled={saving} className="btn-primary w-full disabled:opacity-60">
            <IconPalette className="h-4 w-4" />
            {saving ? "جارٍ الحفظ…" : "حفظ القالب"}
            {!saving && <IconArrow className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function CustomizeTemplatePage() {
  return (
    <Suspense fallback={<main className="p-6"><p className="text-center text-sm text-ink-muted">جارٍ التحميل…</p></main>}>
      <Customizer />
    </Suspense>
  );
}
