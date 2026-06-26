"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getToken, authedFetch } from "@/lib/auth";
import { useI18n, useT } from "@/components/LocaleProvider";
import { IconCheck, IconArrow } from "@/components/icons";

type BatchDetail = {
  id: string;
  name: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  certificates: {
    id: string;
    recipientName: string;
    recipientEmail: string | null;
    courseName: string | null;
    verificationCode: string;
    status: string;
    pdfUrl: string | null;
  }[];
};

export default function BatchDetailPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(`batches/${id}`);
      if (!res.ok) { router.push("/dashboard/bulk"); return; }
      setBatch(await res.json());
    } catch {
      router.push("/dashboard/bulk");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  // Poll while processing
  useEffect(() => {
    if (!batch || batch.status !== "processing") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [batch, load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-muted">{t("batch.loading")}</p>
      </div>
    );
  }

  if (!batch) return null;

  const pct = batch.totalCount > 0 ? Math.round((batch.successCount / batch.totalCount) * 100) : 0;

  return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Link href="/dashboard/bulk" className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-brand-700">
          ← {t("batch.back")}
        </Link>

        {/* Summary */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-black text-ink">{batch.name}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {new Date(batch.createdAt).toLocaleDateString(locale, { numberingSystem: "latn", dateStyle: "long" })}
                {batch.completedAt && (
                  <> · {t("batch.completedAt", { time: new Date(batch.completedAt).toLocaleTimeString(locale, { numberingSystem: "latn", timeStyle: "short" }) })}</>
                )}
              </p>
            </div>
            <StatusBadge status={batch.status} />
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-bold text-ink">{t("batch.progress", { success: batch.successCount, total: batch.totalCount })}</span>
              <span className="text-ink-muted">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {batch.failedCount > 0 && (
              <p className="mt-2 text-xs font-bold text-red-500">
                {t("batch.failedCount", { n: batch.failedCount })}
              </p>
            )}
          </div>
        </div>

        {/* Certificate list */}
        <div className="card overflow-hidden">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("batch.issuedCerts")}</h2>
          </div>
          {batch.certificates.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">{t("batch.noneIssued")}</p>
          ) : (
            <div className="divide-y">
              {batch.certificates.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-6 py-4 transition hover:bg-surface-2/60">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 font-display font-black text-brand-600">
                      {c.recipientName.charAt(0)}
                    </span>
                    <div>
                      <p className="font-bold text-ink">{c.recipientName}</p>
                      <p className="text-xs text-ink-muted">{c.courseName ?? t("batch.dash")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-xs text-ink-muted sm:inline">{c.verificationCode}</span>
                    <span className="flex items-center gap-1 rounded-full bg-verify-50 px-2.5 py-0.5 text-xs font-bold text-verify-700">
                      <IconCheck className="h-3 w-3" /> {t("batch.active")}
                    </span>
                    <Link href={`/verify/${c.verificationCode}`} target="_blank"
                      className="text-sm font-bold text-brand-700 hover:underline">
                      {t("batch.verify")} <IconArrow className="inline h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useT();
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-verify-50 px-3 py-1 text-sm font-bold text-verify-700">
        <IconCheck className="h-4 w-4" /> {t("batch.statusCompleted")}
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="rounded-full bg-gold-50 px-3 py-1 text-sm font-bold text-gold-700 animate-pulse">
        {t("batch.statusProcessing")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-600">{t("batch.statusFailed")}</span>
  );
}
