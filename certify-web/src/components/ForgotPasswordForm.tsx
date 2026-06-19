"use client";

import { useState } from "react";
import { forgotPassword } from "@/lib/auth";
import { IconMail, IconArrow } from "./icons";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 px-4 py-5 text-center ring-1 ring-green-100">
          <p className="text-2xl">✅</p>
          <p className="mt-2 font-bold text-green-800">تم الإرسال!</p>
          <p className="mt-1 text-sm text-green-700">
            إن كان البريد مسجلا، ستصلك رسالة استعادة خلال دقائق. تحقق من صندوق الوارد والبريد
            غير المرغوب فيه.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
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
            autoFocus
          />
        </span>
      </label>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "جار الإرسال…" : "إرسال رابط الاستعادة"}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>
    </form>
  );
}
