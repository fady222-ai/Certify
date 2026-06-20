"use client";

import { useEffect, useState } from "react";
import { getStoredUser, refreshProfile, setupMfa, enableMfa, disableMfa } from "@/lib/auth";
import { IconLock, IconCheck, IconShield } from "@/components/icons";

type Phase = "idle" | "setup" | "done";

export default function AdminSecurityPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [qr, setQr] = useState<{ qr_data_url: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(!!getStoredUser()?.user?.mfa_enabled);
  }, []);

  async function startSetup() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await setupMfa();
      setQr({ qr_data_url: res.qr_data_url, secret: res.secret });
      setPhase("setup");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { backup_codes } = await enableMfa(code.trim());
      setBackupCodes(backup_codes);
      setCode("");
      setQr(null);
      setPhase("done");
      await refreshProfile();
      setEnabled(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    const c = prompt("أدخل رمزا من تطبيق المصادقة (أو رمز احتياطي) لتعطيل المصادقة الثنائية:");
    if (!c) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await disableMfa(c.trim());
      await refreshProfile();
      setEnabled(false);
      setPhase("idle");
      setBackupCodes(null);
      setNotice("تم تعطيل المصادقة الثنائية.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-black text-ink">
        <IconLock className="h-6 w-6 text-brand-600" /> أمان الحساب
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        المصادقة الثنائية (TOTP) تضيف طبقة حماية لحسابك الإداري — يطلب رمز من تطبيق
        مصادقة بعد كلمة المرور عند كل تسجيل دخول.
      </p>

      {error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</div>}
      {notice && <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700 ring-1 ring-green-100">{notice}</div>}

      <section className="card mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${enabled ? "bg-green-50 text-green-600" : "bg-surface-2 text-ink-muted"}`}>
              <IconShield className="h-6 w-6" />
            </span>
            <div>
              <p className="font-bold text-ink">المصادقة الثنائية</p>
              <p className="text-xs font-bold">
                {enabled === null ? "…" : enabled
                  ? <span className="text-green-700">● مفعلة</span>
                  : <span className="text-ink-muted">غير مفعلة</span>}
              </p>
            </div>
          </div>
          {enabled
            ? <button onClick={turnOff} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60">تعطيل</button>
            : phase === "idle" && <button onClick={startSetup} disabled={busy} className="btn-primary">{busy ? "…" : "تفعيل"}</button>}
        </div>

        {/* خطوة الإعداد: QR + تأكيد */}
        {phase === "setup" && qr && (
          <form onSubmit={confirmEnable} className="mt-6 border-t pt-6">
            <p className="text-sm font-bold text-ink">1) امسح رمز QR بتطبيق مصادقة (Google Authenticator، Authy…)</p>
            <div className="mt-3 flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qr_data_url} alt="رمز QR للمصادقة الثنائية" className="h-44 w-44 rounded-lg ring-1 ring-line" />
              <p className="text-xs text-ink-muted">أو أدخل السر يدويا:</p>
              <code dir="ltr" className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-bold tracking-wider text-ink">{qr.secret}</code>
            </div>
            <p className="mt-5 text-sm font-bold text-ink">2) أدخل الرمز المعروض في التطبيق للتأكيد</p>
            <input
              type="text" inputMode="numeric" maxLength={6} required dir="ltr" autoComplete="one-time-code"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="input mt-2 text-center text-2xl font-black tracking-widest"
            />
            <div className="mt-4 flex gap-3">
              <button type="submit" disabled={busy || code.length < 6} className="btn-primary disabled:opacity-60">
                {busy ? "جار التفعيل…" : "تأكيد وتفعيل"}
              </button>
              <button type="button" onClick={() => { setPhase("idle"); setQr(null); setCode(""); }} className="btn-ghost">إلغاء</button>
            </div>
          </form>
        )}

        {/* عرض رموز الاحتياط مرة واحدة */}
        {phase === "done" && backupCodes && (
          <div className="mt-6 border-t pt-6">
            <p className="flex items-center gap-1.5 text-sm font-bold text-green-700">
              <IconCheck className="h-4 w-4" /> تم تفعيل المصادقة الثنائية.
            </p>
            <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-sm font-bold text-amber-800">احفظ رموز الاحتياط الآن — تعرض مرة واحدة فقط:</p>
              <div dir="ltr" className="mt-3 grid grid-cols-2 gap-2">
                {backupCodes.map((c) => (
                  <code key={c} className="rounded-lg bg-white px-3 py-1.5 text-center text-sm font-bold tracking-wider text-ink ring-1 ring-amber-200">{c}</code>
                ))}
              </div>
              <p className="mt-3 text-xs text-amber-700">كل رمز يستخدم مرة واحدة لاستعادة الدخول إن فقدت جهازك.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
