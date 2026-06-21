"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, authedFetch } from "@/lib/auth";
import { revokeCertificate, reactivateCertificate, deleteCertificate } from "@/lib/certificates";
import { RevokeCertificateModal } from "@/components/RevokeCertificateModal";
import { DeleteCertificateModal } from "@/components/DeleteCertificateModal";
import {
  IconBadge, IconCheck, IconSearch, IconBan, IconDownload, IconMail, IconShield, IconTrash, IconWhatsapp,
} from "@/components/icons";
import { whatsappShareUrl, shareText } from "@/lib/share";

type Certificate = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  course_name: string | null;
  verification_code: string;
  status: string;
  pdf_url: string | null;
  issue_date: string | null;
};

/** Owner-side "send to trainee via WhatsApp" link (uses the trainee phone if present). */
function waSend(c: Certificate): string {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${c.verification_code}`
      : `/verify/${c.verification_code}`;
  const text = shareText({ recipientName: c.recipient_name, courseName: c.course_name });
  return whatsappShareUrl({ text, url, phone: c.recipient_phone });
}

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "active", label: "نشطة" },
  { key: "revoked", label: "ملغاة" },
];

export default function CertificatesPage() {
  const router = useRouter();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status) qs.set("status", status);
      qs.set("page", String(page));
      const res = await authedFetch(`certificates?${qs.toString()}`);
      const data = await res.json();
      setCerts(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [search, status, page, router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced reload on search/status changes
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function resend(id: string) {
    setResending(id);
    setToast(null);
    try {
      const res = await authedFetch(`certificates/${id}/resend-email`, { method: "POST" });
      const data = await res.json();
      setToast(res.ok ? data.message : data.message ?? "تعذر الإرسال.");
    } catch {
      setToast("تعذر الإرسال.");
    } finally {
      setResending(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function confirmRevoke(reason: string) {
    if (!revokeTarget) return;
    const id = revokeTarget;
    setRevoking(id);
    try {
      await revokeCertificate(id, reason);
      setRevokeTarget(null);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "تعذر الإلغاء.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRevoking(null);
    }
  }

  async function reactivate(id: string) {
    setReactivating(id);
    setToast(null);
    try {
      await reactivateCertificate(id);
      setToast("تمت إعادة تفعيل الشهادة.");
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "تعذرت إعادة التفعيل.");
    } finally {
      setReactivating(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setToast(null);
    try {
      await deleteCertificate(deleteTarget.id);
      setDeleteTarget(null);
      setToast("تم حذف الشهادة.");
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "تعذر الحذف.");
    } finally {
      setDeleting(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">إدارة الشهادات</h1>
          <p className="mt-1 text-sm text-ink-soft">ابحث عن الشهادات الصادرة وتحقق منها أو ألغها.</p>
        </div>

        {toast && (
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
            {toast}
          </div>
        )}

        {/* Search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم، البريد، الدورة، أو رمز التحقق…"
              className="input pr-11"
            />
          </div>
          <div className="flex gap-1.5 rounded-xl bg-white p-1 ring-1 ring-surface-3">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => { setStatus(f.key); setPage(1); }}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  status === f.key ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-surface-2"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="card overflow-hidden">
          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-ink-muted">جار التحميل…</p>
          ) : certs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <IconBadge className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm text-ink-soft">
                {search || status ? "لا توجد نتائج مطابقة." : "لم تصدر أي شهادة بعد."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {certs.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-6 py-4 transition hover:bg-surface-2/60">
                  {/* وسم الحالة — أقصى اليمين */}
                  {c.status === "revoked" ? (
                    <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">ملغاة</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-verify-50 px-3 py-1 text-xs font-bold text-verify-700">
                      <IconCheck className="h-3.5 w-3.5" /> نشطة
                    </span>
                  )}
                  <Link href={`/dashboard/certificates/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display font-black ${
                      c.status === "revoked" ? "bg-red-50 text-red-400" : "bg-brand-50 text-brand-600"
                    }`}>
                      {c.recipient_name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink hover:text-brand-700">{c.recipient_name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {c.course_name ?? "—"} · <span className="font-mono">{c.verification_code}</span>
                      </p>
                    </div>
                  </Link>
                  {/* مجموعة أيقونات الإجراءات — يساراً */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer"
                        className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-brand-700" title="تحميل PDF">
                        <IconDownload className="h-4 w-4" />
                      </a>
                    )}
                    {c.recipient_email && c.status !== "revoked" && (
                      <button onClick={() => resend(c.id)} disabled={resending === c.id}
                        className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-brand-700 disabled:opacity-50" title="إعادة إرسال البريد">
                        <IconMail className="h-4 w-4" />
                      </button>
                    )}
                    <Link href={`/verify/${c.verification_code}`} target="_blank"
                      className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-brand-700" title="صفحة التحقق">
                      <IconShield className="h-4 w-4" />
                    </Link>
                    {c.status !== "revoked" && (
                      <a href={waSend(c)} target="_blank" rel="noreferrer"
                        className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-[#25d366]" title="إرسال عبر واتساب">
                        <IconWhatsapp className="h-4 w-4" />
                      </a>
                    )}
                    {c.status === "revoked" ? (
                      <button onClick={() => reactivate(c.id)} disabled={reactivating === c.id}
                        className="rounded-lg p-2 text-verify-600 hover:bg-verify-50 disabled:opacity-50" title="إعادة تفعيل الشهادة">
                        <IconCheck className="h-4 w-4" />
                      </button>
                    ) : (
                      <button onClick={() => setRevokeTarget(c.id)} disabled={revoking === c.id}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="إلغاء الشهادة">
                        <IconBan className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget({ id: c.id, name: c.recipient_name })}
                      className="ms-2 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600" title="حذف نهائي">
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination — only shown when results span more than one page */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-ink-muted">
              صفحة {page} من {Math.ceil(total / PAGE_SIZE)} · {total} شهادة
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg px-4 py-2 font-bold text-ink-soft ring-1 ring-surface-3 transition hover:bg-surface-2 disabled:opacity-40">
                السابق
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
                className="rounded-lg px-4 py-2 font-bold text-ink-soft ring-1 ring-surface-3 transition hover:bg-surface-2 disabled:opacity-40">
                التالي
              </button>
            </div>
          </div>
        )}

        <RevokeCertificateModal
          open={revokeTarget !== null}
          busy={revoking !== null}
          onClose={() => setRevokeTarget(null)}
          onConfirm={confirmRevoke}
        />
        <DeleteCertificateModal
          open={deleteTarget !== null}
          recipientName={deleteTarget?.name ?? ""}
          busy={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      </main>
  );
}
