"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getGuestTicket, replyGuestTicket, STATUS_LABELS, type TicketDetail } from "@/lib/support";
import { IconMail } from "@/components/icons";

function fmt(d: string) {
  return new Date(d).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
}

export default function GuestTicketPage() {
  const { token } = useParams<{ token: string }>();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await getGuestTicket(token));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await replyGuestTicket(token, reply.trim());
      setReply("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-14">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : notFound || !detail ? (
          <div className="card p-10 text-center text-ink-soft">
            <IconMail className="mx-auto mb-3 h-10 w-10 text-ink-muted" />
            <p className="font-bold text-ink">الطلب غير موجود</p>
            <p className="mt-1 text-sm">قد يكون الرابط غير صحيح أو منتهياً.</p>
            <Link href="/support" className="btn-primary mt-5 inline-flex">إرسال طلب جديد</Link>
          </div>
        ) : (
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
              <h1 className="text-lg font-extrabold text-ink">{detail.ticket.subject}</h1>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                {STATUS_LABELS[detail.ticket.status]}
              </span>
            </div>

            <div className="space-y-3">
              {detail.messages.map((m) => (
                <div key={m.id} className={`flex ${m.author_role === "admin" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.author_role === "admin" ? "bg-surface-2 text-ink" : "bg-brand-600 text-white"}`}>
                    <p className="mb-1 text-[11px] font-bold opacity-70">
                      {m.author_role === "admin" ? "فريق الدعم" : "أنت"} · {fmt(m.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>
            )}

            {detail.ticket.status === "closed" ? (
              <div className="mt-5 flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-ink-muted">هذا الطلب مغلق. لمتابعة الأمر أرسل طلباً جديداً.</p>
                <Link href="/support" className="btn-primary">إرسال طلب جديد</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 border-t pt-4">
                <textarea
                  className="input min-h-24" placeholder="اكتب ردّك…" value={reply}
                  onChange={(e) => setReply(e.target.value)} required maxLength={5000}
                />
                <div className="mt-3 flex justify-end">
                  <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">إرسال الردّ</button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
