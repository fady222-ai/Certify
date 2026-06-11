"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { IconMail, IconLock, IconGoogle, IconArrow } from "./icons";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile = await login({ email, password });
      router.push(profile.user?.is_admin ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <button type="button" className="btn-ghost w-full">
        <IconGoogle className="h-5 w-5" />
        المتابعة عبر Google
      </button>

      <div className="flex items-center gap-3 py-1 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        أو بالبريد الإلكتروني
        <span className="h-px flex-1 bg-line" />
      </div>

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
          <a href="#" className="text-xs font-bold text-brand-600 hover:underline">نسيت كلمة المرور؟</a>
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
