"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  listMyTickets, createTicket, getMyTicket, replyTicket,
  type SupportTicket, type TicketDetail, type TicketStatus,
} from "@/lib/support";
import { useI18n, useT } from "@/components/LocaleProvider";
import { IconMail, IconArrow, IconCheck } from "@/components/icons";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-brand-50 text-brand-700",
  closed: "bg-surface-2 text-ink-muted",
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const tr = useT();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      {status === "closed" ? tr("support.statusClosed") : tr("support.statusOpen")}
    </span>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const fmt = (d: string) =>
    new Date(d).toLocaleString(locale, { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" });
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
      flash(t("support.sent"));
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
            <IconMail className="h-6 w-6 text-brand-600" /> {t("support.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t("support.subtitle")}</p>
        </div>
        {!selected && (
          <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? t("support.cancel") : t("support.newTicket")}
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
            <IconArrow className="h-4 w-4 rotate-180" /> {t("support.backToList")}
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
                    {m.author_role === "admin" ? t("support.admin") : t("support.you")} · {fmt(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            ))}
          </div>

          {selected.ticket.status !== "closed" ? (
            <form onSubmit={submitReply} className="mt-5 border-t pt-4">
              <textarea
                className="input min-h-24" placeholder={t("support.replyPh")} value={reply}
                onChange={(e) => setReply(e.target.value)} required maxLength={5000}
              />
              <div className="mt-3 flex items-center justify-end gap-3">
                <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">{t("support.sendReply")}</button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink-muted">
                <IconCheck className="h-4 w-4" /> {t("support.closedNote")}
              </p>
              <button
                className="btn-primary"
                onClick={() => { setSelected(null); setCreating(true); }}
              >
                {t("support.newTicket")}
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
                className="input" placeholder={t("support.subjectPh")} value={subject}
                onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={200}
              />
              <textarea
                className="input min-h-32" placeholder={t("support.bodyPh")} value={body}
                onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={5000}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="btn-primary">{t("support.send")}</button>
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
              <p className="font-bold">{t("support.noTicketsTitle")}</p>
              <p className="mt-1 text-sm">{t("support.noTicketsBody")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((tk) => (
                <button
                  key={tk.id} onClick={() => openTicket(tk.id)}
                  className="card card-lift flex w-full items-center justify-between gap-3 p-4 text-start"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{tk.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{t("support.lastUpdate")} {fmt(tk.last_message_at)}</p>
                  </div>
                  <StatusBadge status={tk.status} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
