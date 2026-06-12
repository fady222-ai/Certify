"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, verifyEmail, resendOtp } from "@/lib/auth";
import { IconMail, IconLock, IconArrow } from "./icons";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, password });
      if ("requires_verification" in result) {
        setUserId(result.userId);
        setStep("otp");
        setLoading(false);
        return;
      }
      router.push(result.user?.is_admin ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
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
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
      setLoading(false);
    }
  }

  async function onResend() {
    if (!userId) return;
    setError(null);
    setInfo(null);
    try {
      await resendOtp(userId);
      setInfo("تم إرسال رمز جديد إلى بريدك الإلكتروني.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
    }
  }

  if (step === "otp") {
    return (
      <form className="space-y-4" onSubmit={onOtpSubmit}>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 ring-1 ring-blue-100">
          بريدك الإلكتروني لم يُفعَّل بعد. تم إرسال رمز تحقق جديد إلى{" "}
          <strong className="font-bold">{email}</strong>.
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
          <span className="mb-1.5 block text-sm font-bold text-ink">رمز التحقق</span>
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
          {loading ? "جارٍ التحقق…" : "تفعيل الحساب"}
          {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
        </button>

        <p className="text-center text-xs text-ink-muted">
          لم تستلم الرمز؟{" "}
          <button type="button" onClick={onResend} className="font-bold text-brand-600 hover:underline">
            أعد الإرسال
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onLoginSubmit}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">البريد الإلكتروني</span>
        <span className="relative block">
          <IconMail className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input pr-11"
            dir="ltr"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-ink">
          كلمة المرور
          <Link href="/forgot-password" className="text-xs font-bold text-brand-600 hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input pr-11"
            dir="ltr"
          />
        </span>
      </label>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "جارٍ الدخول…" : "تسجيل الدخول"}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>
    </form>
  );
}
