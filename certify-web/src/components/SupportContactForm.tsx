"use client";

import { useState } from "react";
import Link from "next/link";
import { createGuestTicket } from "@/lib/support";
import { IconCheck } from "@/components/icons";

export function SupportContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ token: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await createGuestTicket({
        name: name.trim(), email: email.trim(), subject: subject.trim(), body: body.trim(),
      });
      setDone({ token: res.public_token });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-verify-50 text-verify-600">
          <IconCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold text-ink">تم استلام رسالتك</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          أرسلنا رابط متابعة طلبك إلى بريدك الإلكتروني. يمكنك أيضاً متابعة المحادثة مباشرةً من هنا.
        </p>
        <Link href={`/support/ticket/${done.token}`} className="btn-primary mt-5 inline-flex">
          متابعة طلبي
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-xl space-y-3 p-6 sm:p-8">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="input" placeholder="الاسم" value={name}
          onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120}
        />
        <input
          className="input" type="email" placeholder="البريد الإلكتروني" value={email}
          onChange={(e) => setEmail(e.target.value)} required maxLength={160}
        />
      </div>
      <input
        className="input" placeholder="الموضوع" value={subject}
        onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={200}
      />
      <textarea
        className="input min-h-36" placeholder="كيف يمكننا مساعدتك؟" value={body}
        onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={5000}
      />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "جارٍ الإرسال…" : "إرسال"}
      </button>
      <p className="text-center text-xs text-ink-muted">
        سيصلك رابط لمتابعة طلبك على بريدك — لا حاجة لإنشاء حساب.
      </p>
    </form>
  );
}
