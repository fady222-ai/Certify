"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { requestWalletLink } from "@/lib/wallet";
import { useT } from "@/components/LocaleProvider";
import { IconBadge, IconCheck } from "@/components/icons";

export default function WalletRequestPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestWalletLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wallet.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto max-w-md px-5 py-16 lg:py-24">
          <div className="card p-8">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-verify-50 text-verify-600">
                  <IconCheck className="h-8 w-8" />
                </div>
                <h1 className="mt-5 font-display text-xl font-black text-ink">{t("wallet.sentTitle")}</h1>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("wallet.sentBody")}</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <IconBadge className="h-7 w-7" />
                  </div>
                  <h1 className="mt-4 font-display text-2xl font-black text-ink">{t("wallet.title")}</h1>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("wallet.subtitle")}</p>
                </div>

                {error && (
                  <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-100">{error}</div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("wallet.emailPh")}
                    className="input"
                    dir="ltr"
                  />
                  <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
                    {busy ? t("wallet.sending") : t("wallet.submit")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
