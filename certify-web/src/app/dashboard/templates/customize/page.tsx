"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { applyTheme, getTheme, downscaleToDataUrl, type Theme } from "@/lib/customize";
import { DesignPreview } from "@/components/DesignPreview";
import { IconPalette, IconUpload, IconArrow, IconTrash } from "@/components/icons";

function Customizer() {
  const router = useRouter();
  const params = useSearchParams();
  const baseId = params.get("base");
  const ownedId = params.get("id");
  const sourceId = baseId ?? ownedId;
  const fileRef = useRef<HTMLInputElement>(null);

  const [base, setBase] = useState<Template | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [accent, setAccent] = useState("#000000");
  const [accent2, setAccent2] = useState("#000000");
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (!sourceId) { setError("لا يوجد قالب محدّد."); setLoading(false); return; }
    getTemplate(sourceId)
      .then((t) => {
        const th = getTheme(t.design_data);
        if (!t.design_data || !th) {
          setError("هذا القالب غير قابل للتخصيص.");
          return;
        }
        setBase(t);
        setTheme(th);
        setAccent(th.accent);
        setAccent2(th.accent2);
        setName(baseId ? `${t.name} — مخصّص` : t.name);
        // pre-load an existing logo if editing an owned customized template
        const existing = t.design_data.elements?.find((e) => e.type === "image" && e.role === "logo");
        if (existing?.src) setLogo(existing.src);
      })
      .catch(() => setError("تعذّر تحميل القالب."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  // Live preview design with current color + logo choices applied.
  const previewDesign = useMemo<DesignData | null>(() => {
    if (!base?.design_data || !theme) return null;
    return applyTheme(base.design_data, theme, { accent, accent2, logoDataUri: logo });
  }, [base, theme, accent, accent2, logo]);

  async function onPickLogo(file?: File | null) {
    if (!file) return;
    setError(null);
    try {
      setLogo(await downscaleToDataUrl(file));
    } catch {
      setError("تعذّرت معالجة الصورة. جرّب صورة PNG/JPG أصغر.");
    }
  }

  async function onSave() {
    if (!previewDesign || !theme) return;
    if (!name.trim()) { setError("يرجى إدخال اسم للقالب."); return; }
    setSaving(true);
    setError(null);
    // keep theme so the saved template stays re-customizable
    const designData = { ...previewDesign, theme: { ...theme, accent, accent2 } } as DesignData;
    try {
      if (ownedId) {
        await updateTemplate(ownedId, { name: name.trim(), designData });
      } else {
        await createTemplate({ name: name.trim(), designData });
      }
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
          <p className="mt-1 text-sm text-ink-soft">عدّل الألوان والشعار فقط — يبقى التصميم كما هو، ثم احفظه باسم جديد.</p>
        </div>
        <Link href="/dashboard/templates" className="btn-ghost">إلغاء</Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Live preview */}
        <div className="rounded-2xl bg-surface-2/50 p-5 ring-1 ring-line">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg shadow ring-1 ring-line">
            {previewDesign && <DesignPreview design={previewDesign} />}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">اسم القالب الجديد</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: قالب شركتي" />
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

          <div>
            <span className="mb-1.5 block text-sm font-bold text-ink">الشعار (اختياري)</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost flex-1 justify-center">
                <IconUpload className="h-4 w-4" /> {logo ? "تغيير الشعار" : "رفع شعار"}
              </button>
              {logo && (
                <button type="button" onClick={() => setLogo(null)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100" title="إزالة">
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { onPickLogo(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">PNG شفاف يُفضّل. يوضع في المكان المخصّص بالتصميم.</p>
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
