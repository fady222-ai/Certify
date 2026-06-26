"use client";

import { useEffect, useState } from "react";
import {
  listPaymentGateways,
  savePaymentGateway,
  resetPaymentGateway,
  gatewayStatus,
  type PaymentGateway,
  type GatewayStatus,
} from "@/lib/admin";
import { Switch } from "@/components/Switch";
import { useT } from "@/components/LocaleProvider";

type Draft = Record<string, string>;

const SOURCE_KEY: Record<PaymentGateway["source"], string> = {
  db: "admin.gateways.sourceDb",
  env: "admin.gateways.sourceEnv",
  none: "admin.gateways.sourceNone",
};

const STATUS_META: Record<GatewayStatus, { labelKey: string; pill: string; dot: string }> = {
  live: { labelKey: "admin.gateways.statusLive", pill: "bg-green-50 text-green-700", dot: "bg-green-500" },
  needs_setup: { labelKey: "admin.gateways.statusNeedsSetup", pill: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  off: { labelKey: "admin.gateways.statusOff", pill: "bg-gray-100 text-gray-500", dot: "bg-gray-300" },
};

function draftFromGateway(g: PaymentGateway): Draft {
  const next: Draft = {};
  for (const f of g.fields) next[f.key] = !f.secret && f.preview ? f.preview : "";
  return next;
}

export default function PaymentGatewaysPage() {
  const t = useT();
  const [gateways, setGateways] = useState<PaymentGateway[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, { ok: boolean; text: string }>>({});

  function hydrate(list: PaymentGateway[]) {
    setGateways(list);
    setActive((prev) => prev ?? list[0]?.gateway ?? null);
    const d: Record<string, Draft> = {};
    for (const g of list) d[g.gateway] = draftFromGateway(g);
    setDrafts(d);
  }

  useEffect(() => {
    listPaymentGateways()
      .then((r) => hydrate(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.gateways.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(gateway: string, key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [gateway]: { ...prev[gateway], [key]: value } }));
  }

  function collectFields(g: PaymentGateway): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const f of g.fields) {
      const v = (drafts[g.gateway]?.[f.key] ?? "").trim();
      // Only send non-empty values; a blank secret keeps the stored one.
      if (v !== "") fields[f.key] = v;
    }
    return fields;
  }

  // Single persist path used by every action (save keys, toggle availability, etc.).
  async function persist(g: PaymentGateway, payload: { enabled: boolean; fields: Record<string, string> }) {
    setSavingId(g.gateway);
    setNotice((n) => ({ ...n, [g.gateway]: undefined as never }));
    try {
      const res = await savePaymentGateway(g.gateway, payload);
      setGateways((prev) => prev!.map((x) => (x.gateway === g.gateway ? res.gateway : x)));
      setDrafts((prev) => ({ ...prev, [g.gateway]: draftFromGateway(res.gateway) }));
      setNotice((n) => ({ ...n, [g.gateway]: { ok: true, text: res.message } }));
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [g.gateway]: { ok: false, text: e instanceof Error ? e.message : t("admin.gateways.saveError") },
      }));
    } finally {
      setSavingId(null);
    }
  }

  // Save the typed keys. `makeLive` enables the gateway in the same step (used by
  // the setup flow); otherwise the current availability is preserved.
  const saveKeys = (g: PaymentGateway, makeLive: boolean) =>
    persist(g, { enabled: makeLive ? true : g.enabled, fields: collectFields(g) });

  // The availability switch — toggling persists immediately (no separate save).
  const toggleAvailable = (g: PaymentGateway, value: boolean) =>
    persist(g, { enabled: value, fields: {} });

  async function onReset(g: PaymentGateway) {
    if (!confirm(t("admin.gateways.resetConfirm", { label: g.label }))) return;
    setSavingId(g.gateway);
    try {
      const res = await resetPaymentGateway(g.gateway);
      setGateways((prev) => prev!.map((x) => (x.gateway === g.gateway ? res.gateway : x)));
      setDrafts((prev) => ({ ...prev, [g.gateway]: draftFromGateway(res.gateway) }));
      setNotice((n) => ({ ...n, [g.gateway]: { ok: true, text: res.message } }));
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [g.gateway]: { ok: false, text: e instanceof Error ? e.message : t("admin.gateways.execError") },
      }));
    } finally {
      setSavingId(null);
    }
  }

  const liveGateways = gateways?.filter((g) => gatewayStatus(g) === "live") ?? [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-2xl font-black text-ink">{t("admin.gateways.title")}</h1>
      <p className="text-sm text-ink-soft mt-1">
        {t("admin.gateways.subtitle")}
      </p>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      {!gateways && !error && (
        <div className="mt-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ملخص: ما يراه العملاء عند الدفع (الرابط الصريح بين الإعداد والنتيجة) */}
      {gateways && gateways.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-surface-2/60 px-4 py-3">
          <p className="text-xs font-bold text-ink-soft">{t("admin.gateways.customersSee")}</p>
          {liveGateways.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {liveGateways.map((g) => (
                <span key={g.gateway} className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                  {g.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-amber-700">
              {t("admin.gateways.noneAvailable")}
            </p>
          )}
        </div>
      )}

      {/* محدد البوابة (تبويبات) — يبقي الصفحة قصيرة بعرض بوابة واحدة في كل مرة */}
      {gateways && gateways.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {gateways.map((g) => {
            const isActive = active === g.gateway;
            const st = gatewayStatus(g);
            return (
              <button
                key={g.gateway}
                onClick={() => setActive(g.gateway)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  isActive
                    ? "bg-brand-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]"
                    : "bg-surface-2 text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white/70" : STATUS_META[st].dot}`} />
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {gateways?.filter((g) => g.gateway === active).map((g) => {
          const note = notice[g.gateway];
          const status = gatewayStatus(g);
          const meta = STATUS_META[status];
          const draft = drafts[g.gateway] ?? {};
          // A required field is satisfied if already stored (DB/env) or just typed.
          const requiredMissing = g.fields.filter(
            (f) => f.required && !f.set && !((draft[f.key] ?? "").trim())
          );
          const saving = savingId === g.gateway;
          return (
            <section key={g.gateway} className="card p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-black text-ink">{g.label}</h2>
                    <span className="text-xs text-ink-muted">({g.region})</span>
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {t(meta.labelKey)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">{t("admin.gateways.sourceLabel", { source: t(SOURCE_KEY[g.source]) })}</p>
                </div>

                {/* مفتاح الإتاحة يظهر فقط بعد اكتمال المفاتيح (live/off) */}
                {status !== "needs_setup" && (
                  <div className="flex items-center gap-2.5 select-none">
                    <span className={`text-sm font-bold ${status === "live" ? "text-green-700" : "text-ink-muted"}`}>
                      {t("admin.gateways.availability")}
                    </span>
                    <Switch
                      checked={status === "live"}
                      disabled={saving}
                      aria-label={t("admin.gateways.availabilityAria", { label: g.label })}
                      onChange={(v) => toggleAvailable(g, v)}
                    />
                  </div>
                )}
              </div>

              {/* تلميح حسب الحالة */}
              {status === "needs_setup" && (
                <div className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                  {t("admin.gateways.needsSetupHint")}
                </div>
              )}
              {status === "off" && (
                <div className="mt-4 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-line">
                  {t("admin.gateways.offHint")}
                </div>
              )}

              <div className="mt-5 space-y-4">
                {g.fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1.5 flex items-center gap-1 text-sm font-bold text-ink">
                      {f.label}
                      {f.required && <span className="text-red-500">*</span>}
                      {f.secret && f.set && (
                        <span className="text-xs font-normal text-ink-muted">{t("admin.gateways.savedPreview", { preview: f.preview ?? "" })}</span>
                      )}
                    </span>
                    <input
                      type={f.secret ? "password" : "text"}
                      dir="ltr"
                      autoComplete="off"
                      value={drafts[g.gateway]?.[f.key] ?? ""}
                      onChange={(e) => setField(g.gateway, f.key, e.target.value)}
                      placeholder={
                        f.secret
                          ? f.set
                            ? t("admin.gateways.keepCurrent")
                            : t("admin.gateways.enterValue")
                          : t("admin.gateways.enterValue")
                      }
                      className="input"
                    />
                  </label>
                ))}
              </div>

              {note && (
                <div
                  className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${
                    note.ok ? "bg-green-50 text-green-700 ring-green-100" : "bg-red-50 text-red-600 ring-red-100"
                  }`}
                >
                  {note.text}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {status === "needs_setup" ? (
                  <>
                    <button
                      onClick={() => saveKeys(g, true)}
                      disabled={saving || requiredMissing.length > 0}
                      className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? t("admin.gateways.saving") : t("admin.gateways.saveAndEnable")}
                    </button>
                    {requiredMissing.length > 0 && (
                      <span className="text-xs font-medium text-amber-700">
                        {t("admin.gateways.completeRequired", { fields: requiredMissing.map((f) => f.label).join("، ") })}
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => saveKeys(g, false)}
                    disabled={saving}
                    className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? t("admin.gateways.saving") : t("admin.gateways.saveChanges")}
                  </button>
                )}
                {g.source === "db" && (
                  <button
                    onClick={() => onReset(g)}
                    disabled={saving}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {t("admin.gateways.resetDefault")}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
