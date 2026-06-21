"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getCertificate, revokeCertificate, reactivateCertificate, deleteCertificate,
  resendCertificateEmail, eventLabel, type CertificateDetail,
} from "@/lib/certificates";
import { RevokeCertificateModal } from "@/components/RevokeCertificateModal";
import { DeleteCertificateModal } from "@/components/DeleteCertificateModal";
import {
  IconCheck, IconArrow, IconQr, IconMail, IconBan, IconTrash,
  IconDownload, IconLinkedin, IconClock,
} from "@/components/icons";

export default function CertificateDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setCert(await getCertificate(id));
    } catch {
      router.push("/dashboard/certificates");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function onResend() {
    setBusy(true);
    try {
      const r = await resendCertificateEmail(id);
      flash(r.message);
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر الإرسال.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(reason: string) {
    setBusy(true);
    try {
      await revokeCertificate(id, reason);
      setRevokeOpen(false);
      await load();
      flash("تم إلغاء الشهادة.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر الإلغاء.");
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate() {
    setBusy(true);
    try {
      await reactivateCertificate(id);
      await load();
      flash("تمت إعادة تفعيل الشهادة.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذرت إعادة التفعيل.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteCertificate(id);
      router.push("/dashboard/certificates");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذر الحذف.");
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">جار التحميل…</div>;
  }
  if (!cert) return null;

  const revoked = cert.status === "revoked";
  const metrics = [
    { label: "مرات الفتح", value: cert.opened_count, icon: IconQr, tone: "brand" },
    { label: "التحميلات", value: cert.downloaded_count, icon: IconDownload, tone: "verify" },
    { label: "المشاركات", value: cert.shared_count, icon: IconArrow, tone: "gold" },
    { label: "لينكدإن", value: cert.linkedin_added ? "نعم" : "لا", icon: IconLinkedin, tone: "brand" },
  ];
  const toneMap: Record<string, string> = {
    brand: "from-brand-50 to-brand-100 text-brand-600",
    gold: "from-gold-50 to-gold-100 text-gold-600",
    verify: "from-verify-50 to-verify-100 text-verify-600",
  };

  return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Link href="/dashboard/certificates" className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-brand-700">
          ← رجوع للشهادات
        </Link>

        {toast && (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100">{toast}</div>
        )}

        {/* Header card */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl font-display text-2xl font-black ${
                revoked ? "bg-red-50 text-red-400" : "bg-brand-50 text-brand-600"
              }`}>
                {cert.recipient_name.charAt(0)}
              </span>
              <div>
                <h1 className="font-display text-2xl font-black text-ink">{cert.recipient_name}</h1>
                <p className="mt-0.5 text-sm text-ink-muted">{cert.course_name ?? "—"}</p>
              </div>
            </div>
            {revoked ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-600">ملغاة</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-verify-50 px-3 py-1 text-sm font-bold text-verify-700">
                <IconCheck className="h-4 w-4" /> نشطة
              </span>
            )}
          </div>

          {revoked && cert.revoked_reason && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              سبب الإلغاء: {cert.revoked_reason}
            </p>
          )}

          {/* Meta grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta label="رمز التحقق" value={cert.verification_code} mono />
            <Meta label="تاريخ الإصدار" value={cert.issue_date ?? "—"} />
            <Meta label="البريد" value={cert.recipient_email ?? "—"} />
            <Meta label="القالب" value={cert.template?.name ?? "الافتراضي"} />
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            {cert.pdf_url && (
              <a href={cert.pdf_url} target="_blank" rel="noreferrer" className="btn-primary">
                <IconDownload className="h-4 w-4" /> تحميل PDF
              </a>
            )}
            <Link href={`/verify/${cert.verification_code}`} target="_blank" className="btn-ghost">
              <IconQr className="h-4 w-4" /> صفحة التحقق
            </Link>
            {cert.recipient_email && !revoked && (
              <button onClick={onResend} disabled={busy} className="btn-ghost disabled:opacity-60">
                <IconMail className="h-4 w-4" /> إعادة إرسال البريد
              </button>
            )}
            {revoked ? (
              <button onClick={onReactivate} disabled={busy}
                className="btn inline-flex items-center gap-2 border border-verify-200 bg-verify-50 text-verify-700 hover:bg-verify-100 disabled:opacity-60">
                <IconCheck className="h-4 w-4" /> إعادة تفعيل الشهادة
              </button>
            ) : (
              <button onClick={() => setRevokeOpen(true)} disabled={busy}
                className="btn inline-flex items-center gap-2 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60">
                <IconBan className="h-4 w-4" /> إلغاء الشهادة
              </button>
            )}
            <button onClick={() => setDeleteOpen(true)} disabled={busy}
              className="btn inline-flex items-center gap-2 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60">
              <IconTrash className="h-4 w-4" /> حذف نهائي
            </button>
          </div>
        </div>

        {/* Engagement metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-ink-soft">{m.label}</p>
                  <p className="mt-2 font-display text-3xl font-black text-ink">{m.value}</p>
                </div>
                <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${toneMap[m.tone]}`}>
                  <m.icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Event timeline */}
        <div className="card overflow-hidden">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-extrabold text-ink">سجل النشاط</h2>
          </div>
          {cert.events.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ink-muted">لا يوجد نشاط بعد.</p>
          ) : (
            <ul className="divide-y">
              {cert.events.map((e, i) => (
                <li key={i} className="flex items-center gap-3 px-6 py-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft">
                    <IconClock className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">{eventLabel(e.type)}</span>
                  <span className="text-xs text-ink-muted">
                    {new Date(e.at).toLocaleString("ar", { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <RevokeCertificateModal
          open={revokeOpen}
          busy={busy}
          onClose={() => setRevokeOpen(false)}
          onConfirm={onRevoke}
        />
        <DeleteCertificateModal
          open={deleteOpen}
          recipientName={cert.recipient_name}
          busy={busy}
          onClose={() => setDeleteOpen(false)}
          onConfirm={onDelete}
        />
      </main>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold text-ink ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}
