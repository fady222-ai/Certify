"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { getOrganization } from "@/lib/organization";
import { IconBadge, IconCheck } from "./icons";

export function IssueCertificateModal({
  open,
  onClose,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [form, setForm] = useState({ recipientName: "", courseName: "", recipientEmail: "" });
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [defaultTemplateName, setDefaultTemplateName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReady(false);
    Promise.all([getOrganization(), listTemplates().catch(() => [])])
      .then(([org, templates]) => {
        const id = org.default_template_id ?? null;
        setDefaultTemplateId(id);
        setDefaultTemplateName(templates.find((t) => t.id === id)?.name ?? null);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [open]);

  if (!open) return null;

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!defaultTemplateId) {
      setError("اختر قالبا أولا قبل إصدار الشهادات.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authedFetch("certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, templateId: defaultTemplateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "تعذر الإصدار.");
      setDone(data.verification_code);
      onIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm({ recipientName: "", courseName: "", recipientEmail: "" });
    setError(null);
    setDone(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={reset} />
      <div className="card relative z-10 w-full max-w-md p-7">
        {done ? (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-verify-50 text-verify-600">
              <IconCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">تم إصدار الشهادة! 🎉</h2>
            <p className="mt-2 text-sm text-ink-soft">رمز التحقق:</p>
            <p className="mt-1 font-mono text-sm font-bold text-brand-700">{done}</p>
            {form.recipientEmail && (
              <p className="mt-3 text-xs text-ink-muted">📧 تم إرسال نسخة إلى {form.recipientEmail}</p>
            )}
            <div className="mt-6 flex gap-3">
              <a href={`/verify/${done}`} target="_blank" rel="noreferrer" className="btn-ghost flex-1">
                عرض صفحة التحقق
              </a>
              <button onClick={reset} className="btn-primary flex-1" type="button">تم</button>
            </div>
          </div>
        ) : !ready ? (
          <div className="py-10 text-center text-sm text-ink-muted">جار التحميل…</div>
        ) : ready && !defaultTemplateId ? (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 text-3xl">
              🎨
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">اختر قالبا أولا</h2>
            <p className="mt-2 text-sm text-ink-soft">
              لم تعين قالبا افتراضيا بعد. عين قالبا من صفحة القوالب لتبدأ بإصدار الشهادات.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={reset} className="btn-ghost flex-1" type="button">إلغاء</button>
              <Link href="/dashboard/templates" onClick={reset} className="btn-primary flex-1 justify-center">
                اذهب لاختيار قالب
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <IconBadge className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-lg font-black text-ink">إصدار شهادة جديدة</h2>
                <p className="text-xs text-ink-muted">أدخل بيانات المتدرب</p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">اسم المتدرب *</span>
                <input required value={form.recipientName} onChange={update("recipientName")} placeholder="مثال: عبدالله محمد" className="input" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">اسم الدورة</span>
                <input value={form.courseName} onChange={update("courseName")} placeholder="مثال: أساسيات التسويق الرقمي" className="input" />
              </label>
              <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-4 py-3 text-sm">
                <span className="text-ink-soft">
                  القالب: <span className="font-bold text-ink">{defaultTemplateName ?? "القالب الافتراضي"}</span>
                </span>
                <Link href="/dashboard/templates" onClick={reset} className="text-xs font-bold text-brand-600 hover:underline">
                  تغيير القالب
                </Link>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">بريد المتدرب (اختياري)</span>
                <input type="email" value={form.recipientEmail} onChange={update("recipientEmail")} placeholder="student@example.com" className="input" dir="ltr" />
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={reset} className="btn-ghost flex-1">إلغاء</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
                  {loading ? "جار الإصدار…" : "إصدار"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
