"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getWallet, type Wallet } from "@/lib/wallet";
import { whatsappShareUrl, twitterShareUrl, shareText } from "@/lib/share";
import { useI18n } from "@/components/LocaleProvider";
import { IconBadge, IconDownload, IconQr, IconWhatsapp, IconX } from "@/components/icons";

export default function WalletViewPage() {
  const { token } = useParams<{ token: string }>();
  const { t, locale } = useI18n();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    getWallet(token)
      .then(setWallet)
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale, { numberingSystem: "latn", dateStyle: "medium" }) : t("wallet.dash");

  const count = wallet?.certificates.length ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 lg:py-20">
          {loading ? (
            <p className="text-center text-sm text-ink-muted">{t("wallet.loading")}</p>
          ) : invalid || !wallet ? (
            <div className="card mx-auto max-w-md p-10 text-center">
              <h1 className="font-display text-xl font-black text-ink">{t("wallet.invalidTitle")}</h1>
              <p className="mt-3 text-sm text-ink-soft">{t("wallet.invalidBody")}</p>
              <Link href="/wallet" className="btn-primary mt-6 inline-flex">{t("wallet.requestNew")}</Link>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="font-display text-3xl font-black text-ink">{t("wallet.heading")}</h1>
                <p className="mt-2 text-sm text-ink-soft">
                  {count === 1 ? t("wallet.countOne") : t("wallet.count", { n: count })} · <span dir="ltr">{wallet.email}</span>
                </p>
              </div>

              {count === 0 ? (
                <p className="card p-10 text-center text-sm text-ink-muted">{t("wallet.empty")}</p>
              ) : (
                <div className="space-y-4">
                  {wallet.certificates.map((c) => {
                    const text = shareText({ recipientName: c.recipient_name, courseName: c.course_name });
                    return (
                      <div key={c.verification_code} className="card p-5">
                        <div className="flex items-start gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                            <IconBadge className="h-6 w-6" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-lg font-extrabold text-ink">{c.course_name ?? t("wallet.dash")}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {t("wallet.issuedBy")} {c.organization_name ?? t("wallet.dash")} · {t("wallet.issuedOn")} {fmtDate(c.issue_date)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {c.pdf_url && (
                            <a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                              <IconDownload className="h-4 w-4" /> {t("wallet.download")}
                            </a>
                          )}
                          <Link href={`/verify/${c.verification_code}`} target="_blank" className="btn-ghost text-sm">
                            <IconQr className="h-4 w-4" /> {t("wallet.verify")}
                          </Link>
                          <span className="ms-auto flex items-center gap-1">
                            <a href={whatsappShareUrl({ text, url: c.verify_url })} target="_blank" rel="noreferrer"
                              className="rounded-lg p-2 text-ink-soft hover:bg-surface-2" aria-label="WhatsApp">
                              <IconWhatsapp className="h-4 w-4 text-[#25d366]" />
                            </a>
                            <a href={twitterShareUrl({ text, url: c.verify_url })} target="_blank" rel="noreferrer"
                              className="rounded-lg p-2 text-ink-soft hover:bg-surface-2" aria-label="X">
                              <IconX className="h-4 w-4" />
                            </a>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
