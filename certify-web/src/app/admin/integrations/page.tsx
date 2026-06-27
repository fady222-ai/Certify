"use client";

import { useEffect, useState } from "react";
import { getAdminWhatsapp, setAdminWhatsapp } from "@/lib/whatsapp";
import { useT } from "@/components/LocaleProvider";
import { Switch } from "@/components/Switch";
import { IconWhatsapp } from "@/components/icons";

export default function AdminIntegrationsPage() {
  const t = useT();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminWhatsapp()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setError(t("admin.integrations.loadFailed")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setToast(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    try {
      const r = await setAdminWhatsapp(next);
      setEnabled(r.enabled);
      setToast(t("admin.integrations.saved"));
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setEnabled(prev ?? false);
      setError(e instanceof Error ? e.message : t("admin.integrations.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-black text-ink">{t("admin.integrations.title")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("admin.integrations.subtitle")}</p>
      </div>

      {toast && (
        <div className="rounded-xl bg-verify-50 px-4 py-3 text-sm font-bold text-verify-700 ring-1 ring-verify-100">{toast}</div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</div>
      )}

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25d366]/10 text-[#25d366]">
              <IconWhatsapp className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-extrabold text-ink">{t("admin.integrations.waTitle")}</h2>
              <p className="mt-1 max-w-prose text-sm text-ink-soft">{t("admin.integrations.waDesc")}</p>
            </div>
          </div>
          {enabled !== null && (
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              enabled ? "bg-verify-50 text-verify-700" : "bg-surface-2 text-ink-muted"
            }`}>
              {enabled ? t("admin.integrations.live") : t("admin.integrations.off")}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t pt-5">
          <span className="text-sm font-bold text-ink">{t("admin.integrations.waToggle")}</span>
          {enabled === null ? (
            <span className="text-xs text-ink-muted">{t("admin.integrations.loading")}</span>
          ) : (
            <Switch checked={enabled} onChange={toggle} disabled={busy} aria-label={t("admin.integrations.waToggle")} />
          )}
        </div>
      </div>
    </main>
  );
}
