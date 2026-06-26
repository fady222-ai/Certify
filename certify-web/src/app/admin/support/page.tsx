"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminListTickets, adminGetTicket, adminReplyTicket, adminCloseTicket,
  type SupportTicket, type TicketDetail, type TicketStatus,
} from "@/lib/support";
import { IconMail, IconArrow, IconSearch } from "@/components/icons";
import { useI18n } from "@/components/LocaleProvider";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-brand-50 text-brand-700",
  closed: "bg-surface-2 text-ink-muted",
};

const STATUS_KEY: Record<TicketStatus, string> = {
  open: "admin.support.statusOpen",
  closed: "admin.support.statusClosed",
};

export default function AdminSupportPage() {
  const { t: tr, locale } = useI18n();
  const fmt = (d: string) =>
    new Date(d).toLocaleString(locale, { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" });
  const FILTERS: { key: "" | TicketStatus; label: string }[] = [
    { key: "", label: tr("admin.support.filterAll") },
    { key: "open", label: tr("admin.support.filterOpen") },
    { key: "closed", label: tr("admin.support.filterClosed") },
  ];
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | TicketStatus>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListTickets({
        status: status || undefined,
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setTickets(res.data);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(id: string) {
    setError(null);
    try {
      setSelected(await adminGetTicket(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await adminReplyTicket(selected.ticket.id, reply.trim());
      setReply("");
      await openTicket(selected.ticket.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      await adminCloseTicket(selected.ticket.id);
      await openTicket(selected.ticket.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-extrabold text-ink">
        <IconMail className="h-6 w-6 text-brand-600" /> {tr("admin.support.title")}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">{tr("admin.support.subtitle")}</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>
      )}

      {selected ? (
        <div className="card p-5">
          <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
            <IconArrow className="h-4 w-4 rotate-180" /> {tr("admin.support.back")}
          </button>

          <div className="mb-4 border-b pb-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-ink">{selected.ticket.subject}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[selected.ticket.status]}`}>
                {tr(STATUS_KEY[selected.ticket.status])}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {selected.ticket.requester.kind === "guest" ? tr("admin.support.guest") : tr("admin.support.user")}: {selected.ticket.requester.name ?? "—"}
              {selected.ticket.requester.email ? ` · ${selected.ticket.requester.email}` : ""}
            </p>
          </div>

          <div className="space-y-3">
            {selected.messages.map((m) => (
              <div key={m.id} className={`flex ${m.author_role === "admin" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.author_role === "admin" ? "bg-brand-600 text-white" : "bg-surface-2 text-ink"}`}>
                  <p className="mb-1 text-[11px] font-bold opacity-70">
                    {m.author_role === "admin" ? tr("admin.support.supportTeam") : tr("admin.support.customer")} · {fmt(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            ))}
          </div>

          {selected.ticket.status === "closed" ? (
            <p className="mt-5 flex items-center gap-1.5 border-t pt-4 text-sm font-bold text-ink-muted">
              {tr("admin.support.ticketClosed")}
            </p>
          ) : (
            <form onSubmit={submitReply} className="mt-5 border-t pt-4">
              <textarea
                className="input min-h-24" placeholder={tr("admin.support.replyPh")} value={reply}
                onChange={(e) => setReply(e.target.value)} required maxLength={5000}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={closeSelected} disabled={busy} className="btn-ghost text-red-600">
                  {tr("admin.support.closeTicket")}
                </button>
                <button type="submit" disabled={busy || !reply.trim()} className="btn-primary">{tr("admin.support.sendReply")}</button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <IconSearch className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                className="input pe-9" placeholder={tr("admin.support.searchPh")} value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key} onClick={() => { setStatus(f.key); setPage(1); }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    status === f.key ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-soft hover:bg-brand-50"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-10 text-center text-ink-soft">
              <IconMail className="mx-auto mb-3 h-10 w-10 text-ink-muted" />
              <p className="font-bold">{tr("admin.support.noTickets")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id} onClick={() => openTicket(ticket.id)}
                  className="card card-lift flex w-full items-center justify-between gap-3 p-4 text-start"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{ticket.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {ticket.requester.kind === "guest" ? tr("admin.support.guest") : tr("admin.support.user")}: {ticket.requester.name ?? "—"}
                      {ticket.requester.email ? ` · ${ticket.requester.email}` : ""} · {fmt(ticket.last_message_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[ticket.status]}`}>
                    {tr(STATUS_KEY[ticket.status])}
                  </span>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tr("admin.support.prev")}</button>
              <span className="text-sm text-ink-soft">{page} / {totalPages}</span>
              <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{tr("admin.support.next")}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
