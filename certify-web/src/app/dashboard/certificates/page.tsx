"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getToken, authedFetch } from "@/lib/auth";
import {
  IconBadge, IconCheck, IconArrow, IconSearch, IconBan, IconDownload, IconMail,
} from "@/components/icons";

type Certificate = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  course_name: string | null;
  verification_code: string;
  status: string;
  pdf_url: string | null;
  issue_date: string | null;
};

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
  const [revoking, setRevoking] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status) qs.set("status", status);
      const res = await authedFetch(`certificates?${qs.toString()}`);
      const data = await res.json();
      setCerts(data.data ?? []);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [search, status, router]);

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
      setToast(res.ok ? data.message : data.message ?? "تعذّر الإرسال.");
    } catch {
      setToast("تعذّر الإرسال.");
    } finally {
      setResending(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function revoke(id: string) {
    const reason = prompt("سبب الإلغاء (اختياري):") ?? "";
    if (reason === null) return;
    setRevoking(id);
    try {
      await authedFetch(`certificates/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      load();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface-2/40">
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-sm font-bold text-ink-muted sm:inline">/ الشهادات</span>
        </div>
        <Link href="/dashboard" className="btn-ghost">لوحة التحكم</Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">إدارة الشهادات</h1>
          <p className="mt-1 text-sm text-ink-soft">ابحث عن الشهادات الصادرة وتحقق منها أو ألغِها.</p>
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، البريد، الدورة، أو رمز التحقق…"
              className="input pr-11"
            />
          </div>
          <div className="flex gap-1.5 rounded-xl bg-white p-1 ring-1 ring-surface-3">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setStatus(f.key)}
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
            <p className="px-6 py-12 text-center text-sm text-ink-muted">جارٍ التحميل…</p>
          ) : certs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <IconBadge className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm text-ink-soft">
                {search || status ? "لا توجد نتائج مطابقة." : "لم تُصدر أي شهادة بعد."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {certs.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-surface-2/60">
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
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {c.status === "revoked" ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">ملغاة</span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-verify-50 px-3 py-1 text-xs font-bold text-verify-700">
                        <IconCheck className="h-3.5 w-3.5" /> نشطة
                      </span>
                    )}
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer"
                        className="hidden rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-brand-700 sm:inline-flex" title="تحميل PDF">
                        <IconDownload className="h-4 w-4" />
                      </a>
                    )}
                    {c.recipient_email && c.status !== "revoked" && (
                      <button onClick={() => resend(c.id)} disabled={resending === c.id}
                        className="hidden rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-brand-700 disabled:opacity-50 sm:inline-flex" title="إعادة إرسال البريد">
                        <IconMail className="h-4 w-4" />
                      </button>
                    )}
                    <Link href={`/verify/${c.verification_code}`} target="_blank"
                      className="text-sm font-bold text-brand-700 hover:underline">
                      تحقق <IconArrow className="inline h-3.5 w-3.5" />
                    </Link>
                    {c.status !== "revoked" && (
                      <button onClick={() => revoke(c.id)} disabled={revoking === c.id}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="إلغاء الشهادة">
                        <IconBan className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
