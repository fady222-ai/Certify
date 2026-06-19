"use client";

import { useEffect, useState } from "react";
import {
  listPaymentGateways,
  savePaymentGateway,
  resetPaymentGateway,
  type PaymentGateway,
} from "@/lib/admin";
import { Switch } from "@/components/Switch";

type Draft = Record<string, string>;

const SOURCE_LABEL: Record<PaymentGateway["source"], string> = {
  db: "محفوظة في قاعدة البيانات",
  env: "من متغيرات البيئة",
  none: "غير مهيأة",
};

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [enabledDraft, setEnabledDraft] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, { ok: boolean; text: string }>>({});

  function hydrate(list: PaymentGateway[]) {
    setGateways(list);
    setActive((prev) => prev ?? list[0]?.gateway ?? null);
    const d: Record<string, Draft> = {};
    const en: Record<string, boolean> = {};
    for (const g of list) {
      d[g.gateway] = {};
      for (const f of g.fields) {
        // Pre-fill non-secret fields (ids/rate) with their stored value; leave
        // secret fields blank so the admin types them only to change them.
        d[g.gateway][f.key] = !f.secret && f.preview ? f.preview : "";
      }
      en[g.gateway] = g.enabled;
    }
    setDrafts(d);
    setEnabledDraft(en);
  }

  useEffect(() => {
    listPaymentGateways()
      .then((r) => hydrate(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "تعذر التحميل."));
  }, []);

  function setField(gateway: string, key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [gateway]: { ...prev[gateway], [key]: value } }));
  }

  async function onSave(g: PaymentGateway) {
    setSavingId(g.gateway);
    setNotice((n) => ({ ...n, [g.gateway]: undefined as never }));
    try {
      const fields: Record<string, string> = {};
      for (const f of g.fields) {
        const v = (drafts[g.gateway]?.[f.key] ?? "").trim();
        // Only send non-empty values; blank secret = keep the stored one.
        if (v !== "") fields[f.key] = v;
      }
      const res = await savePaymentGateway(g.gateway, { enabled: enabledDraft[g.gateway], fields });
      // Refresh just this gateway in place and clear typed secrets.
      setGateways((prev) => prev!.map((x) => (x.gateway === g.gateway ? res.gateway : x)));
      setDrafts((prev) => {
        const next: Draft = {};
        for (const f of res.gateway.fields) next[f.key] = !f.secret && f.preview ? f.preview : "";
        return { ...prev, [g.gateway]: next };
      });
      setNotice((n) => ({ ...n, [g.gateway]: { ok: true, text: res.message } }));
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [g.gateway]: { ok: false, text: e instanceof Error ? e.message : "تعذر الحفظ." },
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function onReset(g: PaymentGateway) {
    if (!confirm(`إعادة بوابة ${g.label} إلى الإعداد الافتراضي (متغيرات البيئة)؟ سيحذف ما هو محفوظ.`)) return;
    setSavingId(g.gateway);
    try {
      const res = await resetPaymentGateway(g.gateway);
      setGateways((prev) => prev!.map((x) => (x.gateway === g.gateway ? res.gateway : x)));
      setDrafts((prev) => {
        const next: Draft = {};
        for (const f of res.gateway.fields) next[f.key] = !f.secret && f.preview ? f.preview : "";
        return { ...prev, [g.gateway]: next };
      });
      setEnabledDraft((prev) => ({ ...prev, [g.gateway]: res.gateway.enabled }));
      setNotice((n) => ({ ...n, [g.gateway]: { ok: true, text: res.message } }));
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [g.gateway]: { ok: false, text: e instanceof Error ? e.message : "تعذر التنفيذ." },
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-2xl font-black text-ink">بوابات الدفع</h1>
      <p className="text-sm text-ink-soft mt-1">
        أدخل مفاتيح كل بوابة لتفعيل الدفع. المفاتيح السرية تخزن مشفرة ولا تعرض كاملة مرة أخرى — اترك
        الحقل السري فارغا للإبقاء على القيمة المحفوظة.
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

      {/* محدد البوابة (تبويبات) — يبقي الصفحة قصيرة بعرض بوابة واحدة في كل مرة */}
      {gateways && gateways.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {gateways.map((g) => {
            const isActive = active === g.gateway;
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
                <span
                  className={`h-2 w-2 rounded-full ${
                    g.available ? "bg-green-400" : isActive ? "bg-white/60" : "bg-gray-300"
                  }`}
                />
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {gateways?.filter((g) => g.gateway === active).map((g) => {
          const note = notice[g.gateway];
          const isOn = enabledDraft[g.gateway] ?? g.enabled;
          const draft = drafts[g.gateway] ?? {};
          // A required field counts as satisfied if it's already stored (DB/env)
          // or the admin just typed a value for it.
          const requiredMissing = g.fields.filter(
            (f) => f.required && !f.set && !((draft[f.key] ?? "").trim())
          );
          const blockSave = isOn && requiredMissing.length > 0;
          return (
            <section key={g.gateway} className="card p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-black text-ink">{g.label}</h2>
                    <span className="text-xs text-ink-muted">({g.region})</span>
                    {g.available ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700">
                        ● متصلة
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-500">
                        غير مهيأة
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">المصدر: {SOURCE_LABEL[g.source]}</p>
                </div>

                <div className="flex items-center gap-2.5 select-none">
                  <span className={`text-sm font-bold ${isOn ? "text-brand-700" : "text-ink-muted"}`}>
                    {isOn ? "مفعلة" : "مطفأة"}
                  </span>
                  <Switch
                    checked={isOn}
                    aria-label={`تفعيل بوابة ${g.label}`}
                    onChange={(v) =>
                      setEnabledDraft((prev) => ({ ...prev, [g.gateway]: v }))
                    }
                  />
                </div>
              </div>

              {/* تلميح يعكس وضع الزر فورا (قبل الحفظ) */}
              <div
                className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ring-1 ${
                  isOn
                    ? "bg-brand-50 text-brand-700 ring-brand-100"
                    : "bg-surface-2 text-ink-soft ring-line"
                }`}
              >
                {isOn
                  ? "البوابة مفعلة — أدخل المفاتيح المطلوبة أدناه لتصبح قابلة للاختيار من المستخدم."
                  : "البوابة مطفأة — لن تظهر كخيار دفع للمستخدمين."}
              </div>

              {blockSave && (
                <div className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                  ⚠️ لا يمكن تفعيل البوابة قبل تعبئة الحقول المطلوبة:
                  {` ${requiredMissing.map((f) => f.label).join("، ")}.`}
                </div>
              )}

              <div className={`mt-5 space-y-4 transition-opacity ${isOn ? "" : "opacity-60"}`}>
                {g.fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1.5 flex items-center gap-1 text-sm font-bold text-ink">
                      {f.label}
                      {f.required && <span className="text-red-500">*</span>}
                      {f.secret && f.set && (
                        <span className="text-xs font-normal text-ink-muted">
                          (محفوظ: {f.preview})
                        </span>
                      )}
                    </span>
                    <input
                      type={f.secret ? "password" : "text"}
                      dir="ltr"
                      autoComplete="off"
                      disabled={!isOn}
                      value={drafts[g.gateway]?.[f.key] ?? ""}
                      onChange={(e) => setField(g.gateway, f.key, e.target.value)}
                      placeholder={
                        !isOn
                          ? "فعّل البوابة أولا لإدخال المفاتيح"
                          : f.secret
                            ? f.set
                              ? "اتركه فارغا للإبقاء على القيمة الحالية"
                              : "أدخل القيمة"
                            : "أدخل القيمة"
                      }
                      className="input disabled:cursor-not-allowed disabled:bg-surface-2"
                    />
                  </label>
                ))}
              </div>

              {note && (
                <div
                  className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${
                    note.ok
                      ? "bg-green-50 text-green-700 ring-green-100"
                      : "bg-red-50 text-red-600 ring-red-100"
                  }`}
                >
                  {note.text}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onSave(g)}
                  disabled={savingId === g.gateway || blockSave}
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingId === g.gateway ? "جار الحفظ…" : "حفظ"}
                </button>
                {blockSave && (
                  <span className="text-xs font-medium text-amber-700">
                    أكمل الحقول المطلوبة لتفعيل البوابة.
                  </span>
                )}
                {g.source === "db" && (
                  <button
                    onClick={() => onReset(g)}
                    disabled={savingId === g.gateway}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    إعادة للافتراضي
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
