"use client";

import type { Analytics } from "@/lib/certificates";
import { useI18n } from "@/components/LocaleProvider";

function monthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short", numberingSystem: "latn" });
}

/** Lightweight, dependency-free analytics: monthly issuance bars + top courses. */
export function AnalyticsPanel({ data }: { data: Analytics }) {
  const { t, locale } = useI18n();
  const maxMonthly = Math.max(1, ...data.monthly.map((m) => m.count));
  const totalSixMonths = data.monthly.reduce((s, m) => s + m.count, 0);
  const maxCourse = Math.max(1, ...data.top_courses.map((c) => c.count));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Monthly issuance */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-ink">{t("dash.analyticsMonthly")}</h2>
          <span className="text-xs text-ink-muted">{t("dash.countCerts", { n: totalSixMonths })}</span>
        </div>
        <div className="mt-6 flex h-40 items-end justify-between gap-2">
          {data.monthly.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-bold text-ink-soft">{m.count}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                style={{ height: `${Math.max(4, (m.count / maxMonthly) * 120)}px` }}
                title={t("dash.countCerts", { n: m.count })}
              />
              <span className="text-[11px] text-ink-muted">{monthLabel(m.month, locale)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top courses */}
      <div className="card p-6">
        <h2 className="font-display text-lg font-extrabold text-ink">{t("dash.analyticsTopCourses")}</h2>
        {data.top_courses.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-muted">{t("dash.analyticsNoData")}</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {data.top_courses.map((c, i) => (
              <li key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-bold text-ink">{c.course}</span>
                  <span className="shrink-0 ps-2 text-ink-muted">{c.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gold-500" style={{ width: `${(c.count / maxCourse) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
