"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { listTemplates, deleteTemplate, type Template } from "@/lib/templates";
import { getOrganization, setDefaultTemplate } from "@/lib/organization";
import { getTheme, injectLogo } from "@/lib/customize";
import { DesignPreview } from "@/components/DesignPreview";
import { useT } from "@/components/LocaleProvider";
import { IconPalette, IconArrow, IconCheck } from "@/components/icons";

export default function TemplatesPage() {
  const router = useRouter();
  const tr = useT();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Template | null>(null);

  async function load() {
    try {
      const [tpls, org] = await Promise.all([listTemplates(), getOrganization().catch(() => null)]);
      setTemplates(tpls);
      setLogoUrl(org?.logo_url ?? null);
      setDefaultId(org?.default_template_id ?? null);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function assignDefault(id: string) {
    setAssigning(id);
    try {
      const org = await setDefaultTemplate(id);
      setDefaultId(org.default_template_id ?? id);
    } catch (e) {
      alert(e instanceof Error ? e.message : tr("tpl.assignFailed"));
    } finally {
      setAssigning(null);
    }
  }

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    if (!confirm(tr("tpl.confirmDelete"))) return;
    await deleteTemplate(id);
    load();
  }

  // Public preset → customize a new copy (base). Owned themed template →
  // re-customize in place (id). Owned plain template → the classic fabric editor.
  function editHref(t: Template): string {
    if (t.is_public) return `/dashboard/templates/customize?base=${t.id}`;
    if (getTheme(t.design_data)) return `/dashboard/templates/customize?id=${t.id}`;
    return `/dashboard/templates/${t.id}`;
  }

  return (
      <main className="mx-auto max-w-7xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-black text-ink">{tr("tpl.title")}</h1>
            <p className="mt-1 text-sm text-ink-soft">{tr("tpl.subtitle")}</p>
          </div>
          <Link href="/dashboard/templates/new" className="btn-primary">
            <IconPalette className="h-4 w-4" /> {tr("tpl.newTemplate")}
          </Link>
        </div>

        {!loading && !logoUrl && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
            <span>{tr("tpl.noLogoHint")}</span>
            <Link href="/dashboard/settings" className="whitespace-nowrap font-extrabold text-amber-900 hover:underline">
              {tr("tpl.uploadLogo")} ←
            </Link>
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-ink-muted">{tr("tpl.loading")}</p>
        ) : templates.length === 0 ? (
          <div className="card mt-8 p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconPalette className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">{tr("tpl.emptyTitle")}</h2>
            <p className="mt-2 text-sm text-ink-soft">{tr("tpl.emptyBody")}</p>
            <Link href="/dashboard/templates/new" className="btn-primary mt-6 inline-flex">
              <IconPalette className="h-4 w-4" /> {tr("tpl.designTemplate")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="card card-lift overflow-hidden">
                <button
                  type="button"
                  onClick={() => t.design_data && setPreview(t)}
                  className="relative block w-full border-b text-start"
                  title={tr("tpl.preview")}
                >
                  {t.design_data ? (
                    <DesignPreview design={injectLogo(t.design_data, logoUrl)!} />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-surface-2 text-ink-muted">
                      <IconPalette className="h-10 w-10" />
                    </div>
                  )}
                  {t.is_public && (
                    <span className="absolute end-3 top-3 rounded-full bg-brand-600/90 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                      {tr("tpl.ready")}
                    </span>
                  )}
                </button>
                <div className="p-4">
                  <h3 className="font-extrabold text-ink">{t.name}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {tr("tpl.elementsCount", { n: t.design_data?.elements?.length ?? 0 })}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {defaultId === t.id ? (
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-verify-50 px-3 py-2 text-xs font-bold text-verify-700 ring-1 ring-verify-200">
                        <IconCheck className="h-3.5 w-3.5" /> {tr("tpl.default")}
                      </div>
                    ) : (
                      <button onClick={() => assignDefault(t.id)} disabled={assigning === t.id}
                        className="btn-primary flex-1 justify-center py-2 text-xs disabled:opacity-60">
                        {assigning === t.id ? tr("tpl.assigning") : tr("tpl.assign")}
                      </button>
                    )}
                    {t.is_public ? (
                      <Link href={editHref(t)} className="btn-ghost flex-1 justify-center py-2 text-xs">
                        {tr("tpl.customize")}
                      </Link>
                    ) : (
                      <>
                        <Link href={editHref(t)} className="btn-ghost flex-1 justify-center py-2 text-xs">
                          {getTheme(t.design_data) ? tr("tpl.customize") : tr("tpl.edit")} <IconArrow className="h-3.5 w-3.5" />
                        </Link>
                        <button onClick={() => remove(t.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                          {tr("tpl.delete")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview modal */}
        {preview?.design_data && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPreview(null)}
          >
            <div
              className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h3 className="font-display text-lg font-black text-ink">{preview.name}</h3>
                <button onClick={() => setPreview(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2" aria-label={tr("tpl.close")}>
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto bg-surface-2/40 p-5">
                <div className="mx-auto max-w-2xl rounded-lg shadow ring-1 ring-line">
                  <DesignPreview design={injectLogo(preview.design_data, logoUrl)!} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5">
                <button onClick={() => setPreview(null)} className="btn-ghost">{tr("tpl.close")}</button>
                <Link href={editHref(preview)} className="btn-primary">
                  {preview.is_public || getTheme(preview.design_data) ? tr("tpl.customize") : tr("tpl.edit")} <IconArrow className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
