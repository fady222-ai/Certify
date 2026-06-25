"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { useT } from "@/components/LocaleProvider";
import { IconLock, IconArrow } from "./icons";

export function ResetPasswordForm() {
  const t = useT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError(t("auth.reset.invalidLink"));
  }, [token, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"));
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.reset.newPassword")}</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.reset.passwordHint")}
            className="input ps-11"
            dir="ltr"
            autoFocus
          />
        </span>
        <p className="mt-1 text-xs text-ink-muted">{t("auth.reset.passwordHint")}</p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">{t("auth.reset.confirmPassword")}</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="input ps-11"
            dir="ltr"
          />
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !token}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? t("auth.reset.saving") : t("auth.reset.save")}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>
    </form>
  );
}
