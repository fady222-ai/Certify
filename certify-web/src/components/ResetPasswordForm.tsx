"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import { IconLock, IconArrow } from "./icons";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError("رابط الاستعادة غير صالح. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.");
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
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
        <span className="mb-1.5 block text-sm font-bold text-ink">كلمة المرور الجديدة</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="٨ أحرف على الأقل"
            className="input pr-11"
            dir="ltr"
            autoFocus
          />
        </span>
        <p className="mt-1 text-xs text-ink-muted">٨ أحرف على الأقل.</p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">تأكيد كلمة المرور</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="input pr-11"
            dir="ltr"
          />
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !token}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? "جارٍ الحفظ…" : "حفظ كلمة المرور الجديدة"}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>
    </form>
  );
}
