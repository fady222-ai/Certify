"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useT } from "@/components/LocaleProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function SiteHeader() {
  const t = useT();
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-bold text-ink-soft md:flex">
          <a href="/#features" className="transition hover:text-brand-700">{t("header.features")}</a>
          <a href="/#how" className="transition hover:text-brand-700">{t("header.how")}</a>
          <a href="/#pricing" className="transition hover:text-brand-700">{t("header.pricing")}</a>
          <Link href="/verify" className="transition hover:text-brand-700">{t("header.verifyCert")}</Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">{t("header.login")}</Link>
          <Link href="/register" className="btn-primary">{t("header.startFree")}</Link>
        </div>
      </div>
    </header>
  );
}
