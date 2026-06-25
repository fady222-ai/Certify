"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { IconBan } from "./icons";

export function RevokeCertificateModal({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const t = useT();
  const [reason, setReason] = useState("");

  if (!open) return null;

  function close() {
    setReason("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={busy ? undefined : close} />
      <div className="card relative z-10 w-full max-w-md p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600">
            <IconBan className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black text-ink">{t("cert.revokeModal.title")}</h2>
            <p className="text-xs text-ink-muted">{t("cert.revokeModal.subtitle")}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-700 ring-1 ring-amber-100">
          {t("cert.revokeModal.warning")}
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-bold text-ink">{t("cert.revokeModal.reasonLabel")}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("cert.revokeModal.reasonPh")}
            maxLength={500}
            className="input min-h-24"
          />
        </label>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={close} disabled={busy} className="btn-ghost flex-1">
            {t("cert.revokeModal.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy}
            className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? t("cert.revokeModal.revoking") : t("cert.revokeModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
