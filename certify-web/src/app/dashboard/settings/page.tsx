"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getToken, refreshProfile } from "@/lib/auth";
import {
  getOrganization, updateOrganization, uploadBranding, deleteBranding,
  type Organization,
} from "@/lib/organization";
import { useT } from "@/components/LocaleProvider";
import { WhatsappSettingsCard } from "@/components/WhatsappSettingsCard";
import { IconBadge, IconTrash, IconUpload } from "@/components/icons";

const PRESET_COLORS = ["#4f46e5", "#0ea5e9", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0f172a"];

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const o = await getOrganization();
      setOrg(o);
      setName(o.name);
      setPrimaryColor(o.primary_color || "#4f46e5");
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateOrganization({ primaryColor });
      setOrg(updated);
      await refreshProfile();
      setNotice(t("settings.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(kind: "logo" | "signature", file?: File | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const updated = await uploadBranding(kind, file);
      setOrg(updated);
      await refreshProfile();
      setNotice(kind === "logo" ? t("settings.logoUpdated") : t("settings.sigUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.uploadFailed"));
    }
  }

  async function onDelete(kind: "logo" | "signature") {
    try {
      const updated = await deleteBranding(kind);
      setOrg(updated);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.deleteFailed"));
    }
  }

  return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">{t("settings.title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("settings.subtitle")}</p>
        </div>

        {notice && (
          <div className="rounded-xl bg-verify-50 px-4 py-3 text-sm font-bold text-verify-700 ring-1 ring-verify-100">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-ink-muted">{t("settings.loading")}</p>
        ) : (
          <>
            {/* Details */}
            <form onSubmit={saveDetails} className="card space-y-5 p-6">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">{t("settings.orgName")}</span>
                <input value={name} readOnly disabled className="input bg-surface-2/60 text-ink-soft cursor-not-allowed" />
                <p className="mt-1 text-xs text-ink-muted">{t("settings.orgNameHint")}</p>
              </label>

              <div>
                <span className="mb-2 block text-sm font-bold text-ink">{t("settings.primaryColor")}</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setPrimaryColor(c)}
                      className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                        primaryColor.toLowerCase() === c ? "ring-ink" : "ring-transparent"
                      }`}
                      style={{ background: c }} aria-label={c} />
                  ))}
                  <label className="flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-1.5">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="font-mono text-xs text-ink-muted">{primaryColor}</span>
                  </label>
                </div>
              </div>

              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? t("settings.saving") : t("settings.saveChanges")}
              </button>
            </form>

            {/* Branding assets */}
            <div className="grid gap-5 sm:grid-cols-2">
              <AssetCard
                title={t("settings.logo")}
                hint={t("settings.logoHint")}
                url={org?.logo_url ?? null}
                inputRef={logoRef}
                onPick={(f) => onUpload("logo", f)}
                onRemove={() => onDelete("logo")}
                bg="#ffffff"
              />
              <AssetCard
                title={t("settings.signature")}
                hint={t("settings.signatureHint")}
                url={org?.signature_url ?? null}
                inputRef={sigRef}
                onPick={(f) => onUpload("signature", f)}
                onRemove={() => onDelete("signature")}
                bg="#f8fafc"
              />
            </div>

            {/* Live preview swatch */}
            <div className="card p-6">
              <p className="mb-3 text-sm font-bold text-ink-soft">{t("settings.previewTitle")}</p>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: `${primaryColor}55` }}>
                <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: primaryColor }}>
                  {org?.logo_url ? (
                    <Image src={org.logo_url} alt="" width={120} height={40} className="max-h-9 w-auto object-contain" unoptimized />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">
                      <IconBadge className="h-5 w-5" />
                    </span>
                  )}
                  <span className="font-display font-extrabold">{name || t("settings.orgNamePlaceholder")}</span>
                </div>
                <div className="bg-white px-5 py-4 text-center">
                  <p className="text-xs text-ink-muted">{t("settings.certType")}</p>
                  <p className="mt-1 font-display text-lg font-black" style={{ color: primaryColor }}>
                    {t("settings.traineeName")}
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp delivery (owner only; self-hides otherwise) */}
            <WhatsappSettingsCard />
          </>
        )}
      </main>
  );
}

function AssetCard({
  title, hint, url, inputRef, onPick, onRemove, bg,
}: {
  title: string;
  hint: string;
  url: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | null) => void;
  onRemove: () => void;
  bg: string;
}) {
  const t = useT();
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-ink">{title}</h3>
        {url && (
          <button onClick={onRemove} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600" title={t("settings.deleteTitle")}>
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>

      <div
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex h-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-surface-3 hover:border-brand-400"
        style={{ background: bg }}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-20 max-w-[80%] object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-ink-muted">
            <IconUpload className="h-6 w-6" />
            <span className="text-xs font-bold">{t("settings.uploadImage")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
