"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";
import { IconMail, IconLock, IconGoogle, IconArrow, IconUsers, IconBadge } from "./icons";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", organizationName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <button type="button" className="btn-ghost w-full">
        <IconGoogle className="h-5 w-5" />
        التسجيل عبر Google
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
        <span className="mb-1.5 block text-sm font-bold text-ink">الاسم الكامل</span>
        <span className="relative block">
          <IconUsers className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="text" required value={form.name} onChange={update("name")} placeholder="اسمك" className="input pr-11" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">اسم المنظمة / الأكاديمية</span>
        <span className="relative block">
          <IconBadge className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="text" value={form.organizationName} onChange={update("organizationName")} placeholder="أكاديمية..." className="input pr-11" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">البريد الإلكتروني</span>
        <span className="relative block">
          <IconMail className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="email" required value={form.email} onChange={update("email")} placeholder="you@example.com" className="input pr-11" dir="ltr" />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">كلمة المرور</span>
        <span className="relative block">
          <IconLock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input type="password" required minLength={8} value={form.password} onChange={update("password")} placeholder="٨ أحرف على الأقل" className="input pr-11" dir="ltr" />
        </span>
      </label>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
        {!loading && <IconArrow className="h-4 w-4 rotate-180" />}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink-muted">
        بإنشائك حساباً فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
      </p>
    </form>
  );
}
