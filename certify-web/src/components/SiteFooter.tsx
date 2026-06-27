"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useT } from "@/components/LocaleProvider";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="border-t bg-surface-2/60">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">{t("footer.tagline")}</p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">{t("footer.product")}</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><a href="/#features" className="hover:text-brand-700">{t("footer.features")}</a></li>
              <li><a href="/#pricing" className="hover:text-brand-700">{t("footer.pricing")}</a></li>
              <li><Link href="/help" className="hover:text-brand-700">{t("footer.help")}</Link></li>
              <li><Link href="/support" className="hover:text-brand-700">{t("footer.contact")}</Link></li>
              <li><Link href="/verify" className="hover:text-brand-700">{t("footer.verify")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">{t("footer.account")}</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><Link href="/login" className="hover:text-brand-700">{t("footer.loginLink")}</Link></li>
              <li><Link href="/register" className="hover:text-brand-700">{t("footer.register")}</Link></li>
              <li><Link href="/wallet" className="hover:text-brand-700">{t("footer.wallet")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-extrabold text-ink">{t("footer.legal")}</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><Link href="/terms" className="hover:text-brand-700">{t("footer.terms")}</Link></li>
              <li><Link href="/privacy" className="hover:text-brand-700">{t("footer.privacy")}</Link></li>
              <li><Link href="/refund" className="hover:text-brand-700">{t("footer.refund")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-ink-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Certify · {t("footer.rights")}</span>
          <span className="flex items-center gap-1.5">
            {t("footer.madeWith")}
            <span className="text-gold-500">★</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
