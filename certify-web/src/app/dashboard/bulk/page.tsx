"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, authedFetch } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { getOrganization } from "@/lib/organization";
import { getBilling } from "@/lib/billing";
import { IconUpload, IconCheck, IconArrow } from "@/components/icons";

type BatchStatus = {
  id: string;
  name: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export default function BulkPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [defaultTemplateName, setDefaultTemplateName] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ batchId: string; total: number } | null>(null);

  const [batches, setBatches] = useState<BatchStatus[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  // null = still loading the entitlement; false = plan can't bulk (show upgrade).
  const [canBulk, setCanBulk] = useState<boolean | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      const res = await authedFetch("batches");
      const data = await res.json();
      setBatches(data.data ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    Promise.all([getOrganization(), listTemplates().catch(() => [])])
      .then(([org, templates]) => {
        const id = org.default_template_id ?? null;
        setDefaultTemplateId(id);
        setDefaultTemplateName(templates.find((t) => t.id === id)?.name ?? null);
      })
      .catch(() => {});
    getBilling()
      .then((b) => setCanBulk(b.plan?.has_bulk_issuance ?? false))
      .catch(() => setCanBulk(false));
    loadBatches();
  }, [router, loadBatches]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("يرجى اختيار ملف."); return; }
    if (!defaultTemplateId) { setError("اختر قالباً أولاً قبل إصدار الشهادات."); return; }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (batchName) fd.append("name", batchName);
      if (courseName) fd.append("courseName", courseName);
      fd.append("templateId", defaultTemplateId);

      const res = await authedFetch("batches", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "تعذّر الرفع.");
      setSubmitted({ batchId: data.batchId, total: data.total });
      loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ.");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setBatchName("");
    setCourseName("");
    setError(null);
    setSubmitted(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
      <main className="mx-auto max-w-3xl space-y-8 p-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">الإصدار الجماعي</h1>
          <p className="mt-1 text-sm text-ink-soft">ارفع ملف Excel أو CSV يحتوي على أسماء المتدربين وسيتم إصدار الشهادات تلقائياً.</p>
        </div>

        {/* Upgrade gate — bulk issuance is a paid feature */}
        {canBulk === false ? (
          <div className="card p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconUpload className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">الإصدار الجماعي ميزة مدفوعة</h2>
            <p className="mt-2 text-sm text-ink-soft">
              باقتك الحالية لا تتيح الإصدار الجماعي. رقِّ إلى Pro أو Business لإصدار مئات الشهادات من ملف واحد.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/dashboard/billing" className="btn-primary">
                ترقية الباقة <IconArrow className="inline h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : submitted ? (
          <div className="card p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-verify-50 text-verify-600">
              <IconCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-black text-ink">جارٍ المعالجة!</h2>
            <p className="mt-2 text-sm text-ink-soft">
              تم استلام الدفعة بنجاح. سيتم إصدار <span className="font-bold text-ink">{submitted.total}</span> شهادة في الخلفية.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={reset} className="btn-ghost">رفع دفعة جديدة</button>
              <Link href={`/dashboard/bulk/${submitted.batchId}`} className="btn-primary">
                متابعة الدفعة <IconArrow className="inline h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition ${
                dragOver
                  ? "border-brand-500 bg-brand-50"
                  : file
                  ? "border-verify-400 bg-verify-50"
                  : "border-surface-3 hover:border-brand-400 hover:bg-brand-50/40"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <IconCheck className="h-10 w-10 text-verify-500" />
                  <p className="mt-3 font-bold text-ink">{file.name}</p>
                  <p className="mt-1 text-xs text-ink-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="mt-3 text-xs font-bold text-red-500 hover:underline">
                    إزالة الملف
                  </button>
                </>
              ) : (
                <>
                  <IconUpload className="h-10 w-10 text-ink-soft" />
                  <p className="mt-3 font-bold text-ink">اسحب الملف هنا أو انقر للاختيار</p>
                  <p className="mt-1 text-xs text-ink-muted">Excel (.xlsx، .xls) أو CSV — بحد أقصى 500 صف</p>
                </>
              )}
            </div>

            {/* Template hint */}
            <div className="rounded-xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
              <strong>هيكل الملف المطلوب:</strong> عمود <code>name</code> أو <code>recipient_name</code> (مطلوب) ·
              عمود <code>email</code> (اختياري) · عمود <code>course_name</code> (اختياري)
            </div>

            {/* Fields */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">اسم الدفعة (اختياري)</span>
              <input value={batchName} onChange={(e) => setBatchName(e.target.value)}
                placeholder="مثال: ورشة التسويق — يناير 2026" className="input" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">اسم الدورة الافتراضي (اختياري)</span>
              <input value={courseName} onChange={(e) => setCourseName(e.target.value)}
                placeholder="يُستخدم إذا لم يكن في الملف" className="input" />
            </label>

            {defaultTemplateId ? (
              <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-4 py-3 text-sm">
                <span className="text-ink-soft">
                  القالب: <span className="font-bold text-ink">{defaultTemplateName ?? "القالب الافتراضي"}</span>
                </span>
                <Link href="/dashboard/templates" className="text-xs font-bold text-brand-600 hover:underline">
                  تغيير القالب
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
                <span>🎨 لم تعيّن قالباً افتراضياً بعد — عيّنه أولاً لإصدار الشهادات.</span>
                <Link href="/dashboard/templates" className="whitespace-nowrap font-extrabold text-amber-900 hover:underline">
                  اختيار قالب ←
                </Link>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <button type="submit" disabled={uploading || !file || !defaultTemplateId} className="btn-primary w-full disabled:opacity-60">
              <IconUpload className="h-4 w-4" />
              {uploading ? "جارٍ الرفع…" : "رفع وإصدار الشهادات"}
            </button>
          </form>
        )}

        {/* Previous batches */}
        <div className="card overflow-hidden">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-extrabold text-ink">الدفعات السابقة</h2>
          </div>
          {loadingBatches ? (
            <p className="px-6 py-8 text-center text-sm text-ink-muted">جارٍ التحميل…</p>
          ) : batches.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ink-soft">لا توجد دفعات بعد.</p>
          ) : (
            <div className="divide-y">
              {batches.map((b) => (
                <Link key={b.id} href={`/dashboard/bulk/${b.id}`}
                  className="flex items-center justify-between px-6 py-4 transition hover:bg-surface-2/60">
                  <div>
                    <p className="font-bold text-ink">{b.name}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(b.createdAt).toLocaleDateString("ar-SA")} · {b.totalCount} شهادة
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.status === "completed" && (
                      <span className="flex items-center gap-1.5 rounded-full bg-verify-50 px-3 py-1 text-xs font-bold text-verify-700">
                        <IconCheck className="h-3.5 w-3.5" /> مكتملة
                      </span>
                    )}
                    {b.status === "processing" && (
                      <span className="rounded-full bg-gold-50 px-3 py-1 text-xs font-bold text-gold-700">
                        جارٍ المعالجة
                      </span>
                    )}
                    {b.status === "failed" && (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                        فشلت
                      </span>
                    )}
                    <span className="text-xs text-ink-muted">
                      {b.successCount}/{b.totalCount} ✓
                    </span>
                    <IconArrow className="h-4 w-4 text-ink-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
  );
}
