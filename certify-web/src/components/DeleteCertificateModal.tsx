"use client";

import { useState } from "react";
import { IconTrash } from "./icons";

export function DeleteCertificateModal({
  open,
  recipientName,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  recipientName: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const matches = typed.trim() === recipientName.trim();

  function close() {
    setTyped("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={busy ? undefined : close} />
      <div className="card relative z-10 w-full max-w-md p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600">
            <IconTrash className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black text-ink">حذف الشهادة نهائياً</h2>
            <p className="text-xs text-ink-muted">لا يمكن التراجع عن هذا الإجراء</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700 ring-1 ring-red-100">
          سيُحذف سجلّ الشهادة وملفّها نهائياً ويتوقّف التحقق منها — لا يمكن استرجاعها بعد ذلك.
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            اكتب اسم المتدرّب للتأكيد: <span className="font-extrabold text-ink">{recipientName}</span>
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={recipientName}
            className="input"
          />
        </label>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={close} disabled={busy} className="btn-ghost flex-1">
            تراجع
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !matches}
            className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "جار الحذف…" : "حذف نهائي"}
          </button>
        </div>
      </div>
    </div>
  );
}
