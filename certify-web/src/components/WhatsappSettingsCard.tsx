"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWhatsapp, updateWhatsapp, type WaConfig } from "@/lib/whatsapp";
import { useT } from "@/components/LocaleProvider";
import { Switch } from "@/components/Switch";
import { IconWhatsapp } from "@/components/icons";

/**
 * Owner-only WhatsApp delivery settings. Self-contained: it fetches its own
 * config and renders nothing if the caller isn't the owner (the API 403s) so it
 * can be dropped into the settings page unconditionally.
 */
export function WhatsappSettingsCard() {
  const t = useT();
  const [cfg, setCfg] = useState<WaConfig | null>(null);
  const [hidden, setHidden] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function hydrate(c: WaConfig) {
    setCfg(c);
    setEnabled(c.enabled);
    // Prefill non-secret fields from their (real) preview; secrets stay blank.
    const v: Record<string, string> = {};
    for (const f of c.fields) if (!f.secret && f.preview) v[f.key] = f.preview;
    setValues(v);
  }

  useEffect(() => {
    getWhatsapp()
      .then(hydrate)
      .catch(() => setHidden(true)); // not the owner (or load error) → hide
  }, []);

  if (hidden) return null;

  async function save(nextEnabled?: boolean) {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      // Send only non-empty fields — a blank secret keeps the stored value.
      const fields: Record<string, string> = {};
      for (const [k, val] of Object.entries(values)) if (val.trim()) fields[k] = val.trim();
      const r = await updateWhatsapp({ enabled: nextEnabled ?? enabled, fields });
      hydrate(r.config);
      setToast(t("wa.saved"));
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wa.saveFailed"));
      if (cfg) setEnabled(cfg.enabled); // revert optimistic toggle
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25d366]/10 text-[#25d366]">
          <IconWhatsapp className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("wa.title")}</h2>
            {cfg?.available && (
              <span className="rounded-full bg-verify-50 px-2.5 py-0.5 text-[11px] font-bold text-verify-700">
                {t("wa.statusLive")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">{t("wa.subtitle")}</p>
        </div>
      </div>

      {!cfg ? (
        <p className="mt-5 text-center text-sm text-ink-muted">{t("wa.loading")}</p>
      ) : !cfg.platform_enabled ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
          {t("wa.platformOff")}
        </p>
      ) : cfg.plan_allowed === false ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
          <span className="text-sm font-bold text-amber-800">{t("wa.planOff")}</span>
          <Link href="/dashboard/billing" className="btn-primary shrink-0">{t("wa.upgrade")}</Link>
        </div>
      ) : (
        <>
          {toast && (
            <div className="mt-4 rounded-xl bg-verify-50 px-4 py-3 text-sm font-bold text-verify-700 ring-1 ring-verify-100">{toast}</div>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</div>
          )}

          {/* Enable toggle */}
          <div className="mt-5 flex items-center justify-between border-t pt-5">
            <span className="text-sm font-bold text-ink">{t("wa.enableLabel")}</span>
            <Switch
              checked={enabled}
              disabled={busy}
              onChange={(next) => { setEnabled(next); save(next); }}
              aria-label={t("wa.enableLabel")}
            />
          </div>

          {/* Credentials */}
          <p className="mt-5 text-xs text-ink-muted">{t("wa.fieldsHint")}</p>
          <div className="mt-3 space-y-3">
            {cfg.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">
                  {t(`wa.f.${f.key}`)} {f.required && <span className="text-red-500">*</span>}
                </span>
                <input
                  type={f.secret ? "password" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.secret && f.set ? `${f.preview} — ${t("wa.leaveBlank")}` : ""}
                  className="input"
                  dir="ltr"
                />
              </label>
            ))}
          </div>

          <p className="mt-3 rounded-xl bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-ink-soft ring-1 ring-line">
            {t("wa.templateHint")}
          </p>

          <div className="mt-4">
            <button onClick={() => save()} disabled={busy} className="btn-primary disabled:opacity-60">
              {busy ? t("wa.saving") : t("wa.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
