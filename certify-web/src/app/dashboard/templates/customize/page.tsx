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
import { applyTheme, injectLogo, getTheme, readCertType, readBody, hasBody, applyContent, type Theme } from "@/lib/customize";
import { DesignPreview } from "@/components/DesignPreview";
import { useT } from "@/components/LocaleProvider";
import { IconPalette, IconArrow } from "@/components/icons";

type Pos = "right" | "center" | "left";
const MARGIN = 60;

// Certificate type values (the actual Arabic word written onto the certificate);
// labels are localized at render. "" = plain «شهادة».
const CERT_TYPE_VALUES = ["", "إتمام", "حضور", "تقدير", "مشاركة", "تدريب", "شكر", "نجاح"];
const CERT_TYPE_KEYS = ["plain", "completion", "attendance", "appreciation", "participation", "training", "thanks", "success"];

// Constrained horizontal anchors (keeps the template's vertical + size).
function posToBox(theme: Theme, width: number, pos: Pos) {
  const lw = theme.logoBox.width;
  const left = pos === "right" ? width - MARGIN - lw : pos === "left" ? MARGIN : Math.round((width - lw) / 2);
  return { ...theme.logoBox, left };
}
function boxToPos(theme: Theme, width: number): Pos {
  const lw = theme.logoBox.width;
  const center = Math.round((width - lw) / 2);
  const right = width - MARGIN - lw;
  const l = theme.logoBox.left;
  const d = (x: number) => Math.abs(l - x);
  if (d(MARGIN) <= d(center) && d(MARGIN) <= d(right)) return "left";
  if (d(right) <= d(center)) return "right";
  return "center";
}

function Customizer() {
  const router = useRouter();
  const t = useT();
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
  const [pos, setPos] = useState<Pos>("center");
  const [certType, setCertType] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [showBody, setShowBody] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    if (!sourceId) { setError(t("customize.noTemplate")); setLoading(false); return; }
    Promise.all([getTemplate(sourceId), getOrganization().catch(() => null)])
      .then(([tpl, org]) => {
        const th = getTheme(tpl.design_data);
        if (!tpl.design_data || !th) { setError(t("customize.notCustomizable")); return; }
        setBase(tpl);
        setTheme(th);
        setAccent(th.accent);
        setAccent2(th.accent2);
        setPos(boxToPos(th, tpl.design_data.width || 1123));
        setName(baseId ? `${tpl.name} — ${t("customize.customSuffix")}` : tpl.name);
        setLogoUrl(org?.logo_url ?? null);
        setCertType(readCertType(tpl.design_data));
        setBodyText(readBody(tpl.design_data));
        setShowBody(hasBody(tpl.design_data));
      })
      .catch(() => setError(t("customize.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const width = base?.design_data?.width ?? 1123;

  // Recolor + apply the chosen logo position into the design's theme.
  const themedDesign = useMemo<DesignData | null>(() => {
    if (!base?.design_data || !theme) return null;
    let d = applyTheme(base.design_data, theme, { accent, accent2 });
    d = applyContent(d, { certType, bodyText }); // title type + academy sentence
    (d as unknown as { theme: Theme }).theme = { ...theme, accent, accent2, logoBox: posToBox(theme, width, pos) };
    return d;
  }, [base, theme, accent, accent2, pos, width, certType, bodyText]);

  // Preview = themed design + org logo at the (chosen) slot.
  const previewDesign = useMemo(() => injectLogo(themedDesign, logoUrl), [themedDesign, logoUrl]);

  async function onSave() {
    if (!themedDesign || !theme) return;
    if (!name.trim()) { setError(t("customize.nameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      if (ownedId) await updateTemplate(ownedId, { name: name.trim(), designData: themedDesign });
      else await createTemplate({ name: name.trim(), designData: themedDesign });
      router.push("/dashboard/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("customize.saveFailed"));
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-6"><p className="text-center text-sm text-ink-muted">{t("customize.loading")}</p></main>;
  }
  if (error && !base) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-ink-soft">{error}</p>
        <Link href="/dashboard/templates" className="btn-ghost mt-6 inline-flex">{t("customize.backToTemplates")}</Link>
      </main>
    );
  }

  const positions: { v: Pos; label: string }[] = [
    { v: "right", label: t("customize.posRight") },
    { v: "center", label: t("customize.posCenter") },
    { v: "left", label: t("customize.posLeft") },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">{t("customize.title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("customize.subtitle")}</p>
        </div>
        <Link href="/dashboard/templates" className="btn-ghost">{t("customize.cancel")}</Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-surface-2/50 p-5 ring-1 ring-line">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg shadow ring-1 ring-line">
            {previewDesign && <DesignPreview design={previewDesign} />}
          </div>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.newName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("customize.namePh")} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.primaryColor")}</span>
              <span className="flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-1.5">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-xs text-ink-muted">{accent}</span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.secondaryColor")}</span>
              <span className="flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-1.5">
                <input type="color" value={accent2} onChange={(e) => setAccent2(e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-xs text-ink-muted">{accent2}</span>
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.certType")}</span>
            <select value={certType} onChange={(e) => setCertType(e.target.value)} className="input">
              {CERT_TYPE_VALUES.map((v, i) => (
                <option key={v} value={v}>{t(`customize.types.${CERT_TYPE_KEYS[i]}`)}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-ink-muted">
              {t("customize.titleLabel", { title: certType ? `${t("customize.certTitleWord")} ${certType}` : t("customize.certTitleWord") })}
            </span>
          </label>

          {showBody && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.bodyText")}</span>
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3}
                className="input leading-relaxed" placeholder={t("customize.bodyPh")} />
            </label>
          )}

          {logoUrl && (
            <div>
              <span className="mb-1.5 block text-sm font-bold text-ink">{t("customize.logoPos")}</span>
              <div className="flex gap-1.5 rounded-xl bg-white p-1 ring-1 ring-surface-3">
                {positions.map((p) => (
                  <button key={p.v} type="button" onClick={() => setPos(p.v)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${
                      pos === p.v ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-surface-2"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-surface-2/60 px-4 py-3 text-xs text-ink-soft ring-1 ring-line">
            {logoUrl ? (
              <>{t("customize.logoAutoA")} <Link href="/dashboard/settings" className="font-bold text-brand-700 hover:underline">{t("customize.orgSettings")}</Link>.</>
            ) : (
              <>{t("customize.logoNoneA")} <Link href="/dashboard/settings" className="font-bold text-brand-700 hover:underline">{t("customize.uploadFromSettings")}</Link> {t("customize.logoNoneB")}</>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</p>}

          <button onClick={onSave} disabled={saving} className="btn-primary w-full disabled:opacity-60">
            <IconPalette className="h-4 w-4" />
            {saving ? t("customize.saving") : t("customize.saveTemplate")}
            {!saving && <IconArrow className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function CustomizeTemplatePage() {
  return (
    <Suspense fallback={<main className="p-6"><p className="text-center text-sm text-ink-muted" /></main>}>
      <Customizer />
    </Suspense>
  );
}
