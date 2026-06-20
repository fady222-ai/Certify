"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  listMyTickets, createTicket, getMyTicket, replyTicket, closeTicket,
  STATUS_LABELS, type SupportTicket, type TicketDetail, type TicketStatus,
} from "@/lib/support";
import { IconMail, IconArrow, IconCheck } from "@/components/icons";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-brand-50 text-brand-700",
  answered: "bg-verify-50 text-verify-700",
  closed: "bg-surface-2 text-ink-muted",
};

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleString("ar", { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" });
}

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listMyTickets();
      setTickets(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function openTicket(id: string) {
    setError(null);
    try {
      setSelected(await getMyTicket(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await createTicket(subject.trim(), body.trim());
      setSubject(""); setBody(""); setCreating(false);
      flash("تم إرسال تذكرتك. سيرد فريق الدعم قريبا.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await replyTicket(selected.ticket.id, reply.trim());
      setReply("");
      await openTicket(selected.ticket.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onClose() {
    if (!selected) return;
    setBusy(true);
    try {
      await closeTicket(selected.ticket.id);
      await openTicket(selected.ticket.id);
      await load();
      flash("تم إغلاق التذكرة.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
            <IconMail className="h-6 w-6 text-brand-600" /> الدعم الفني
          </h1>
          <p className="mt-1 text-sm text-ink-soft">افتح تذكرة وسيتواصل معك فريق الدعم.</p>
        </div>
        {!selected && (
          <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? "إلغاء" : "تذكرة جديدة"}
          </button>
        )}
      </div>

      {toast && (
        <div className="mb-4 rounded-xl bg-verify-50 px-4 py-3 text-sm font-bold text-verify-700">{toast}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>
      )}

      {/* تفاصيل التذكرة */}
      {selected ? (
        <div className="card p-5">
          <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
            <IconArrow className="h-4 w-4 rotate-180" /> رجوع للقائمة
          </button>
          <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
            <h2 className="text-lg font-extrabold text-ink">{selected.ticket.subject}</h2>
            <StatusBadge status={selected.ticket.status} />
          </div>

          <div className="space-y-3">
            {selected.messages.map((m) => (
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

          {selected.ticket.status !== "closed" ? (
            <form onSubmit={submitReply} className="mt-5 border-t pt-4">
              <textarea
                className="input min-h-24" placeholder="اكتب ردك…" value={reply}
                onChange={(e) => setReply(e.target.value)} required maxLength={5000}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">إغلاق التذكرة</button>
                <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">إرسال الرد</button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink-muted">
                <IconCheck className="h-4 w-4" /> هذه التذكرة مغلقة. لمتابعة الأمر افتح تذكرة جديدة.
              </p>
              <button
                className="btn-primary"
                onClick={() => { setSelected(null); setCreating(true); }}
              >
                تذكرة جديدة
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* نموذج تذكرة جديدة */}
          {creating && (
            <form onSubmit={submitNew} className="card mb-6 space-y-3 p-5">
              <input
                className="input" placeholder="الموضوع" value={subject}
                onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={200}
              />
              <textarea
                className="input min-h-32" placeholder="صف مشكلتك أو سؤالك بالتفصيل…" value={body}
                onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={5000}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="btn-primary">إرسال</button>
              </div>
            </form>
          )}

          {/* قائمة التذاكر */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-10 text-center text-ink-soft">
              <IconMail className="mx-auto mb-3 h-10 w-10 text-ink-muted" />
              <p className="font-bold">لا توجد تذاكر بعد</p>
              <p className="mt-1 text-sm">افتح تذكرة جديدة وسيرد عليك فريق الدعم.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id} onClick={() => openTicket(t.id)}
                  className="card card-lift flex w-full items-center justify-between gap-3 p-4 text-right"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">آخر تحديث: {fmt(t.last_message_at)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
