import { IconShield } from "@/components/icons";

export type LegalSection = { h: string; p: string[] };

/** Shared layout for the static legal pages (terms / privacy / refund). */
export function LegalDoc({
  title,
  chip,
  sections,
  intro,
  disclaimer,
}: {
  title: string;
  chip: string;
  sections: LegalSection[];
  intro?: string;
  disclaimer: string;
}) {
  return (
    <main className="mesh-bg flex-1">
      <div className="absolute inset-0 dot-grid opacity-40" />
      <div className="relative mx-auto max-w-3xl px-5 py-16 lg:py-24">
        <div className="text-center">
          <span className="chip"><IconShield className="h-4 w-4" /> {chip}</span>
          <h1 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">{title}</h1>
          {intro && <p className="mt-4 text-lg text-ink-soft">{intro}</p>}
        </div>

        <article className="mt-12 space-y-8">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl font-black text-ink">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-ink-soft">{para}</p>
              ))}
            </section>
          ))}
        </article>

        <p className="mt-12 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100">
          {disclaimer}
        </p>
      </div>
    </main>
  );
}
