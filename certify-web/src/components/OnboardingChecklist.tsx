"use client";

import Link from "next/link";
import { IconCheck, IconArrow } from "@/components/icons";
import { useT } from "@/components/LocaleProvider";

export type OnboardingStep = {
  key: string;
  label: string;
  desc: string;
  done: boolean;
  href?: string;
  onClick?: () => void;
  cta: string;
};

/**
 * First-run setup checklist shown on the dashboard overview until every step is
 * done. Steps are derived from real org data (branding, template, first issue),
 * so it self-hides once the org is fully set up.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const t = useT();
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null; // fully set up → nothing to show

  // The first not-yet-done step is the one we nudge the user toward.
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-extrabold text-ink">{t("dash.onboardTitle")}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{t("dash.onboardSubtitle")}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
          {done} / {steps.length}
        </span>
      </div>

      {/* progress bar */}
      <div className="h-1.5 w-full bg-surface-2">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>

      <ul className="divide-y">
        {steps.map((s) => {
          const isNext = s.key === nextKey;
          return (
            <li key={s.key} className="flex items-center gap-3 px-6 py-4">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                s.done ? "bg-verify-500 text-white" : "bg-surface-2 text-ink-muted"
              }`}>
                {s.done ? <IconCheck className="h-4 w-4" /> : <span className="text-xs font-black">{steps.indexOf(s) + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-bold ${s.done ? "text-ink-muted line-through" : "text-ink"}`}>{s.label}</p>
                {!s.done && <p className="text-xs text-ink-soft">{s.desc}</p>}
              </div>
              {!s.done && (
                s.href ? (
                  <Link href={s.href} className={isNext ? "btn-primary" : "btn-ghost"}>
                    {s.cta} <IconArrow className="h-4 w-4" />
                  </Link>
                ) : (
                  <button onClick={s.onClick} className={isNext ? "btn-primary" : "btn-ghost"}>
                    {s.cta} <IconArrow className="h-4 w-4" />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
