"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { register, verifyEmail, resendOtp, getToken, getStoredUser } from "@/lib/auth";
import { useT } from "@/components/LocaleProvider";
import { IconMail, IconLock, IconArrow, IconUsers, IconBadge } from "./icons";

export function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", organizationName: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Already-authenticated guard: if a session exists, bounce to the dashboard
  // (or admin) instead of showing the form. Starts true to avoid flashing the
  // form before the localStorage check resolves.
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (getToken()) {
      router.replace(getStoredUser()?.user.is_admin ? "/admin" : "/dashboard");
      return;
    }
    setRedirecting(false);
  }, [router]);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await register(form);
      setUserId(result.userId);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    } finally {
      setLoading(false);
    }
  }

  async function onOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyEmail(userId!, otp.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
      setLoading(false);
    }
  }

  async function onResend() {
    if (!userId) return;
    setError(null);
    setInfo(null);
    try {
      await resendOtp(userId);
      setInfo(t("auth.otp.resent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
    }
  }

  if (redirecting) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "otp") {
    return (
      <form className="space-y-4" onSubmit={onOtpSubmit}>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 ring-1 ring-blue-100">
          {t("auth.register.otpSentTo", { email: form.email })}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-100">
            {info}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.otp.code")}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="input text-center text-2xl font-black tracking-widest"
            dir="ltr"
            autoFocus
          />
        </label>

        <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full disabled:opacity-60">
          {loading ? t("auth.otp.verifying") : t("auth.otp.activate")}
          {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
        </button>

        <p className="text-center text-xs text-ink-muted">
          {t("auth.otp.didntReceive")}{" "}
          <button type="button" onClick={onResend} className="font-bold text-brand-600 hover:underline">
            {t("auth.otp.resend")}
          </button>
          {" · "}
          <button type="button" onClick={() => { setStep("form"); setError(null); }} className="text-ink-muted hover:underline">
            {t("auth.register.editEmail")}
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onRegisterSubmit}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.register.name")}</span>
        <span className="relative block">
          <IconUsers className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="text" required value={form.name} onChange={update("name")} placeholder={t("auth.register.namePh")} className="input ps-11" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.register.org")}</span>
        <span className="relative block">
          <IconBadge className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="text" required minLength={2} value={form.organizationName} onChange={update("organizationName")} placeholder={t("auth.register.orgPh")} className="input ps-11" />
        </span>
        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
          {t("auth.register.orgWarning")}
        </p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.register.email")}</span>
        <span className="relative block">
          <IconMail className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="email" required value={form.email} onChange={update("email")} placeholder="you@example.com" className="input ps-11" dir="ltr" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.register.password")}</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="password" required minLength={8} value={form.password} onChange={update("password")} placeholder={t("auth.register.passwordPh")} className="input ps-11" dir="ltr" />
        </span>
        <p className="mt-1 text-xs text-ink-muted">{t("auth.register.passwordHint")}</p>
      </label>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? t("auth.register.creating") : t("auth.register.create")}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink-muted">
        {t("auth.register.terms")}
      </p>
    </form>
  );
}
