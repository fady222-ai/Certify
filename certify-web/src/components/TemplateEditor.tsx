"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type DesignData,
  type DesignElement,
  createTemplate,
  updateTemplate,
  getTemplate,
  uploadTemplateBackground,
  VARIABLE_OPTIONS,
  variableLabel,
} from "@/lib/templates";
import { getToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { IconBadge, IconPalette, IconUpload, IconCheck, IconArrow } from "./icons";
import {
  STAGE_W,
  STAGE_H,
  centerX,
  buildObject,
  normColor,
  objectToElement,
  type FabricNS,
  type FObj,
} from "./templateEditor/canvas";
import { Panel, ToolBtn, NumberRow, ColorRow } from "./templateEditor/controls";

export function TemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<FabricNS | null>(null);
  const canvasRef = useRef<FObj | null>(null);

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("قالب بدون عنوان");
  const [bg, setBg] = useState("#ffffff");
  const [bgImage, setBgImage] = useState<string | null>(null); // saved relative path/URL
  const [bgUploading, setBgUploading] = useState(false);
  const [selected, setSelected] = useState<FObj | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ---- Init canvas ----
  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    let disposed = false;
    (async () => {
      const fabric = await import("fabric");
      if (disposed || !canvasElRef.current) return;
      fabricRef.current = fabric;

      const wrapW = wrapRef.current?.clientWidth ?? 900;
      const scale = Math.min(1, (wrapW - 4) / STAGE_W);

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: STAGE_W * scale,
        height: STAGE_H * scale,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      canvas.setZoom(scale);
      canvasRef.current = canvas;

      const sync = () => {
        setSelected(canvas.getActiveObject() ?? null);
        rerender();
      };
      canvas.on("selection:created", sync);
      canvas.on("selection:updated", sync);
      canvas.on("selection:cleared", () => { setSelected(null); rerender(); });
      canvas.on("object:modified", rerender);

      // Load existing template (if editing)
      if (templateId) {
        try {
          const tpl = await getTemplate(templateId);
          if (tpl.design_data) {
            setName(tpl.name);
            setBg(tpl.design_data.background ?? "#ffffff");
            canvas.backgroundColor = tpl.design_data.background ?? "#ffffff";
            const savedBg = tpl.design_data.backgroundImage;
            if (savedBg) {
              setBgImage(savedBg);
              const url = /^https?:\/\//i.test(savedBg)
                ? savedBg
                : `${API_URL}/storage/${savedBg}`;
              const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
              img.set({ scaleX: STAGE_W / img.width, scaleY: STAGE_H / img.height });
              canvas.backgroundImage = img;
            }
            for (const el of tpl.design_data.elements) {
              const obj = await buildObject(fabric, el);
              canvas.add(obj);
            }
          }
        } catch {
          setError("تعذر تحميل القالب.");
        }
      }

      await (document as FObj).fonts?.ready;
      canvas.renderAll();
      setReady(true);
    })();

    return () => {
      disposed = true;
      canvasRef.current?.dispose?.();
      canvasRef.current = null;
    };
  }, [templateId, router]);

  // ---- Toolbar actions ----
  function add(el: DesignElement) {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!fabric || !canvas) return;
    Promise.resolve(buildObject(fabric, el)).then((obj) => {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
      setSelected(obj);
      rerender();
    });
  }

  function addText() {
    add({ type: "text", left: centerX(360), top: 320, width: 360, text: "نص جديد", fontSize: 30, fontWeight: 700, fill: "#111827", textAlign: "center" });
  }
  function addVariable(key: string) {
    add({ type: "variable", variableKey: key, left: centerX(420), top: 360, width: 420, fontSize: 34, fontWeight: 800, fill: "#1f2937", textAlign: "center" });
  }
  function addRect() {
    add({ type: "rect", left: 60, top: 60, width: STAGE_W - 120, height: STAGE_H - 120, fill: "transparent", stroke: "#4f46e5", strokeWidth: 3, rx: 8 });
  }
  function addLine() {
    add({ type: "line", left: centerX(400), top: 500, width: 400, stroke: "#cbd5e1", strokeWidth: 2 });
  }
  function addQr() {
    add({ type: "qr", left: 90, top: 620, width: 96 });
  }
  function addImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => add({ type: "image", left: centerX(180), top: 70, width: 180, src: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function updateSelected(props: Record<string, unknown>) {
    const canvas = canvasRef.current;
    if (!selected || !canvas) return;
    selected.set(props);
    canvas.renderAll();
    rerender();
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!selected || !canvas) return;
    canvas.remove(selected);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelected(null);
    rerender();
  }

  function setBackground(color: string) {
    setBg(color);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.backgroundColor = color;
      canvas.renderAll();
    }
  }

  // Paint (or clear) the full-page background image on the canvas. `url` is an
  // absolute URL for preview; pass null to remove it.
  async function paintBgImage(url: string | null) {
    const fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!fabric || !canvas) return;
    if (!url) {
      canvas.backgroundImage = null;
      canvas.renderAll();
      return;
    }
    const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    img.set({ scaleX: STAGE_W / img.width, scaleY: STAGE_H / img.height });
    canvas.backgroundImage = img;
    canvas.renderAll();
  }

  async function onUploadBg(file: File) {
    setBgUploading(true);
    setError(null);
    try {
      const { path, url } = await uploadTemplateBackground(file);
      setBgImage(path);
      await paintBgImage(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع صورة الخلفية.");
    } finally {
      setBgUploading(false);
    }
  }

  function removeBgImage() {
    setBgImage(null);
    paintBgImage(null);
  }

  // ---- Serialize canvas → design_data ----
  function serialize(): DesignData {
    const canvas = canvasRef.current;
    const elements: DesignElement[] = [];
    for (const obj of canvas?.getObjects() ?? []) {
      const el = objectToElement(obj);
      if (el) elements.push(el);
    }
    return { width: STAGE_W, height: STAGE_H, background: bg, backgroundImage: bgImage ?? undefined, elements };
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const designData = serialize();
      if (templateId) {
        await updateTemplate(templateId, { name, designData });
      } else {
        const created = await createTemplate({ name, designData });
        router.replace(`/dashboard/templates/${created.id}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  const isText = selected && (selected.type === "textbox");
  const isRect = selected && selected.type === "rect" && !selected.isQr;

  return (
    <div className="min-h-screen bg-surface-2/40">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/templates")} className="btn-ghost px-3 py-2">
            <IconArrow className="h-4 w-4" /> رجوع
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold focus:border-brand-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-sm font-bold text-verify-600"><IconCheck className="h-4 w-4" /> تم الحفظ</span>}
          {error && <span className="text-sm font-bold text-red-600">{error}</span>}
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? "جار الحفظ…" : "حفظ القالب"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-5 p-5">
        {/* Tools */}
        <aside className="w-56 shrink-0 space-y-4">
          <Panel title="إضافة عناصر">
            <ToolBtn icon={IconBadge} label="نص" onClick={addText} />
            <div className="rounded-xl border border-line bg-white p-2">
              <p className="mb-1.5 px-1 text-xs font-bold text-ink-muted">متغير ديناميكي</p>
              <div className="grid gap-1">
                {VARIABLE_OPTIONS.map((v) => (
                  <button key={v.key} onClick={() => addVariable(v.key)}
                    className="rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-brand-700 transition hover:bg-brand-50">
                    + {v.label}
                  </button>
                ))}
              </div>
            </div>
            <ToolBtn icon={IconPalette} label="مستطيل / إطار" onClick={addRect} />
            <ToolBtn icon={IconPalette} label="خط فاصل" onClick={addLine} />
            <ToolBtn icon={IconBadge} label="مربع QR" onClick={addQr} />
            <label className="btn-ghost w-full cursor-pointer">
              <IconUpload className="h-4 w-4" /> صورة / شعار
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && addImageFromFile(e.target.files[0])} />
            </label>
          </Panel>

          <Panel title="خلفية الشهادة">
            <ColorRow label="اللون" value={bg} onChange={setBackground} />
            <div className="mt-2 space-y-1.5">
              <label className={`btn-ghost w-full cursor-pointer ${bgUploading ? "opacity-60" : ""}`}>
                <IconUpload className="h-4 w-4" />
                {bgUploading ? "جار الرفع…" : bgImage ? "تغيير صورة الخلفية" : "رفع صورة خلفية"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={bgUploading}
                  onChange={(e) => { if (e.target.files?.[0]) onUploadBg(e.target.files[0]); e.target.value = ""; }} />
              </label>
              {bgImage && (
                <button onClick={removeBgImage}
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                  إزالة صورة الخلفية
                </button>
              )}
              <p className="px-1 text-[11px] text-ink-muted">PNG/JPG/WebP حتى 2MB، بمقاس أفقي 1123×794.</p>
            </div>
          </Panel>
        </aside>

        {/* Canvas */}
        <div ref={wrapRef} className="min-w-0 flex-1">
          <div className="card overflow-hidden p-2">
            <div className="overflow-auto">
              <canvas ref={canvasElRef} className="rounded-lg" />
            </div>
          </div>
          {!ready && <p className="mt-3 text-center text-sm text-ink-muted">جار تحضير المحرر…</p>}
          <p className="mt-3 text-center text-xs text-ink-muted">
            انقر عنصرا لتحديده، اسحب لتحريكه، واستخدم اللوحة الجانبية لتعديله.
          </p>
        </div>

        {/* Properties */}
        <aside className="w-60 shrink-0">
          <Panel title="الخصائص">
            {!selected ? (
              <p className="px-1 text-xs text-ink-muted">حدد عنصرا لعرض خصائصه.</p>
            ) : (
              <div className="space-y-3">
                {selected.variableKey && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-ink-muted">المتغير</p>
                    <select
                      value={selected.variableKey}
                      onChange={(e) =>
                        updateSelected({
                          text: `«${variableLabel(e.target.value)}»`,
                          variableKey: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
                      {VARIABLE_OPTIONS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                    </select>
                  </div>
                )}

                {isText && (
                  <>
                    <NumberRow label="حجم الخط" value={Math.round(selected.fontSize)} min={8} max={120}
                      onChange={(n) => updateSelected({ fontSize: n })} />
                    <div>
                      <p className="mb-1 text-xs font-bold text-ink-muted">الوزن</p>
                      <div className="flex gap-1">
                        {[400, 700, 800].map((w) => (
                          <button key={w} onClick={() => updateSelected({ fontWeight: w })}
                            className={`flex-1 rounded-lg border px-2 py-1 text-xs font-bold ${selected.fontWeight == w ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line"}`}>
                            {w === 400 ? "عادي" : w === 700 ? "عريض" : "أعرض"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold text-ink-muted">المحاذاة</p>
                      <div className="flex gap-1">
                        {[["right","يمين"],["center","وسط"],["left","يسار"]].map(([v,l]) => (
                          <button key={v} onClick={() => updateSelected({ textAlign: v })}
                            className={`flex-1 rounded-lg border px-2 py-1 text-xs font-bold ${selected.textAlign === v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ColorRow label="لون النص" value={selected.fill} onChange={(c) => updateSelected({ fill: c })} />
                  </>
                )}

                {isRect && (
                  <>
                    <ColorRow label="لون التعبئة" value={normColor(selected.fill)} onChange={(c) => updateSelected({ fill: c })} />
                    <ColorRow label="لون الحدود" value={normColor(selected.stroke)} onChange={(c) => updateSelected({ stroke: c })} />
                    <NumberRow label="سماكة الحدود" value={Math.round(selected.strokeWidth ?? 0)} min={0} max={20}
                      onChange={(n) => updateSelected({ strokeWidth: n })} />
                    <NumberRow label="استدارة الزوايا" value={Math.round(selected.rx ?? 0)} min={0} max={80}
                      onChange={(n) => updateSelected({ rx: n, ry: n })} />
                  </>
                )}

                <button onClick={deleteSelected} className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100">
                  حذف العنصر
                </button>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
