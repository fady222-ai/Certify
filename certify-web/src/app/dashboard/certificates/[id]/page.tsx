"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getCertificate, revokeCertificate, reactivateCertificate, deleteCertificate,
  resendCertificateEmail, type CertificateDetail,
} from "@/lib/certificates";
import { RevokeCertificateModal } from "@/components/RevokeCertificateModal";
import { DeleteCertificateModal } from "@/components/DeleteCertificateModal";
import { useI18n } from "@/components/LocaleProvider";
import {
  IconCheck, IconArrow, IconQr, IconMail, IconBan, IconTrash,
  IconDownload, IconLinkedin, IconClock, IconWhatsapp,
} from "@/components/icons";
import { whatsappShareUrl, shareText } from "@/lib/share";

export default function CertificateDetailPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
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
      flash(e instanceof Error ? e.message : t("cert.resendFailed"));
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
      flash(t("cert.revoked"));
    } catch (e) {
      flash(e instanceof Error ? e.message : t("cert.revokeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate() {
    setBusy(true);
    try {
      await reactivateCertificate(id);
      await load();
      flash(t("cert.reactivated"));
    } catch (e) {
      flash(e instanceof Error ? e.message : t("cert.reactivateFailed"));
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
      flash(e instanceof Error ? e.message : t("cert.deleteFailed"));
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">{t("cert.loading")}</div>;
  }
  if (!cert) return null;

  const revoked = cert.status === "revoked";
  const metrics = [
    { label: t("cert.metricOpens"), value: cert.opened_count, icon: IconQr, tone: "brand" },
    { label: t("cert.metricDownloads"), value: cert.downloaded_count, icon: IconDownload, tone: "verify" },
    { label: t("cert.metricShares"), value: cert.shared_count, icon: IconArrow, tone: "gold" },
    { label: t("cert.metricLinkedin"), value: cert.linkedin_added ? t("cert.yes") : t("cert.no"), icon: IconLinkedin, tone: "brand" },
  ];
  const toneMap: Record<string, string> = {
    brand: "from-brand-50 to-brand-100 text-brand-600",
    gold: "from-gold-50 to-gold-100 text-gold-600",
    verify: "from-verify-50 to-verify-100 text-verify-600",
  };

  return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Link href="/dashboard/certificates" className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft hover:text-brand-700">
          ← {t("cert.back")}
        </Link>

        {toast && (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100">{toast}</div>
        )}

        {/* Header card */}
        <div className="card overflow-hidden">
          {/* Hero — identity on an accent header */}
          <div
            className={`px-6 py-7 text-white ${
              revoked
                ? "bg-gradient-to-br from-red-500 to-red-600"
                : "bg-gradient-to-br from-brand-600 to-brand-700"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-black">
                  {cert.recipient_name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-black">{cert.recipient_name}</h1>
                  <p className="mt-0.5 text-sm opacity-80">{cert.course_name ?? t("cert.dash")}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold">
                {revoked ? (
                  <>
                    <IconBan className="h-4 w-4" /> {t("cert.statusRevoked")}
                  </>
                ) : (
                  <>
                    <IconCheck className="h-4 w-4" /> {t("cert.statusActive")}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {revoked && cert.revoked_reason && (
              <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {t("cert.revokeReason")} {cert.revoked_reason}
              </p>
            )}

            {/* Meta tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label={t("cert.metaVerifyCode")} value={cert.verification_code} mono />
              <Meta label={t("cert.metaIssueDate")} value={cert.issue_date ?? t("cert.dash")} />
              <Meta label={t("cert.metaEmail")} value={cert.recipient_email ?? t("cert.dash")} />
              <Meta label={t("cert.metaTemplate")} value={cert.template?.name ?? t("cert.defaultTemplate")} />
            </div>

            {/* Primary & share actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {cert.pdf_url && (
                <a href={cert.pdf_url} target="_blank" rel="noreferrer" className="btn-primary">
                  <IconDownload className="h-4 w-4" /> {t("cert.downloadPdf")}
                </a>
              )}
              <Link href={`/verify/${cert.verification_code}`} target="_blank" className="btn-ghost">
                <IconQr className="h-4 w-4" /> {t("cert.verifyPage")}
              </Link>
              {!revoked && (
                <a
                  href={whatsappShareUrl({
                    text: shareText({ recipientName: cert.recipient_name, courseName: cert.course_name }),
                    url:
                      typeof window !== "undefined"
                        ? `${window.location.origin}/verify/${cert.verification_code}`
                        : `/verify/${cert.verification_code}`,
                    phone: cert.recipient_phone,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  <IconWhatsapp className="h-4 w-4 text-[#25d366]" /> {t("cert.sendWhatsapp")}
                </a>
              )}
              {cert.recipient_email && !revoked && (
                <button onClick={onResend} disabled={busy} className="btn-ghost disabled:opacity-60">
                  <IconMail className="h-4 w-4" /> {t("cert.resendEmail")}
                </button>
              )}
            </div>

            {/* Sensitive actions — visually separated */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
              <span className="text-xs font-bold text-ink-muted">{t("cert.sensitiveActions")}</span>
              {revoked ? (
                <button onClick={onReactivate} disabled={busy}
                  className="btn inline-flex items-center gap-2 border border-verify-200 bg-verify-50 text-verify-700 hover:bg-verify-100 disabled:opacity-60">
                  <IconCheck className="h-4 w-4" /> {t("cert.reactivateCert")}
                </button>
              ) : (
                <button onClick={() => setRevokeOpen(true)} disabled={busy}
                  className="btn inline-flex items-center gap-2 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60">
                  <IconBan className="h-4 w-4" /> {t("cert.revokeCert")}
                </button>
              )}
              <button onClick={() => setDeleteOpen(true)} disabled={busy}
                className="btn ms-auto inline-flex items-center gap-2 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60">
                <IconTrash className="h-4 w-4" /> {t("cert.deletePermanent")}
              </button>
            </div>
          </div>
        </div>

        {/* Engagement metrics */}
        <div>
          <h2 className="mb-3 font-display text-lg font-extrabold text-ink">{t("cert.engagementMetrics")}</h2>
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
        </div>

        {/* Event timeline */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("cert.activityLog")}</h2>
            <span className="text-xs text-ink-muted">{t("cert.last5")}</span>
          </div>
          {cert.events.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">{t("cert.noActivity")}</p>
          ) : (
            <ul className="px-6 py-2">
              {cert.events.map((e, i) => {
                const { Icon, cls } = eventVisual(e.type);
                const last = i === cert.events.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    {/* الأيقونة + خط الزمن العمودي */}
                    <div className="flex flex-col items-center">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${cls}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {!last && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className={`min-w-0 flex-1 ${last ? "pb-2" : "pb-5"} pt-1`}>
                      <p className="text-sm font-bold text-ink">{t(`cert.events.${e.type}`)}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {new Date(e.at).toLocaleString(locale, { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  </li>
                );
              })}
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

// Distinct icon + color per activity-log event type (replaces the generic clock).
function eventVisual(type: string): { Icon: typeof IconClock; cls: string } {
  switch (type) {
    case "issued":
    case "reactivated":
      return { Icon: IconCheck, cls: "bg-verify-50 text-verify-600" };
    case "opened":
      return { Icon: IconQr, cls: "bg-brand-50 text-brand-600" };
    case "downloaded":
      return { Icon: IconDownload, cls: "bg-verify-50 text-verify-600" };
    case "shared":
      return { Icon: IconArrow, cls: "bg-gold-50 text-gold-600" };
    case "added_to_linkedin":
      return { Icon: IconLinkedin, cls: "bg-brand-50 text-[#0a66c2]" };
    case "emailed":
      return { Icon: IconMail, cls: "bg-brand-50 text-brand-600" };
    case "revoked":
      return { Icon: IconBan, cls: "bg-red-50 text-red-500" };
    default:
      return { Icon: IconClock, cls: "bg-surface-2 text-ink-soft" };
  }
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-4 py-3">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold text-ink ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}
