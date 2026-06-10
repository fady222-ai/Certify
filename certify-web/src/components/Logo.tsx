import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-[0_8px_20px_rgba(79,70,229,0.35)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="9" r="5" />
          <path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5" />
          <path d="M12 7v2M10.5 8.5l3 .5" stroke="#fcd34d" />
        </svg>
        <span className="absolute -bottom-1 -left-1 h-3.5 w-3.5 rounded-full bg-gold-400 ring-2 ring-white" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold text-ink">سرتفاي</span>
        <span className="text-[10px] font-bold tracking-widest text-ink-muted">CERTIFY</span>
      </span>
    </Link>
  );
}
